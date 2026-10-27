using System.Text.Json.Serialization;
using EducationGamePlatform.Domain;
using EducationGamePlatform.Features.Auth;
using EducationGamePlatform.Features.Catalog;
using EducationGamePlatform.Features.Profile;
using EducationGamePlatform.Features.Game;
using EducationGamePlatform.Features.Cosmetics;
using EducationGamePlatform.Infrastructure;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var hostArguments = args.Where(argument => argument is not "--migrate" and not "--seed-demo").ToArray();
var builder = WebApplication.CreateBuilder(hostArguments);
// This ignored file also works when Rider and a terminal use different user-secrets profiles.
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);
    // Explicit deployment/test configuration must still override local settings.
    builder.Configuration.AddEnvironmentVariables();
    if (hostArguments.Length > 0) builder.Configuration.AddCommandLine(hostArguments);
}
var connectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException(
        "Set ConnectionStrings:Database using scripts/Set-LocalDatabase.ps1, dotnet user-secrets or ConnectionStrings__Database. See docs/local-database.md.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 10;
        options.Password.RequireNonAlphanumeric = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "edtech.auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "edtech.csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
var keysPath = builder.Configuration["DataProtection:KeysPath"]
    ?? Path.Combine(builder.Environment.ContentRootPath, ".data-protection-keys");
builder.Services.AddDataProtection().SetApplicationName("EducationGamePlatform")
    .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
builder.Services.Configure<JsonOptions>(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GameRuleExceptionHandler>();
builder.Services.AddOptions<GameOptions>().BindConfiguration("Game")
    .PostConfigure(options => { if (options.RankThresholds is not { Length: > 0 }) options.RankThresholds = [0, 100, 300, 600, 1000, 1500]; })
    .Validate(GameOptions.IsValid, "Invalid game economy or rank thresholds.").ValidateOnStart();
builder.Services.AddScoped<ProgressService>();
builder.Services.AddScoped<GameService>();
builder.Services.AddScoped<CosmeticsService>();
builder.Services.AddScoped<MascotPresentationService>();
builder.Services.AddSingleton<RankCalculator>();
builder.Services.AddHostedService<AttemptExpiryWorker>();
builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHealthChecks().AddCheck<PostgresHealthCheck>("postgres", tags: ["ready"]);

var app = builder.Build();
// Apply migrations once explicitly, before starting API instances.
if (args.Contains("--migrate") || args.Contains("--seed-demo"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (args.Contains("--migrate")) await database.Database.MigrateAsync();
    if (args.Contains("--seed-demo") || builder.Configuration.GetValue<bool>("Database:SeedDemoData"))
        await DemoData.SeedAsync(database);
    return;
}
app.UseExceptionHandler();
var frontendPath = Path.Combine(AppContext.BaseDirectory, "wwwroot");
if (!Directory.Exists(frontendPath)) frontendPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../../frontend"));
if (Directory.Exists(frontendPath))
{
    var frontendFiles = new PhysicalFileProvider(frontendPath);
    app.Lifetime.ApplicationStopped.Register(frontendFiles.Dispose);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = frontendFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = frontendFiles });
}
app.UseStatusCodePages(async context =>
    await Results.Problem(statusCode: context.HttpContext.Response.StatusCode)
        .ExecuteAsync(context.HttpContext));
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<CsrfMiddleware>();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
app.MapAuthEndpoints();
app.MapProfileEndpoints();
app.MapCatalogEndpoints();
app.MapGameEndpoints();
app.MapCosmeticsEndpoints();
app.Run();

public partial class Program;
