using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Channels;
using EducationGamePlatform.Features.Auth;
using EducationGamePlatform.Features.Catalog;
using EducationGamePlatform.Features.Profile;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;

namespace EducationGamePlatform.IntegrationTests;

[Collection("PostgreSQL API")]
public sealed class AccountFeatureTests(ApiFixture fixture)
{
    [Fact]
    public async Task GuestSeesMetadataAndInstructionsWhileLessonContentStaysProtected()
    {
        using var client = fixture.CreateClient();
        var path = $"/api/public/courses/{DemoData.CourseId}/topics";
        var cards = await client.GetFromJsonAsync<List<PublicTopicCard>>(path);
        Assert.Equal(3, cards!.Count);
        Assert.All(cards, card => Assert.True(card.RequiresSignIn));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/instructions")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"/api/lessons/{DemoData.LessonId}")).StatusCode);
    }

    [Fact]
    public async Task RegistrationChecksConsentVersionAndNicknameAndSavesSelectedHero()
    {
        using var host = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.PostConfigure<AccountOptions>(options =>
            {
                options.RequireConsent = true;
                options.ConsentVersion = "test-v2";
                options.ConsentText = "Согласие для тестовой базы.";
            })));
        using var client = Client(host);
        await ApiFixture.RefreshCsrfAsync(client);
        var email = $"consent-{Guid.NewGuid():N}@example.test";
        var request = new RegisterRequest(email, "NewPass1", "Фаза_01", "ampere", true, "old", true);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/register", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/register",
            request with { ConsentVersion = "test-v2", AcceptConsent = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/auth/register",
            request with { ConsentVersion = "test-v2" })).StatusCode);
        var profile = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        Assert.Equal(email, profile.Email);
        Assert.Equal("ampere", profile.Hero!.Key);
        Assert.Equal("test-v2", profile.ConsentVersion);
        Assert.NotNull(profile.ConsentAcceptedAt);

        using var other = Client(host);
        await ApiFixture.RefreshCsrfAsync(other);
        var duplicate = await other.PostAsJsonAsync("/api/auth/register",
            request with { Email = $"other-{Guid.NewGuid():N}@example.test", DisplayName = "фаза_01", ConsentVersion = "test-v2" });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Contains("displayName", await duplicate.Content.ReadAsStringAsync());

        await ApiFixture.RefreshCsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync("/api/me/nickname", new ChangeNicknameRequest("Фаза_02"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync("/api/me/hero", new ChangeHeroRequest("phase"))).StatusCode);
        var updated = (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        Assert.Equal("Фаза_02", updated.DisplayName);
        Assert.Equal("phase", updated.Hero!.Key);
        Assert.Equal(profile.ConsentAcceptedAt, updated.ConsentAcceptedAt);
    }

    [Fact]
    public async Task RecoveryDoesNotRevealEmailExistenceAndTheTokenOnlyResetsOnce()
    {
        var mailbox = new TestMailer();
        using var host = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.AddSingleton<IPasswordResetMailer>(mailbox);
            services.PostConfigure<PasswordMailOptions>(options => options.ResetPageUrl = "https://localhost/#/auth/reset");
        }));
        using var registered = await fixture.CreateStudentAsync();
        var profile = (await registered.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
        using var client = Client(host);
        await ApiFixture.RefreshCsrfAsync(client);
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest(profile.Email!));
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("no-account@example.test"));
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var message = await mailbox.Messages.Reader.ReadAsync(timeout.Token);
        Assert.Equal(profile.Email, message.Email);
        var uri = new Uri(message.Link);
        Assert.Empty(uri.Query);
        var query = QueryHelpers.ParseQuery(uri.Fragment[uri.Fragment.IndexOf('?')..]);
        var reset = new ResetPasswordRequest(Guid.Parse(query["userId"].ToString()), query["token"].ToString(), "Changed9");
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/reset-password", reset)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password",
            reset with { NewPassword = "Different9" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await registered.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(profile.Email!, "Development123!"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(profile.Email!, "Changed9"))).StatusCode);
        await ApiFixture.RefreshCsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync("/api/me/password",
            new ChangePasswordRequest("Changed9", "Changed10"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/me")).StatusCode);
    }

    private static HttpClient Client(WebApplicationFactory<Program> host) => host.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("https://localhost")
    });

    private sealed class TestMailer : IPasswordResetMailer
    {
        public bool Enabled => true;
        public Channel<(string Email, string Link)> Messages { get; } = Channel.CreateUnbounded<(string, string)>();
        public async Task SendAsync(string email, string resetLink, CancellationToken token) =>
            await Messages.Writer.WriteAsync((email, resetLink), token);
    }
}
