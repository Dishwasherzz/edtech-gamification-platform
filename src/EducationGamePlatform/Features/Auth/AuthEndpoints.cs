using EducationGamePlatform.Domain;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace EducationGamePlatform.Features.Auth;

public sealed record RegisterRequest(string Email, string Password, string DisplayName,
    string? HeroKey = null, bool AcceptConsent = false, string? ConsentVersion = null, bool SignIn = false);
public sealed record LoginRequest(string Email, string Password);
public sealed record RegisteredUserResponse(Guid UserId, string Email);
public sealed record CsrfResponse(string Token, string HeaderName);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth").WithTags("Auth");
        group.MapGet("/registration", (IOptions<AccountOptions> options) => Results.Ok(new
        {
            heroes = AccountRules.Heroes,
            defaultHeroKey = AccountRules.Heroes[0].Key,
            minimumPasswordLength = AccountRules.MinimumPasswordLength,
            requiresConsent = options.Value.RequireConsent,
            canRegister = !options.Value.RequireConsent || options.Value.ConsentIsConfigured,
            consent = options.Value.ConsentIsConfigured ? new
            {
                version = options.Value.ConsentVersion,
                text = options.Value.ConsentText
            } : null
        }));
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
        SignInManager<ApplicationUser> signIn, IOptions<AccountOptions> options, AppDbContext database,
        TimeProvider clock, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (!AccountRules.ValidEmail(request.Email))
            errors["email"] = ["Введите корректный email."];
        var nickname = AccountRules.ValidateNickname(request.DisplayName);
        if (nickname is null)
            errors["displayName"] = ["Ник должен содержать 3–20 букв, цифр, дефисов или подчёркиваний."];
        if (!AccountSettingsEndpoints.ValidPasswordInput(request.Password))
            errors["password"] = ["Укажи пароль длиной не более 128 символов."];
        var hero = request.HeroKey is null ? AccountRules.Heroes[0] : AccountRules.Hero(request.HeroKey);
        if (hero is null) errors["heroKey"] = ["Выбери одного из двух героев."];
        var requireConsent = options.Value.RequireConsent || request.AcceptConsent || request.ConsentVersion is not null;
        if (requireConsent)
        {
            if (!options.Value.ConsentIsConfigured)
                return Results.Problem(statusCode: 503, title: "Текст согласия пока недоступен.");
            if (!request.AcceptConsent || request.ConsentVersion != options.Value.ConsentVersion)
                errors["consent"] = ["Подтверди актуальную версию согласия на обработку данных."];
        }
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        var normalized = AccountRules.NormalizeNickname(nickname!);
        if (await AccountRules.NicknameTakenAsync(database, normalized, null, cancellationToken))
            return AccountRules.NicknameTaken();

        var user = new ApplicationUser
        {
            Id = Guid.CreateVersion7(), Email = request.Email.Trim(), UserName = request.Email.Trim(),
            CreatedAt = clock.GetUtcNow(),
            ConsentVersion = requireConsent ? options.Value.ConsentVersion : null,
            ConsentAcceptedAt = requireConsent ? clock.GetUtcNow() : null
        };
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await users.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                return Results.ValidationProblem(result.Errors.GroupBy(error => error.Code)
                    .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
            database.PlayerProfiles.Add(new PlayerProfile
            {
                UserId = user.Id, DisplayName = nickname!, NormalizedDisplayName = normalized, HeroKey = hero!.Key
            });
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (AccountRules.IsDuplicateNickname(exception))
        {
            return AccountRules.NicknameTaken();
        }
        catch (DbUpdateException exception) when
            (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Account already exists.");
        }
        if (request.SignIn) await signIn.SignInAsync(user, isPersistent: false);
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
