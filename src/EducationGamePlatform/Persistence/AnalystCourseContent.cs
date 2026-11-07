using System.Text.Json;
using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Persistence;

internal static class AnalystCourseContent
{
    private sealed record Package(int BossSeconds, TopicMaterial[] Topics);
    private sealed record TopicMaterial(int Order, string Title, string Subtitle, string Description, string IconKey,
        string BossName, string BossIcon, string BossIntro, string Lecture, BossQuestion[] Boss, Scenario[] Scenarios);
    private sealed record BossQuestion(int SourceId, string Prompt, string[] Options, int CorrectIndex,
        string CorrectAnswer, string Explanation, string? CalculationHint);
    private sealed record Scenario(string Title, string Introduction, string IllustrationKey, Step[] Steps);
    private sealed record Step(string Prompt, string[] Options, int CorrectIndex, string Explanation);

    private static Guid Id(int number) => Guid.Parse($"82000000-0000-4000-8000-{number:000000000000}");
    private static Guid VersionId(int order, AssessmentMode mode) => Id(10 + order * 2 + (mode == AssessmentMode.Crisis ? 1 : 0));

    public static async Task SeedAsync(AppDbContext database, CancellationToken token)
    {
        using var stream = typeof(AnalystCourseContent).Assembly.GetManifestResourceStream("AnalystCourse.json")
            ?? throw new InvalidOperationException("Пакет учебных материалов не найден.");
        var package = await JsonSerializer.DeserializeAsync<Package>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), token)
            ?? throw new InvalidOperationException("Пакет учебных материалов пуст.");
        Validate(package);

        var expected = package.Topics.SelectMany(topic =>
            new[] { VersionId(topic.Order, AssessmentMode.Boss), VersionId(topic.Order, AssessmentMode.Crisis) }).ToArray();
        var installed = await database.AssessmentVersions.CountAsync(version => expected.Contains(version.Id), token);
        if (installed == expected.Length) return;
        if (installed != 0) throw new InvalidOperationException("В базе найдена неполная версия пакета аналитика.");

        var publishedAt = DateTimeOffset.UtcNow;
        foreach (var material in package.Topics.OrderBy(topic => topic.Order))
        {
            var topic = await database.Topics.SingleAsync(item => item.Id == DemoGameContent.TopicId(material.Order), token);
            var lesson = await database.Lessons.SingleAsync(item => item.Id == DemoGameContent.LessonId(material.Order), token);
            topic.Title = material.Title;
            topic.Subtitle = material.Subtitle;
            topic.Description = material.Description;
            topic.IconKey = material.IconKey;
            lesson.Title = material.Title;
            lesson.ContentMarkdown = material.Lecture;

            var boss = await NewVersionAsync(database, DemoGameContent.BossId(material.Order), material.Order,
                AssessmentMode.Boss, publishedAt, token);
            boss.BossName = material.BossName;
            boss.BossIcon = material.BossIcon;
            boss.BossIntro = material.BossIntro;
            boss.QuestionTimeLimitSeconds = package.BossSeconds;
            for (var index = 0; index < material.Boss.Length; index++)
            {
                var question = material.Boss[index];
                AddQuestion(boss, 100 + question.SourceId, index, question.Prompt, question.Options,
                    question.CorrectIndex, question.Explanation, question.CalculationHint);
            }

            var crisis = await NewVersionAsync(database, DemoGameContent.CrisisId(material.Order), material.Order,
                AssessmentMode.Crisis, publishedAt, token);
            for (var index = 0; index < material.Scenarios.Length; index++)
            {
                var source = material.Scenarios[index];
                var scenario = new CrisisScenario
                {
                    Id = Id(50 + material.Order * 3 + index), AssessmentVersionId = crisis.Id, Title = source.Title,
                    Introduction = "Учебная симуляция. Действия относятся к модели стенда. " + source.Introduction,
                    IllustrationKey = source.IllustrationKey, SortOrder = index
                };
                crisis.Scenarios.Add(scenario);
                for (var step = 0; step < source.Steps.Length; step++)
                {
                    var item = source.Steps[step];
                    var position = index * 4 + step;
                    AddQuestion(crisis, 1000 + material.Order * 100 + position, position, item.Prompt, item.Options,
                        item.CorrectIndex, item.Explanation, scenario: scenario.Id);
                }
            }
            database.AssessmentVersions.AddRange(boss, crisis);
        }
        await database.SaveChangesAsync(token);
    }

    private static async Task<AssessmentVersion> NewVersionAsync(AppDbContext database, Guid assessmentId, int order,
        AssessmentMode mode, DateTimeOffset publishedAt, CancellationToken token)
    {
        var previous = await database.AssessmentVersions.Where(version => version.AssessmentId == assessmentId)
            .MaxAsync(version => (int?)version.VersionNumber, token);
        return new AssessmentVersion
        {
            Id = VersionId(order, mode), AssessmentId = assessmentId, VersionNumber = (previous ?? 0) + 1,
            PublishedAt = publishedAt, RequiredCorrectAnswers = mode == AssessmentMode.Boss ? 5 : 4,
            QuestionTimeLimitSeconds = 60, BossMaxHp = mode == AssessmentMode.Boss ? 100 : 0,
            DamagePerCorrectAnswer = mode == AssessmentMode.Boss ? 20 : 0, XpReward = 100, CoinsReward = 30
        };
    }

    private static void AddQuestion(AssessmentVersion version, int key, int order, string prompt, string[] options,
        int correct, string explanation, string? hint = null, Guid? scenario = null)
    {
        var id = Id(key);
        version.Questions.Add(new Question
        {
            Id = id, AssessmentVersionId = version.Id, ScenarioId = scenario, SortOrder = order, Prompt = prompt,
            Explanation = explanation, CalculationHint = hint,
            Options = options.Select((option, index) => new AnswerOption
            {
                Id = Id(10000 + key * 4 + index), QuestionId = id, Text = option, IsCorrect = index == correct,
                SortOrder = scenario is null ? index : (index + order) % options.Length
            }).ToList()
        });
    }

    private static void Validate(Package package)
    {
        static bool ValidOptions(string[] options, int correct, int count) =>
            options.Length == count && correct >= 0 && correct < count &&
            options.All(option => !string.IsNullOrWhiteSpace(option)) && options.Distinct().Count() == count;

        var bossIds = package.Topics.SelectMany(topic => topic.Boss).Select(question => question.SourceId).ToArray();
        if (package.BossSeconds is < 45 or > 60 ||
            !package.Topics.Select(topic => topic.Order).Order().SequenceEqual([1, 2, 3]) ||
            bossIds.Length != bossIds.Distinct().Count() || bossIds.Any(id => id is < 1 or > 800) ||
            package.Topics.Any(topic => string.IsNullOrWhiteSpace(topic.Lecture) ||
                topic.Boss.Length != 12 || topic.Boss.Any(question => !ValidOptions(question.Options, question.CorrectIndex, 4) ||
                    question.Options[question.CorrectIndex] != question.CorrectAnswer) ||
                topic.Scenarios.Length != 3 || topic.Scenarios.Any(scenario => scenario.Steps.Length != 4 ||
                    scenario.Steps.Any(step => !ValidOptions(step.Options, step.CorrectIndex, 3)))))
            throw new InvalidOperationException("Пакет аналитика не соответствует формату учебного курса.");
    }
}
