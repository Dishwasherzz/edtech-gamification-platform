namespace EducationGamePlatform.Domain;

public enum MascotEvent { Idle, Intro, CorrectAnswer, WrongAnswer, TimeWarning, Timeout, Victory, Defeat, Abandoned }
public enum MascotContext { Any, Boss, Crisis }

public sealed class CharacterSkin
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string AssetKey { get; set; } = string.Empty;
    public int PriceCoins { get; set; }
    public bool IsStarter { get; set; }
    public bool IsForSale { get; set; }
    public int SortOrder { get; set; }
}

public sealed class Mascot
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string AssetKey { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
    public List<MascotReaction> Reactions { get; set; } = [];
}

public sealed class MascotReaction
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid MascotId { get; set; }
    public MascotEvent Event { get; set; }
    public MascotContext Context { get; set; }
    public int Variant { get; set; }
    public string AssetKey { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public Mascot Mascot { get; set; } = null!;
}

public sealed class UserSkin
{
    public Guid UserId { get; set; }
    public Guid SkinId { get; set; }
    public DateTimeOffset AcquiredAt { get; set; }
    public Guid? PurchaseId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public CharacterSkin Skin { get; set; } = null!;
    public SkinPurchase? Purchase { get; set; }
}

public sealed class SkinPurchase
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid SkinId { get; set; }
    public Guid RequestId { get; set; }
    public int PricePaid { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public CharacterSkin Skin { get; set; } = null!;
}
