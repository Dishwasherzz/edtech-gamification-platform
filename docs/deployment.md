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
`SEED_DEMO_DATA=true` также добавляет три демонстрационные темы и испытания.
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
Фронтенд уже входит в опубликованное приложение. Reverse proxy направляет на контейнер все пути одного origin,
включая `/`, `/js`, `/style.css` и `/api`; отдельный контейнер фронтенда не требуется.

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

## Автодеплой на Ubuntu

После проверок коммита в `main` GitHub Actions публикует образ в GHCR с тегом коммита и тегом `main`. Ubuntu скачивает его по HTTPS каждые пять минут. Сборка выполняется на GitHub. Для VDS ТПУ первоначальную установку можно выполнить по SSH с компьютера кампуса.

На VDS должны быть Docker Engine, плагин Compose, Git и curl. Настрой DNS и HTTPS-прокси для имени, выданного ТПУ. Прокси направляет запросы на `127.0.0.1:5244` при стандартном порте API и задаёт `Host`, `X-Forwarded-Proto` и `X-Forwarded-For`. На прокси перезаписывай входящие заголовки `X-Forwarded-*` значениями из соединения. Порт API в Compose привязан к loopback.

```bash
sudo git clone https://github.com/Dishwasherzz/edtech-gamification-platform.git /opt/edtech-gamification-platform
cd /opt/edtech-gamification-platform
sudo test -e deploy/.env || sudo install -m 0600 deploy/.env.example deploy/.env
sudoedit deploy/.env
```

Если репозиторий уже размещён по этому пути, обнови его и сохрани существующий `deploy/.env`. Для уже запущенного Compose используй прежние имя проекта и параметры базы, чтобы подключить существующие тома. В `deploy/.env` задай новый случайный пароль для **новой** БД, `ASPNETCORE_ENVIRONMENT=Production` и `SEED_DEMO_DATA=false`. Для регистрации и восстановления передай утверждённый текст согласия и почтовые параметры. [Настройки аккаунтов](analyst-integration.md#настройки-запуска).

Первый пакет GHCR может быть закрытым. Сделай его публичным в настройках пакета или выполни `sudo docker login ghcr.io` с токеном чтения пакетов. Сервис запускается от root и использует его Docker-конфигурацию. [Доступ к GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

```bash
sudo install -m 0644 deploy/edtech-deploy.service deploy/edtech-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start edtech-deploy.service
sudo systemctl enable --now edtech-deploy.timer
sudo journalctl -u edtech-deploy.service -n 50 --no-pager
curl --fail http://127.0.0.1:5244/health/ready
```

При обновлении скрипт фиксирует digest образа, останавливает API, делает резервную копию БД, применяет миграции, загружает учебный пакет и запускает API. Проверка `/health/ready` завершает обновление. Повтор запуска с той же рабочей версией проходит без перезапуска. Резервные копии находятся в `/var/lib/edtech-deploy`. Копии старше 14 дней убираются после успешного обновления, последний снимок сохраняется.

При ошибке смотри журнал сервиса и логи контейнера. Для ручного восстановления останови таймер через `sudo systemctl stop edtech-deploy.timer`. Версию API и состояние базы восстанавливай совместно по журналу и резервной копии. Изменения самих файлов Compose, скрипта или systemd обновляются на сервере отдельно.
