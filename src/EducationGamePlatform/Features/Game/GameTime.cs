namespace EducationGamePlatform.Features.Game;

public static class GameTime
{
    // PostgreSQL timestamps have microsecond precision; return exactly the value that will be persisted.
    public static DateTimeOffset Now(TimeProvider clock)
    {
        var ticks = clock.GetUtcNow().UtcTicks;
        return new DateTimeOffset(ticks - ticks % 10, TimeSpan.Zero);
    }
}
