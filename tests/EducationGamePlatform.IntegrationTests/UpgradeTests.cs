using EducationGamePlatform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace EducationGamePlatform.IntegrationTests;

[Collection("PostgreSQL API")]
public sealed class UpgradeTests(ApiFixture fixture)
{
    [Fact]
    public async Task UpgradePreservesLegacyProfileReadingAndRewardAndDerivesTopicProgress()
    {
        var admin = new NpgsqlConnectionStringBuilder(fixture.ConnectionString) { Database = "postgres" };
        var name = $"edtech_upgrade_{Guid.NewGuid():N}";
        var created = false;
        await using var connection = new NpgsqlConnection(admin.ConnectionString);
        await connection.OpenAsync();
        try
        {
            await using (var command = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", connection)) await command.ExecuteNonQueryAsync();
            created = true;
            var target = new NpgsqlConnectionStringBuilder(admin.ConnectionString) { Database = name };
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(target.ConnectionString).Options);
            await db.GetService<IMigrator>().MigrateAsync("20261010013719_InitialSchema");
            var user = Guid.NewGuid(); var course = Guid.NewGuid(); var topic = Guid.NewGuid(); var lesson = Guid.NewGuid();
            var assessment = Guid.NewGuid(); var version = Guid.NewGuid(); var attempt = Guid.NewGuid(); var reward = Guid.NewGuid();
            var timestamp = DateTimeOffset.Parse("2026-10-10T01:00:00Z");
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "AspNetUsers" ("Id", "CreatedAt", "EmailConfirmed", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount")
                VALUES ({user}, {timestamp}, FALSE, FALSE, FALSE, FALSE, 0);
                INSERT INTO "PlayerProfiles" ("UserId", "DisplayName", "AvatarKey", "TotalXp", "CoinsBalance") VALUES ({user}, 'Legacy', 'default', 100, 30);
                INSERT INTO "Courses" ("Id", "Slug", "Title", "Description", "IsPublished") VALUES ({course}, 'upgrade-test', 'Course', '', TRUE);
                INSERT INTO "Topics" ("Id", "CourseId", "Title", "Description", "SortOrder", "IsPublished") VALUES ({topic}, {course}, 'Topic', '', 1, TRUE);
                INSERT INTO "Lessons" ("Id", "TopicId", "Title", "ContentMarkdown", "SortOrder", "IsPublished") VALUES ({lesson}, {topic}, 'Lesson', 'Content', 1, TRUE);
                INSERT INTO "LessonProgress" ("UserId", "LessonId", "CompletedAt") VALUES ({user}, {lesson}, {timestamp});
                INSERT INTO "Assessments" ("Id", "TopicId", "Title", "Mode", "IsRequired", "IsPublished") VALUES ({assessment}, {topic}, 'Boss', 'Boss', TRUE, TRUE);
                INSERT INTO "AssessmentVersions" ("Id", "AssessmentId", "VersionNumber", "QuestionTimeLimitSeconds", "RequiredCorrectAnswers", "XpReward", "CoinsReward", "BossName", "BossMaxHp", "DamagePerCorrectAnswer")
                VALUES ({version}, {assessment}, 1, 60, 1, 100, 30, 'Legacy', 100, 20);
                INSERT INTO "Attempts" ("Id", "UserId", "AssessmentId", "AssessmentVersionId", "Status", "StartedAt", "FinishedAt", "CorrectAnswers", "QuestionCount", "BossHpRemaining")
                VALUES ({attempt}, {user}, {assessment}, {version}, 'Passed', {timestamp}, {timestamp}, 1, 1, 0);
                INSERT INTO "RewardGrants" ("Id", "UserId", "AssessmentId", "AttemptId", "Reason", "XpAmount", "CoinsAmount", "GrantedAt")
                VALUES ({reward}, {user}, {assessment}, {attempt}, 'FirstPass', 100, 30, {timestamp});
                """);
            await db.Database.MigrateAsync();
            var profile = await db.PlayerProfiles.SingleAsync();
            Assert.Equal(100, profile.TotalXp);
            Assert.Equal(30, profile.CoinsBalance);
            Assert.Equal(timestamp, (await db.LessonProgress.SingleAsync()).CompletedAt);
            Assert.Equal(topic, (await db.Attempts.SingleAsync()).TopicId);
            Assert.Equal(topic, (await db.RewardGrants.SingleAsync()).TopicId);
            Assert.Equal(attempt, (await db.TopicProgress.SingleAsync()).FirstAttemptId);
            Assert.Null(profile.EquippedSkinId);
            Assert.Null(profile.SelectedMascotId);
            Assert.Equal(3, await db.CharacterSkins.CountAsync());
            Assert.Equal(3, await db.Mascots.CountAsync());
            Assert.Equal(51, await db.MascotReactions.CountAsync());
            Assert.Empty(await db.SkinPurchases.ToListAsync());
        }
        finally
        {
            if (created)
            {
                NpgsqlConnection.ClearAllPools();
                await using var command = new NpgsqlCommand($"DROP DATABASE \"{name}\" WITH (FORCE)", connection);
                await command.ExecuteNonQueryAsync();
            }
        }
    }
}
