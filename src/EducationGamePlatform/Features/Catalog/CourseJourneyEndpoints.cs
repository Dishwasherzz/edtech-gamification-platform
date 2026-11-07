using System.Security.Claims;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Auth;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Catalog;

public sealed record PublicTopicCard(Guid Id, string Title, string Description, int SortOrder, bool RequiresSignIn,
    string? Subtitle, string? IconKey);
public sealed record CourseSummary(long TotalXp, long CoinsBalance, int Rank, int Attempts);
public sealed record CourseJourney(string Destination, Guid? TopicId = null, Guid? LessonId = null,
    Guid? AttemptId = null, bool CompletionPending = false, CourseSummary? Summary = null);

public static class CourseJourneyEndpoints
{
    public static void MapCourseJourneyEndpoints(this IEndpointRouteBuilder routes)
    {
        var catalog = routes.MapGroup("/api/public").WithTags("Public catalog");
        catalog.MapGet("/courses", async (AppDbContext database, CancellationToken token) =>
            Results.Ok(await database.Courses.AsNoTracking().Where(course => course.IsPublished)
                .OrderBy(course => course.Title).ThenBy(course => course.Id)
                .Select(course => new { course.Id, course.Slug, course.Title, course.Description })
                .ToListAsync(token)));
        catalog.MapGet("/courses/{courseId:guid}/topics", async (Guid courseId, AppDbContext database, CancellationToken token) =>
        {
            if (!await database.Courses.AnyAsync(course => course.Id == courseId && course.IsPublished, token))
                return Results.NotFound();
            return Results.Ok(await database.Topics.AsNoTracking()
                .Where(topic => topic.CourseId == courseId && topic.IsPublished)
                .OrderBy(topic => topic.SortOrder).ThenBy(topic => topic.Id)
                .Select(topic => new PublicTopicCard(topic.Id, topic.Title, topic.Description, topic.SortOrder, true, topic.Subtitle, topic.IconKey))
                .ToListAsync(token));
        });

        var group = routes.MapGroup("/api/me/courses/{courseId:guid}").RequireAuthorization().WithTags("Learning");
        group.MapGet("/journey", JourneyAsync).Produces<CourseJourney>();
        group.MapPost("/completion/claim", ClaimCompletionAsync).Produces<CourseSummary>().Produces(204);
    }

    private static async Task<IResult> JourneyAsync(Guid courseId, ClaimsPrincipal principal, AppDbContext database,
        ProgressService progress, GameService game, RankCalculator ranks, CancellationToken token)
    {
        var userId = principal.GetUserId();
        var active = await game.ActiveAsync(userId, token);
        var topics = await progress.GetTopicsAsync(courseId, userId, token);
        if (active is not null && topics.Any(topic => topic.Id == active.TopicId))
            return Results.Ok(new CourseJourney("Attempt", active.TopicId, AttemptId: active.Id));
        if (topics.Count == 0) return Results.Ok(new CourseJourney("Topics"));

        var next = topics.FirstOrDefault(topic => topic.Status == "Available");
        if (next is not null)
        {
            var lesson = await database.Lessons.AsNoTracking()
                .Where(lesson => lesson.TopicId == next.Id && lesson.IsPublished &&
                    !database.LessonProgress.Any(item => item.UserId == userId && item.LessonId == lesson.Id))
                .OrderBy(lesson => lesson.SortOrder).ThenBy(lesson => lesson.Id)
                .Select(lesson => (Guid?)lesson.Id).FirstOrDefaultAsync(token);
            return Results.Ok(lesson is null ? new CourseJourney("Topic", next.Id) : new CourseJourney("Lesson", next.Id, lesson));
        }
        if (!topics.All(topic => topic.Status == "Completed")) return Results.Ok(new CourseJourney("Topics"));
        var claimed = await database.CourseCompletionReceipts.AnyAsync(item => item.UserId == userId && item.CourseId == courseId, token);
        var summary = await GetSummaryAsync(courseId, userId, database, ranks, token);
        return summary is null ? Results.NotFound() : Results.Ok(new CourseJourney("Completed", CompletionPending: !claimed, Summary: summary));
    }

    private static async Task<IResult> ClaimCompletionAsync(Guid courseId, ClaimsPrincipal principal,
        AppDbContext database, ProgressService progress, RankCalculator ranks, TimeProvider clock, CancellationToken token)
    {
        var userId = principal.GetUserId();
        await using var transaction = await database.Database.BeginTransactionAsync(token);
        await AccountRules.LockProfileAsync(database, userId, token);
        var topics = await progress.GetTopicsAsync(courseId, userId, token);
        if (topics.Count == 0 || topics.Any(topic => topic.Status != "Completed"))
            return Results.Conflict(new { code = "CourseIncomplete" });

        if (await database.CourseCompletionReceipts.AnyAsync(item => item.UserId == userId && item.CourseId == courseId, token))
            return Results.NoContent();
        var summary = await GetSummaryAsync(courseId, userId, database, ranks, token);
        if (summary is null) return Results.NotFound();

        database.CourseCompletionReceipts.Add(new CourseCompletionReceipt
        {
            UserId = userId, CourseId = courseId, AcknowledgedAt = clock.GetUtcNow()
        });
        await database.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return Results.Ok(summary);
    }

    private static async Task<CourseSummary?> GetSummaryAsync(Guid courseId, Guid userId, AppDbContext database,
        RankCalculator ranks, CancellationToken token)
    {
        var profile = await database.PlayerProfiles.AsNoTracking().Where(item => item.UserId == userId)
            .Select(item => new { item.TotalXp, item.CoinsBalance }).SingleOrDefaultAsync(token);
        if (profile is null) return null;
        var attempts = await database.Attempts.CountAsync(attempt =>
            attempt.UserId == userId && attempt.Topic.CourseId == courseId && attempt.BegunAt != null, token);
        return new(profile.TotalXp, profile.CoinsBalance, ranks.Calculate(profile.TotalXp).Rank, attempts);
    }
}
