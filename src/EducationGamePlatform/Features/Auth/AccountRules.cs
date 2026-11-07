using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.RegularExpressions;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EducationGamePlatform.Features.Auth;

public sealed class AccountOptions
{
    public bool RequireConsent { get; set; } = true;
    public string? ConsentVersion { get; set; }
    public string? ConsentText { get; set; }
    public bool ConsentIsConfigured => ConsentVersion is { Length: > 0 and <= 80 } &&
        !string.IsNullOrWhiteSpace(ConsentVersion) && !string.IsNullOrWhiteSpace(ConsentText);
}

public sealed record HeroOption(string Key, string Name, string AssetKey);

internal static partial class AccountRules
{
    public const int MinimumPasswordLength = 8;
    public static IReadOnlyList<HeroOption> Heroes { get; } =
        [new("phase", "Фаз", "heroes/phase"), new("ampere", "Ампер", "heroes/ampere")];

    public static HeroOption? Hero(string? key) => Heroes.SingleOrDefault(item => item.Key == key);

    public static bool ValidEmail(string? email) => !string.IsNullOrWhiteSpace(email) && email.Length <= 256 &&
        new EmailAddressAttribute().IsValid(email.Trim());

    [GeneratedRegex(@"\A[\p{L}\p{Nd}_-]{3,20}\z", RegexOptions.CultureInvariant)]
    private static partial Regex NicknamePattern();

    public static string? ValidateNickname(string? value)
    {
        var name = value?.Trim();
        return name is not null && NicknamePattern().IsMatch(name) ? name.Normalize(NormalizationForm.FormC) : null;
    }

    public static string NormalizeNickname(string value) => value.Trim().Normalize(NormalizationForm.FormC).ToUpperInvariant();

    public static async Task<bool> NicknameTakenAsync(AppDbContext database, string normalized, Guid? owner, CancellationToken token)
    {
        var profiles = database.PlayerProfiles.AsNoTracking().Where(profile => profile.UserId != owner);
        if (await profiles.AnyAsync(profile => profile.NormalizedDisplayName == normalized, token)) return true;

        // Older profiles keep their names, including duplicates, until their owner changes them.
        var legacy = await profiles.Where(profile => profile.NormalizedDisplayName == null)
            .Select(profile => profile.DisplayName).ToListAsync(token);
        return legacy.Any(name => NormalizeNickname(name) == normalized);
    }

    public static Task LockProfileAsync(AppDbContext database, Guid userId, CancellationToken token) =>
        database.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT 1 FROM \"PlayerProfiles\" WHERE \"UserId\" = {userId} FOR UPDATE", token);

    public static bool IsDuplicateNickname(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "UX_PlayerProfiles_NormalizedDisplayName"
        };

    public static IResult NicknameTaken() =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["displayName"] = ["Этот ник занят."] });
}
