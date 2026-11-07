using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Catalog;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Features.Profile;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.IntegrationTests;

[CollectionDefinition("PostgreSQL pilot content", DisableParallelization = true)]
public sealed class PilotContentCollection : ICollectionFixture<ApiFixture>;

[Collection("PostgreSQL pilot content")]
public sealed class PilotContentTests(ApiFixture fixture)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public async Task ContentUpdatesKeepOldAttemptsAndReadingMarksAndPublishBothNewAssessments()
    {
        using var client = await fixture.CreateStudentAsync();
        var completion = await client.PutAsJsonAsync($"/api/me/lessons/{DemoData.LessonId}/completion", new { });
        Assert.Equal(HttpStatusCode.OK, completion.StatusCode);
        var old = await StartAsync(client, DemoGameContent.BossId());

        await using var database = fixture.CreateDatabase();
        await DemoData.SeedAsync(database, includePilot: true);
        await DemoData.SeedAsync(database, includePilot: true);
        var bossId = DemoGameContent.BossId();
        var crisisId = DemoGameContent.CrisisId();
        var versions = await database.AssessmentVersions
            .Where(version => version.AssessmentId == bossId || version.AssessmentId == crisisId)
            .Select(version => new { version.AssessmentId, version.VersionNumber, Questions = version.Questions.Count,
                Scenarios = version.Scenarios.Count }).ToListAsync();
        Assert.Equal(4, versions.Count);
        Assert.Equal(10, Assert.Single(versions, version => version.AssessmentId == bossId && version.VersionNumber == 2).Questions);
        var crisisVersion = Assert.Single(versions, version => version.AssessmentId == crisisId && version.VersionNumber == 2);
        Assert.Equal(12, crisisVersion.Questions);
        Assert.Equal(3, crisisVersion.Scenarios);

        var existing = await ReadAsync(await client.GetAsync($"/api/attempts/{old.Id}"));
        Assert.Equal(old.CurrentQuestion!.Id, existing.CurrentQuestion!.Id);
        Assert.Equal(old.CurrentQuestion.Prompt, existing.CurrentQuestion.Prompt);
        var lesson = await client.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoData.LessonId}");
        Assert.Equal("Последовательные и параллельные цепи", lesson!.Title);
        Assert.Equal(20, lesson.AwardedXp);
        Assert.NotNull(lesson.CompletedAt);

        await ReadAsync(await client.PostAsJsonAsync($"/api/attempts/{old.Id}/abandon", new { }));
        var boss = await PassAsync(client, await StartAsync(client, bossId));
        Assert.Equal(150, boss.Reward!.Xp);
        Assert.Equal(4, boss.Reward.NewRank);
        var crisis = await PassAsync(client, await StartAsync(client, crisisId));
        Assert.Equal(25, crisis.Reward!.Xp);
        Assert.Equal(4, crisis.Review!.Count);
        Assert.Null(crisis.Reward.NewRank);
        var profile = await client.GetFromJsonAsync<ProfileResponse>("/api/me");
        Assert.Equal(195, profile!.TotalXp);
        Assert.Equal(57, profile.CoinsBalance);

        var pilotAttempt = await StartAsync(client, bossId);
        var versionCount = await database.AssessmentVersions.CountAsync();
        await DemoData.SeedAsync(database, includeAnalyst: true);
        await DemoData.SeedAsync(database, includeAnalyst: true);
        Assert.Equal(versionCount + 6, await database.AssessmentVersions.CountAsync());
        for (var order = 1; order <= 3; order++)
        {
            var topicBossId = DemoGameContent.BossId(order);
            var topicCrisisId = DemoGameContent.CrisisId(order);
            var bossVersion = await database.AssessmentVersions.Where(version => version.AssessmentId == topicBossId)
                .OrderByDescending(version => version.VersionNumber)
                .Select(version => new { version.QuestionTimeLimitSeconds, Questions = version.Questions.Count }).FirstAsync();
            Assert.Equal(50, bossVersion.QuestionTimeLimitSeconds);
            Assert.Equal(12, bossVersion.Questions);
            var latestCrisis = await database.AssessmentVersions.Where(version => version.AssessmentId == topicCrisisId)
                .OrderByDescending(version => version.VersionNumber)
                .Select(version => new { Questions = version.Questions.Count, Scenarios = version.Scenarios.Count }).FirstAsync();
            Assert.Equal(12, latestCrisis.Questions);
            Assert.Equal(3, latestCrisis.Scenarios);
        }

        var resumed = await ReadAsync(await client.GetAsync($"/api/attempts/{pilotAttempt.Id}"));
        Assert.Equal(pilotAttempt.CurrentQuestion!.Id, resumed.CurrentQuestion!.Id);
        Assert.Equal(pilotAttempt.CurrentQuestion.Prompt, resumed.CurrentQuestion.Prompt);
        await ReadAsync(await client.PostAsJsonAsync($"/api/attempts/{pilotAttempt.Id}/abandon", new { }));

        var updatedLesson = await client.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoData.LessonId}");
        Assert.Equal("Закон Ома и основы цепей", updatedLesson!.Title);
        Assert.Equal(lesson.CompletedAt, updatedLesson.CompletedAt);
        Assert.Equal(lesson.AwardedXp, updatedLesson.AwardedXp);

        var current = await StartAsync(client, bossId);
        Assert.Equal("ДРОССЕЛЬ ОМ-3000", current.BossName);
        Assert.Equal(TimeSpan.FromSeconds(50), current.ExpiresAt - current.StartedAt);
        Assert.NotNull(current.CurrentQuestion!.CalculationHint);
        var victory = await PassAsync(client, current);
        Assert.Equal(25, victory.Reward!.Xp);
        var crisisVictory = await PassAsync(client, await StartAsync(client, crisisId));
        Assert.Equal(25, crisisVictory.Reward!.Xp);
        Assert.Equal(4, crisisVictory.Review!.Count);
    }

    private static async Task<AttemptResponse> StartAsync(HttpClient client, Guid assessmentId) =>
        await ReadAsync(await client.PostAsJsonAsync($"/api/assessments/{assessmentId}/attempts", new { }));

    private async Task<AttemptResponse> PassAsync(HttpClient client, AttemptResponse attempt)
    {
        if (attempt.IsReady)
            attempt = await ReadAsync(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        await using var database = fixture.CreateDatabase();
        while (attempt.Status == AttemptStatus.Active)
        {
            var questionId = attempt.CurrentQuestion!.Id;
            var option = await database.AttemptQuestions.Where(question => question.Id == questionId)
                .SelectMany(question => question.Question.Options).SingleAsync(option => option.IsCorrect);
            attempt = await ReadAsync(await client.PutAsJsonAsync($"/api/attempts/{attempt.Id}/questions/{questionId}/answer",
                new AnswerRequest(option.Id, Guid.NewGuid())));
        }
        Assert.Equal(AttemptStatus.Passed, attempt.Status);
        return attempt;
    }

    private static async Task<AttemptResponse> ReadAsync(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<AttemptResponse>(Json))!;
    }
}
