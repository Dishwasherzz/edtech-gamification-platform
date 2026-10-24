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
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EducationGamePlatform.IntegrationTests;

[Collection("PostgreSQL API")]
public sealed class GameTests(ApiFixture fixture)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private static async Task<AttemptResponse> Read(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<AttemptResponse>(Json))!;
    }
    private async Task<AttemptResponse> SendStart(HttpClient client, Guid id) => await Read(await client.PostAsJsonAsync($"/api/assessments/{id}/attempts", new { }));
    private async Task<HttpClient> Ready()
    {
        var client = await fixture.CreateStudentAsync();
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/me/lessons/{DemoData.LessonId}/completion", new { })).StatusCode);
        return client;
    }
    private async Task<Guid> Option(AttemptResponse attempt, bool correct)
    {
        await using var db = fixture.CreateDatabase();
        var disabled = attempt.CurrentQuestion!.Options.Where(item => item.IsDisabled).Select(item => item.Id).ToArray();
        return await db.AttemptQuestions.Where(question => question.Id == attempt.CurrentQuestion!.Id)
            .SelectMany(question => question.Question.Options).Where(option => option.IsCorrect == correct &&
                !disabled.Contains(option.Id))
            .Select(option => option.Id).FirstAsync();
    }
    private async Task<AttemptResponse> Answer(HttpClient client, AttemptResponse attempt, bool correct)
        => await Read(await client.PutAsJsonAsync($"/api/attempts/{attempt.Id}/questions/{attempt.CurrentQuestion!.Id}/answer", new AnswerRequest(await Option(attempt, correct), Guid.NewGuid())));
    private async Task<AttemptResponse> Pass(HttpClient client, AttemptResponse attempt)
    {
        if (attempt.IsReady) attempt = await Read(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        while (attempt.Status == AttemptStatus.Active) attempt = await Answer(client, attempt, true);
        return attempt;
    }

    [Fact]
    public async Task CrisisWithFewerThanThreeScenariosIsRejectedBeforeCreatingAttempt()
    {
        using var client = await Ready();
        var assessment = new Assessment { TopicId = DemoData.TopicId, Mode = AssessmentMode.Crisis, Title = "Incomplete scenario bank", IsPublished = true };
        var version = new AssessmentVersion { AssessmentId = assessment.Id, VersionNumber = 1, RequiredCorrectAnswers = 4,
            PublishedAt = fixture.Clock.GetUtcNow(), QuestionTimeLimitSeconds = 60 };
        var scenario = new CrisisScenario { AssessmentVersionId = version.Id, Title = "Only scenario" };
        version.Scenarios.Add(scenario);
        for (var i = 0; i < 4; i++)
            version.Questions.Add(new Question { AssessmentVersionId = version.Id, ScenarioId = scenario.Id, Prompt = $"Step {i}", SortOrder = i,
                Options = [new AnswerOption { Text = "Correct", IsCorrect = true, SortOrder = 0 },
                    new AnswerOption { Text = "Wrong 1", SortOrder = 1 }, new AnswerOption { Text = "Wrong 2", SortOrder = 2 }] });
        assessment.Versions.Add(version);
        await using var db = fixture.CreateDatabase();
        db.Assessments.Add(assessment);
        await db.SaveChangesAsync();
        var response = await client.PostAsJsonAsync($"/api/assessments/{assessment.Id}/attempts", new { });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("InvalidContent", await response.Content.ReadAsStringAsync());
        Assert.False(await db.Attempts.AnyAsync(attempt => attempt.AssessmentId == assessment.Id));
    }

    [Fact]
    public async Task LegacyReadingMarkReceivesTheNewAwardOnceAndKeepsItsOriginalDate()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        var timestamp = DateTimeOffset.Parse("2026-10-10T01:00:00Z");
        await using (var database = fixture.CreateDatabase())
        {
            database.LessonProgress.Add(new LessonProgress { UserId = profile.UserId, LessonId = DemoData.LessonId, CompletedAt = timestamp });
            await database.SaveChangesAsync();
        }
        var path = $"/api/me/lessons/{DemoData.LessonId}/completion";
        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => client.PutAsJsonAsync(path, new { })));
        var awards = new List<int>();
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var completion = (await response.Content.ReadFromJsonAsync<CompletionResponse>())!;
            Assert.Equal(timestamp, completion.CompletedAt);
            awards.Add(completion.XpAwarded);
        }
        Assert.Equal(20, awards.Sum());
        Assert.Equal(20, (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!.TotalXp);
        Assert.Equal(20, (await client.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoData.LessonId}"))!.AwardedXp);
    }

    [Fact]
    public async Task LectureAndPreviousTopicAreRequiredAndAnotherUsersAttemptIsHidden()
    {
        using var client = await fixture.CreateStudentAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/assessments/{DemoGameContent.BossId()}/attempts", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync($"/api/lessons/{DemoGameContent.LessonId(2)}")).StatusCode);
        await client.PutAsJsonAsync($"/api/me/lessons/{DemoData.LessonId}/completion", new { });
        var attempt = await SendStart(client, DemoGameContent.BossId());
        using var other = await fixture.CreateStudentAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/attempts/{attempt.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync($"/api/attempts/{attempt.Id}/abandon", new { })).StatusCode);
    }

    [Fact]
    public async Task BossVictoryAndConcurrentReplayAwardOnceThenOtherModeGetsQuarterReward()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.BossId());
        for (var i = 0; i < 4; i++) attempt = await Answer(client, attempt, true);
        var payload = new AnswerRequest(await Option(attempt, true), Guid.NewGuid());
        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => client.PutAsJsonAsync($"/api/attempts/{attempt.Id}/questions/{attempt.CurrentQuestion!.Id}/answer", payload)));
        foreach (var response in responses)
        {
            var won = await Read(response);
            Assert.Equal(AttemptStatus.Passed, won.Status);
            Assert.Equal(0, won.BossHpRemaining);
            Assert.Equal(150, won.Reward!.Xp);
            Assert.Equal(50, won.Reward.Coins);
        }
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        Assert.Equal(170, profile.TotalXp);
        var topics = (await client.GetFromJsonAsync<List<TopicResponse>>($"/api/courses/{DemoData.CourseId}/topics"))!;
        Assert.Equal("Completed", topics[0].Status);
        Assert.Equal("Available", topics[1].Status);
        var crisis = await Pass(client, await SendStart(client, DemoGameContent.CrisisId()));
        Assert.False(crisis.Reward!.IsFirstPass);
        Assert.Equal(25, crisis.Reward.Xp);
        Assert.Equal(7, crisis.Reward.Coins);
        Assert.False(crisis.Reward.PerfectBonus);
        profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        Assert.Equal(195, profile.TotalXp);
        Assert.Equal(57, profile.CoinsBalance);
        await using var db = fixture.CreateDatabase();
        Assert.Equal(1, await db.TopicProgress.CountAsync(item => item.UserId == profile.UserId));
        Assert.Equal(2, await db.RewardGrants.CountAsync(item => item.UserId == profile.UserId));
    }

    [Fact]
    public async Task ThreeWrongBossAnswersLoseWithoutRewardAndRetryCanWinFirstPrize()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.BossId());
        for (var i = 0; i < 3; i++) attempt = await Answer(client, attempt, false);
        Assert.Equal(AttemptStatus.Failed, attempt.Status);
        Assert.Null(attempt.Reward);
        Assert.Equal(3, attempt.Errors);
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        Assert.Equal(20, profile.TotalXp);
        Assert.Equal(0, profile.CoinsBalance);
        var won = await Pass(client, await SendStart(client, DemoGameContent.BossId()));
        Assert.True(won.Reward!.IsFirstPass);
        Assert.True(won.Reward.PerfectBonus);
    }

    [Fact]
    public async Task OfflineBossAttemptUsesOriginalDeadlinesAndLosesAfterThreeTimeouts()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.BossId());
        fixture.Clock.Advance(TimeSpan.FromSeconds(181));
        var result = await Read(await client.GetAsync($"/api/attempts/{attempt.Id}"));
        Assert.Equal(AttemptStatus.Failed, result.Status);
        Assert.Equal(3, result.Errors);
        Assert.Null(result.Reward);
        Assert.Equal(attempt.ExpiresAt!.Value.AddSeconds(120), result.FinishedAt);
    }

    [Fact]
    public async Task QteIntroStartsNoGameTimerAndWrongChoiceReplayDoesNotChargeTwice()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.CrisisId());
        Assert.True(attempt.IsReady);
        Assert.Null(attempt.CurrentQuestion);
        fixture.Clock.Advance(TimeSpan.FromSeconds(90));
        attempt = await Read(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        var deadline = attempt.ExpiresAt;
        var questionId = attempt.CurrentQuestion!.Id;
        var request = new AnswerRequest(await Option(attempt, false), Guid.NewGuid());
        var path = $"/api/attempts/{attempt.Id}/questions/{questionId}/answer";
        attempt = await Read(await client.PutAsJsonAsync(path, request));
        Assert.Equal(1, attempt.Errors);
        Assert.Equal(questionId, attempt.CurrentQuestion!.Id);
        Assert.Equal(deadline!.Value.AddSeconds(-10), attempt.ExpiresAt);
        var replay = await Read(await client.PutAsJsonAsync(path, request));
        Assert.Equal(1, replay.Errors);
        Assert.Equal(attempt.ExpiresAt, replay.ExpiresAt);
        var sameOption = await Read(await client.PutAsJsonAsync(path, request with { RequestId = Guid.NewGuid() }));
        Assert.Equal(1, sameOption.Errors);
        Assert.Equal(replay.ExpiresAt, sameOption.ExpiresAt);
        Assert.True(replay.CurrentQuestion!.Options.Single(option => option.Id == request.SelectedOptionId).IsDisabled);
        attempt = await Answer(client, replay, false);
        Assert.Equal(2, attempt.Errors);
        var won = await Pass(client, attempt);
        Assert.Equal(AttemptStatus.Passed, won.Status);
        Assert.Equal(100, won.Reward!.Xp);
        Assert.Equal(30, won.Reward.Coins);
        Assert.Equal(4, won.Review!.Count);
        Assert.Equal(2, won.Review[0].WrongChoices.Count);
    }

    [Fact]
    public async Task QteThreeErrorsLoseAndLaterFailureDoesNotRemoveCompletedTopic()
    {
        using var client = await Ready();
        await Pass(client, await SendStart(client, DemoGameContent.BossId()));
        var attempt = await SendStart(client, DemoGameContent.CrisisId());
        attempt = await Read(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        attempt = await Answer(client, attempt, false);
        attempt = await Answer(client, attempt, false);
        attempt = await Answer(client, attempt, true);
        attempt = await Answer(client, attempt, false);
        Assert.Equal(AttemptStatus.Failed, attempt.Status);
        Assert.Null(attempt.Reward);
        var topics = (await client.GetFromJsonAsync<List<TopicResponse>>($"/api/courses/{DemoData.CourseId}/topics"))!;
        Assert.Equal("Completed", topics[0].Status);
        Assert.Equal("Available", topics[1].Status);
    }

    [Fact]
    public async Task QteDeadlineAndRefreshCannotGrantAdditionalTime()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.CrisisId());
        attempt = await Read(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        var same = await Read(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        Assert.Equal(attempt.ExpiresAt, same.ExpiresAt);
        fixture.Clock.Advance(TimeSpan.FromSeconds(61));
        var result = await Read(await client.GetAsync($"/api/attempts/{attempt.Id}"));
        Assert.Equal(AttemptStatus.Failed, result.Status);
        Assert.Equal("TimeExpired", result.FinishReason);
        Assert.Equal(attempt.ExpiresAt, result.FinishedAt);
        Assert.Null(result.Reward);
    }

    [Fact]
    public async Task LateBossAnswerIsNotAppliedToTheNextQuestion()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.BossId());
        var option = await Option(attempt, true);
        fixture.Clock.Advance(TimeSpan.FromSeconds(61));
        var next = await Read(await client.PutAsJsonAsync($"/api/attempts/{attempt.Id}/questions/{attempt.CurrentQuestion!.Id}/answer", new AnswerRequest(option, Guid.NewGuid())));
        Assert.Equal(1, next.Errors);
        Assert.Equal(0, next.CorrectAnswers);
        Assert.Equal(2, next.CurrentQuestion!.Position);
        Assert.Equal(attempt.ExpiresAt!.Value.AddSeconds(60), next.ExpiresAt);
    }

    [Fact]
    public async Task ConcurrentStartReturnsOneAttemptAndBlocksTheOtherMode()
    {
        using var client = await Ready();
        var starts = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => SendStart(client, DemoGameContent.BossId())));
        Assert.Single(starts.Select(attempt => attempt.Id).Distinct());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/assessments/{DemoGameContent.CrisisId()}/attempts", new { })).StatusCode);
        var restored = await Read(await client.GetAsync("/api/me/attempts/active"));
        Assert.Equal(starts[0].Id, restored.Id);
    }

    [Fact]
    public async Task LiveQuestionDoesNotExposeCorrectAnswersAndRejectsForeignOption()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.BossId());
        var raw = await client.GetStringAsync($"/api/attempts/{attempt.Id}");
        Assert.DoesNotContain("\"isCorrect\"", raw);
        Assert.DoesNotContain("\"correctAnswer\"", raw);
        Assert.Null(attempt.Review);
        var path = $"/api/attempts/{attempt.Id}/questions/{attempt.CurrentQuestion!.Id}/answer";
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(path, new AnswerRequest(Guid.NewGuid(), Guid.NewGuid()))).StatusCode);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(path, new AnswerRequest(await Option(attempt, true), Guid.NewGuid()))).StatusCode);
    }

    [Fact]
    public async Task RetryPrefersUnseenQuestionsAndANewCrisisScenario()
    {
        using var client = await Ready();
        var first = await SendStart(client, DemoGameContent.BossId());
        var finished = await Pass(client, first);
        var next = await SendStart(client, DemoGameContent.BossId());
        await using var db = fixture.CreateDatabase();
        var seen = await db.AttemptQuestions.Where(question => question.AttemptId == first.Id && question.Status != AttemptQuestionStatus.Pending).Select(question => question.QuestionId).ToListAsync();
        var selected = await db.AttemptQuestions.Where(question => question.AttemptId == next.Id).Select(question => question.QuestionId).ToListAsync();
        Assert.Equal(5, selected.Count(id => !seen.Contains(id)));
        await client.PostAsJsonAsync($"/api/attempts/{next.Id}/abandon", new { });
        var crisis = await SendStart(client, DemoGameContent.CrisisId());
        await client.PostAsJsonAsync($"/api/attempts/{crisis.Id}/abandon", new { });
        var other = await SendStart(client, DemoGameContent.CrisisId());
        Assert.NotEqual(crisis.Scenario!.Title, other.Scenario!.Title);
    }

    [Fact]
    public async Task PassingAllTopicsReachesOneHundredPercentAndRepeatsDoNotIncreaseIt()
    {
        using var client = await fixture.CreateStudentAsync();
        for (var topic = 1; topic <= 3; topic++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/me/lessons/{DemoGameContent.LessonId(topic)}/completion", new { })).StatusCode);
            await Pass(client, await SendStart(client, DemoGameContent.BossId(topic)));
        }
        var courses = (await client.GetFromJsonAsync<List<CourseResponse>>("/api/courses"))!;
        var course = courses.Single(item => item.Id == DemoData.CourseId);
        Assert.Equal(3, course.CompletedTopics);
        Assert.Equal(100, course.ProgressPercent);
        await Pass(client, await SendStart(client, DemoGameContent.BossId()));
        courses = (await client.GetFromJsonAsync<List<CourseResponse>>("/api/courses"))!;
        Assert.Equal(100, courses.Single(item => item.Id == DemoData.CourseId).ProgressPercent);
    }

    [Fact]
    public async Task ExpiryWorkerFinishesAnAttemptWithoutAnyClientRequest()
    {
        using var client = await Ready();
        var attempt = await SendStart(client, DemoGameContent.BossId());
        fixture.Clock.Advance(TimeSpan.FromSeconds(181));
        using var worker = new AttemptExpiryWorker(fixture.Factory.Services.GetRequiredService<IServiceScopeFactory>(), fixture.Clock,
            Options.Create(new GameOptions { EnableExpiryWorker = true }), NullLogger<AttemptExpiryWorker>.Instance);
        await worker.StartAsync(CancellationToken.None);
        try
        {
            var finished = false;
            for (var i = 0; i < 30; i++)
            {
                await using var db = fixture.CreateDatabase();
                if (await db.Attempts.AnyAsync(row => row.Id == attempt.Id && row.Status == AttemptStatus.Failed)) { finished = true; break; }
                await Task.Delay(100);
            }
            Assert.True(finished);
        }
        finally { await worker.StopAsync(CancellationToken.None); }
    }
}
