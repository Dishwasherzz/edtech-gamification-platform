using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Cosmetics;

public sealed class CosmeticsService(AppDbContext database, TimeProvider clock)
{
    public async Task<List<SkinResponse>> SkinsAsync(Guid userId, bool ownedOnly, CancellationToken token)
    {
        var profile = await ProfileAsync(userId, token);
        var owned = await database.UserSkins.Where(item => item.UserId == userId).Select(item => item.SkinId).ToListAsync(token);
        var skins = await database.CharacterSkins.AsNoTracking()
            .Where(skin => ownedOnly ? skin.IsStarter || owned.Contains(skin.Id) : skin.IsForSale || skin.IsStarter)
            .OrderBy(skin => skin.SortOrder).ThenBy(skin => skin.Id).ToListAsync(token);
        var equipped = profile.EquippedSkinId ?? CosmeticDefaults.DefaultSkinId;
        return skins.Select(skin => new SkinResponse(skin.Id, skin.Key, skin.Name, skin.Description, skin.AssetKey,
            skin.PriceCoins, skin.IsStarter, skin.IsForSale, skin.IsStarter || owned.Contains(skin.Id), skin.Id == equipped)).ToList();
    }

    public Task<List<MascotResponse>> MascotsAsync(CancellationToken token) => database.Mascots.AsNoTracking()
        .Where(mascot => mascot.IsEnabled).OrderBy(mascot => mascot.SortOrder).ThenBy(mascot => mascot.Id)
        .Select(mascot => new MascotResponse(mascot.Id, mascot.Key, mascot.Name, mascot.Description, mascot.AssetKey)).ToListAsync(token);

    public async Task<MascotDetails> MascotAsync(Guid id, CancellationToken token)
    {
        var mascot = await database.Mascots.AsNoTracking().SingleOrDefaultAsync(mascot => mascot.Id == id && mascot.IsEnabled, token)
            ?? throw new GameRuleException(404, "MascotNotFound", "Маскот не найден.");
        var reactions = await database.MascotReactions.AsNoTracking().Where(reaction => reaction.MascotId == id)
            .OrderBy(reaction => reaction.Event).ThenBy(reaction => reaction.Context).ThenBy(reaction => reaction.Variant)
            .Select(reaction => new ReactionResponse(reaction.Id, reaction.Event, reaction.Context, reaction.Variant, reaction.AssetKey, reaction.Message)).ToListAsync(token);
        return new(ToResponse(mascot), reactions);
    }

    public async Task<AppearanceResponse> AppearanceAsync(Guid userId, CancellationToken token)
    {
        var profile = await ProfileAsync(userId, token);
        return await ResolveAsync(profile.EquippedSkinId, profile.SelectedMascotId, token);
    }

    public async Task<AppearanceResponse> CaptureAsync(PlayerProfile profile, CancellationToken token)
    {
        var mascotId = profile.SelectedMascotId;
        if (mascotId.HasValue && !await database.Mascots.AnyAsync(mascot => mascot.Id == mascotId && mascot.IsEnabled, token))
            mascotId = null;
        return await ResolveAsync(profile.EquippedSkinId, mascotId, token);
    }

    public async Task<AppearanceResponse> ResolveAsync(Guid? skinId, Guid? mascotId, CancellationToken token)
    {
        var actualSkinId = skinId ?? CosmeticDefaults.DefaultSkinId;
        var actualMascotId = mascotId ?? CosmeticDefaults.DefaultMascotId;
        var skin = await database.CharacterSkins.AsNoTracking().SingleAsync(skin => skin.Id == actualSkinId, token);
        var mascot = await database.Mascots.AsNoTracking().SingleAsync(mascot => mascot.Id == actualMascotId, token);
        return new(new(skin.Id, skin.Key, skin.Name, skin.AssetKey), ToResponse(mascot));
    }

    public Task<AppearanceResponse> EquipAsync(Guid userId, Guid skinId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        var skin = await database.CharacterSkins.AsNoTracking().SingleOrDefaultAsync(skin => skin.Id == skinId, token)
            ?? throw new GameRuleException(404, "SkinNotFound", "Скин не найден.");
        if (!skin.IsStarter && !await database.UserSkins.AnyAsync(item => item.UserId == userId && item.SkinId == skinId, token))
            throw new GameRuleException(403, "SkinNotOwned", "Сначала купи этот скин.");
        profile.EquippedSkinId = skinId;
        return await ResolveAsync(skinId, profile.SelectedMascotId, token);
    }, token);

    public Task<AppearanceResponse> SelectMascotAsync(Guid userId, Guid mascotId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        if (!await database.Mascots.AnyAsync(mascot => mascot.Id == mascotId && mascot.IsEnabled, token))
            throw new GameRuleException(404, "MascotNotFound", "Маскот не найден.");
        profile.SelectedMascotId = mascotId;
        return await ResolveAsync(profile.EquippedSkinId, mascotId, token);
    }, token);

    public Task<PurchaseResponse> PurchaseAsync(Guid userId, Guid skinId, Guid requestId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        if (requestId == Guid.Empty) throw new GameRuleException(400, "RequestIdRequired", "Укажи идентификатор покупки.");
        var previous = await database.SkinPurchases.AsNoTracking().SingleOrDefaultAsync(purchase => purchase.UserId == userId && purchase.RequestId == requestId, token);
        if (previous != null)
        {
            if (previous.SkinId != skinId) throw new GameRuleException(409, "RequestConflict", "Этот идентификатор уже использован для другой покупки.");
            return new PurchaseResponse(previous.Id, previous.SkinId, previous.PricePaid, profile.CoinsBalance, previous.CreatedAt, true);
        }
        var skin = await database.CharacterSkins.AsNoTracking().SingleOrDefaultAsync(skin => skin.Id == skinId, token)
            ?? throw new GameRuleException(404, "SkinNotFound", "Скин не найден.");
        if (skin.IsStarter || await database.UserSkins.AnyAsync(item => item.UserId == userId && item.SkinId == skinId, token))
            throw new GameRuleException(409, "SkinAlreadyOwned", "Этот скин уже есть в гардеробе.");
        if (!skin.IsForSale) throw new GameRuleException(409, "SkinNotForSale", "Этот скин сейчас не продаётся.");
        if (profile.CoinsBalance < skin.PriceCoins) throw new GameRuleException(409, "InsufficientCoins", "Недостаточно монет.");
        var now = GameTime.Now(clock);
        var purchase = new SkinPurchase { UserId = userId, SkinId = skinId, RequestId = requestId, PricePaid = skin.PriceCoins, CreatedAt = now };
        database.SkinPurchases.Add(purchase);
        database.UserSkins.Add(new UserSkin { UserId = userId, SkinId = skinId, PurchaseId = purchase.Id, AcquiredAt = now });
        profile.CoinsBalance -= skin.PriceCoins;
        return new PurchaseResponse(purchase.Id, skinId, purchase.PricePaid, profile.CoinsBalance, now, false);
    }, token);

    public async Task<List<PurchaseHistoryResponse>> PurchasesAsync(Guid userId, int page, CancellationToken token)
    {
        if (page is < 1 or > 10000) throw new GameRuleException(400, "InvalidPage", "Недопустимый номер страницы.");
        return await database.SkinPurchases.AsNoTracking().Where(purchase => purchase.UserId == userId)
            .OrderByDescending(purchase => purchase.CreatedAt).ThenByDescending(purchase => purchase.Id).Skip((page - 1) * 20).Take(20)
            .Select(purchase => new PurchaseHistoryResponse(purchase.Id, purchase.SkinId, purchase.Skin.Name, purchase.PricePaid, purchase.CreatedAt)).ToListAsync(token);
    }

    private async Task<PlayerProfile> ProfileAsync(Guid userId, CancellationToken token) =>
        await database.PlayerProfiles.AsNoTracking().SingleOrDefaultAsync(profile => profile.UserId == userId, token)
        ?? throw new GameRuleException(404, "ProfileNotFound", "Профиль не найден.");

    private async Task<T> LockedAsync<T>(Guid userId, Func<PlayerProfile, Task<T>> action, CancellationToken token)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(token);
        // Same row lock as game rewards and lecture XP: purchases cannot overwrite a concurrent reward.
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"PlayerProfiles\" WHERE \"UserId\" = {userId} FOR UPDATE", token);
        var profile = await database.PlayerProfiles.SingleOrDefaultAsync(profile => profile.UserId == userId, token)
            ?? throw new GameRuleException(404, "ProfileNotFound", "Профиль не найден.");
        var result = await action(profile);
        await database.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return result;
    }

    private static MascotResponse ToResponse(Mascot mascot) => new(mascot.Id, mascot.Key, mascot.Name, mascot.Description, mascot.AssetKey);
}
