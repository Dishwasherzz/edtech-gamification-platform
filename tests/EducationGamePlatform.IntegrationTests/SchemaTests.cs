using System.Net.Http.Json;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Profile;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EducationGamePlatform.IntegrationTests;

[Collection("PostgreSQL API")]
public sealed class SchemaTests(ApiFixture fixture)
{
    [Fact]
    public async Task RewardCannotBeGrantedTwiceAcrossDifferentSuccessfulAttempts()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        await using var database = fixture.CreateDatabase();
        var version = await CreateAssessmentAsync(database);
        var first = CreateAttempt(profile.UserId, version);
        var second = CreateAttempt(profile.UserId, version);
        database.Attempts.AddRange(first, second);
        await database.SaveChangesAsync();
        database.RewardGrants.Add(new RewardGrant
        {
            AttemptId = first.Id, UserId = profile.UserId, AssessmentId = version.AssessmentId, TopicId = DemoData.TopicId,
            XpAmount = 100, CoinsAmount = 10, GrantedAt = DateTimeOffset.UtcNow
        });
        await database.SaveChangesAsync();
        database.RewardGrants.Add(new RewardGrant
        {
            AttemptId = second.Id, UserId = profile.UserId, AssessmentId = version.AssessmentId, TopicId = DemoData.TopicId,
            XpAmount = 100, CoinsAmount = 10, GrantedAt = DateTimeOffset.UtcNow
        });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => database.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    [Fact]
    public async Task AnswerCannotSelectAnOptionFromAnotherQuestion()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        await using var database = fixture.CreateDatabase();
        var version = await CreateAssessmentAsync(database);
        var attempt = CreateAttempt(profile.UserId, version);
        attempt.Status = AttemptStatus.Active;
        attempt.FinishedAt = null;
        database.Attempts.Add(attempt);
        await database.SaveChangesAsync();
        var attemptQuestion = new AttemptQuestion
        {
            AttemptId = attempt.Id, AssessmentVersionId = version.Id, QuestionId = version.Questions[0].Id,
            Position = 0, Status = AttemptQuestionStatus.Presented,
            PresentedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(60)
        };
        database.AttemptQuestions.Add(attemptQuestion);
        await database.SaveChangesAsync();
        database.AttemptAnswers.Add(new AttemptAnswer
        {
            AttemptQuestionId = attemptQuestion.Id, QuestionId = version.Questions[0].Id,
            SelectedOptionId = version.Questions[1].Options[0].Id, ReceivedAt = DateTimeOffset.UtcNow
        });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => database.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    [Fact]
    public async Task AttemptCannotUseTheVersionOfAnotherAssessment()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        await using var database = fixture.CreateDatabase();
        var first = await CreateAssessmentAsync(database);
        var other = await CreateAssessmentAsync(database);
        var attempt = CreateAttempt(profile.UserId, first);
        // A fresh context avoids navigation fixup correcting this deliberately invalid FK pair.
        await using var invalidDatabase = fixture.CreateDatabase();
        attempt.AssessmentId = other.AssessmentId;
        invalidDatabase.Attempts.Add(attempt);
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => invalidDatabase.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    private static Attempt CreateAttempt(Guid userId, AssessmentVersion version) => new()
    {
        UserId = userId, AssessmentId = version.AssessmentId, AssessmentVersionId = version.Id, TopicId = DemoData.TopicId,
        Status = AttemptStatus.Passed, QuestionCount = 2, CorrectAnswers = 1,
        StartedAt = DateTimeOffset.UtcNow.AddMinutes(-1), FinishedAt = DateTimeOffset.UtcNow
    };

    private static async Task<AssessmentVersion> CreateAssessmentAsync(AppDbContext database)
    {
        var assessment = new Assessment { TopicId = DemoData.TopicId, Title = "Schema test", IsPublished = false };
        var version = new AssessmentVersion
        {
            Assessment = assessment, VersionNumber = 1, RequiredCorrectAnswers = 1,
            Questions = Enumerable.Range(0, 2).Select(index => new Question
            {
                Prompt = $"Question {index}", SortOrder = index,
                Options = [new AnswerOption { Text = "A", SortOrder = 0, IsCorrect = true },
                    new AnswerOption { Text = "B", SortOrder = 1 }]
            }).ToList()
        };
        database.AssessmentVersions.Add(version);
        await database.SaveChangesAsync();
        return version;
    }
}
