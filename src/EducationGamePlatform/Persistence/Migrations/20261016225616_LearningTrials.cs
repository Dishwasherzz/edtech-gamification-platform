using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EducationGamePlatform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LearningTrials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RewardGrants_UserId_AssessmentId_Reason",
                table: "RewardGrants");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Attempt_Counts",
                table: "Attempts");

            migrationBuilder.AddColumn<Guid>(
                name: "TopicId",
                table: "RewardGrants",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "ScenarioId",
                table: "Questions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AwardedXp",
                table: "LessonProgress",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "BegunAt",
                table: "Attempts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ErrorCount",
                table: "Attempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAt",
                table: "Attempts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinishReason",
                table: "Attempts",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ScenarioId",
                table: "Attempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TopicId",
                table: "Attempts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Preserve rows written before game operations existed; infer their topic from the assessment.
            migrationBuilder.Sql("""
                UPDATE "Attempts" AS a SET "TopicId" = s."TopicId", "BegunAt" = a."StartedAt"
                FROM "Assessments" AS s WHERE s."Id" = a."AssessmentId";
                UPDATE "RewardGrants" AS r SET "TopicId" = s."TopicId"
                FROM "Assessments" AS s WHERE s."Id" = r."AssessmentId";
                UPDATE "Attempts" SET "Status" = 'Abandoned', "FinishedAt" = CURRENT_TIMESTAMP,
                    "FinishReason" = 'LegacyMigration' WHERE "Status" = 'Active';
                WITH ranked AS (
                    SELECT "Id", row_number() OVER (PARTITION BY "UserId", "TopicId" ORDER BY "GrantedAt", "Id") AS n
                    FROM "RewardGrants" WHERE "Reason" = 'FirstPass'
                ) UPDATE "RewardGrants" r SET "Reason" = 'RepeatPass' FROM ranked x WHERE r."Id" = x."Id" AND x.n > 1;
                """);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Attempts_Id_UserId_TopicId",
                table: "Attempts",
                columns: new[] { "Id", "UserId", "TopicId" });

            migrationBuilder.CreateTable(
                name: "AttemptChoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptQuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SelectedOptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttemptChoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttemptChoices_AnswerOptions_SelectedOptionId_QuestionId",
                        columns: x => new { x.SelectedOptionId, x.QuestionId },
                        principalTable: "AnswerOptions",
                        principalColumns: new[] { "Id", "QuestionId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AttemptChoices_AttemptQuestions_AttemptQuestionId_QuestionId",
                        columns: x => new { x.AttemptQuestionId, x.QuestionId },
                        principalTable: "AttemptQuestions",
                        principalColumns: new[] { "Id", "QuestionId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CrisisScenarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssessmentVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Introduction = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    IllustrationKey = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CrisisScenarios", x => x.Id);
                    table.UniqueConstraint("AK_CrisisScenarios_Id_AssessmentVersionId", x => new { x.Id, x.AssessmentVersionId });
                    table.ForeignKey(
                        name: "FK_CrisisScenarios_AssessmentVersions_AssessmentVersionId",
                        column: x => x.AssessmentVersionId,
                        principalTable: "AssessmentVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TopicProgress",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FirstAttemptId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicProgress", x => new { x.UserId, x.TopicId });
                    table.ForeignKey(
                        name: "FK_TopicProgress_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TopicProgress_Attempts_FirstAttemptId_UserId_TopicId",
                        columns: x => new { x.FirstAttemptId, x.UserId, x.TopicId },
                        principalTable: "Attempts",
                        principalColumns: new[] { "Id", "UserId", "TopicId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TopicProgress_Topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "Topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql("""
                INSERT INTO "TopicProgress" ("UserId", "TopicId", "CompletedAt", "FirstAttemptId")
                SELECT DISTINCT ON ("UserId", "TopicId") "UserId", "TopicId", COALESCE("FinishedAt", "StartedAt"), "Id"
                FROM "Attempts" WHERE "Status" = 'Passed' ORDER BY "UserId", "TopicId", COALESCE("FinishedAt", "StartedAt"), "Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_RewardGrants_UserId_TopicId",
                table: "RewardGrants",
                columns: new[] { "UserId", "TopicId" },
                unique: true,
                filter: "\"Reason\" = 'FirstPass'");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_ScenarioId_AssessmentVersionId",
                table: "Questions",
                columns: new[] { "ScenarioId", "AssessmentVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_ScenarioId_AssessmentVersionId",
                table: "Attempts",
                columns: new[] { "ScenarioId", "AssessmentVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_Status_ExpiresAt",
                table: "Attempts",
                columns: new[] { "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_TopicId",
                table: "Attempts",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_UserId",
                table: "Attempts",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 'Active'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Attempt_Counts",
                table: "Attempts",
                sql: "\"QuestionCount\" > 0 AND \"CorrectAnswers\" >= 0 AND \"CorrectAnswers\" <= \"QuestionCount\" AND \"BossHpRemaining\" >= 0 AND \"ErrorCount\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_AttemptChoices_AttemptId_RequestId",
                table: "AttemptChoices",
                columns: new[] { "AttemptId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttemptChoices_AttemptQuestionId_QuestionId",
                table: "AttemptChoices",
                columns: new[] { "AttemptQuestionId", "QuestionId" });

            migrationBuilder.CreateIndex(
                name: "IX_AttemptChoices_AttemptQuestionId_SelectedOptionId",
                table: "AttemptChoices",
                columns: new[] { "AttemptQuestionId", "SelectedOptionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttemptChoices_SelectedOptionId_QuestionId",
                table: "AttemptChoices",
                columns: new[] { "SelectedOptionId", "QuestionId" });

            migrationBuilder.CreateIndex(
                name: "IX_CrisisScenarios_AssessmentVersionId_SortOrder",
                table: "CrisisScenarios",
                columns: new[] { "AssessmentVersionId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TopicProgress_FirstAttemptId_UserId_TopicId",
                table: "TopicProgress",
                columns: new[] { "FirstAttemptId", "UserId", "TopicId" });

            migrationBuilder.CreateIndex(
                name: "IX_TopicProgress_TopicId",
                table: "TopicProgress",
                column: "TopicId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_CrisisScenarios_ScenarioId_AssessmentVersionId",
                table: "Attempts",
                columns: new[] { "ScenarioId", "AssessmentVersionId" },
                principalTable: "CrisisScenarios",
                principalColumns: new[] { "Id", "AssessmentVersionId" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_Topics_TopicId",
                table: "Attempts",
                column: "TopicId",
                principalTable: "Topics",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Questions_CrisisScenarios_ScenarioId_AssessmentVersionId",
                table: "Questions",
                columns: new[] { "ScenarioId", "AssessmentVersionId" },
                principalTable: "CrisisScenarios",
                principalColumns: new[] { "Id", "AssessmentVersionId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_CrisisScenarios_ScenarioId_AssessmentVersionId",
                table: "Attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_Topics_TopicId",
                table: "Attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_Questions_CrisisScenarios_ScenarioId_AssessmentVersionId",
                table: "Questions");

            migrationBuilder.DropTable(
                name: "AttemptChoices");

            migrationBuilder.DropTable(
                name: "CrisisScenarios");

            migrationBuilder.DropTable(
                name: "TopicProgress");

            migrationBuilder.DropIndex(
                name: "IX_RewardGrants_UserId_TopicId",
                table: "RewardGrants");

            migrationBuilder.DropIndex(
                name: "IX_Questions_ScenarioId_AssessmentVersionId",
                table: "Questions");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Attempts_Id_UserId_TopicId",
                table: "Attempts");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_ScenarioId_AssessmentVersionId",
                table: "Attempts");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_Status_ExpiresAt",
                table: "Attempts");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_TopicId",
                table: "Attempts");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_UserId",
                table: "Attempts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Attempt_Counts",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "TopicId",
                table: "RewardGrants");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "AwardedXp",
                table: "LessonProgress");

            migrationBuilder.DropColumn(
                name: "BegunAt",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "ErrorCount",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "FinishReason",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "TopicId",
                table: "Attempts");

            migrationBuilder.CreateIndex(
                name: "IX_RewardGrants_UserId_AssessmentId_Reason",
                table: "RewardGrants",
                columns: new[] { "UserId", "AssessmentId", "Reason" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Attempt_Counts",
                table: "Attempts",
                sql: "\"QuestionCount\" > 0 AND \"CorrectAnswers\" >= 0 AND \"CorrectAnswers\" <= \"QuestionCount\" AND \"BossHpRemaining\" >= 0");
        }
    }
}
