#!/usr/bin/env bash
set -euo pipefail
umask 077

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ ! -f .env ]]; then
    echo 'Create deploy/.env before starting automatic deployment.' >&2
    exit 1
fi

state_dir="${EDTECH_STATE_DIR:-/var/lib/edtech-deploy}"
mkdir -p -- "$state_dir"
exec 9>"$state_dir/update.lock"
flock -n 9 || exit 0

repository=ghcr.io/dishwasherzz/edtech-gamification-platform
channel="$repository:main"
compose=(docker compose --env-file .env -f compose.yml -f compose.release.yml --profile app)
docker pull "$channel"

# Use the same immutable version for migration and application startup.
digests=$(docker image inspect "$channel" --format '{{range .RepoDigests}}{{println .}}{{end}}')
export EDTECH_IMAGE
EDTECH_IMAGE=$(printf '%s\n' "$digests" | grep -m1 -F "$repository@sha256:")
revision="${EDTECH_IMAGE##*@sha256:}"

is_ready() {
    local address
    address=$("${compose[@]}" port api 8080) || return 1
    curl --fail --silent --max-time 3 "http://$address/health/ready" >/dev/null
}

api_id=$("${compose[@]}" ps -q api)
if [[ -n "$api_id" ]] && [[ $(docker inspect --format '{{.Config.Image}}' "$api_id") == "$EDTECH_IMAGE" ]] && is_ready; then
    echo "Already running $EDTECH_IMAGE"
    exit 0
fi

"${compose[@]}" up -d --wait --wait-timeout 120 --pull missing postgres
backup="$state_dir/before-$revision.dump"
if [[ ! -f "$backup" ]]; then
    temporary=$(mktemp "$state_dir/backup.XXXXXXXX")
    trap 'rm -f -- "$temporary"' EXIT
    "${compose[@]}" stop api
    if ! "${compose[@]}" exec -T postgres sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$temporary" ||
       ! "${compose[@]}" exec -T postgres pg_restore --list <"$temporary" >/dev/null; then
        if [[ -n "$api_id" ]]; then docker start "$api_id" >/dev/null; fi
        echo 'Database backup failed. Migration was skipped.' >&2
        exit 1
    fi
    mv -- "$temporary" "$backup"
    trap - EXIT
else
    "${compose[@]}" stop api
fi

"${compose[@]}" run --rm --no-deps -T --pull never migrate
"${compose[@]}" up -d --no-deps --no-build --pull never api
for (( attempt = 0; attempt < 30; attempt++ )); do
    if is_ready; then
        find "$state_dir" -maxdepth 1 -type f -name 'before-*.dump' ! -name "${backup##*/}" -mtime +14 -delete
        echo "Deployed $EDTECH_IMAGE"
        exit 0
    fi
    sleep 2
done

echo "Readiness check failed for $EDTECH_IMAGE. Database backup: $backup" >&2
exit 1
