using System.Security.Claims;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Profile;

public sealed record ProfileResponse(Guid UserId, string DisplayName, string AvatarKey, long TotalXp, long CoinsBalance);

public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/me", async (ClaimsPrincipal user, AppDbContext database, CancellationToken cancellationToken) =>
        {
            var userId = user.GetUserId();
            var profile = await database.PlayerProfiles.AsNoTracking().Where(profile => profile.UserId == userId)
                .Select(profile => new ProfileResponse(profile.UserId, profile.DisplayName, profile.AvatarKey,
                    profile.TotalXp, profile.CoinsBalance)).SingleOrDefaultAsync(cancellationToken);
            return profile is null ? Results.NotFound() : Results.Ok(profile);
        }).RequireAuthorization().WithTags("Profile").WithSummary("Read the current user's profile.")
            .Produces<ProfileResponse>().ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
