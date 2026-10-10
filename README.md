# edtech-gamification-platform

Бэкенд образовательной платформы по электротехнике с элементами геймификации.
Стек: C#, ASP.NET Core / .NET 10, EF Core 10, PostgreSQL 18.

## Что входит в первый этап

- Регистрация, вход и выход через ASP.NET Core Identity и защищённые cookie.
- Профиль текущего пользователя с XP и монетами.
- Чтение опубликованных курсов, тем и лекций; личная отметка о чтении.
- 14 предметных сущностей, связи, ограничения БД и первая миграция.
- Повторяемая загрузка одной демонстрационной темы с лекцией.
- OpenAPI, проверки состояния приложения и БД.
- Dockerfile, Docker Compose и проверка на GitHub Actions.
- Интеграционные тесты с настоящим PostgreSQL.

Бой, таймеры, проверка ответов и выдача наград — следующий этап: модели уже есть,
но их операции ещё не реализованы. XP и монеты новых пользователей равны нулю;
чтение лекции наград не даёт. Магазин, лабораторный симулятор, кабинет преподавателя
и фронтенд в этот коммит не входят.

## Локальная разработка на Windows: Rider + PostgreSQL в Docker

Нужны .NET SDK 10 и Docker Desktop с Linux containers. Открыть `EducationGamePlatform.sln` в Rider.
Docker Desktop устанавливается отдельно: [официальная инструкция](https://docs.docker.com/desktop/setup/install/windows-install/).

В PowerShell в папке проекта:

```powershell
Copy-Item .env.example .env
```

В `.env` заменить `POSTGRES_PASSWORD` на случайный пароль, удобно использовать случайную
строку из букв и цифр без `;`. `.env` исключён из Git. Затем:

```powershell
docker compose -f compose.yml -f compose.local.yml up -d postgres
dotnet restore EducationGamePlatform.sln --locked-mode
dotnet tool restore
dotnet user-secrets set "ConnectionStrings:Database" "Host=localhost;Port=5433;Database=edtech;Username=edtech;Password=YOUR_LOCAL_PASSWORD"
dotnet run --project EducationGamePlatform.csproj --no-launch-profile -- --migrate --seed-demo
dotnet run --project EducationGamePlatform.csproj --launch-profile http
```

Подставить свой пароль из `.env`. Если изменены порт, пользователь или название БД,
изменить и строку подключения. Для миграций достаточно команды приложения `--migrate`;
первоначальные сущности уже описаны миграцией.

API: `http://localhost:5244`. OpenAPI в Development: `http://localhost:5244/openapi/v1.json`.
Проверки состояния: `/health/live` и `/health/ready`. Readiness проверяет подключение
к БД и отсутствие неприменённых миграций.

Можно использовать уже установленный PostgreSQL вместо Docker: создать отдельную БД
для проекта и указать её параметры через `dotnet user-secrets`. Остальные шаги те же.
Приложение не создаёт базу и не применяет миграции при обычном запуске.

## API и база вместе в Docker

После создания и заполнения `.env`:

```powershell
docker compose --profile app up -d --build
docker compose --profile app ps -a
```

Профиль `app` запускает PostgreSQL, одноразовую задачу миграции и API.
API начинает работу после успешной миграции; завершение `migrate` с кодом 0 нормально.
При `SEED_DEMO_DATA=true` эта задача дополнительно загружает демонстрационную лекцию.
База доступна только контейнерам; API опубликован на `127.0.0.1:5244`.

В локальном `.env.example` стоит Development для проверки через HTTP. Для публикации
обязательно сменить `ASPNETCORE_ENVIRONMENT=Production`, `SEED_DEMO_DATA=false`
и поставить HTTPS reverse proxy. В Production auth-cookie передаются только по HTTPS.

## Сервер Ubuntu

Настройка Windows и сервера независима: на ПК разрабатываем и проверяем код,
на сервере собираем тот же Docker-образ. Доступ к серверу для первого коммита не нужен.

После установки Docker Engine и Compose по [официальной инструкции](https://docs.docker.com/engine/install/ubuntu/):

```bash
git clone https://github.com/Dishwasherzz/edtech-gamification-platform.git
cd edtech-gamification-platform
cp .env.example .env
# В .env: новый пароль, Production, SEED_DEMO_DATA=false.
docker compose --profile app up -d --build
curl --fail http://127.0.0.1:5244/health/ready
```

HTTPS reverse proxy (например, уже используемый на сервере Nginx или Caddy) должен
проксировать API на `127.0.0.1:5244`. Настройка домена и сертификата выполняется на этапе
развёртывания. В дальнейшем фронтенд удобно отдавать на том же origin, проксируя `/api`
в этот контейнер. Создавать контейнер фронтенда сейчас не требуется: его исходников в проекте нет.

Данные PostgreSQL и ключи шифрования cookie хранятся в именованных томах. Для PostgreSQL 18
том монтируется в `/var/lib/postgresql`, как требует [официальный образ](https://hub.docker.com/_/postgres).
Обычный `docker compose down` сохраняет тома; параметр `-v` удаляет БД и ключи.

При обновлении уже запущенного приложения сначала сделать резервную копию,
остановить API, применить миграции новой версии и запустить API:

```bash
docker compose --profile app build
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backups/edtech.sql
docker compose --profile app stop api
docker compose --profile app run --rm migrate
docker compose --profile app up -d api
```

В серверной среде бэкапы нужно хранить вне контейнерных томов и регулярно проверять восстановление.
Отдельные роли БД для миграций и работы API, университетский вход и восстановление пароля
через почту можно добавить на следующем этапе публикации.

## Работа с API

Реализованные и планируемые маршруты: [карта API](docs/api-map.md).
Модель данных: [сущности и связи](docs/domain-model.md).
Примеры запросов для Rider: `EducationGamePlatform.http`.

Для каждого клиента:

1. Получить `GET /api/auth/csrf`; сохранить cookie и поле `token`.
2. Отправлять `X-CSRF-TOKEN: <token>` при POST/PUT/DELETE вместе с cookie.
3. Зарегистрироваться и войти; регистрация сама по себе вход не выполняет.
4. После входа получить новый CSRF-токен: он привязан к текущему пользователю.
5. После выхода также обновить токен перед новым входом.

React в разработке должен использовать прокси `/api` на backend. Для запросов
`fetch` использовать `credentials: 'include'`. Запросов с другого origin по умолчанию нет:
CORS не настроен, потому что начальная схема предполагает UI и API на одном origin.

Клиент получает DTO, а не EF-сущности: хеши паролей и правильные ответы не входят в контракт.
Ошибки возвращаются как `application/problem+json`; `401` означает отсутствие входа,
`404` — отсутствующий или неопубликованный материал, `400` — ошибки проверки данных/CSRF.

## Миграции при изменении модели

```powershell
dotnet tool restore
dotnet ef migrations add MeaningfulChangeName --project EducationGamePlatform.csproj --output-dir Persistence/Migrations
dotnet ef migrations has-pending-model-changes --project EducationGamePlatform.csproj
dotnet run --project EducationGamePlatform.csproj --no-launch-profile -- --migrate
```

Генерация миграции работает без подключения к БД благодаря design-time factory.
Команда приложения для применения читает user-secrets и окружение; для `dotnet ef database update`
нужно отдельно задать `ConnectionStrings__Database` в окружении.

## Проверки

Тестам нужен отдельный PostgreSQL с правом создания баз: они создают базу со случайным
именем `edtech_tests_<guid>` и удаляют только её после завершения. Рабочую БД не использовать.

```powershell
$env:TEST_DATABASE_CONNECTION_STRING = "Host=localhost;Port=5433;Database=postgres;Username=edtech;Password=YOUR_LOCAL_PASSWORD"
dotnet test EducationGamePlatform.sln -c Release
```

GitHub Actions проверяет сборку, соответствие модели миграции, тесты с PostgreSQL 18,
конфигурацию Compose и сборку Docker-образа. Версии NuGet фиксируются в `packages.lock.json`.

## Следующий шаг

Реализовать серверное прохождение одной проверки: старт → текущий вопрос → ответ → итог.
Затем добавить транзакционное начисление награды за первое успешное прохождение.
До этого согласовать реальные вопросы, время на вопрос/тест, критерий победы и роли преподавателя.
