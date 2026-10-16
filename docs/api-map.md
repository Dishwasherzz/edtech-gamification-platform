# Карта API

Актуальна для интеграции фронтенда и испытаний от 17 октября 2026 года.
Фронтенд и API обслуживаются одним приложением: `http://localhost:5244/`.
Описание OpenAPI в Development: `/openapi/v1.json`.

## Общие правила

- JSON: имена свойств в camelCase, GUID — строки, время — ISO 8601 / UTC, перечисления — строки.
- Вход через cookie `edtech.auth`, без JWT. Браузер использует `credentials: "same-origin"`.
- Перед изменяющими запросами получить `/api/auth/csrf` и передать `X-CSRF-TOKEN` вместе с cookie. После входа/выхода обновить токен.
- Классы `UserId`, XP, монеты, правильность ответа и клиентское время не принимаются как основание для начисления.
- Все маршруты каталога, профиля и испытаний требуют входа. Регистрация сама по себе вход не выполняет; UI вызывает вход следующим запросом.
- Сервер не разрешает прямой переход в закрытую тему или запуск испытания без прочтения опубликованных лекций темы.

## Учётная запись и каталог

| Метод | Адрес | Ответ / назначение |
|---|---|---|
| GET | `/api/auth/csrf` | `{token, headerName}` и CSRF-cookie |
| POST | `/api/auth/register` | `{email,password,displayName}` → 201, `{userId,email}` |
| POST | `/api/auth/login` | `{email,password}` → 204 и auth-cookie |
| POST | `/api/auth/logout` | 204 |
| GET | `/api/me` | `{userId,displayName,avatarKey,totalXp,coinsBalance,rank,rankStartXp,nextRankXp,rankProgressPercent}` |
| GET | `/api/courses` | Массив `{id,slug,title,description,totalTopics,completedTopics,progressPercent}` |
| GET | `/api/courses/{courseId}/topics` | Массив `{id,title,description,sortOrder,lessonCount,completedLessons,status,isRead}` |
| GET | `/api/topics/{topicId}` | `{id,courseId,title,description,lessons,assessments}` |
| GET | `/api/lessons/{lessonId}` | `{id,topicId,title,contentMarkdown,completedAt,awardedXp}` |
| PUT | `/api/me/lessons/{lessonId}/completion` | `{}` → `{lessonId,completedAt,xpAwarded}` |
| GET | `/api/instructions` | Текущие награды и пороги разрядов |

Статус темы: `Locked`, `Available`, `Completed`. `isRead` означает, что все опубликованные лекции темы отмечены.
Пройденная тема остаётся доступной для повторения. Процент курса = число пройденных опубликованных тем / число опубликованных тем.

Элементы `lessons` в теме: `{id,title,sortOrder}`. Элементы `assessments`: `{id,title,mode,isRequired}`, режимы `Boss` и `Crisis`.
`completedAt = null` — лекция ещё не отмечена. Первая отметка начисляет XP, повторная даёт `xpAwarded = 0` и прежнее время.
Старые отметки, созданные до введения наград, получают XP один раз при следующем подтверждении через API.

## Испытания

| Метод | Адрес | Назначение |
|---|---|---|
| POST | `/api/assessments/{assessmentId}/attempts` | Создать попытку либо восстановить активную попытку того же испытания |
| POST | `/api/attempts/{attemptId}/begin` | Начать отсчёт подготовленного QTE; повтор не сбрасывает таймер |
| GET | `/api/attempts/{attemptId}` | Актуальное состояние с учётом истёкших дедлайнов |
| PUT | `/api/attempts/{attemptId}/questions/{attemptQuestionId}/answer` | Сохранить выбор; тело ниже |
| POST | `/api/attempts/{attemptId}/abandon` | Прекратить свою активную попытку без награды |
| GET | `/api/attempts/{attemptId}/result` | То же состояние; завершённая попытка содержит награду и разбор |
| GET | `/api/me/attempts/active` | Единственная активная попытка или пустой ответ / null |
| GET | `/api/me/attempts?page=1` | История: 20 попыток на страницу, новые сначала |

Тело ответа на вопрос:

```json
{
  "selectedOptionId": "GUID варианта из currentQuestion.options",
  "requestId": "новый GUID для этого действия"
}
```

При сетевом повторе одного действия отправлять тот же `requestId` и тело. Повтор не начисляет награду и не списывает время снова.
Использование того же requestId с другим содержимым — 409. Повтор заблокированного варианта QTE также не увеличивает ошибки.
Опоздавший ответ не применяется к следующему вопросу: возвращается актуальное состояние попытки.

### Состояние попытки

Основные поля: `id`, `topicId`, `assessmentId`, `topicTitle`, `mode`, `status`, `isReady`, `serverNow`, `startedAt`, `finishedAt`,
`expiresAt`, `correctAnswers`, `errors`, `questionCount`, `bossHpRemaining`, `bossMaxHp`, `bossName`, `finishReason`.

- `status`: `Active`, `Passed`, `Failed`, `Abandoned`.
- `isReady = true`: QTE-сценарий выбран, основной таймер ещё не запущен; вызвать `begin` после нажатия «Действовать».
- `scenario`: `{title,introduction,illustrationKey}` или null; ключи иллюстрации — `circuit`, `cable`, `panel`.
- `currentQuestion`: `{id,position,prompt,expiresAt,options}` или null. `id` — идентификатор **вопроса попытки**, именно его подставлять в адрес ответа.
- `options`: массив `{id,text,isDisabled}`. Правильность и объяснения до завершения не выдаются.
- `feedback`: `{questionId,isCorrect,message}` для обработанного выбора либо null. У неверного QTE-выбора правильное действие не раскрывается.
- `reward`: `{xp,coins,isFirstPass,perfectBonus}` после победы; иначе null.
- `review`: только после завершения; элементы `{position,prompt,selectedAnswer,correctAnswer,explanation,isCorrect,timedOut,wrongChoices}`.

История: `{id,topicId,topicTitle,mode,status,startedAt,finishedAt,correctAnswers,errors,xp,coins}`.
Для повторного прохождения создать новую попытку через assessmentId; история предыдущей сохраняется.

## Работа фронтенда

| Файл | Ответственность |
|---|---|
| `frontend/js/api.js` | HTTP, cookie, CSRF, ошибки; повтор CSRF-запроса только после проверки ошибки сервера |
| `state.js` | Профиль, полученный с сервера; локального начисления XP/монет нет |
| `router.js` | Hash-маршруты, проверка входа, очистка таймеров старого экрана |
| `views/auth.js` | Регистрация, вход |
| `views/dashboard.js` | Курсы, доступность тем, продолжение активной попытки |
| `views/theory.js` | Теория, отметка чтения, выбор режима |
| `views/attempt.js` | Вводный экран QTE, вопрос, таймер, выбор, результат и повтор |
| `views/profile.js` | Разряд, баланс и история |
| `views/instructions.js` | Правила и актуальная экономика |

Интерфейс пересчитывает отображаемый отсчёт относительно `serverNow` и запрашивает состояние каждые 1,5 секунды.
Решение об истечении времени всегда принимает сервер. При сетевом сбое кнопка повторной отправки использует прежний requestId.
Обновление страницы восстанавливает вход по cookie и попытку по её адресу. `204` и пустой успешный ответ не разбираются как JSON.

## Ошибки и служебные адреса

Ошибки используют ProblemDetails / ValidationProblemDetails. У игровых правил есть `code`:
`TopicLocked`, `LectureRequired`, `ActiveAttempt`, `InvalidOption`, `RequestIdRequired`, `RequestConflict`, `InvalidContent`, `NotPublished`.
Нельзя отличить чужую попытку от несуществующей: обе дают 404.

| Статус | Значение |
|---|---|
| 400 | Неверное тело, вариант ответа, пароль или CSRF (`InvalidCsrfToken`) |
| 401 | Вход отсутствует / истёк, либо неверные данные входа |
| 404 | Нет маршрута, нет опубликованного материала или попытка не принадлежит пользователю |
| 409 | Закрытая тема, непрочитанная лекция, другое активное испытание, конфликт requestId или неподготовленный контент |

`GET /health/live` — работает процесс. `GET /health/ready` — доступна БД и применены миграции.
`GET /` — фронтенд. Неизвестный `/api/...` возвращает 404, а не HTML главной страницы.
