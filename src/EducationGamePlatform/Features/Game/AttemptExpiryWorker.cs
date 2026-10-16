using EducationGamePlatform.Domain;
using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EducationGamePlatform.Features.Game;

public sealed class AttemptExpiryWorker(IServiceScopeFactory scopes, TimeProvider clock, IOptions<GameOptions> options,
    ILogger<AttemptExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.EnableExpiryWorker) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                List<(Guid Id, Guid UserId)> due;
                await using (var scope = scopes.CreateAsyncScope())
                {
                    var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var now = clock.GetUtcNow();
                    var rows = await database.Attempts.AsNoTracking().Where(attempt => attempt.Status == AttemptStatus.Active && attempt.ExpiresAt <= now)
                        .OrderBy(attempt => attempt.ExpiresAt).Take(100).Select(attempt => new { attempt.Id, attempt.UserId }).ToListAsync(stoppingToken);
                    due = rows.Select(row => (row.Id, row.UserId)).ToList();
                }
                foreach (var row in due)
                {
                    await using var scope = scopes.CreateAsyncScope();
                    await scope.ServiceProvider.GetRequiredService<GameService>().GetAsync(row.Id, row.UserId, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { logger.LogError(exception, "Could not process expired assessment attempts."); }
        }
    }
}
