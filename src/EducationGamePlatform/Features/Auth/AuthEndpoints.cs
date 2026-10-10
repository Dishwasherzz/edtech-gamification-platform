using System.ComponentModel.DataAnnotations;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EducationGamePlatform.Features.Auth;

public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record LoginRequest(string Email, string Password);
public sealed record RegisteredUserResponse(Guid UserId, string Email);
public sealed record CsrfResponse(string Token, string HeaderName);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth").WithTags("Auth");
        group.MapGet("/csrf", (HttpContext context, IAntiforgery antiforgery) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            return TypedResults.Ok(new CsrfResponse(tokens.RequestToken!, "X-CSRF-TOKEN"));
        }).WithSummary("Get a CSRF token; refresh after login or logout.");
        group.MapPost("/register", RegisterAsync).WithSummary("Register a student and create their profile.")
            .Produces<RegisteredUserResponse>(StatusCodes.Status201Created).ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);
        group.MapPost("/login", LoginAsync).WithSummary("Sign in using a protected cookie.")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status401Unauthorized);
        group.MapPost("/logout", async (SignInManager<ApplicationUser> signInManager) =>
        {
            await signInManager.SignOutAsync();
            return TypedResults.NoContent();
        }).RequireAuthorization().WithSummary("Sign out.");
    }

    private static async Task<IResult> RegisterAsync(RegisterRequest request, UserManager<ApplicationUser> users,
        AppDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 256 ||
            !new EmailAddressAttribute().IsValid(request.Email.Trim()))
            errors["email"] = ["A valid email of up to 256 characters is required."];
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 80)
            errors["displayName"] = ["Display name must contain 1–80 characters."];
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
            errors["password"] = ["A password of up to 128 characters is required."];
        if (errors.Count > 0) return Results.ValidationProblem(errors);

        var user = new ApplicationUser
        {
            Id = Guid.CreateVersion7(), Email = request.Email.Trim(), UserName = request.Email.Trim(),
            CreatedAt = clock.GetUtcNow()
        };
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await users.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                return Results.ValidationProblem(result.Errors.GroupBy(error => error.Code)
                    .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
            database.PlayerProfiles.Add(new PlayerProfile { UserId = user.Id, DisplayName = request.DisplayName.Trim() });
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when
            (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Account already exists.");
        }
        return Results.Created("/api/me", new RegisteredUserResponse(user.Id, user.Email!));
    }

    private static async Task<IResult> LoginAsync(LoginRequest request, UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signInManager)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 256 ||
            string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid credentials.");
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null) return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid credentials.");
        var result = await signInManager.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
        return result.Succeeded ? Results.NoContent()
            : Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid credentials.");
    }
}
