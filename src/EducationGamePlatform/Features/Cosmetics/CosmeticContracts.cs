using EducationGamePlatform.Domain;

namespace EducationGamePlatform.Features.Cosmetics;

public sealed record SkinReference(Guid Id, string Key, string Name, string AssetKey);
public sealed record SkinResponse(Guid Id, string Key, string Name, string Description, string AssetKey,
    int PriceCoins, bool IsStarter, bool IsForSale, bool IsOwned, bool IsEquipped);
public sealed record MascotResponse(Guid Id, string Key, string Name, string Description, string AssetKey);
public sealed record ReactionResponse(Guid Id, MascotEvent Event, MascotContext Context, int Variant, string AssetKey, string Message);
public sealed record MascotDetails(MascotResponse Mascot, List<ReactionResponse> Reactions);
public sealed record AppearanceResponse(SkinReference CharacterSkin, MascotResponse Mascot);
public sealed record SelectSkinRequest(Guid SkinId);
public sealed record SelectMascotRequest(Guid MascotId);
public sealed record PurchaseSkinRequest(Guid RequestId);
public sealed record PurchaseResponse(Guid Id, Guid SkinId, int CoinsSpent, long CoinsBalance,
    DateTimeOffset PurchasedAt, bool IsReplay);
public sealed record PurchaseHistoryResponse(Guid Id, Guid SkinId, string SkinName, int CoinsSpent, DateTimeOffset PurchasedAt);
public sealed record MascotPresentation(MascotResponse Character, MascotEvent Event, MascotContext Context,
    Guid ReactionId, int Variant, string AssetKey, string Message);
