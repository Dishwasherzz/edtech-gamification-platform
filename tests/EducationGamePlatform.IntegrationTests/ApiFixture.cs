using System.Net;
using System.Net.Http.Json;
using EducationGamePlatform.Features.Auth;
using EducationGamePlatform.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace EducationGamePlatform.IntegrationTests;

[CollectionDefinition("PostgreSQL API", DisableParallelization = true)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>;

public sealed class ApiFixture : IAsyncLifetime
{
    private readonly string databaseName = $"edtech_tests_{Guid.NewGuid():N}";
    private readonly string keysDirectory = Path.Combine(Path.GetTempPath(), "edtech-test-keys", Guid.NewGuid().ToString("N"));
    private string adminConnectionString = null!;
    private string? previousConnectionString;
    private string? previousKeysPath;
    private bool databaseCreated;
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public string ConnectionString { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        adminConnectionString = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION_STRING")
            ?? throw new InvalidOperationException("Set TEST_DATABASE_CONNECTION_STRING to an isolated PostgreSQL instance with CREATE DATABASE permission.");
        var connectionBuilder = new NpgsqlConnectionStringBuilder(adminConnectionString) { Database = databaseName };
        ConnectionString = connectionBuilder.ConnectionString;
        await using (var connection = new NpgsqlConnection(adminConnectionString))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
            await command.ExecuteNonQueryAsync();
            databaseCreated = true;
        }
        previousConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Database");
        previousKeysPath = Environment.GetEnvironmentVariable("DataProtection__KeysPath");
        Environment.SetEnvironmentVariable("ConnectionStrings__Database", ConnectionString);
        Environment.SetEnvironmentVariable("DataProtection__KeysPath", keysDirectory);
        Factory = new WebApplicationFactory<Program>();
        using var scope = Factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await database.Database.MigrateAsync();
        await DemoData.SeedAsync(database);
        // Re-running initialization must preserve content and avoid duplicate demo rows.
        await database.Database.MigrateAsync();
        await DemoData.SeedAsync(database);
    }

    public HttpClient CreateClient() => Factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("https://localhost")
    });

    public static async Task RefreshCsrfAsync(HttpClient client)
    {
        var response = await client.GetFromJsonAsync<CsrfResponse>("/api/auth/csrf");
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", response!.Token);
    }

    public async Task<HttpClient> CreateStudentAsync()
    {
        var client = CreateClient();
        await RefreshCsrfAsync(client);
        var email = $"student-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Development123!", "Студент"));
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "Development123!"));
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        await RefreshCsrfAsync(client);
        return client;
    }

    public AppDbContext CreateDatabase()
        => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options);

    public async Task DisposeAsync()
    {
        if (Factory is not null) await Factory.DisposeAsync();
        Environment.SetEnvironmentVariable("ConnectionStrings__Database", previousConnectionString);
        Environment.SetEnvironmentVariable("DataProtection__KeysPath", previousKeysPath);
        if (databaseCreated)
        {
            NpgsqlConnection.ClearAllPools();
            await using var connection = new NpgsqlConnection(adminConnectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"DROP DATABASE \"{databaseName}\" WITH (FORCE)", connection);
            await command.ExecuteNonQueryAsync();
        }
        // Leave temporary keys for normal OS temp cleanup; never delete a computed directory recursively.
    }
}
