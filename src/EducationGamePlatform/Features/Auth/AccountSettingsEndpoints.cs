using System.Security.Claims;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Auth;

public sealed record ChangeNicknameRequest(string DisplayName);
public sealed record ChangeHeroRequest(string HeroKey);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record DeleteAccountRequest(string Password);

public static class AccountSettingsEndpoints
{
    public static void MapAccountSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/me").RequireAuthorization().WithTags("Account");
        group.MapPut("/nickname", ChangeNicknameAsync);
        group.MapPut("/hero", ChangeHeroAsync);
        group.MapPut("/password", ChangePasswordAsync).RequireRateLimiting("account-sensitive");
        group.MapDelete("", DeleteAsync).RequireRateLimiting("account-sensitive");
    }

    private static async Task<IResult> ChangeNicknameAsync(ChangeNicknameRequest request, ClaimsPrincipal principal,
        AppDbContext database, CancellationToken token)
    {
        var name = AccountRules.ValidateNickname(request.DisplayName);
        if (name is null) return Invalid("displayName", "Ник должен содержать 3–20 букв, цифр, дефисов или подчёркиваний.");
        var normalized = AccountRules.NormalizeNickname(name);
        var id = principal.GetUserId();
        await using var transaction = await database.Database.BeginTransactionAsync(token);
        await AccountRules.LockProfileAsync(database, id, token);
        var profile = await database.PlayerProfiles.SingleOrDefaultAsync(item => item.UserId == id, token);
        if (profile is null) return Results.NotFound();
        if (await AccountRules.NicknameTakenAsync(database, normalized, id, token)) return AccountRules.NicknameTaken();
        profile.DisplayName = name;
        profile.NormalizedDisplayName = normalized;
        try
        {
            await database.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
        }
        catch (DbUpdateException exception) when (AccountRules.IsDuplicateNickname(exception))
        {
            return AccountRules.NicknameTaken();
        }
        return Results.NoContent();
    }

    private static async Task<IResult> ChangeHeroAsync(ChangeHeroRequest request, ClaimsPrincipal principal,
        AppDbContext database, CancellationToken token)
    {
        var hero = AccountRules.Hero(request.HeroKey);
        if (hero is null) return Invalid("heroKey", "Выбери одного из двух героев.");
        var id = principal.GetUserId();
        var changed = await database.PlayerProfiles.Where(profile => profile.UserId == id)
            .ExecuteUpdateAsync(update => update.SetProperty(profile => profile.HeroKey, hero.Key), token);
        return changed == 0 ? Results.NotFound() : Results.NoContent();
    }

    private static async Task<IResult> ChangePasswordAsync(ChangePasswordRequest request, ClaimsPrincipal principal,
        UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, AppDbContext database, CancellationToken token)
    {
        if (!ValidPasswordInput(request.CurrentPassword) || !ValidPasswordInput(request.NewPassword))
            return Invalid("password", "Укажи текущий и новый пароль длиной не более 128 символов.");
        if (request.CurrentPassword == request.NewPassword)
            return Invalid("newPassword", "Новый пароль должен отличаться от текущего.");
        await using var transaction = await database.Database.BeginTransactionAsync(token);
        var id = principal.GetUserId();
        await AccountRules.LockProfileAsync(database, id, token);
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return Results.NotFound();
        var result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded) return IdentityErrors(result);
        await transaction.CommitAsync(token);
        await signIn.RefreshSignInAsync(user);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAsync([FromBody] DeleteAccountRequest request, ClaimsPrincipal principal,
        UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, AppDbContext database, CancellationToken token)
    {
        if (!ValidPasswordInput(request.Password)) return Invalid("password", "Для удаления аккаунта введи пароль.");
        var id = principal.GetUserId();
        await using var transaction = await database.Database.BeginTransactionAsync(token);
        await AccountRules.LockProfileAsync(database, id, token);
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return Results.NotFound();
        if (!await users.CheckPasswordAsync(user, request.Password)) return Invalid("password", "Неверный пароль.");

        var attempts = database.Attempts.Where(attempt => attempt.UserId == id);
        var questions = database.AttemptQuestions.Where(question => attempts.Any(attempt => attempt.Id == question.AttemptId));
        await database.AttemptChoices.Where(choice => attempts.Any(attempt => attempt.Id == choice.AttemptId)).ExecuteDeleteAsync(token);
        await database.AttemptAnswers.Where(answer => questions.Any(question => question.Id == answer.AttemptQuestionId)).ExecuteDeleteAsync(token);
        await database.RewardGrants.Where(grant => grant.UserId == id).ExecuteDeleteAsync(token);
        await database.TopicProgress.Where(progress => progress.UserId == id).ExecuteDeleteAsync(token);
        await questions.ExecuteDeleteAsync(token);
        await attempts.ExecuteDeleteAsync(token);
        await database.LessonProgress.Where(progress => progress.UserId == id).ExecuteDeleteAsync(token);
        await database.UserSkins.Where(skin => skin.UserId == id).ExecuteDeleteAsync(token);
        await database.SkinPurchases.Where(purchase => purchase.UserId == id).ExecuteDeleteAsync(token);
        await database.PlayerProfiles.Where(profile => profile.UserId == id).ExecuteDeleteAsync(token);

        var deleted = await users.DeleteAsync(user);
        if (!deleted.Succeeded) return IdentityErrors(deleted);
        await transaction.CommitAsync(token);
        await signIn.SignOutAsync();
        return Results.NoContent();
    }

    internal static bool ValidPasswordInput(string? value) => value is { Length: > 0 and <= 128 };

    internal static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    internal static IResult IdentityErrors(IdentityResult result) =>
        Results.ValidationProblem(result.Errors.GroupBy(error => error.Code)
            .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
}
