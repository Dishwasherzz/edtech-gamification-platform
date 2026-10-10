# edtech-gamification-platform

Бэкенд образовательной платформы по электротехнике с элементами геймификации.
Стек: C#, ASP.NET Core / .NET 10, EF Core 10, PostgreSQL 18.

## Что уже работает

- Регистрация, вход и выход через ASP.NET Core Identity и защищённые cookie.
- Профиль текущего пользователя с XP и монетами.
- Чтение опубликованных курсов, тем и лекций; личная отметка о чтении.
- 14 предметных сущностей, связи, ограничения БД и первая миграция.
- Повторяемая загрузка одной демонстрационной темы с лекцией.
- OpenAPI, проверки состояния приложения и БД.
- Интеграционные тесты с настоящим PostgreSQL, Docker и GitHub Actions.

Бой, таймеры, проверка ответов и выдача наград — следующий этап: модели уже есть,
но их операции ещё не реализованы. XP и монеты новых пользователей равны нулю;
чтение лекции наград не даёт. Фронтенд, магазин и лабораторный симулятор пока не входят в проект.

## Структура

```text
src/EducationGamePlatform/                  # приложение ASP.NET Core
  Program.cs                               # подключение сервисов и маршрутов
  Domain/                                  # сущности
  Features/                                # API регистрации, профиля и каталога
  Infrastructure/                          # CSRF, текущий пользователь, health checks
  Persistence/                             # EF Core, миграции и демоданные
  Properties/                              # профили запуска Rider
tests/EducationGamePlatform.IntegrationTests/ # проверки API и ограничений БД
docs/                                      # карта API, модель данных, инструкции
requests/EducationGamePlatform.http         # запросы для проверки в Rider
scripts/                                   # настройка и запуск на Windows
deploy/                                    # Dockerfile, Compose, пример .env
.config/dotnet-tools.json                   # версия dotnet-ef
.github/workflows/ci.yml                    # автоматические проверки
EducationGamePlatform.sln                   # открыть этот файл в Rider
```

## Запуск и документация

Открыть `EducationGamePlatform.sln` в Rider. После переноса файлов переоткрыть solution.
Основная локальная база — `EducationGamePlatform` на `localhost:5434`.
Из корня репозитория запуск: `.\scripts\Start-Api.ps1`.
Проверка подключения: `http://localhost:5244/health/ready` → `Healthy`.

- [Настройка локальной БД, миграции и запуск](docs/local-database.md)
- [Карта API и подключение фронтенда](docs/api-map.md)
- [Модель данных](docs/domain-model.md)
- [Docker и Ubuntu](docs/deployment.md)
- [Запросы для проверки без фронтенда в Rider](requests/EducationGamePlatform.http)

Пароли, `appsettings.Local.json`, ключи cookie, сборочные файлы и резервные копии
не входят в Git и Docker-образ. Тестам нужна отдельная временная БД с правом CREATE DATABASE;
настройка описана в [документации](docs/development.md).
