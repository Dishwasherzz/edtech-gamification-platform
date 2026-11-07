using System.Net;
using System.Net.Mail;
using System.Threading.Channels;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EducationGamePlatform.Features.Auth;

public sealed class PasswordMailOptions
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? From { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? ResetPageUrl { get; set; }
}

public interface IPasswordResetMailer
{
    bool Enabled { get; }
    Task SendAsync(string email, string resetLink, CancellationToken token);
}

internal sealed class SmtpPasswordResetMailer(IOptions<PasswordMailOptions> options) : IPasswordResetMailer
{
    public bool Enabled => !string.IsNullOrWhiteSpace(options.Value.Host) &&
        options.Value.Port is > 0 and <= 65535 && MailAddress.TryCreate(options.Value.From, out _) &&
        (string.IsNullOrWhiteSpace(options.Value.Username) || !string.IsNullOrEmpty(options.Value.Password));

    public async Task SendAsync(string email, string resetLink, CancellationToken token)
    {
        var settings = options.Value;
        using var mail = new MailMessage(settings.From!, email, "Восстановление пароля — Электротехника",
            $"Чтобы задать новый пароль, открой ссылку в течение часа.\n\n{resetLink}\n\nЕсли ты не запрашивал восстановление, просто проигнорируй письмо.");
        using var smtp = new SmtpClient(settings.Host!, settings.Port) { EnableSsl = true };
        if (!string.IsNullOrWhiteSpace(settings.Username))
            smtp.Credentials = new NetworkCredential(settings.Username, settings.Password);
        await smtp.SendMailAsync(mail, token);
    }
}

internal sealed class PasswordResetQueue
{
    private readonly Channel<string> pending = Channel.CreateBounded<string>(100);
    public bool TryAdd(string email) => pending.Writer.TryWrite(email);
    public IAsyncEnumerable<string> ReadAllAsync(CancellationToken token) => pending.Reader.ReadAllAsync(token);
}

internal sealed class PasswordResetWorker(PasswordResetQueue queue, IServiceScopeFactory scopes,
    IPasswordResetMailer mailer, IOptions<PasswordMailOptions> options, ILogger<PasswordResetWorker> logger) : BackgroundService
{
    public static Uri? ResetPage(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        string.IsNullOrEmpty(uri.UserInfo) && (uri.Scheme == Uri.UriSchemeHttps || (uri.IsLoopback && uri.Scheme == Uri.UriSchemeHttp))
        ? uri : null;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var email in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                var page = ResetPage(options.Value.ResetPageUrl);
                if (!mailer.Enabled || page is null) continue;
                using var scope = scopes.CreateScope();
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var user = await users.FindByEmailAsync(email);
                if (user?.Email is null) continue;
                var token = await users.GeneratePasswordResetTokenAsync(user);
                var link = new UriBuilder(page)
                {
                    Fragment = QueryHelpers.AddQueryString(
                        string.IsNullOrEmpty(page.Fragment) ? "/auth/reset" : page.Fragment[1..],
                        new Dictionary<string, string?> { ["userId"] = user.Id.ToString(), ["token"] = token })
                };
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(20));
                await mailer.SendAsync(user.Email, link.Uri.AbsoluteUri, timeout.Token);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception)
            {
                // Transport errors can contain recipients, credentials or message contents.
                logger.LogWarning("Password recovery delivery failed ({ErrorType}).", exception.GetType().Name);
            }
        }
    }
}

public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(Guid UserId, string Token, string NewPassword);

public static class PasswordRecoveryEndpoints
{
    public static void MapPasswordRecoveryEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth").WithTags("Auth").RequireRateLimiting("account-sensitive");
        group.MapPost("/forgot-password", (ForgotPasswordRequest request, PasswordResetQueue queue,
            IPasswordResetMailer mailer, IOptions<PasswordMailOptions> options) =>
        {
            if (!AccountRules.ValidEmail(request.Email))
                return AccountSettingsEndpoints.Invalid("email", "Введите корректный email.");
            if (!mailer.Enabled || PasswordResetWorker.ResetPage(options.Value.ResetPageUrl) is null)
                return Results.Problem(statusCode: 503, title: "Восстановление пароля пока недоступно.");
            if (!queue.TryAdd(request.Email.Trim()))
                return Results.Problem(statusCode: 429, title: "Попробуй запросить письмо позже.");
            return Results.Accepted(value: new { message = "Если такой email зарегистрирован, мы отправили письмо." });
        });
        group.MapPost("/reset-password", ResetAsync);
    }

    private static async Task<IResult> ResetAsync(ResetPasswordRequest request, UserManager<ApplicationUser> users,
        AppDbContext database, CancellationToken token)
    {
        if (!AccountSettingsEndpoints.ValidPasswordInput(request.NewPassword))
            return AccountSettingsEndpoints.Invalid("newPassword", "Укажи пароль длиной не более 128 символов.");
        if (request.UserId == Guid.Empty || request.Token is not { Length: > 0 and <= 4096 })
            return InvalidToken();

        await using var transaction = await database.Database.BeginTransactionAsync(token);
        await AccountRules.LockProfileAsync(database, request.UserId, token);
        var user = await users.FindByIdAsync(request.UserId.ToString());
        if (user is null) return InvalidToken();
        var result = await users.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
            return result.Errors.Any(error => error.Code == "InvalidToken") ? InvalidToken()
                : AccountSettingsEndpoints.IdentityErrors(result);
        result = await users.ResetAccessFailedCountAsync(user);
        if (!result.Succeeded) return AccountSettingsEndpoints.IdentityErrors(result);
        if (user.LockoutEnabled && user.LockoutEnd is not null)
        {
            result = await users.SetLockoutEndDateAsync(user, null);
            if (!result.Succeeded) return AccountSettingsEndpoints.IdentityErrors(result);
        }
        await transaction.CommitAsync(token);
        return Results.NoContent();
    }

    private static IResult InvalidToken() =>
        AccountSettingsEndpoints.Invalid("token", "Ссылка недействительна или срок её действия истёк.");
}
