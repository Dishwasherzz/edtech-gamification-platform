using Microsoft.AspNetCore.Antiforgery;

namespace EducationGamePlatform.Infrastructure;

public sealed class CsrfMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        if (context.Request.Path.StartsWithSegments("/api") &&
            !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) &&
            !HttpMethods.IsOptions(context.Request.Method))
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException)
            {
                await Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                    title: "Invalid CSRF token.",
                    detail: "Get a token from GET /api/auth/csrf and send it in X-CSRF-TOKEN. Refresh it after login/logout.",
                    extensions: new Dictionary<string, object?> { ["code"] = "InvalidCsrfToken" })
                    .ExecuteAsync(context);
                return;
            }
        }
        await next(context);
    }
}
