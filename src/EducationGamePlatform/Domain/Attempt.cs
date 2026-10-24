namespace EducationGamePlatform.Domain;

public enum AttemptStatus { Active, Passed, Failed, Abandoned }
public enum AttemptQuestionStatus { Pending, Presented, Answered, TimedOut }
public enum RewardReason { FirstPass, RepeatPass }

public sealed class Attempt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid AssessmentId { get; set; }
    public Guid AssessmentVersionId { get; set; }
    public Guid TopicId { get; set; }
    public Guid? ScenarioId { get; set; }
    public Guid? CharacterSkinId { get; set; }
    public Guid? MascotId { get; set; }
    public AttemptStatus Status { get; set; } = AttemptStatus.Active;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? BegunAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public int CorrectAnswers { get; set; }
    public int ErrorCount { get; set; }
    public string? FinishReason { get; set; }
    public int QuestionCount { get; set; }
    public int BossHpRemaining { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
    public CrisisScenario? Scenario { get; set; }
    public AssessmentVersion AssessmentVersion { get; set; } = null!;
    public List<AttemptQuestion> Questions { get; set; } = [];
}

public sealed class AttemptQuestion
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AttemptId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid AssessmentVersionId { get; set; }
    public int Position { get; set; }
    public DateTimeOffset? PresentedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public AttemptQuestionStatus Status { get; set; } = AttemptQuestionStatus.Pending;
    public Attempt Attempt { get; set; } = null!;
    public Question Question { get; set; } = null!;
    public AttemptAnswer? Answer { get; set; }
}

public sealed class AttemptAnswer
{
    public Guid AttemptQuestionId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid SelectedOptionId { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public bool IsCorrect { get; set; }
    public AttemptQuestion AttemptQuestion { get; set; } = null!;
    public AnswerOption SelectedOption { get; set; } = null!;
}

public sealed class RewardGrant
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid AssessmentId { get; set; }
    public Guid TopicId { get; set; }
    public Guid AttemptId { get; set; }
    public RewardReason Reason { get; set; } = RewardReason.FirstPass;
    public int XpAmount { get; set; }
    public int CoinsAmount { get; set; }
    public DateTimeOffset GrantedAt { get; set; }
    public Attempt Attempt { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}

// Includes unsuccessful QTE choices. AttemptAnswer keeps the final answer of a step.
public sealed class AttemptChoice
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid RequestId { get; set; }
    public Guid AttemptId { get; set; }
    public Guid AttemptQuestionId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid SelectedOptionId { get; set; }
    public bool IsCorrect { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public AttemptQuestion AttemptQuestion { get; set; } = null!;
    public AnswerOption SelectedOption { get; set; } = null!;
}
