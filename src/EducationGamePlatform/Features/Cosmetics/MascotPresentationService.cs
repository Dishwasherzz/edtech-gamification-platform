using EducationGamePlatform.Domain;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Features.Cosmetics;

public sealed class MascotPresentationService(AppDbContext database)
{
    public async Task<MascotPresentation> ForAttemptAsync(Attempt attempt, MascotResponse character, List<AttemptChoice> choices,
        DateTimeOffset now, CancellationToken token)
    {
        var eventType = ResolveEvent(attempt, choices, now);
        var context = attempt.AssessmentVersion.Assessment.Mode == AssessmentMode.Boss ? MascotContext.Boss : MascotContext.Crisis;
        var reactions = await database.MascotReactions.AsNoTracking().Where(reaction => reaction.MascotId == character.Id &&
            reaction.Event == eventType && (reaction.Context == context || reaction.Context == MascotContext.Any))
            .OrderBy(reaction => reaction.Context == context ? 0 : 1).ThenBy(reaction => reaction.Variant).ToListAsync(token);
        var candidates = reactions.Where(reaction => reaction.Context == context).ToList();
        if (candidates.Count == 0) candidates = reactions;
        if (candidates.Count == 0)
            candidates = await database.MascotReactions.AsNoTracking().Where(reaction => reaction.MascotId == character.Id &&
                reaction.Event == MascotEvent.Idle && reaction.Context == MascotContext.Any).OrderBy(reaction => reaction.Variant).ToListAsync(token);
        // A newly added character without animation metadata must not break a learning attempt.
        if (candidates.Count == 0)
            return new(character, eventType, context, Guid.Empty, 0, character.AssetKey, $"{character.Name}: продолжай обучение. Состояние попытки сохранено.");
        var phase = choices.Count + attempt.Questions.Count(question => question.Status == AttemptQuestionStatus.TimedOut);
        // Deterministic across polling, restart and replay; no process-randomized string.GetHashCode().
        var index = (attempt.Id.ToByteArray()[0] + phase + (int)eventType) % candidates.Count;
        var selected = candidates[index];
        return new(character, eventType, context, selected.Id, selected.Variant, selected.AssetKey, selected.Message);
    }

    private static MascotEvent ResolveEvent(Attempt attempt, List<AttemptChoice> choices, DateTimeOffset now)
    {
        if (attempt.Status == AttemptStatus.Passed) return MascotEvent.Victory;
        if (attempt.Status == AttemptStatus.Failed) return MascotEvent.Defeat;
        if (attempt.Status == AttemptStatus.Abandoned) return MascotEvent.Abandoned;
        if (attempt.BegunAt == null) return MascotEvent.Intro;
        if (attempt.ExpiresAt <= now.AddSeconds(10)) return MascotEvent.TimeWarning;
        var lastChoice = choices.OrderByDescending(choice => choice.ReceivedAt).ThenByDescending(choice => choice.Id).FirstOrDefault();
        var timeout = attempt.Questions.Where(question => question.Status == AttemptQuestionStatus.TimedOut)
            .Select(question => question.ExpiresAt).Max();
        if (timeout != null && (lastChoice == null || timeout > lastChoice.ReceivedAt)) return MascotEvent.Timeout;
        return lastChoice == null ? MascotEvent.Idle : lastChoice.IsCorrect ? MascotEvent.CorrectAnswer : MascotEvent.WrongAnswer;
    }
}
