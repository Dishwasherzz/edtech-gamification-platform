using Microsoft.AspNetCore.Identity;

namespace EducationGamePlatform.Domain;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public PlayerProfile? Profile { get; set; }
}

public sealed class PlayerProfile
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string AvatarKey { get; set; } = "default";
    public long TotalXp { get; set; }
    public long CoinsBalance { get; set; }
    public ApplicationUser User { get; set; } = null!;
}
