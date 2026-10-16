using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Persistence;

public static class DemoData
{
    public static readonly Guid CourseId = Guid.Parse("10000000-0000-4000-8000-000000000001");
    public static readonly Guid TopicId = Guid.Parse("20000000-0000-4000-8000-000000000001");
    public static readonly Guid LessonId = Guid.Parse("30000000-0000-4000-8000-000000000001");

    public static async Task SeedAsync(AppDbContext database, CancellationToken cancellationToken = default)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        await database.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(20261010)", cancellationToken);
        if (!await database.Courses.AnyAsync(course => course.Id == CourseId, cancellationToken))
        {
            database.Courses.Add(new Course
            {
                Id = CourseId, Slug = "electrical-engineering", Title = "Электротехника",
                Description = "Демонстрационные данные для разработки. Материалы требуют согласования с преподавателем.",
                IsPublished = true,
                Topics = [new Topic
                {
                    Id = TopicId, Title = "Электрические величины", SortOrder = 1, IsPublished = true,
                    Description = "Напряжение, сила тока, сопротивление.",
                    Lessons = [new Lesson
                    {
                        Id = LessonId, Title = "Закон Ома для участка цепи", SortOrder = 1, IsPublished = true,
                        ContentMarkdown = """
                            # Закон Ома для участка цепи

                            Демонстрационная лекция для проверки API; учебное содержание согласуется с преподавателем.

                            Для участка цепи с сопротивлением R: **I = U / R**.
                            U измеряется в вольтах, I — в амперах, R — в омах.

                            Например, при U = 12 В и R = 6 Ом сила тока равна 2 А.
                            """
                    }]
                }]
            });
            await database.SaveChangesAsync(cancellationToken);
        }
        await DemoGameContent.SeedAsync(database, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
