using EducationGamePlatform.Domain;

namespace EducationGamePlatform.Persistence;

// System catalog: fixed identifiers and metadata only. Asset keys are resolved by the future frontend.
public static class CosmeticDefaults
{
    public static readonly Guid DefaultSkinId = Id("60000000", 1);
    public static readonly Guid CopperSkinId = Id("60000000", 2);
    public static readonly Guid NeonSkinId = Id("60000000", 3);
    public static readonly Guid DefaultMascotId = Id("70000000", 1);
    public static readonly Guid OhmMascotId = Id("70000000", 2);
    public static readonly Guid RelayMascotId = Id("70000000", 3);
    private static Guid Id(string prefix, int number) => Guid.Parse($"{prefix}-0000-4000-8000-{number:000000000000}");

    public static CharacterSkin[] Skins() =>
    [
        new() { Id = DefaultSkinId, Key = "default", Name = "Стандартный инженер", Description = "Базовый образ доступен каждому игроку.",
            AssetKey = "characters/engineer/default", IsStarter = true, SortOrder = 0 },
        new() { Id = CopperSkinId, Key = "copper-engineer", Name = "Медный инженер", Description = "Демонстрационный скин. Цена предварительная.",
            AssetKey = "characters/engineer/copper", PriceCoins = 30, IsForSale = true, SortOrder = 1 },
        new() { Id = NeonSkinId, Key = "neon-engineer", Name = "Неоновый инженер", Description = "Демонстрационный скин. Цена предварительная.",
            AssetKey = "characters/engineer/neon", PriceCoins = 75, IsForSale = true, SortOrder = 2 }
    ];

    public static Mascot[] Mascots() =>
    [
        new() { Id = DefaultMascotId, Key = "spark", Name = "Искра", Description = "Поддерживает в учебных испытаниях.", AssetKey = "mascots/spark/idle", SortOrder = 0 },
        new() { Id = OhmMascotId, Key = "ohm", Name = "Ом", Description = "Помогает спокойно разобрать ошибки.", AssetKey = "mascots/ohm/idle", SortOrder = 1 },
        new() { Id = RelayMascotId, Key = "relay", Name = "Реле", Description = "Следит за состоянием учебной цепи.", AssetKey = "mascots/relay/idle", SortOrder = 2 }
    ];

    public static MascotReaction[] Reactions()
    {
        var result = new List<MascotReaction>();
        foreach (var mascot in Mascots())
        {
            foreach (var eventType in Enum.GetValues<MascotEvent>())
                result.Add(Create(mascot, eventType, MascotContext.Any, 0));
            foreach (var context in new[] { MascotContext.Boss, MascotContext.Crisis })
                foreach (var eventType in new[] { MascotEvent.Victory, MascotEvent.Defeat })
                    for (var variant = 0; variant < 2; variant++) result.Add(Create(mascot, eventType, context, variant));
        }
        return result.ToArray();

        MascotReaction Create(Mascot mascot, MascotEvent eventType, MascotContext context, int variant)
        {
            var message = eventType switch
            {
                MascotEvent.Intro => "Начни, когда будешь готов. Время испытания считает сервер.",
                MascotEvent.CorrectAnswer => "Верно! Продолжай в том же духе.",
                MascotEvent.WrongAnswer => "Это ошибка. Посмотри на условие ещё раз.",
                MascotEvent.TimeWarning => "Времени осталось мало. Выбери действие.",
                MascotEvent.Timeout => "Время вопроса истекло. Продолжим с текущего состояния.",
                MascotEvent.Victory => variant == 0 ? "Испытание пройдено! Результат и награда сохранены." : "Победа! Можно двигаться к следующей теме.",
                MascotEvent.Defeat => variant == 0 ? "Попытка завершена. Разберём ошибки и попробуем снова." : "Прогресс сохранён. Повтори теорию и возвращайся.",
                MascotEvent.Abandoned => "Попытка прекращена. Можно выбрать другое испытание.",
                _ => "Начнём с лекции. Потом можно выбрать тест или аварию."
            };
            return new MascotReaction { Id = Id("71000000", result.Count + 1), MascotId = mascot.Id,
                Event = eventType, Context = context, Variant = variant,
                AssetKey = $"mascots/{mascot.Key}/{context.ToString().ToLowerInvariant()}/{eventType.ToString().ToLowerInvariant()}-{variant}",
                Message = $"{mascot.Name}: {message}" };
        }
    }
}
