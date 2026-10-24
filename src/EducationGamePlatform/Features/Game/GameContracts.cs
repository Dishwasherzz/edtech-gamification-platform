using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Cosmetics;

namespace EducationGamePlatform.Features.Game;

public sealed record AnswerRequest(Guid SelectedOptionId, Guid RequestId);
public sealed record OptionResponse(Guid Id, string Text, bool IsDisabled);
public sealed record QuestionResponse(Guid Id, int Position, string Prompt, DateTimeOffset ExpiresAt, List<OptionResponse> Options);
public sealed record ScenarioResponse(string Title, string Introduction, string IllustrationKey);
public sealed record FeedbackResponse(Guid QuestionId, bool IsCorrect, string Message);
public sealed record RewardResponse(int Xp, int Coins, bool IsFirstPass, bool PerfectBonus);
public sealed record ReviewResponse(int Position, string Prompt, string? SelectedAnswer, string CorrectAnswer,
    string Explanation, bool IsCorrect, bool TimedOut, List<string> WrongChoices);
public sealed record AttemptResponse(Guid Id, Guid TopicId, Guid AssessmentId, string TopicTitle, AssessmentMode Mode,
    AttemptStatus Status, bool IsReady, DateTimeOffset ServerNow, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt,
    DateTimeOffset? ExpiresAt, int CorrectAnswers, int Errors, int QuestionCount, int BossHpRemaining,
    int BossMaxHp, string BossName, string? FinishReason, ScenarioResponse? Scenario, QuestionResponse? CurrentQuestion,
    FeedbackResponse? Feedback, RewardResponse? Reward, List<ReviewResponse>? Review)
{
    public SkinReference? CharacterSkin { get; init; }
    public MascotPresentation? Mascot { get; init; }
}
public sealed record HistoryResponse(Guid Id, Guid TopicId, string TopicTitle, AssessmentMode Mode, AttemptStatus Status,
    DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, int CorrectAnswers, int Errors, int Xp, int Coins);
