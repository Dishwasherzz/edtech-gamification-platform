namespace EducationGamePlatform.Domain;

public enum AssessmentMode { Boss, Crisis }
public enum QuestionType { SingleChoice }

public sealed class Assessment
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TopicId { get; set; }
    public string Title { get; set; } = string.Empty;
    public AssessmentMode Mode { get; set; } = AssessmentMode.Boss;
    public bool IsRequired { get; set; } = true;
    public bool IsPublished { get; set; }
    public Topic Topic { get; set; } = null!;
    public List<AssessmentVersion> Versions { get; set; } = [];
}

public sealed class AssessmentVersion
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AssessmentId { get; set; }
    public int VersionNumber { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public int QuestionTimeLimitSeconds { get; set; } = 60;
    public int RequiredCorrectAnswers { get; set; }
    public int XpReward { get; set; }
    public int CoinsReward { get; set; }
    public string BossName { get; set; } = string.Empty;
    public int BossMaxHp { get; set; }
    public int DamagePerCorrectAnswer { get; set; }
    public Assessment Assessment { get; set; } = null!;
    public List<Question> Questions { get; set; } = [];
    public List<CrisisScenario> Scenarios { get; set; } = [];
}

public sealed class Question
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AssessmentVersionId { get; set; }
    public Guid? ScenarioId { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public QuestionType Type { get; set; } = QuestionType.SingleChoice;
    public int SortOrder { get; set; }
    public string Explanation { get; set; } = string.Empty;
    public AssessmentVersion AssessmentVersion { get; set; } = null!;
    public CrisisScenario? Scenario { get; set; }
    public List<AnswerOption> Options { get; set; } = [];
}

public sealed class CrisisScenario
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AssessmentVersionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Introduction { get; set; } = string.Empty;
    public string IllustrationKey { get; set; } = "circuit";
    public int SortOrder { get; set; }
    public AssessmentVersion AssessmentVersion { get; set; } = null!;
    public List<Question> Questions { get; set; } = [];
}

public sealed class AnswerOption
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid QuestionId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int SortOrder { get; set; }
    public Question Question { get; set; } = null!;
}
