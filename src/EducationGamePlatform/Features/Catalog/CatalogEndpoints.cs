using System.Security.Claims;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EducationGamePlatform.Features.Catalog;

public sealed record CourseResponse(Guid Id, string Slug, string Title, string Description)
{
    public int TotalTopics { get; init; }
    public int CompletedTopics { get; init; }
    public int ProgressPercent { get; init; }
}
public sealed record TopicResponse(Guid Id, string Title, string Description, int SortOrder, int LessonCount, int CompletedLessons,
    string Status, bool IsRead);
public sealed record LessonSummary(Guid Id, string Title, int SortOrder);
public sealed record AssessmentSummary(Guid Id, string Title, AssessmentMode Mode, bool IsRequired);
public sealed record TopicDetails(Guid Id, Guid CourseId, string Title, string Description,
    List<LessonSummary> Lessons, List<AssessmentSummary> Assessments);
public sealed record LessonResponse(Guid Id, Guid TopicId, string Title, string ContentMarkdown, DateTimeOffset? CompletedAt)
{
    public int AwardedXp { get; init; }
}
public sealed record CompletionResponse(Guid LessonId, DateTimeOffset CompletedAt)
{
    public int XpAwarded { get; init; }
}

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api").RequireAuthorization().WithTags("Learning");
        group.MapGet("/courses", async (AppDbContext database, ProgressService progress, ClaimsPrincipal user, CancellationToken cancellationToken) =>
        {
            var courses = await database.Courses.AsNoTracking().Where(course => course.IsPublished).OrderBy(course => course.Title)
                .ThenBy(course => course.Id).Select(course => new CourseResponse(course.Id, course.Slug, course.Title,
                    course.Description)).ToListAsync(cancellationToken);
            var result = new List<CourseResponse>();
            foreach (var course in courses)
            {
                var topics = await progress.GetTopicsAsync(course.Id, user.GetUserId(), cancellationToken);
                var passed = topics.Count(topic => topic.Status == "Completed");
                result.Add(course with { TotalTopics = topics.Count, CompletedTopics = passed,
                    ProgressPercent = topics.Count == 0 ? 0 : passed * 100 / topics.Count });
            }
            return Results.Ok(result);
        }).WithSummary("List published courses and personal course progress.");
        group.MapGet("/courses/{courseId:guid}/topics", GetTopicsAsync)
            .WithSummary("List published topics with the current user's reading progress.").Produces<List<TopicResponse>>();
        group.MapGet("/topics/{topicId:guid}", GetTopicAsync)
            .WithSummary("Read a topic's lessons and assessment metadata.").Produces<TopicDetails>();
        group.MapGet("/lessons/{lessonId:guid}", GetLessonAsync)
            .WithSummary("Read a published lesson.").Produces<LessonResponse>();
        group.MapPut("/me/lessons/{lessonId:guid}/completion", CompleteLessonAsync)
            .WithSummary("Mark a lesson as read and award lecture XP once.").Produces<CompletionResponse>();
    }

    private static async Task<IResult> GetTopicsAsync(Guid courseId, ClaimsPrincipal user, ProgressService progress,
        CancellationToken cancellationToken)
    {
        var topics = await progress.GetTopicsAsync(courseId, user.GetUserId(), cancellationToken);
        return Results.Ok(topics.Select(topic => new TopicResponse(topic.Id, topic.Title, topic.Description,
            topic.SortOrder, topic.LessonCount, topic.CompletedLessons, topic.Status, topic.IsRead)).ToList());
    }

    private static async Task<IResult> GetTopicAsync(Guid topicId, AppDbContext database, ClaimsPrincipal user,
        ProgressService progress, CancellationToken cancellationToken)
    {
        await progress.RequireTopicAsync(topicId, user.GetUserId(), false, cancellationToken);
        var topic = await database.Topics.AsNoTracking().AsSplitQuery()
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

    private static async Task<IResult> GetLessonAsync(Guid lessonId, ClaimsPrincipal user, AppDbContext database, ProgressService progress,
        CancellationToken cancellationToken)
    {
        var userId = user.GetUserId();
        var lesson = await PublishedLessons(database).Where(lesson => lesson.Id == lessonId)
            .Select(lesson => new LessonResponse(lesson.Id, lesson.TopicId, lesson.Title, lesson.ContentMarkdown,
                database.LessonProgress.Where(progress => progress.UserId == userId && progress.LessonId == lessonId)
                    .Select(progress => (DateTimeOffset?)progress.CompletedAt).FirstOrDefault())
                { AwardedXp = database.LessonProgress.Where(progress => progress.UserId == userId && progress.LessonId == lessonId)
                    .Select(progress => progress.AwardedXp).FirstOrDefault() })
            .SingleOrDefaultAsync(cancellationToken);
        if (lesson is null) return Results.NotFound();
        await progress.RequireTopicAsync(lesson.TopicId, userId, false, cancellationToken);
        return Results.Ok(lesson);
    }

    private static async Task<IResult> CompleteLessonAsync(Guid lessonId, ClaimsPrincipal user, AppDbContext database,
        TimeProvider clock, ProgressService topics, IOptions<GameOptions> options, CancellationToken cancellationToken)
    {
        var lesson = await PublishedLessons(database).SingleOrDefaultAsync(lesson => lesson.Id == lessonId, cancellationToken);
        if (lesson is null) return Results.NotFound();
        var userId = user.GetUserId();
        await topics.RequireTopicAsync(lesson.TopicId, userId, false, cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"PlayerProfiles\" WHERE \"UserId\" = {userId} FOR UPDATE", cancellationToken);
        var profile = await database.PlayerProfiles.SingleAsync(profile => profile.UserId == userId, cancellationToken);
        var progress = await database.LessonProgress.SingleOrDefaultAsync(progress => progress.UserId == userId && progress.LessonId == lessonId, cancellationToken);
        if (progress is null)
        {
            progress = new LessonProgress { UserId = userId, LessonId = lessonId, CompletedAt = GameTime.Now(clock) };
            database.LessonProgress.Add(progress);
        }
        // Existing marks from the API-only version receive the newly introduced award once as well.
        var awarded = progress.AwardedXp == 0 ? options.Value.LessonXp : 0;
        progress.AwardedXp += awarded;
        profile.TotalXp += awarded;
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new CompletionResponse(lessonId, progress.CompletedAt) { XpAwarded = awarded });
    }

    private static IQueryable<Lesson> PublishedLessons(AppDbContext database)
        => database.Lessons.AsNoTracking().Where(lesson => lesson.IsPublished && lesson.Topic.IsPublished && lesson.Topic.Course.IsPublished);
}
