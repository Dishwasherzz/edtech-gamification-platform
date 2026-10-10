using System.Security.Claims;

namespace EducationGamePlatform.Infrastructure;

public static class UserExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user)
        => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("An authenticated Identity user is required."));
}
