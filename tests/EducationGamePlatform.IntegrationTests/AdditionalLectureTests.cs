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

[CollectionDefinition("Additional lectures", DisableParallelization = true)]
public sealed class AdditionalLectureCollection : ICollectionFixture<ApiFixture>;

[Collection("Additional lectures")]
public sealed class AdditionalLectureTests(ApiFixture fixture)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public async Task LectureImportPreservesHistoryAndReadingUnlocksTopicsAndCourseCompletion()
    {
        using var client = await fixture.CreateStudentAsync();
        var mark = await client.PutAsJsonAsync($"/api/me/lessons/{DemoData.LessonId}/completion", new { });
        mark.EnsureSuccessStatusCode();
        var oldMark = await mark.Content.ReadFromJsonAsync<CompletionResponse>();
        var attempt = await ReadAttempt(await client.PostAsJsonAsync($"/api/assessments/{DemoGameContent.BossId()}/attempts", new { }));

        await using var database = fixture.CreateDatabase();
        await DemoData.SeedAsync(database, includeAnalyst: true);
        await DemoData.SeedAsync(database, includeAnalyst: true);
        Assert.Equal(8, await database.Topics.CountAsync(topic => topic.CourseId == DemoData.CourseId && topic.IsPublished));
        Assert.Equal(8, await database.Lessons.CountAsync(lesson => lesson.Topic.CourseId == DemoData.CourseId));
        var resumed = await client.GetFromJsonAsync<AttemptResponse>($"/api/attempts/{attempt.Id}", Json);
        Assert.Equal(attempt.CurrentQuestion!.Id, resumed!.CurrentQuestion!.Id);
        Assert.Equal(oldMark!.CompletedAt, (await client.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoData.LessonId}"))!.CompletedAt);
        (await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/abandon", new { })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync($"/api/lessons/{DemoGameContent.LessonId(4)}")).StatusCode);

        for (var order = 1; order <= 3; order++)
        {
            (await client.PutAsJsonAsync($"/api/me/lessons/{DemoGameContent.LessonId(order)}/completion", new { })).EnsureSuccessStatusCode();
            var game = await ReadAttempt(await client.PostAsJsonAsync($"/api/assessments/{DemoGameContent.BossId(order)}/attempts", new { }));
            while (game.Status == AttemptStatus.Active)
            {
                var option = await database.AttemptQuestions.Where(question => question.Id == game.CurrentQuestion!.Id)
                    .SelectMany(question => question.Question.Options).SingleAsync(option => option.IsCorrect);
                game = await ReadAttempt(await client.PutAsJsonAsync($"/api/attempts/{game.Id}/questions/{game.CurrentQuestion!.Id}/answer",
                    new AnswerRequest(option.Id, Guid.NewGuid())));
            }
            Assert.Equal(AttemptStatus.Passed, game.Status);
            Assert.Null(game.CompletedCourseId);
        }
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/me/courses/{DemoData.CourseId}/completion/claim", new { })).StatusCode);

        for (var order = 4; order <= 8; order++)
        {
            var topic = await client.GetFromJsonAsync<TopicDetails>($"/api/topics/{DemoGameContent.TopicId(order)}");
            Assert.Empty(topic!.Assessments);
            var lesson = await client.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoGameContent.LessonId(order)}");
            Assert.StartsWith($"# Тема {order}:", lesson!.ContentMarkdown.TrimStart('\uFEFF'));
            Assert.True(lesson.ContentMarkdown.Length > 5000);
            var before = await client.GetFromJsonAsync<ProfileResponse>("/api/me");
            var response = await client.PutAsJsonAsync($"/api/me/lessons/{lesson.Id}/completion", new { });
            response.EnsureSuccessStatusCode();
            Assert.Equal(20, (await response.Content.ReadFromJsonAsync<CompletionResponse>())!.XpAwarded);
            response = await client.PutAsJsonAsync($"/api/me/lessons/{lesson.Id}/completion", new { });
            Assert.Equal(0, (await response.Content.ReadFromJsonAsync<CompletionResponse>())!.XpAwarded);
            var after = await client.GetFromJsonAsync<ProfileResponse>("/api/me");
            Assert.Equal(before!.TotalXp + 20, after!.TotalXp);
            Assert.Equal(before.CoinsBalance, after.CoinsBalance);
            var states = await client.GetFromJsonAsync<List<TopicResponse>>($"/api/courses/{DemoData.CourseId}/topics");
            Assert.Equal("Completed", states!.Single(item => item.SortOrder == order).Status);
            if (order < 8) Assert.Equal("Available", states!.Single(item => item.SortOrder == order + 1).Status);
        }
        var course = Assert.Single((await client.GetFromJsonAsync<List<CourseResponse>>("/api/courses"))!);
        Assert.Equal(100, course.ProgressPercent);
        Assert.Equal(8, course.CompletedTopics);
        (await client.PostAsJsonAsync($"/api/me/courses/{course.Id}/completion/claim", new { })).EnsureSuccessStatusCode();
        await DemoData.SeedAsync(database, includeAnalyst: true);
        Assert.Equal(100, Assert.Single((await client.GetFromJsonAsync<List<CourseResponse>>("/api/courses"))!).ProgressPercent);
    }

    private static async Task<AttemptResponse> ReadAttempt(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AttemptResponse>(Json))!;
    }
}
