using System.Text.Json;
using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Persistence;

internal static class AdditionalTrialContent
{
    private sealed record Package(int BossSeconds, Material[] Topics);
    private sealed record Material(int Order, Item[] Boss, Scenario[] Scenarios);
    private sealed record Item(string SourceId, string Prompt, string[] Options, int CorrectIndex, string Explanation);
    private sealed record Scenario(string Title, string Introduction, string IllustrationDescription, Item[] Steps);
    private static Guid Id(int key) => Guid.Parse($"83000000-0000-4000-8000-{key:000000000000}");

    public static async Task SeedAsync(AppDbContext database, CancellationToken token)
    {
        using var stream = typeof(AdditionalTrialContent).Assembly.GetManifestResourceStream("AdditionalTrials.json")
            ?? throw new InvalidOperationException("Не найден пакет испытаний тем 4–5.");
        var package = await JsonSerializer.DeserializeAsync<Package>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), token)
            ?? throw new InvalidOperationException("Пакет испытаний пуст.");
        static bool Valid(Item item, int count) => !string.IsNullOrWhiteSpace(item.Prompt) &&
            !string.IsNullOrWhiteSpace(item.Explanation) && item.Options.Length == count &&
            item.Options.All(option => !string.IsNullOrWhiteSpace(option)) &&
            item.Options.Distinct().Count() == count && item.CorrectIndex >= 0 && item.CorrectIndex < count;
        if (package.BossSeconds is < 45 or > 60 || !package.Topics.Select(topic => topic.Order).Order().SequenceEqual([4, 5]) ||
            package.Topics.Any(topic => topic.Boss.Length != 14 || topic.Boss.Any(item => !Valid(item, 4)) ||
                topic.Scenarios.Length != 3 || topic.Scenarios.Any(scenario => string.IsNullOrWhiteSpace(scenario.Title) ||
                    string.IsNullOrWhiteSpace(scenario.Introduction) || scenario.Steps.Length != 4 || scenario.Steps.Any(item => !Valid(item, 3)))))
            throw new InvalidOperationException("Неверный формат испытаний тем 4–5.");

        foreach (var material in package.Topics)
        {
            var topic = await database.Topics.SingleAsync(item => item.Id == DemoGameContent.TopicId(material.Order), token);
            topic.Subtitle = "Лекция, босс-тест и виртуальный стенд";
            topic.Description = "Изучите лекцию и победите в босс-тесте или QTE на прогноз изменений параметров цепи.";
            foreach (var mode in new[] { AssessmentMode.Boss, AssessmentMode.Crisis })
            {
                var assessmentId = mode == AssessmentMode.Boss ? DemoGameContent.BossId(material.Order) : DemoGameContent.CrisisId(material.Order);
                var versionId = Id(material.Order * 10000 + (mode == AssessmentMode.Boss ? 1 : 2));
                if (await database.AssessmentVersions.AnyAsync(item => item.Id == versionId, token)) continue;
                var assessment = await database.Assessments.SingleOrDefaultAsync(item => item.Id == assessmentId, token);
                if (assessment is null)
                {
                    assessment = new Assessment { Id = assessmentId, TopicId = topic.Id, Mode = mode, IsPublished = true,
                        Title = mode == AssessmentMode.Boss ? "Тест: бой с боссом" : "QTE: прогноз на виртуальном стенде" };
                    database.Assessments.Add(assessment);
                }
                var previous = await database.AssessmentVersions.Where(item => item.AssessmentId == assessmentId)
                    .MaxAsync(item => (int?)item.VersionNumber, token);
                var version = new AssessmentVersion
                {
                    Id = versionId, Assessment = assessment, VersionNumber = (previous ?? 0) + 1, PublishedAt = DateTimeOffset.UtcNow,
                    QuestionTimeLimitSeconds = mode == AssessmentMode.Boss ? package.BossSeconds : 60,
                    RequiredCorrectAnswers = mode == AssessmentMode.Boss ? 5 : 4,
                    BossMaxHp = mode == AssessmentMode.Boss ? 100 : 0, DamagePerCorrectAnswer = mode == AssessmentMode.Boss ? 20 : 0,
                    XpReward = 100, CoinsReward = 30,
                    BossName = material.Order == 4 ? "Синусоидальный ток" : "Комплексная мощность",
                    BossIntro = "Решите расчётные задачи по теме.", BossIcon = "⚡"
                };
                if (mode == AssessmentMode.Boss)
                {
                    for (var index = 0; index < material.Boss.Length; index++)
                        AddQuestion(version, material.Order * 10000 + 100 + index, index, material.Boss[index]);
                }
                else
                {
                    for (var index = 0; index < material.Scenarios.Length; index++)
                    {
                        var source = material.Scenarios[index];
                        var scenario = new CrisisScenario { Id = Id(material.Order * 10000 + 300 + index),
                            AssessmentVersionId = versionId, Title = source.Title, SortOrder = index,
                            Introduction = "Учебная симуляция. " + source.Introduction, IllustrationKey = "circuit" };
                        version.Scenarios.Add(scenario);
                        for (var step = 0; step < source.Steps.Length; step++)
                            AddQuestion(version, material.Order * 10000 + 400 + index * 4 + step,
                                index * 4 + step, source.Steps[step], scenario.Id);
                    }
                }
                database.AssessmentVersions.Add(version);
            }
        }
        await database.SaveChangesAsync(token);
    }

    private static void AddQuestion(AssessmentVersion version, int key, int order, Item source, Guid? scenarioId = null)
    {
        var question = new Question { Id = Id(key), AssessmentVersionId = version.Id, ScenarioId = scenarioId,
            SortOrder = order, Prompt = source.Prompt, Explanation = source.Explanation };
        question.Options = source.Options.Select((text, index) => new AnswerOption { Id = Id(1000000 + key * 4 + index),
            QuestionId = question.Id, Text = text, IsCorrect = index == source.CorrectIndex,
            // Keep each step's fixed order between attempts; rotate the correct position so it is not always first.
            SortOrder = scenarioId is null ? index : (index + order) % source.Options.Length }).ToList();
        version.Questions.Add(question);
    }
}
