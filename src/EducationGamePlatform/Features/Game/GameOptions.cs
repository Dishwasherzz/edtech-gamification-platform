using Microsoft.Extensions.Options;

namespace EducationGamePlatform.Features.Game;

public sealed class GameOptions
{
    public int LessonXp { get; set; } = 20;
    public int FirstWinXp { get; set; } = 100;
    public int FirstWinCoins { get; set; } = 30;
    public int PerfectBonusXp { get; set; } = 50;
    public int PerfectBonusCoins { get; set; } = 20;
    // ConfigurationBinder appends array values; start empty so configured thresholds are not duplicated.
    public int[] RankThresholds { get; set; } = [];
    public bool EnableExpiryWorker { get; set; } = true;

    public static bool IsValid(GameOptions value) => value.LessonXp > 0 && value.FirstWinXp >= 0 &&
        value.FirstWinCoins >= 0 && value.PerfectBonusXp >= 0 && value.PerfectBonusCoins >= 0 &&
        value.RankThresholds.Length > 0 && value.RankThresholds[0] == 0 &&
        value.RankThresholds.Zip(value.RankThresholds.Skip(1)).All(pair => pair.First < pair.Second);
}

public sealed record RankResponse(int Rank, long RankStartXp, long? NextRankXp, int RankProgressPercent);

public sealed class RankCalculator(IOptions<GameOptions> options)
{
    public RankResponse Calculate(long xp)
    {
        var thresholds = options.Value.RankThresholds;
        var index = Array.FindLastIndex(thresholds, threshold => xp >= threshold);
        var next = index + 1 < thresholds.Length ? (long?)thresholds[index + 1] : null;
        return new(index + 1, thresholds[index], next,
            next is null ? 100 : (int)Math.Clamp((xp - thresholds[index]) * 100 / (next.Value - thresholds[index]), 0, 100));
    }
}
