# Docker и сервер Ubuntu

Эти настройки запускают отдельную контейнерную базу `edtech`.
Основная локальная база `EducationGamePlatform` на порту `5434` описана в [local-database.md](local-database.md).
Команды выполняются из корня репозитория.

## Только PostgreSQL в Docker, API в Rider

Нужны .NET SDK 10 и Docker Desktop с Linux containers:
[установка Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/).

```powershell
Copy-Item deploy/.env.example deploy/.env
```

В `deploy/.env` заменить `POSTGRES_PASSWORD` на случайный пароль из букв и цифр без `;`.
Файл исключён из Git. Затем:

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yml -f deploy/compose.local.yml up -d postgres
dotnet restore EducationGamePlatform.sln --locked-mode
dotnet tool restore
dotnet user-secrets set "ConnectionStrings:Database" "Host=localhost;Port=5433;Database=edtech;Username=edtech;Password=YOUR_LOCAL_PASSWORD" --project src/EducationGamePlatform/EducationGamePlatform.csproj
dotnet run --project src/EducationGamePlatform/EducationGamePlatform.csproj --launch-profile http -- --migrate --seed-demo
dotnet run --project src/EducationGamePlatform/EducationGamePlatform.csproj --launch-profile http
```

Использовать пароль из `deploy/.env` и актуальные порт, имя БД и пользователя.
Если существует `appsettings.Local.json`, обновить или убрать его: в Development он приоритетнее user-secrets.

## API и PostgreSQL вместе в Docker

После создания `deploy/.env`:

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app ps -a
```

Профиль `app` запускает PostgreSQL, одноразовую миграцию и API.
API начинает работу после успешной миграции; завершение `migrate` с кодом 0 нормально.
`SEED_DEMO_DATA=true` также добавляет демонстрационную лекцию.
База доступна контейнерам; API опубликован на `127.0.0.1:5244`.

Для локальной проверки в примере стоит Development. Для публикации поставить
`ASPNETCORE_ENVIRONMENT=Production`, `SEED_DEMO_DATA=false` и HTTPS reverse proxy.
В Production auth-cookie передаются только по HTTPS.

## Ubuntu

На ПК и сервере используются независимые настройки подключения.
На сервере нужен Docker Engine и Compose:
[официальная инструкция](https://docs.docker.com/engine/install/ubuntu/).

```bash
git clone https://github.com/Dishwasherzz/edtech-gamification-platform.git
cd edtech-gamification-platform
cp deploy/.env.example deploy/.env
# В deploy/.env: новый пароль, Production, SEED_DEMO_DATA=false.
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app up -d --build
curl --fail http://127.0.0.1:5244/health/ready
```

HTTPS reverse proxy (Nginx или Caddy) должен направлять API на `127.0.0.1:5244`.
Фронтенд удобно отдавать на том же origin и проксировать `/api` в контейнер.

Данные PostgreSQL и ключи cookie хранятся в именованных томах. Для PostgreSQL 18
том монтируется в `/var/lib/postgresql`, как требует [официальный образ](https://hub.docker.com/_/postgres).
Обычный `down` сохраняет тома; параметр `-v` удаляет БД и ключи.

Перед обновлением сделать резервную копию, остановить API, выполнить миграции и запустить API:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app build
mkdir -p backups
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backups/edtech.sql
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app stop api
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app run --rm migrate
docker compose --env-file deploy/.env -f deploy/compose.yml --profile app up -d api
```

Бэкапы хранить вне контейнерных томов и проверять восстановление.
Раздельные роли миграций/API, университетский вход и восстановление пароля через почту — последующий этап.
