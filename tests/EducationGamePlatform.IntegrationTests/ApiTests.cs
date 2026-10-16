using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Auth;
using EducationGamePlatform.Features.Catalog;
using EducationGamePlatform.Features.Profile;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EducationGamePlatform.IntegrationTests;

[Collection("PostgreSQL API")]
public sealed class ApiTests(ApiFixture fixture)
{
    [Fact]
    public async Task AnonymousUserCannotReadProfileOrCatalog()
    {
        using var client = fixture.CreateClient();
        foreach (var path in new[] { "/api/me", "/api/courses", $"/api/lessons/{DemoData.LessonId}" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType!.MediaType);
        }
    }

    [Fact]
    public async Task MissingCsrfTokenRejectsRegistration()
    {
        using var client = fixture.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("csrf@example.test", "Development123!", "Test"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("InvalidCsrfToken", body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task RegistrationLoginAndLogoutKeepPasswordAndBalancePrivate()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = await client.GetFromJsonAsync<ProfileResponse>("/api/me");
        Assert.Equal("Студент", profile!.DisplayName);
        Assert.Equal(0, profile.TotalXp);
        Assert.Equal(0, profile.CoinsBalance);
        await using var database = fixture.CreateDatabase();
        var user = await database.Users.SingleAsync(user => user.Id == profile.UserId);
        Assert.NotNull(user.PasswordHash);
        Assert.NotEqual("Development123!", user.PasswordHash);
        Assert.Empty(await database.UserRoles.Where(role => role.UserId == profile.UserId).ToListAsync());
        var logout = await client.PostAsJsonAsync("/api/auth/logout", new { });
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me")).StatusCode);
    }

    [Fact]
    public async Task InvalidPasswordDoesNotLeaveAnAccountOrProfile()
    {
        using var client = fixture.CreateClient();
        await ApiFixture.RefreshCsrfAsync(client);
        var email = $"invalid-{Guid.NewGuid():N}@example.test";
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "short", "Test"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var database = fixture.CreateDatabase();
        Assert.False(await database.Users.AnyAsync(user => user.Email == email));
    }

    [Fact]
    public async Task DuplicateEmailIsRejectedIgnoringCase()
    {
        using var client = fixture.CreateClient();
        await ApiFixture.RefreshCsrfAsync(client);
        var email = $"duplicate-{Guid.NewGuid():N}@example.test";
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Development123!", "Test"))).StatusCode);
        var duplicate = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email.ToUpperInvariant(), "Development123!", "Test"));
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        await using var database = fixture.CreateDatabase();
        Assert.Equal(1, await database.Users.CountAsync(user => user.NormalizedEmail == email.ToUpperInvariant()));
    }

    [Fact]
    public async Task LoginDoesNotDistinguishUnknownAccountFromWrongPassword()
    {
        using var client = fixture.CreateClient();
        await ApiFixture.RefreshCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("unknown@example.test", "Development123!"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("Invalid credentials", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ReadingCompletionIsIdempotentEvenForSimultaneousRequestsAndPrivateToStudent()
    {
        using var first = await fixture.CreateStudentAsync();
        using var second = await fixture.CreateStudentAsync();
        var path = $"/api/me/lessons/{DemoData.LessonId}/completion";
        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => first.PutAsJsonAsync(path, new { })));
        var timestamps = new List<DateTimeOffset>();
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            timestamps.Add((await response.Content.ReadFromJsonAsync<CompletionResponse>())!.CompletedAt);
        }
        Assert.Single(timestamps.Distinct());
        Assert.NotNull((await first.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoData.LessonId}"))!.CompletedAt);
        Assert.Null((await second.GetFromJsonAsync<LessonResponse>($"/api/lessons/{DemoData.LessonId}"))!.CompletedAt);
        var profile = (await first.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        Assert.Equal(20, profile.TotalXp);
        Assert.Equal(0, profile.CoinsBalance);
        var topics = await first.GetFromJsonAsync<List<TopicResponse>>($"/api/courses/{DemoData.CourseId}/topics");
        Assert.Equal(1, topics!.Single(topic => topic.Id == DemoData.TopicId).CompletedLessons);
        await using var database = fixture.CreateDatabase();
        Assert.Equal(1, await database.LessonProgress.CountAsync(progress => progress.UserId == profile.UserId));
    }

    [Theory]
    [InlineData("course")]
    [InlineData("topic")]
    [InlineData("lesson")]
    public async Task UnpublishedContentIsHiddenAtEveryLevel(string hiddenLevel)
    {
        var course = new Course { Slug = $"hidden-{Guid.NewGuid():N}", Title = "Hidden", IsPublished = hiddenLevel != "course" };
        var topic = new Topic { Course = course, Title = "Hidden", IsPublished = hiddenLevel != "topic" };
        var lesson = new Lesson { Topic = topic, Title = "Hidden", ContentMarkdown = "Private", IsPublished = hiddenLevel != "lesson" };
        await using var database = fixture.CreateDatabase();
        database.Lessons.Add(lesson);
        await database.SaveChangesAsync();
        using var client = await fixture.CreateStudentAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/lessons/{lesson.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"/api/me/lessons/{lesson.Id}/completion", new { })).StatusCode);
        if (hiddenLevel != "lesson")
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/topics/{topic.Id}")).StatusCode);
        if (hiddenLevel == "course")
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/courses/{course.Id}/topics")).StatusCode);
    }

    [Fact]
    public async Task ReadinessFrontendAndOpenApiAreAvailable()
    {
        using var client = fixture.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        var openApi = JsonDocument.Parse(await client.GetStringAsync("/openapi/v1.json"));
        var paths = openApi.RootElement.GetProperty("paths");
        Assert.True(paths.TryGetProperty("/api/auth/register", out _));
        Assert.True(paths.TryGetProperty("/api/me", out _));
        Assert.True(paths.TryGetProperty("/api/assessments/{assessmentId}/attempts", out _));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/js/router.js")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/appsettings.Local.json")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/not-an-endpoint")).StatusCode);
        await using var database = fixture.CreateDatabase();
        Assert.Equal(1, await database.Courses.CountAsync(course => course.Id == DemoData.CourseId));
    }

    [Fact]
    public async Task DatabaseRejectsNegativeCurrencyBalance()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        await using var database = fixture.CreateDatabase();
        var error = await Assert.ThrowsAsync<PostgresException>(() => database.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE \"PlayerProfiles\" SET \"CoinsBalance\" = -1 WHERE \"UserId\" = {profile.UserId}"));
        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(0, (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!.CoinsBalance);
    }
}
