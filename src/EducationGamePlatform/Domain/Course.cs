namespace EducationGamePlatform.Domain;

public sealed class Course
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsPublished { get; set; }
    public List<Topic> Topics { get; set; } = [];
}

public sealed class Topic
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid CourseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
    public Course Course { get; set; } = null!;
    public List<Lesson> Lessons { get; set; } = [];
    public List<Assessment> Assessments { get; set; } = [];
}

public sealed class Lesson
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TopicId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentMarkdown { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
    public Topic Topic { get; set; } = null!;
}

public sealed class LessonProgress
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public DateTimeOffset CompletedAt { get; set; }
    public int AwardedXp { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Lesson Lesson { get; set; } = null!;
}

public sealed class TopicProgress
{
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public DateTimeOffset CompletedAt { get; set; }
    public Guid FirstAttemptId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
    public Attempt FirstAttempt { get; set; } = null!;
}
