using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Cosmetics;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Features.Profile;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.IntegrationTests;

[Collection("PostgreSQL API")]
public sealed class CosmeticsTests(ApiFixture fixture)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private async Task<ProfileResponse> Profile(HttpClient client) => (await client.GetFromJsonAsync<ProfileResponse>("/api/me"))!;
    private async Task Fund(HttpClient client, int coins)
    {
        var id = (await Profile(client)).UserId;
        await using var db = fixture.CreateDatabase();
        await db.PlayerProfiles.Where(profile => profile.UserId == id).ExecuteUpdateAsync(update => update.SetProperty(profile => profile.CoinsBalance, coins));
    }
    private static string PurchasePath(Guid skinId) => $"/api/shop/skins/{skinId}/purchase";
    private async Task<PurchaseResponse> Purchase(HttpClient client, Guid skinId, Guid? requestId = null)
        => await Read<PurchaseResponse>(await client.PostAsJsonAsync(PurchasePath(skinId), new PurchaseSkinRequest(requestId ?? Guid.NewGuid())));
    private async Task<AttemptResponse> Start(HttpClient client, bool crisis = false)
    {
        await client.PutAsJsonAsync($"/api/me/lessons/{DemoData.LessonId}/completion", new { });
        return await Read<AttemptResponse>(await client.PostAsJsonAsync($"/api/assessments/{(crisis ? DemoGameContent.CrisisId() : DemoGameContent.BossId())}/attempts", new { }));
    }
    private async Task<AttemptResponse> Answer(HttpClient client, AttemptResponse attempt, bool correct)
    {
        await using var db = fixture.CreateDatabase();
        var disabled = attempt.CurrentQuestion!.Options.Where(option => option.IsDisabled).Select(option => option.Id).ToArray();
        var id = await db.AttemptQuestions.Where(question => question.Id == attempt.CurrentQuestion.Id)
            .SelectMany(question => question.Question.Options).Where(option => option.IsCorrect == correct && !disabled.Contains(option.Id))
            .Select(option => option.Id).FirstAsync();
        return await Read<AttemptResponse>(await client.PutAsJsonAsync($"/api/attempts/{attempt.Id}/questions/{attempt.CurrentQuestion.Id}/answer",
            new AnswerRequest(id, Guid.NewGuid())));
    }

    [Fact]
    public async Task NewAndLegacyProfilesHaveAFreeDefaultAppearanceWithoutChangingAvatarOrBalance()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = await Profile(client);
        Assert.Equal("default", profile.AvatarKey);
        Assert.Equal(CosmeticDefaults.DefaultSkinId, profile.CharacterSkin!.Id);
        Assert.Equal(CosmeticDefaults.DefaultMascotId, profile.Mascot!.Id);
        Assert.Equal(0, profile.CoinsBalance);
        var owned = (await client.GetFromJsonAsync<List<SkinResponse>>("/api/me/skins"))!;
        var starter = Assert.Single(owned);
        Assert.True(starter.IsOwned);
        Assert.True(starter.IsEquipped);
        Assert.Equal(0, starter.PriceCoins);
        await using var db = fixture.CreateDatabase();
        var row = await db.PlayerProfiles.SingleAsync(item => item.UserId == profile.UserId);
        Assert.Null(row.EquippedSkinId);
        Assert.Null(row.SelectedMascotId);
        Assert.Empty(await db.SkinPurchases.Where(item => item.UserId == profile.UserId).ToListAsync());
    }

    [Fact]
    public async Task CatalogProvidesMultipleCharactersAndModeSpecificVictoryAndDefeatVariants()
    {
        using var client = await fixture.CreateStudentAsync();
        var list = (await client.GetFromJsonAsync<List<MascotResponse>>("/api/mascots"))!;
        var seeded = list.Where(item => new[] { CosmeticDefaults.DefaultMascotId, CosmeticDefaults.OhmMascotId, CosmeticDefaults.RelayMascotId }.Contains(item.Id)).ToList();
        Assert.Equal(3, seeded.Count);
        foreach (var mascot in seeded)
        {
            var details = await Read<MascotDetails>(await client.GetAsync($"/api/mascots/{mascot.Id}"));
            Assert.Equal(mascot.Id, details.Mascot.Id);
            foreach (var context in new[] { MascotContext.Boss, MascotContext.Crisis })
                foreach (var eventType in new[] { MascotEvent.Victory, MascotEvent.Defeat })
                    Assert.Equal(2, details.Reactions.Count(reaction => reaction.Context == context && reaction.Event == eventType));
        }
    }

    [Fact]
    public async Task PurchaseOwnsAndEquipsSkinAndTheOtherPlayerCannotUseIt()
    {
        using var owner = await fixture.CreateStudentAsync();
        using var other = await fixture.CreateStudentAsync();
        await Fund(owner, 50);
        var purchase = await Purchase(owner, CosmeticDefaults.CopperSkinId);
        Assert.Equal(30, purchase.CoinsSpent);
        Assert.Equal(20, purchase.CoinsBalance);
        Assert.False(purchase.IsReplay);
        var appearance = await Read<AppearanceResponse>(await owner.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(CosmeticDefaults.CopperSkinId)));
        Assert.Equal(CosmeticDefaults.CopperSkinId, appearance.CharacterSkin.Id);
        Assert.Equal(CosmeticDefaults.CopperSkinId, (await Profile(owner)).CharacterSkin!.Id);
        Assert.Equal("default", (await Profile(owner)).AvatarKey);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(CosmeticDefaults.CopperSkinId))).StatusCode);
        Assert.Single((await owner.GetFromJsonAsync<List<PurchaseHistoryResponse>>("/api/me/purchases"))!);
        Assert.Empty((await other.GetFromJsonAsync<List<PurchaseHistoryResponse>>("/api/me/purchases"))!);
        await Read<AppearanceResponse>(await owner.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(CosmeticDefaults.DefaultSkinId)));
        Assert.Equal(20, (await Profile(owner)).CoinsBalance);
    }

    [Fact]
    public async Task InsufficientCoinsCannotCreateReceiptOrOwnershipOrChangeBalance()
    {
        using var client = await fixture.CreateStudentAsync();
        var profile = await Profile(client);
        var response = await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.NeonSkinId), new PurchaseSkinRequest(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("InsufficientCoins", await response.Content.ReadAsStringAsync());
        Assert.Equal(0, (await Profile(client)).CoinsBalance);
        await using var db = fixture.CreateDatabase();
        Assert.False(await db.SkinPurchases.AnyAsync(item => item.UserId == profile.UserId));
        Assert.False(await db.UserSkins.AnyAsync(item => item.UserId == profile.UserId));
    }

    [Fact]
    public async Task ConcurrentReplayChargesOnceAndRequestCannotBeReusedForAnotherSkin()
    {
        using var client = await fixture.CreateStudentAsync();
        await Fund(client, 100);
        var requestId = Guid.NewGuid();
        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Purchase(client, CosmeticDefaults.CopperSkinId, requestId)));
        Assert.Single(results.Select(item => item.Id).Distinct());
        Assert.Equal(1, results.Count(item => !item.IsReplay));
        Assert.Equal(70, (await Profile(client)).CoinsBalance);
        var conflict = await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.NeonSkinId), new PurchaseSkinRequest(requestId));
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        Assert.Contains("RequestConflict", await conflict.Content.ReadAsStringAsync());
        var duplicate = await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.CopperSkinId), new PurchaseSkinRequest(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal(70, (await Profile(client)).CoinsBalance);
    }

    [Fact]
    public async Task ParallelPurchasesCannotOverspendTheSameBalance()
    {
        using var client = await fixture.CreateStudentAsync();
        await Fund(client, 80);
        var requests = await Task.WhenAll(new[] { CosmeticDefaults.CopperSkinId, CosmeticDefaults.NeonSkinId }
            .Select(id => client.PostAsJsonAsync(PurchasePath(id), new PurchaseSkinRequest(Guid.NewGuid()))));
        Assert.Single(requests, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(requests, response => response.StatusCode == HttpStatusCode.Conflict);
        var profile = await Profile(client);
        await using var db = fixture.CreateDatabase();
        var receipt = await db.SkinPurchases.SingleAsync(item => item.UserId == profile.UserId);
        Assert.Equal(80 - receipt.PricePaid, profile.CoinsBalance);
        Assert.Equal(1, await db.UserSkins.CountAsync(item => item.UserId == profile.UserId));
    }

    [Fact]
    public async Task ReplayKeepsOriginalPriceAndOwnedRetiredSkinRemainsWearable()
    {
        using var client = await fixture.CreateStudentAsync();
        var skin = new CharacterSkin { Key = $"retired-{Guid.NewGuid():N}", Name = "Limited", AssetKey = "skins/limited", IsForSale = true, PriceCoins = 10 };
        await using (var db = fixture.CreateDatabase()) { db.CharacterSkins.Add(skin); await db.SaveChangesAsync(); }
        await Fund(client, 50);
        var requestId = Guid.NewGuid();
        var first = await Purchase(client, skin.Id, requestId);
        await using (var db = fixture.CreateDatabase())
            await db.CharacterSkins.Where(item => item.Id == skin.Id).ExecuteUpdateAsync(update => update.SetProperty(item => item.PriceCoins, 99).SetProperty(item => item.IsForSale, false));
        var replay = await Purchase(client, skin.Id, requestId);
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(10, replay.CoinsSpent);
        Assert.Equal(40, replay.CoinsBalance);
        await Read<AppearanceResponse>(await client.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(skin.Id)));
        Assert.Contains((await client.GetFromJsonAsync<List<SkinResponse>>("/api/me/skins"))!, item => item.Id == skin.Id && item.IsEquipped);
        Assert.DoesNotContain((await client.GetFromJsonAsync<List<SkinResponse>>("/api/shop/skins"))!, item => item.Id == skin.Id);
    }

    [Fact]
    public async Task NewFieldsAreProtectedByAuthenticationAndCsrf()
    {
        using var anonymous = fixture.CreateClient();
        foreach (var path in new[] { "/api/mascots", "/api/shop/skins", "/api/me/skins", "/api/me/appearance", "/api/me/purchases" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
        using var client = await fixture.CreateStudentAsync();
        await Fund(client, 100);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.CopperSkinId), new PurchaseSkinRequest(Guid.NewGuid()))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(CosmeticDefaults.DefaultSkinId))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/me/mascot", new SelectMascotRequest(CosmeticDefaults.OhmMascotId))).StatusCode);
        Assert.Equal(100, (await Profile(client)).CoinsBalance);
    }

    [Fact]
    public async Task PurchaseValidatesRequestAndUsesOnlyServerPrice()
    {
        using var client = await fixture.CreateStudentAsync();
        await Fund(client, 50);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.CopperSkinId), new PurchaseSkinRequest(Guid.Empty))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync(PurchasePath(Guid.NewGuid()), new PurchaseSkinRequest(Guid.NewGuid()))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.DefaultSkinId), new PurchaseSkinRequest(Guid.NewGuid()))).StatusCode);
        var purchase = await Read<PurchaseResponse>(await client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.CopperSkinId), new { requestId = Guid.NewGuid(), priceCoins = 0, userId = Guid.NewGuid() }));
        Assert.Equal(30, purchase.CoinsSpent);
        Assert.Equal(20, purchase.CoinsBalance);
    }

    [Fact]
    public async Task AppearanceIsFrozenInAttemptWhileNewPreferenceAppliesToTheNextAttempt()
    {
        using var client = await fixture.CreateStudentAsync();
        await Fund(client, 100);
        await Purchase(client, CosmeticDefaults.CopperSkinId);
        await client.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(CosmeticDefaults.CopperSkinId));
        await client.PutAsJsonAsync("/api/me/mascot", new SelectMascotRequest(CosmeticDefaults.OhmMascotId));
        var first = await Start(client);
        Assert.Equal(CosmeticDefaults.CopperSkinId, first.CharacterSkin!.Id);
        Assert.Equal(CosmeticDefaults.OhmMascotId, first.Mascot!.Character.Id);
        await client.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(CosmeticDefaults.DefaultSkinId));
        await client.PutAsJsonAsync("/api/me/mascot", new SelectMascotRequest(CosmeticDefaults.RelayMascotId));
        var restored = await Read<AttemptResponse>(await client.GetAsync($"/api/attempts/{first.Id}"));
        Assert.Equal(first.CharacterSkin, restored.CharacterSkin);
        Assert.Equal(CosmeticDefaults.OhmMascotId, restored.Mascot!.Character.Id);
        var ended = await Read<AttemptResponse>(await client.PostAsJsonAsync($"/api/attempts/{first.Id}/abandon", new { }));
        Assert.Equal(MascotEvent.Abandoned, ended.Mascot!.Event);
        var next = await Start(client);
        Assert.Equal(CosmeticDefaults.DefaultSkinId, next.CharacterSkin!.Id);
        Assert.Equal(CosmeticDefaults.RelayMascotId, next.Mascot!.Character.Id);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task BothModesReturnVictoryAndDefeatReactionsWithStableVariants(bool crisis)
    {
        using var client = await fixture.CreateStudentAsync();
        await client.PutAsJsonAsync("/api/me/mascot", new SelectMascotRequest(CosmeticDefaults.RelayMascotId));
        var attempt = await Start(client, crisis);
        if (crisis)
        {
            Assert.Equal(MascotEvent.Intro, attempt.Mascot!.Event);
            attempt = await Read<AttemptResponse>(await client.PostAsJsonAsync($"/api/attempts/{attempt.Id}/begin", new { }));
        }
        while (attempt.Status == AttemptStatus.Active) attempt = await Answer(client, attempt, true);
        Assert.Equal(MascotEvent.Victory, attempt.Mascot!.Event);
        Assert.Equal(crisis ? MascotContext.Crisis : MascotContext.Boss, attempt.Mascot.Context);
        Assert.Equal(CosmeticDefaults.RelayMascotId, attempt.Mascot.Character.Id);
        Assert.Equal(attempt.Mascot, (await Read<AttemptResponse>(await client.GetAsync($"/api/attempts/{attempt.Id}"))).Mascot);
        Assert.Equal(150, attempt.Reward!.Xp);
        var fail = await Start(client, crisis);
        if (crisis) fail = await Read<AttemptResponse>(await client.PostAsJsonAsync($"/api/attempts/{fail.Id}/begin", new { }));
        if (crisis)
        {
            fail = await Answer(client, fail, false);
            Assert.Equal(MascotEvent.WrongAnswer, fail.Mascot!.Event);
            fail = await Answer(client, fail, false);
            fail = await Answer(client, fail, true);
            Assert.Equal(MascotEvent.CorrectAnswer, fail.Mascot!.Event);
            fail = await Answer(client, fail, false);
        }
        else for (var i = 0; i < 3; i++) fail = await Answer(client, fail, false);
        Assert.Equal(AttemptStatus.Failed, fail.Status);
        Assert.Equal(MascotEvent.Defeat, fail.Mascot!.Event);
        Assert.Null(fail.Reward);
    }

    [Fact]
    public async Task ServerTimeSelectsWarningAndTimeoutBeforeTerminalDefeat()
    {
        using var client = await fixture.CreateStudentAsync();
        var attempt = await Start(client);
        Assert.Equal(MascotEvent.Idle, attempt.Mascot!.Event);
        fixture.Clock.Advance(TimeSpan.FromSeconds(51));
        var warning = await Read<AttemptResponse>(await client.GetAsync($"/api/attempts/{attempt.Id}"));
        Assert.Equal(MascotEvent.TimeWarning, warning.Mascot!.Event);
        fixture.Clock.Advance(TimeSpan.FromSeconds(10));
        var timeout = await Read<AttemptResponse>(await client.GetAsync($"/api/attempts/{attempt.Id}"));
        Assert.Equal(MascotEvent.Timeout, timeout.Mascot!.Event);
        fixture.Clock.Advance(TimeSpan.FromSeconds(121));
        var defeat = await Read<AttemptResponse>(await client.GetAsync($"/api/attempts/{attempt.Id}"));
        Assert.Equal(MascotEvent.Defeat, defeat.Mascot!.Event);
    }

    [Fact]
    public async Task MascotWithoutReactionsDoesNotBreakTheGameAndMissingIdsAreRejected()
    {
        using var client = await fixture.CreateStudentAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync("/api/me/mascot", new SelectMascotRequest(Guid.NewGuid()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync("/api/me/skin", new SelectSkinRequest(Guid.NewGuid()))).StatusCode);
        var mascot = new Mascot { Key = $"custom-{Guid.NewGuid():N}", Name = "Custom", AssetKey = "mascots/custom" };
        await using (var db = fixture.CreateDatabase()) { db.Mascots.Add(mascot); await db.SaveChangesAsync(); }
        await client.PutAsJsonAsync("/api/me/mascot", new SelectMascotRequest(mascot.Id));
        var attempt = await Start(client);
        Assert.Equal(mascot.Id, attempt.Mascot!.Character.Id);
        Assert.Equal(mascot.AssetKey, attempt.Mascot.AssetKey);
        Assert.Equal(Guid.Empty, attempt.Mascot.ReactionId);
    }

    [Fact]
    public async Task PurchaseAndVictoryShareTheLockSoNeitherLosesTheOthersBalanceUpdate()
    {
        using var client = await fixture.CreateStudentAsync();
        await Fund(client, 100);
        var attempt = await Start(client);
        for (var i = 0; i < 4; i++) attempt = await Answer(client, attempt, true);
        await using var db = fixture.CreateDatabase();
        var option = await db.AttemptQuestions.Where(question => question.Id == attempt.CurrentQuestion!.Id)
            .SelectMany(question => question.Question.Options).Where(option => option.IsCorrect).Select(option => option.Id).SingleAsync();
        var operations = await Task.WhenAll(
            client.PutAsJsonAsync($"/api/attempts/{attempt.Id}/questions/{attempt.CurrentQuestion!.Id}/answer", new AnswerRequest(option, Guid.NewGuid())),
            client.PostAsJsonAsync(PurchasePath(CosmeticDefaults.CopperSkinId), new PurchaseSkinRequest(Guid.NewGuid())));
        Assert.All(operations, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        var profile = await Profile(client);
        Assert.Equal(120, profile.CoinsBalance); // 100 + 50 first perfect victory - 30 skin.
        Assert.Equal(170, profile.TotalXp);
    }
}
