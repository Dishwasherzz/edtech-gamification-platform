using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Cosmetics;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EducationGamePlatform.Features.Game;

// All mutations for a player hold their profile row lock. Rewards, answers and progress commit together.
public sealed class GameService(AppDbContext database, ProgressService progress, TimeProvider clock, IOptions<GameOptions> options,
    CosmeticsService cosmetics, MascotPresentationService mascots)
{
    private GameOptions Economy => options.Value;

    private async Task<T> LockedAsync<T>(Guid userId, Func<PlayerProfile, Task<T>> work, CancellationToken token)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(token);
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"PlayerProfiles\" WHERE \"UserId\" = {userId} FOR UPDATE", token);
        var profile = await database.PlayerProfiles.SingleAsync(profile => profile.UserId == userId, token);
        var result = await work(profile);
        await database.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return result;
    }

    public Task<AttemptResponse> StartAsync(Guid assessmentId, Guid userId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        var assessment = await database.Assessments.Include(assessment => assessment.Topic).ThenInclude(topic => topic.Course)
            .SingleOrDefaultAsync(assessment => assessment.Id == assessmentId && assessment.IsPublished &&
                assessment.Topic.IsPublished && assessment.Topic.Course.IsPublished, token)
            ?? throw new GameRuleException(404, "NotFound", "Испытание не найдено.");
        await progress.RequireTopicAsync(assessment.TopicId, userId, true, token);
        var activeIds = await database.Attempts.Where(attempt => attempt.UserId == userId && attempt.Status == AttemptStatus.Active)
            .Select(attempt => attempt.Id).ToListAsync(token);
        foreach (var activeId in activeIds)
        {
            var active = await LoadAsync(activeId, userId, token);
            Expire(active, GameTime.Now(clock));
            if (active.Status != AttemptStatus.Active) continue;
            if (active.AssessmentId == assessmentId) return await ViewAsync(active, null, token);
            throw new GameRuleException(409, "ActiveAttempt", "Сначала заверши или покинь текущее испытание.");
        }
        await database.SaveChangesAsync(token);
        var version = await database.AssessmentVersions.Include(version => version.Questions).ThenInclude(question => question.Options)
            .Include(version => version.Scenarios).AsSplitQuery()
            .Where(version => version.AssessmentId == assessmentId && version.PublishedAt != null)
            .OrderByDescending(version => version.VersionNumber).FirstOrDefaultAsync(token)
            ?? throw new GameRuleException(409, "NotPublished", "Нет опубликованной версии испытания.");
        List<Question> questions;
        CrisisScenario? scenario = null;
        if (assessment.Mode == AssessmentMode.Boss)
        {
            var seen = await database.AttemptQuestions.Where(question => question.Attempt.UserId == userId &&
                question.Attempt.TopicId == assessment.TopicId && question.Status != AttemptQuestionStatus.Pending)
                .Select(question => question.QuestionId).ToListAsync(token);
            questions = version.Questions.Where(question => question.ScenarioId == null)
                .OrderBy(question => seen.Contains(question.Id)).ThenBy(_ => Random.Shared.Next()).Take(7).ToList();
            if (questions.Count != 7 || version.QuestionTimeLimitSeconds is < 45 or > 60)
                throw new GameRuleException(409, "InvalidContent", "Для теста нужны минимум 7 вопросов и таймер 45–60 секунд.");
        }
        else
        {
            if (version.Scenarios.Count != 3)
                throw new GameRuleException(409, "InvalidContent", "Для аварии нужны три опубликованных сценария в версии испытания.");
            var previous = await database.Attempts.Where(attempt => attempt.UserId == userId && attempt.TopicId == assessment.TopicId && attempt.ScenarioId != null)
                .OrderByDescending(attempt => attempt.StartedAt).ThenByDescending(attempt => attempt.Id).Select(attempt => attempt.ScenarioId).ToListAsync(token);
            scenario = version.Scenarios.Where(candidate => previous.Count == 0 || candidate.Id != previous[0])
                .OrderBy(candidate => previous.Contains(candidate.Id)).ThenBy(_ => Random.Shared.Next()).FirstOrDefault()
                ?? throw new GameRuleException(409, "InvalidContent", "Сценарии аварии ещё не подготовлены.");
            questions = version.Questions.Where(question => question.ScenarioId == scenario.Id).OrderBy(question => question.SortOrder).ToList();
            if (questions.Count != 4) throw new GameRuleException(409, "InvalidContent", "В сценарии аварии должны быть 4 шага.");
        }
        if (questions.Any(question => question.Options.Count != (assessment.Mode == AssessmentMode.Boss ? 4 : 3) ||
            question.Options.Count(option => option.IsCorrect) != 1))
            throw new GameRuleException(409, "InvalidContent", "Проверь варианты ответа и правильный вариант каждого вопроса.");
        var now = GameTime.Now(clock);
        var appearance = await cosmetics.CaptureAsync(profile, token);
        var attempt = new Attempt
        {
            UserId = userId, AssessmentId = assessmentId, AssessmentVersionId = version.Id, TopicId = assessment.TopicId,
            AssessmentVersion = version, Topic = assessment.Topic, ScenarioId = scenario?.Id, Scenario = scenario,
            StartedAt = now, BegunAt = assessment.Mode == AssessmentMode.Boss ? now : null,
            CharacterSkinId = appearance.CharacterSkin.Id, MascotId = appearance.Mascot.Id,
            // A prepared QTE intro does not start the 60-second game timer. Stale preparations expire after 30 minutes.
            ExpiresAt = now.AddMinutes(30), QuestionCount = questions.Count, BossHpRemaining = assessment.Mode == AssessmentMode.Boss ? 100 : 0
        };
        attempt.Questions = questions.Select((question, index) => new AttemptQuestion
        {
            AttemptId = attempt.Id, QuestionId = question.Id, AssessmentVersionId = version.Id,
            Question = question, Position = index
        }).ToList();
        database.Attempts.Add(attempt);
        if (attempt.BegunAt != null) Present(attempt, now);
        await database.SaveChangesAsync(token);
        return await ViewAsync(attempt, null, token);
    }, token);

    public Task<AttemptResponse> BeginAsync(Guid id, Guid userId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        var attempt = await LoadAsync(id, userId, token);
        Expire(attempt, GameTime.Now(clock));
        if (attempt.Status == AttemptStatus.Active && attempt.BegunAt == null)
        {
            attempt.BegunAt = GameTime.Now(clock);
            attempt.ExpiresAt = attempt.BegunAt.Value.AddSeconds(60);
            Present(attempt, attempt.BegunAt.Value);
        }
        await database.SaveChangesAsync(token);
        return await ViewAsync(attempt, null, token);
    }, token);

    public Task<AttemptResponse> GetAsync(Guid id, Guid userId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        var attempt = await LoadAsync(id, userId, token);
        Expire(attempt, GameTime.Now(clock));
        await database.SaveChangesAsync(token);
        return await ViewAsync(attempt, null, token);
    }, token);

    public Task<AttemptResponse?> ActiveAsync(Guid userId, CancellationToken token) => LockedAsync<AttemptResponse?>(userId, async profile =>
    {
        var id = await database.Attempts.Where(attempt => attempt.UserId == userId && attempt.Status == AttemptStatus.Active)
            .Select(attempt => (Guid?)attempt.Id).SingleOrDefaultAsync(token);
        if (id == null) return null;
        var attempt = await LoadAsync(id.Value, userId, token);
        Expire(attempt, GameTime.Now(clock));
        await database.SaveChangesAsync(token);
        return attempt.Status == AttemptStatus.Active ? await ViewAsync(attempt, null, token) : null;
    }, token);

    public Task<AttemptResponse> AnswerAsync(Guid id, Guid attemptQuestionId, AnswerRequest request, Guid userId, CancellationToken token)
        => LockedAsync(userId, async profile =>
    {
        var attempt = await LoadAsync(id, userId, token);
        var now = GameTime.Now(clock);
        Expire(attempt, now);
        if (request.RequestId == Guid.Empty) throw new GameRuleException(400, "RequestIdRequired", "Укажи идентификатор запроса.");
        var replay = await database.AttemptChoices.SingleOrDefaultAsync(choice => choice.AttemptId == id && choice.RequestId == request.RequestId, token);
        if (replay != null)
        {
            if (replay.AttemptQuestionId != attemptQuestionId || replay.SelectedOptionId != request.SelectedOptionId)
                throw new GameRuleException(409, "RequestConflict", "Этот идентификатор уже использован для другого ответа.");
            await database.SaveChangesAsync(token);
            return await ViewAsync(attempt, new(attemptQuestionId, replay.IsCorrect, "Ответ уже сохранён."), token);
        }
        // A late packet cannot change a result, rewards, or the next question.
        if (attempt.Status != AttemptStatus.Active || attempt.BegunAt == null)
        {
            await database.SaveChangesAsync(token);
            return await ViewAsync(attempt, null, token);
        }
        var current = attempt.Questions.SingleOrDefault(question => question.Status == AttemptQuestionStatus.Presented);
        var repeated = await database.AttemptChoices.AnyAsync(choice => choice.AttemptId == id &&
            choice.AttemptQuestionId == attemptQuestionId && choice.SelectedOptionId == request.SelectedOptionId, token);
        if (repeated)
        {
            await database.SaveChangesAsync(token);
            return await ViewAsync(attempt, null, token);
        }
        if (current?.Id != attemptQuestionId)
        {
            // Persist automatic timeouts even when a request referred to the expired question.
            await database.SaveChangesAsync(token);
            return await ViewAsync(attempt, new(attemptQuestionId, false, "Вопрос уже завершён. Показано актуальное состояние."), token);
        }
        var option = current.Question.Options.SingleOrDefault(option => option.Id == request.SelectedOptionId)
            ?? throw new GameRuleException(400, "InvalidOption", "Этот вариант не относится к текущему вопросу.");
        database.AttemptChoices.Add(new AttemptChoice
        {
            AttemptId = id, RequestId = request.RequestId, AttemptQuestionId = current.Id,
            QuestionId = current.QuestionId, SelectedOptionId = option.Id, IsCorrect = option.IsCorrect, ReceivedAt = now
        });
        if (option.IsCorrect) attempt.CorrectAnswers++;
        else attempt.ErrorCount++;
        var boss = attempt.AssessmentVersion.Assessment.Mode == AssessmentMode.Boss;
        if (boss || option.IsCorrect)
        {
            current.Status = AttemptQuestionStatus.Answered;
            database.AttemptAnswers.Add(new AttemptAnswer
            {
                AttemptQuestionId = current.Id, QuestionId = current.QuestionId, SelectedOptionId = option.Id,
                IsCorrect = option.IsCorrect, ReceivedAt = now
            });
        }
        if (boss) attempt.BossHpRemaining = Math.Max(0, 100 - attempt.CorrectAnswers * 20);
        else attempt.ExpiresAt = attempt.ExpiresAt!.Value.AddSeconds(option.IsCorrect ? 10 : -10);
        if (attempt.ErrorCount >= 3) Fail(attempt, now, "ThreeErrors");
        else if (!boss && attempt.ExpiresAt <= now) Fail(attempt, now, "TimeExpired");
        else if (attempt.CorrectAnswers >= (boss ? 5 : 4)) await WinAsync(attempt, profile, now, token);
        else if (boss || option.IsCorrect) Present(attempt, now);
        else if (current.ExpiresAt > current.PresentedAt && attempt.ExpiresAt > current.PresentedAt) current.ExpiresAt = attempt.ExpiresAt;
        await database.SaveChangesAsync(token);
        var message = option.IsCorrect ? "Верно!" : boss ? "Неверно. Разбор будет в итогах." : "Неверное действие: −10 секунд. Выбери другой вариант.";
        return await ViewAsync(attempt, new(current.Id, option.IsCorrect, message), token);
    }, token);

    public Task<AttemptResponse> AbandonAsync(Guid id, Guid userId, CancellationToken token) => LockedAsync(userId, async profile =>
    {
        var attempt = await LoadAsync(id, userId, token);
        Expire(attempt, GameTime.Now(clock));
        if (attempt.Status == AttemptStatus.Active)
        {
            attempt.Status = AttemptStatus.Abandoned;
            attempt.FinishedAt = GameTime.Now(clock);
            attempt.FinishReason = "Abandoned";
        }
        await database.SaveChangesAsync(token);
        return await ViewAsync(attempt, null, token);
    }, token);

    public async Task<List<HistoryResponse>> HistoryAsync(Guid userId, int page, CancellationToken token)
    {
        if (page is < 1 or > 10000) throw new GameRuleException(400, "InvalidPage", "Недопустимый номер страницы.");
        return await database.Attempts.AsNoTracking().Where(attempt => attempt.UserId == userId)
            .OrderByDescending(attempt => attempt.StartedAt).ThenByDescending(attempt => attempt.Id).Skip((page - 1) * 20).Take(20)
            .Select(attempt => new HistoryResponse(attempt.Id, attempt.TopicId, attempt.Topic.Title, attempt.AssessmentVersion.Assessment.Mode,
                attempt.Status, attempt.StartedAt, attempt.FinishedAt, attempt.CorrectAnswers, attempt.ErrorCount,
                database.RewardGrants.Where(reward => reward.AttemptId == attempt.Id).Select(reward => reward.XpAmount).FirstOrDefault(),
                database.RewardGrants.Where(reward => reward.AttemptId == attempt.Id).Select(reward => reward.CoinsAmount).FirstOrDefault()))
            .ToListAsync(token);
    }

    private async Task<Attempt> LoadAsync(Guid id, Guid userId, CancellationToken token) => await database.Attempts
        .Include(attempt => attempt.Topic).Include(attempt => attempt.Scenario)
        .Include(attempt => attempt.AssessmentVersion).ThenInclude(version => version.Assessment)
        .Include(attempt => attempt.Questions).ThenInclude(question => question.Question).ThenInclude(question => question.Options)
        .Include(attempt => attempt.Questions).ThenInclude(question => question.Answer).AsSplitQuery()
        .SingleOrDefaultAsync(attempt => attempt.Id == id && attempt.UserId == userId, token)
        ?? throw new GameRuleException(404, "NotFound", "Попытка не найдена.");

    private static void Present(Attempt attempt, DateTimeOffset now)
    {
        var next = attempt.Questions.Where(question => question.Status == AttemptQuestionStatus.Pending).OrderBy(question => question.Position).FirstOrDefault();
        if (next == null) { Fail(attempt, now, "QuestionsExhausted"); return; }
        next.Status = AttemptQuestionStatus.Presented;
        next.PresentedAt = now;
        if (attempt.AssessmentVersion.Assessment.Mode == AssessmentMode.Boss)
            attempt.ExpiresAt = now.AddSeconds(attempt.AssessmentVersion.QuestionTimeLimitSeconds);
        next.ExpiresAt = attempt.ExpiresAt;
    }

    private static void Expire(Attempt attempt, DateTimeOffset now)
    {
        if (attempt.Status != AttemptStatus.Active || attempt.ExpiresAt == null || attempt.ExpiresAt > now) return;
        if (attempt.BegunAt == null || attempt.AssessmentVersion.Assessment.Mode == AssessmentMode.Crisis)
        {
            var current = attempt.Questions.SingleOrDefault(question => question.Status == AttemptQuestionStatus.Presented);
            if (current != null) current.Status = AttemptQuestionStatus.TimedOut;
            Fail(attempt, attempt.ExpiresAt.Value, "TimeExpired");
            return;
        }
        // Advance from the real previous deadline, never grant extra time after a refresh/offline period.
        while (attempt.Status == AttemptStatus.Active && attempt.ExpiresAt <= now)
        {
            var deadline = attempt.ExpiresAt!.Value;
            var current = attempt.Questions.Single(question => question.Status == AttemptQuestionStatus.Presented);
            current.Status = AttemptQuestionStatus.TimedOut;
            attempt.ErrorCount++;
            if (attempt.ErrorCount >= 3) Fail(attempt, deadline, "ThreeErrors");
            else Present(attempt, deadline);
        }
    }

    private static void Fail(Attempt attempt, DateTimeOffset now, string reason)
    {
        attempt.Status = AttemptStatus.Failed;
        attempt.FinishedAt = now;
        attempt.FinishReason = reason;
    }

    private async Task WinAsync(Attempt attempt, PlayerProfile profile, DateTimeOffset now, CancellationToken token)
    {
        attempt.Status = AttemptStatus.Passed;
        attempt.FinishedAt = now;
        attempt.FinishReason = "Passed";
        var first = !await database.TopicProgress.AnyAsync(item => item.UserId == attempt.UserId && item.TopicId == attempt.TopicId, token);
        var perfect = first && attempt.ErrorCount == 0;
        var xp = first ? Economy.FirstWinXp + (perfect ? Economy.PerfectBonusXp : 0) : Economy.FirstWinXp / 4;
        var coins = first ? Economy.FirstWinCoins + (perfect ? Economy.PerfectBonusCoins : 0) : Economy.FirstWinCoins / 4;
        if (first) database.TopicProgress.Add(new TopicProgress
        {
            UserId = attempt.UserId, TopicId = attempt.TopicId, FirstAttemptId = attempt.Id, CompletedAt = now
        });
        database.RewardGrants.Add(new RewardGrant
        {
            UserId = attempt.UserId, TopicId = attempt.TopicId, AssessmentId = attempt.AssessmentId, AttemptId = attempt.Id,
            Reason = first ? RewardReason.FirstPass : RewardReason.RepeatPass, XpAmount = xp, CoinsAmount = coins, GrantedAt = now
        });
        profile.TotalXp += xp;
        profile.CoinsBalance += coins;
    }

    private async Task<AttemptResponse> ViewAsync(Attempt attempt, FeedbackResponse? feedback, CancellationToken token)
    {
        var choices = await database.AttemptChoices.AsNoTracking().Where(choice => choice.AttemptId == attempt.Id).ToListAsync(token);
        var current = attempt.Status == AttemptStatus.Active
            ? attempt.Questions.SingleOrDefault(question => question.Status == AttemptQuestionStatus.Presented) : null;
        var questionView = current == null ? null : new QuestionResponse(current.Id, current.Position + 1, current.Question.Prompt,
            current.ExpiresAt!.Value, current.Question.Options.OrderBy(option => option.SortOrder)
                .Select(option => new OptionResponse(option.Id, option.Text, choices.Any(choice => choice.AttemptQuestionId == current.Id && choice.SelectedOptionId == option.Id))).ToList());
        var grant = await database.RewardGrants.AsNoTracking().SingleOrDefaultAsync(grant => grant.AttemptId == attempt.Id, token);
        var reward = grant == null ? null : new RewardResponse(grant.XpAmount, grant.CoinsAmount,
            grant.Reason == RewardReason.FirstPass, grant.Reason == RewardReason.FirstPass && attempt.ErrorCount == 0);
        List<ReviewResponse>? review = null;
        if (attempt.Status != AttemptStatus.Active)
            review = attempt.Questions.Where(question => attempt.AssessmentVersion.Assessment.Mode == AssessmentMode.Crisis || question.Status != AttemptQuestionStatus.Pending)
                .OrderBy(question => question.Position).Select(question => new ReviewResponse(question.Position + 1, question.Question.Prompt,
                    question.Answer == null ? null : question.Question.Options.Single(option => option.Id == question.Answer.SelectedOptionId).Text,
                    question.Question.Options.Single(option => option.IsCorrect).Text, question.Question.Explanation,
                    question.Answer?.IsCorrect == true, question.Status == AttemptQuestionStatus.TimedOut,
                    choices.Where(choice => choice.AttemptQuestionId == question.Id && !choice.IsCorrect)
                        .Select(choice => question.Question.Options.Single(option => option.Id == choice.SelectedOptionId).Text).ToList())).ToList();
        var appearance = await cosmetics.ResolveAsync(attempt.CharacterSkinId, attempt.MascotId, token);
        var mascot = await mascots.ForAttemptAsync(attempt, appearance.Mascot, choices, GameTime.Now(clock), token);
        return new(attempt.Id, attempt.TopicId, attempt.AssessmentId, attempt.Topic.Title, attempt.AssessmentVersion.Assessment.Mode,
            attempt.Status, attempt.BegunAt == null && attempt.Status == AttemptStatus.Active, GameTime.Now(clock), attempt.StartedAt,
            attempt.FinishedAt, attempt.ExpiresAt, attempt.CorrectAnswers, attempt.ErrorCount, attempt.QuestionCount,
            attempt.BossHpRemaining, 100, attempt.AssessmentVersion.BossName, attempt.FinishReason,
            attempt.Scenario == null ? null : new(attempt.Scenario.Title, attempt.Scenario.Introduction, attempt.Scenario.IllustrationKey),
            questionView, feedback, reward, review) { CharacterSkin = appearance.CharacterSkin, Mascot = mascot };
    }
}
