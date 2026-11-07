using Microsoft.AspNetCore.Identity;

namespace EducationGamePlatform.Domain;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? ConsentVersion { get; set; }
    public DateTimeOffset? ConsentAcceptedAt { get; set; }
    public PlayerProfile? Profile { get; set; }
}

public sealed class PlayerProfile
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? NormalizedDisplayName { get; set; }
    public string HeroKey { get; set; } = "phase";
    public string AvatarKey { get; set; } = "default";
    public long TotalXp { get; set; }
    public long CoinsBalance { get; set; }
    public Guid? EquippedSkinId { get; set; }
    public Guid? SelectedMascotId { get; set; }
    public ApplicationUser User { get; set; } = null!;
}
