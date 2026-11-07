using System.Security.Claims;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Features.Cosmetics;
using EducationGamePlatform.Features.Auth;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Profile;

public sealed record ProfileResponse(Guid UserId, string DisplayName, string AvatarKey, long TotalXp, long CoinsBalance)
{
    public int Rank { get; init; }
    public long RankStartXp { get; init; }
    public long? NextRankXp { get; init; }
    public int RankProgressPercent { get; init; }
    public SkinReference? CharacterSkin { get; init; }
    public MascotResponse? Mascot { get; init; }
    public string? Email { get; init; }
    public HeroOption? Hero { get; init; }
    public string? ConsentVersion { get; init; }
    public DateTimeOffset? ConsentAcceptedAt { get; init; }
    public long? XpToNextRank { get; init; }
}

public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/me", async (ClaimsPrincipal user, AppDbContext database, RankCalculator ranks, CosmeticsService cosmetics, CancellationToken cancellationToken) =>
        {
            var userId = user.GetUserId();
            var profile = await database.PlayerProfiles.AsNoTracking().Where(profile => profile.UserId == userId)
                .Select(profile => new
                {
                    Value = new ProfileResponse(profile.UserId, profile.DisplayName, profile.AvatarKey,
                        profile.TotalXp, profile.CoinsBalance),
                    profile.HeroKey, profile.User.Email, profile.User.ConsentVersion, profile.User.ConsentAcceptedAt
                }).SingleOrDefaultAsync(cancellationToken);
            if (profile is null) return Results.NotFound();
            var rank = ranks.Calculate(profile.Value.TotalXp);
            var appearance = await cosmetics.AppearanceAsync(userId, cancellationToken);
            return Results.Ok(profile.Value with { Rank = rank.Rank, RankStartXp = rank.RankStartXp,
                NextRankXp = rank.NextRankXp, RankProgressPercent = rank.RankProgressPercent,
                CharacterSkin = appearance.CharacterSkin, Mascot = appearance.Mascot,
                Email = profile.Email, Hero = AccountRules.Hero(profile.HeroKey) ?? AccountRules.Heroes[0],
                ConsentVersion = profile.ConsentVersion, ConsentAcceptedAt = profile.ConsentAcceptedAt,
                XpToNextRank = rank.NextRankXp - profile.Value.TotalXp });
        }).RequireAuthorization().WithTags("Profile").WithSummary("Read the current user's profile.")
            .Produces<ProfileResponse>().ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
