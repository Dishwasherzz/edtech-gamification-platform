# Разработка и проверки

Нужен .NET SDK 10. Открыть `EducationGamePlatform.sln` в Rider.
Команды выполняются из корня репозитория, исходники находятся в `src/EducationGamePlatform`.

```powershell
dotnet restore EducationGamePlatform.sln --locked-mode
dotnet tool restore
dotnet build EducationGamePlatform.sln -c Release --no-restore
```

## Миграции

```powershell
dotnet ef migrations add MeaningfulChangeName --project src/EducationGamePlatform/EducationGamePlatform.csproj --output-dir Persistence/Migrations
dotnet ef migrations has-pending-model-changes --project src/EducationGamePlatform/EducationGamePlatform.csproj
.\scripts\Start-Api.ps1 -Migrate
```

Генерация миграции не требует живой БД благодаря design-time factory.
Применение читает настройки приложения. `dotnet ef database update` требует
отдельно заданной переменной окружения `ConnectionStrings__Database`.
Обычный запуск API не применяет миграции автоматически.

## Интеграционные тесты

Тестам нужен PostgreSQL с правом CREATE DATABASE. Рабочую БД они не меняют:
создают базу `edtech_tests_<guid>` и удаляют только её после завершения.
Пользователь `education_game_platform_app` не имеет права CREATE DATABASE;
для тестов использовать отдельный экземпляр/учётную запись.

```powershell
$env:TEST_DATABASE_CONNECTION_STRING = "Host=localhost;Port=5433;Database=postgres;Username=YOUR_TEST_USER;Password=YOUR_TEST_PASSWORD"
dotnet test EducationGamePlatform.sln -c Release
Remove-Item Env:\TEST_DATABASE_CONNECTION_STRING
```

GitHub Actions поднимает отдельный PostgreSQL 18, проверяет сборку, соответствие
модели миграции, тесты, конфигурацию Compose и Docker-образ.
Версии NuGet фиксируются в `packages.lock.json` каждого проекта.

## Проверка вручную

Запустить `.\scripts\Start-Api.ps1`. `/health/ready` должен вернуть `Healthy`.
Контракт в Development: `http://localhost:5244/openapi/v1.json`.
Корневой `http://localhost:5244/` показывает подключённый фронтенд. Отдельный npm-сервер не требуется.

Открыть [EducationGamePlatform.http](../requests/EducationGamePlatform.http) в Rider
и выполнить запросы сверху вниз: CSRF → регистрация → вход → обновление CSRF → профиль →
каталог → лекция → отметка чтения → выход.
Если email уже зарегистрирован, изменить его или пропустить регистрацию.
Повтор отметки чтения возвращает прежний `completedAt`; после выхода профиль возвращает `401`.

Контракты, cookie/CSRF и ограничения текущего этапа — в [карте API](api-map.md).

Игровые тесты используют управляемые серверные часы: не нужно ждать реальные минуты для проверки таймаутов.
Фоновое завершение проверяется отдельно. UpgradeTests создаёт ещё одну временную БД с первой схемой,
заполняет её старым форматом и проверяет сохранность данных после обновления.
