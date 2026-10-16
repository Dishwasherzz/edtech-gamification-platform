using System.Security.Claims;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using EducationGamePlatform.Features.Game;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Profile;

public sealed record ProfileResponse(Guid UserId, string DisplayName, string AvatarKey, long TotalXp, long CoinsBalance)
{
    public int Rank { get; init; }
    public long RankStartXp { get; init; }
    public long? NextRankXp { get; init; }
    public int RankProgressPercent { get; init; }
}

public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/me", async (ClaimsPrincipal user, AppDbContext database, RankCalculator ranks, CancellationToken cancellationToken) =>
        {
            var userId = user.GetUserId();
            var profile = await database.PlayerProfiles.AsNoTracking().Where(profile => profile.UserId == userId)
                .Select(profile => new ProfileResponse(profile.UserId, profile.DisplayName, profile.AvatarKey,
                    profile.TotalXp, profile.CoinsBalance)).SingleOrDefaultAsync(cancellationToken);
            if (profile is null) return Results.NotFound();
            var rank = ranks.Calculate(profile.TotalXp);
            return Results.Ok(profile with { Rank = rank.Rank, RankStartXp = rank.RankStartXp,
                NextRankXp = rank.NextRankXp, RankProgressPercent = rank.RankProgressPercent });
        }).RequireAuthorization().WithTags("Profile").WithSummary("Read the current user's profile.")
            .Produces<ProfileResponse>().ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
