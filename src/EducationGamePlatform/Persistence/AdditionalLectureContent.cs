using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Persistence;

internal static class AdditionalLectureContent
{
    public static async Task SeedAsync(AppDbContext database, CancellationToken token)
    {
        for (var order = 4; order <= 8; order++)
        {
            using var stream = typeof(AdditionalLectureContent).Assembly
                .GetManifestResourceStream($"Lectures.topic{order}_lecture.md")
                ?? throw new InvalidOperationException($"Не найдена лекция темы {order}.");
            using var reader = new StreamReader(stream);
            var content = await reader.ReadToEndAsync(token);
            var heading = content.Split('\n', 2)[0].Trim().TrimStart('\uFEFF');
            var prefix = $"# Тема {order}: ";
            if (!heading.StartsWith(prefix, StringComparison.Ordinal) || content.Length < 100)
                throw new InvalidOperationException($"Неверный формат лекции темы {order}.");
            var title = heading[prefix.Length..];
            var topicId = DemoGameContent.TopicId(order);
            var topic = await database.Topics.SingleOrDefaultAsync(item => item.Id == topicId, token);
            if (topic is null)
            {
                topic = new Topic { Id = topicId, CourseId = DemoData.CourseId, SortOrder = order, IsPublished = true };
                database.Topics.Add(topic);
            }
            topic.Title = title;
            topic.Subtitle = "Лекция · без испытания";
            topic.Description = "Тема завершается после прочтения лекции. Испытания пока не добавлены.";
            topic.IconKey = "book";

            var lessonId = DemoGameContent.LessonId(order);
            var lesson = await database.Lessons.SingleOrDefaultAsync(item => item.Id == lessonId, token);
            if (lesson is null)
            {
                lesson = new Lesson { Id = lessonId, Topic = topic, SortOrder = 1, IsPublished = true };
                database.Lessons.Add(lesson);
            }
            lesson.Title = title;
            lesson.ContentMarkdown = content;
        }
        await database.SaveChangesAsync(token);
    }
}
