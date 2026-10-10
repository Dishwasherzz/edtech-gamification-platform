using System.Security.Claims;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Catalog;

public sealed record CourseResponse(Guid Id, string Slug, string Title, string Description);
public sealed record TopicResponse(Guid Id, string Title, string Description, int SortOrder, int LessonCount, int CompletedLessons);
public sealed record LessonSummary(Guid Id, string Title, int SortOrder);
public sealed record AssessmentSummary(Guid Id, string Title, AssessmentMode Mode, bool IsRequired);
public sealed record TopicDetails(Guid Id, Guid CourseId, string Title, string Description,
    List<LessonSummary> Lessons, List<AssessmentSummary> Assessments);
public sealed record LessonResponse(Guid Id, Guid TopicId, string Title, string ContentMarkdown, DateTimeOffset? CompletedAt);
public sealed record CompletionResponse(Guid LessonId, DateTimeOffset CompletedAt);

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api").RequireAuthorization().WithTags("Learning");
        group.MapGet("/courses", async (AppDbContext database, CancellationToken cancellationToken) =>
            await database.Courses.AsNoTracking().Where(course => course.IsPublished).OrderBy(course => course.Title)
                .ThenBy(course => course.Id).Select(course => new CourseResponse(course.Id, course.Slug, course.Title,
                    course.Description)).ToListAsync(cancellationToken)).WithSummary("List published courses.");
        group.MapGet("/courses/{courseId:guid}/topics", GetTopicsAsync)
            .WithSummary("List published topics with the current user's reading progress.").Produces<List<TopicResponse>>();
        group.MapGet("/topics/{topicId:guid}", GetTopicAsync)
            .WithSummary("Read a topic's lessons and assessment metadata.").Produces<TopicDetails>();
        group.MapGet("/lessons/{lessonId:guid}", GetLessonAsync)
            .WithSummary("Read a published lesson.").Produces<LessonResponse>();
        group.MapPut("/me/lessons/{lessonId:guid}/completion", CompleteLessonAsync)
            .WithSummary("Mark a lesson as read once; no XP or currency is awarded.").Produces<CompletionResponse>();
    }

    private static async Task<IResult> GetTopicsAsync(Guid courseId, ClaimsPrincipal user, AppDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await database.Courses.AnyAsync(course => course.Id == courseId && course.IsPublished, cancellationToken))
            return Results.NotFound();
        var userId = user.GetUserId();
        var topics = await database.Topics.AsNoTracking().Where(topic => topic.CourseId == courseId && topic.IsPublished)
            .OrderBy(topic => topic.SortOrder).ThenBy(topic => topic.Id)
            .Select(topic => new TopicResponse(topic.Id, topic.Title, topic.Description, topic.SortOrder,
                topic.Lessons.Count(lesson => lesson.IsPublished), database.LessonProgress.Count(progress =>
                    progress.UserId == userId && progress.Lesson.TopicId == topic.Id && progress.Lesson.IsPublished)))
            .ToListAsync(cancellationToken);
        return Results.Ok(topics);
    }

    private static async Task<IResult> GetTopicAsync(Guid topicId, AppDbContext database, CancellationToken cancellationToken)
    {
        var topic = await database.Topics.AsNoTracking()
            .Where(topic => topic.Id == topicId && topic.IsPublished && topic.Course.IsPublished)
            .Select(topic => new TopicDetails(topic.Id, topic.CourseId, topic.Title, topic.Description,
                topic.Lessons.Where(lesson => lesson.IsPublished).OrderBy(lesson => lesson.SortOrder).ThenBy(lesson => lesson.Id)
                    .Select(lesson => new LessonSummary(lesson.Id, lesson.Title, lesson.SortOrder)).ToList(),
                topic.Assessments.Where(assessment => assessment.IsPublished && assessment.Versions.Any(version => version.PublishedAt != null))
                    .OrderBy(assessment => assessment.Title).ThenBy(assessment => assessment.Id)
                    .Select(assessment => new AssessmentSummary(assessment.Id, assessment.Title, assessment.Mode,
                        assessment.IsRequired)).ToList())).SingleOrDefaultAsync(cancellationToken);
        return topic is null ? Results.NotFound() : Results.Ok(topic);
    }

    private static async Task<IResult> GetLessonAsync(Guid lessonId, ClaimsPrincipal user, AppDbContext database,
        CancellationToken cancellationToken)
    {
        var userId = user.GetUserId();
        var lesson = await PublishedLessons(database).Where(lesson => lesson.Id == lessonId)
            .Select(lesson => new LessonResponse(lesson.Id, lesson.TopicId, lesson.Title, lesson.ContentMarkdown,
                database.LessonProgress.Where(progress => progress.UserId == userId && progress.LessonId == lessonId)
                    .Select(progress => (DateTimeOffset?)progress.CompletedAt).FirstOrDefault()))
            .SingleOrDefaultAsync(cancellationToken);
        return lesson is null ? Results.NotFound() : Results.Ok(lesson);
    }

    private static async Task<IResult> CompleteLessonAsync(Guid lessonId, ClaimsPrincipal user, AppDbContext database,
        TimeProvider clock, CancellationToken cancellationToken)
    {
        if (!await PublishedLessons(database).AnyAsync(lesson => lesson.Id == lessonId, cancellationToken))
            return Results.NotFound();
        var userId = user.GetUserId();
        var completedAt = clock.GetUtcNow();
        // The primary key + ON CONFLICT also make simultaneous requests idempotent.
        await database.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "LessonProgress" ("UserId", "LessonId", "CompletedAt")
            VALUES ({userId}, {lessonId}, {completedAt})
            ON CONFLICT ("UserId", "LessonId") DO NOTHING
            """, cancellationToken);
        var progress = await database.LessonProgress.AsNoTracking()
            .SingleAsync(progress => progress.UserId == userId && progress.LessonId == lessonId, cancellationToken);
        return Results.Ok(new CompletionResponse(lessonId, progress.CompletedAt));
    }

    private static IQueryable<Lesson> PublishedLessons(AppDbContext database)
        => database.Lessons.AsNoTracking().Where(lesson => lesson.IsPublished && lesson.Topic.IsPublished && lesson.Topic.Course.IsPublished);
}
