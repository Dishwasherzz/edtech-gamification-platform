using Microsoft.AspNetCore.Diagnostics;

namespace EducationGamePlatform.Features.Game;

public sealed class GameRuleException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}

public sealed class GameRuleExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not GameRuleException rule) return false;
        context.Response.StatusCode = rule.Status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new() { Status = rule.Status, Title = rule.Message, Extensions = { ["code"] = rule.Code } }
        });
    }
}
