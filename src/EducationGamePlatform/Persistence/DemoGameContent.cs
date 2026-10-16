using System.Globalization;
using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Persistence;

// Demonstration material for the software flow. A teacher should review it before classroom use.
public static class DemoGameContent
{
    private static Guid Id(string prefix, int number) => Guid.Parse($"{prefix}-0000-4000-8000-{number:000000000000}");
    public static Guid BossId(int topic = 1) => Id("40000000", topic * 2 - 1);
    public static Guid CrisisId(int topic = 1) => Id("40000000", topic * 2);
    public static Guid TopicId(int topic) => Id("20000000", topic);
    public static Guid LessonId(int topic) => Id("30000000", topic);

    public static async Task SeedAsync(AppDbContext database, CancellationToken token)
    {
        var titles = new[] { "Электрические величины", "Мощность постоянного тока", "Энергия электрического тока" };
        var lectures = new[]
        {
            "# Закон Ома\n\nВ учебной цепи постоянного тока **I = U / R**. Напряжение U измеряется в вольтах, сопротивление R — в омах, ток I — в амперах.\n\nПри U = 12 В и R = 6 Ом ток равен 2 А.",
            "# Мощность постоянного тока\n\nМощность показывает скорость преобразования электрической энергии. Для рассматриваемой цепи **P = U × I**.\n\nU измеряется в вольтах, I — в амперах, P — в ваттах. При 12 В и 2 А мощность равна 24 Вт.\n\nВсе аварии курса происходят в виртуальном стенде. Действия симулятора не являются инструкцией по ремонту реальных электроустановок.",
            "# Энергия электрического тока\n\nПри постоянной мощности **E = P × t**. Если P задана в ваттах, а t в секундах, энергия E получается в джоулях.\n\nПри мощности 10 Вт за 6 секунд расходуется 60 Дж. Не смешивай секунды и часы в одной формуле.\n\nВ аварийных сценариях сначала устраняется опасное состояние виртуального стенда, затем проверяются параметры модели."
        };
        for (var index = 1; index <= 3; index++)
        {
            var topicId = TopicId(index);
            if (!await database.Topics.AnyAsync(topic => topic.Id == topicId, token))
                database.Topics.Add(new Topic { Id = topicId, CourseId = DemoData.CourseId, Title = titles[index - 1],
                    Description = "Демонстрационная тема. Материалы и баланс подлежат согласованию с преподавателем.",
                    SortOrder = index, IsPublished = true });
            await database.SaveChangesAsync(token);
            var lessonId = LessonId(index);
            if (!await database.Lessons.AnyAsync(lesson => lesson.Id == lessonId, token))
                database.Lessons.Add(new Lesson { Id = lessonId, TopicId = topicId, Title = titles[index - 1],
                    ContentMarkdown = lectures[index - 1], SortOrder = 1, IsPublished = true });
            if (!await database.Assessments.AnyAsync(assessment => assessment.Id == BossId(index), token))
                database.Assessments.Add(CreateBoss(index));
            if (!await database.Assessments.AnyAsync(assessment => assessment.Id == CrisisId(index), token))
                database.Assessments.Add(CreateCrisis(index));
            await database.SaveChangesAsync(token);
        }
    }

    private static Assessment CreateBoss(int topic)
    {
        var assessment = new Assessment { Id = BossId(topic), TopicId = TopicId(topic), Title = "Тест: бой с боссом",
            Mode = AssessmentMode.Boss, IsPublished = true };
        var version = new AssessmentVersion { AssessmentId = assessment.Id, VersionNumber = 1,
            PublishedAt = DateTimeOffset.UtcNow, QuestionTimeLimitSeconds = 60, RequiredCorrectAnswers = 5,
            BossName = new[] { "Омнис", "Ваттрон", "Джоуль" }[topic - 1], BossMaxHp = 100, DamagePerCorrectAnswer = 20,
            XpReward = 100, CoinsReward = 30 };
        for (var i = 0; i < 10; i++)
        {
            var a = 12 + i * 6;
            var b = 3 + i % 3;
            var result = topic == 1 ? (decimal)a / b : a * b;
            var unit = topic == 1 ? "А" : topic == 2 ? "Вт" : "Дж";
            var prompt = topic switch
            {
                1 => $"На участке цепи U = {a} В, R = {b} Ом. Чему равен ток I?",
                2 => $"При U = {a} В ток I = {b} А. Найди мощность P.",
                _ => $"При постоянной мощности P = {a} Вт прошло {b} с. Найди энергию E в джоулях."
            };
            var question = new Question { AssessmentVersionId = version.Id, Prompt = prompt, SortOrder = i,
                Explanation = topic == 1 ? $"По закону Ома I = U / R = {a} / {b} = {Number(result)} А."
                    : topic == 2 ? $"P = U × I = {a} × {b} = {Number(result)} Вт."
                    : $"E = P × t = {a} × {b} = {Number(result)} Дж." };
            question.Options = Enumerable.Range(0, 4).Select(option => new AnswerOption { QuestionId = question.Id,
                Text = $"{Number(result + option)} {unit}", IsCorrect = option == 0, SortOrder = (option + i) % 4 }).ToList();
            version.Questions.Add(question);
        }
        assessment.Versions.Add(version);
        return assessment;
    }

    private static Assessment CreateCrisis(int topic)
    {
        var assessment = new Assessment { Id = CrisisId(topic), TopicId = TopicId(topic), Title = "Авария: виртуальный стенд",
            Mode = AssessmentMode.Crisis, IsPublished = true };
        var version = new AssessmentVersion { AssessmentId = assessment.Id, VersionNumber = 1,
            PublishedAt = DateTimeOffset.UtcNow, RequiredCorrectAnswers = 4, QuestionTimeLimitSeconds = 60, XpReward = 100, CoinsReward = 30 };
        var names = new[] { "Перегрузка учебной цепи", "Повреждение изоляции в модели", "Замыкание в виртуальном стенде" };
        var illustrations = new[] { "circuit", "cable", "panel" };
        var prompts = new[] { "Модель сигнализирует об опасном состоянии. С чего начать?",
            "Питание стенда отключено. Что проверить перед работой с моделью?",
            "Опасное состояние устранено. Как проверить электрические параметры?",
            "Расчёт и схема проверены. Что сделать перед запуском симуляции?" };
        var correct = new[] { "Отключить питание виртуального стенда", "Проверить на индикаторах симулятора отсутствие напряжения",
            topic == 1 ? "Проверить ток по I = U / R" : topic == 2 ? "Проверить мощность по P = U × I" : "Проверить энергию по E = P × t с временем в секундах",
            "Убедиться, что предупреждения устранены, и подтвердить безопасное состояние модели" };
        var wrong = new[] { new[] { "Увеличить напряжение", "Игнорировать предупреждение" },
            new[] { "Сразу изменить соединения без проверки", "Проверить проводник прикосновением" },
            new[] { "Выбрать параметры наугад", "Увеличить нагрузку до максимума" },
            new[] { "Обойти защиту симулятора", "Запустить без проверки предупреждений" } };
        for (var scenarioIndex = 0; scenarioIndex < 3; scenarioIndex++)
        {
            var scenario = new CrisisScenario { AssessmentVersionId = version.Id, Title = names[scenarioIndex],
                Introduction = $"Учебная симуляция: {names[scenarioIndex].ToLowerInvariant()}. До виртуального замыкания 60 секунд. " +
                    "Выполни 4 шага. Верный выбор добавляет 10 секунд, неверный отнимает 10. Три ошибки завершают попытку. " +
                    "Это модель для обучения, а не инструкция по ремонту реального оборудования.",
                IllustrationKey = illustrations[scenarioIndex], SortOrder = scenarioIndex };
            for (var step = 0; step < 4; step++)
            {
                var question = new Question { AssessmentVersionId = version.Id, ScenarioId = scenario.Id,
                    Prompt = $"{names[scenarioIndex]}. {prompts[step]}", SortOrder = scenarioIndex * 4 + step,
                    Explanation = $"Шаг {step + 1}: {correct[step]}. В симуляции сначала снимается опасное состояние, затем проверяются параметры и условия запуска." };
                var texts = new[] { correct[step], wrong[step][0], wrong[step][1] };
                question.Options = texts.Select((text, option) => new AnswerOption { QuestionId = question.Id,
                    Text = text, IsCorrect = option == 0, SortOrder = (option + step + scenarioIndex) % 3 }).ToList();
                version.Questions.Add(question);
            }
            version.Scenarios.Add(scenario);
        }
        assessment.Versions.Add(version);
        return assessment;
    }

    private static string Number(decimal number) => number.ToString("0.##", CultureInfo.GetCultureInfo("ru-RU"));
}
