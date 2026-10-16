using EducationGamePlatform.Domain;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Game;

public sealed record TopicState(Guid Id, string Title, string Description, int SortOrder, int LessonCount,
    int CompletedLessons, string Status, bool IsRead);

public sealed class ProgressService(AppDbContext database)
{
    public async Task<List<TopicState>> GetTopicsAsync(Guid courseId, Guid userId, CancellationToken token)
    {
        if (!await database.Courses.AnyAsync(course => course.Id == courseId && course.IsPublished, token))
            throw new GameRuleException(404, "NotFound", "Курс не найден.");
        var topics = await database.Topics.AsNoTracking().Where(topic => topic.CourseId == courseId && topic.IsPublished)
            .OrderBy(topic => topic.SortOrder).ThenBy(topic => topic.Id)
            .Select(topic => new { topic.Id, topic.Title, topic.Description, topic.SortOrder,
                Lessons = topic.Lessons.Count(lesson => lesson.IsPublished),
                Read = database.LessonProgress.Count(progress => progress.UserId == userId &&
                    progress.Lesson.TopicId == topic.Id && progress.Lesson.IsPublished) }).ToListAsync(token);
        var completed = await database.TopicProgress.Where(progress => progress.UserId == userId &&
            progress.Topic.CourseId == courseId).Select(progress => progress.TopicId).ToListAsync(token);
        var previousPassed = true;
        var result = new List<TopicState>();
        foreach (var topic in topics)
        {
            var passed = completed.Contains(topic.Id);
            result.Add(new(topic.Id, topic.Title, topic.Description, topic.SortOrder, topic.Lessons, topic.Read,
                passed ? "Completed" : previousPassed ? "Available" : "Locked", topic.Lessons > 0 && topic.Read == topic.Lessons));
            previousPassed &= passed;
        }
        return result;
    }

    public async Task<TopicState> RequireTopicAsync(Guid topicId, Guid userId, bool requireRead, CancellationToken token)
    {
        var courseId = await database.Topics.Where(topic => topic.Id == topicId && topic.IsPublished && topic.Course.IsPublished)
            .Select(topic => (Guid?)topic.CourseId).SingleOrDefaultAsync(token);
        if (courseId is null) throw new GameRuleException(404, "NotFound", "Тема не найдена.");
        var state = (await GetTopicsAsync(courseId.Value, userId, token)).Single(topic => topic.Id == topicId);
        if (state.Status == "Locked") throw new GameRuleException(409, "TopicLocked", "Сначала пройди предыдущую тему.");
        if (requireRead && !state.IsRead) throw new GameRuleException(409, "LectureRequired", "Сначала отметь лекцию как прочитанную.");
        return state;
    }
}
