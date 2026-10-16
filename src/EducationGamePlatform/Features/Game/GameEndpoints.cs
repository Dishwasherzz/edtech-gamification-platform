using System.Security.Claims;
using EducationGamePlatform.Infrastructure;
using Microsoft.Extensions.Options;

namespace EducationGamePlatform.Features.Game;

public static class GameEndpoints
{
    public static void MapGameEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api").RequireAuthorization().WithTags("Assessments");
        group.MapPost("/assessments/{assessmentId:guid}/attempts", async (Guid assessmentId, ClaimsPrincipal user, GameService game, CancellationToken token) =>
            Results.Ok(await game.StartAsync(assessmentId, user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapGet("/attempts/{attemptId:guid}", async (Guid attemptId, ClaimsPrincipal user, GameService game, CancellationToken token) =>
            Results.Ok(await game.GetAsync(attemptId, user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapGet("/attempts/{attemptId:guid}/result", async (Guid attemptId, ClaimsPrincipal user, GameService game, CancellationToken token) =>
            Results.Ok(await game.GetAsync(attemptId, user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapPost("/attempts/{attemptId:guid}/begin", async (Guid attemptId, ClaimsPrincipal user, GameService game, CancellationToken token) =>
            Results.Ok(await game.BeginAsync(attemptId, user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapPut("/attempts/{attemptId:guid}/questions/{attemptQuestionId:guid}/answer",
            async (Guid attemptId, Guid attemptQuestionId, AnswerRequest request, ClaimsPrincipal user, GameService game, CancellationToken token) =>
                Results.Ok(await game.AnswerAsync(attemptId, attemptQuestionId, request, user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapPost("/attempts/{attemptId:guid}/abandon", async (Guid attemptId, ClaimsPrincipal user, GameService game, CancellationToken token) =>
            Results.Ok(await game.AbandonAsync(attemptId, user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapGet("/me/attempts/active", async (ClaimsPrincipal user, GameService game, CancellationToken token) =>
            Results.Ok(await game.ActiveAsync(user.GetUserId(), token))).Produces<AttemptResponse>();
        group.MapGet("/me/attempts", async (ClaimsPrincipal user, GameService game, CancellationToken token, int page = 1) =>
            Results.Ok(await game.HistoryAsync(user.GetUserId(), page, token))).Produces<List<HistoryResponse>>();
        group.MapGet("/instructions", (IOptions<GameOptions> options) => Results.Ok(new
        {
            lessonXp = options.Value.LessonXp, firstWinXp = options.Value.FirstWinXp, firstWinCoins = options.Value.FirstWinCoins,
            perfectBonusXp = options.Value.PerfectBonusXp, perfectBonusCoins = options.Value.PerfectBonusCoins,
            repeatWinXp = options.Value.FirstWinXp / 4, repeatWinCoins = options.Value.FirstWinCoins / 4,
            rankThresholds = options.Value.RankThresholds
        }));
    }
}
