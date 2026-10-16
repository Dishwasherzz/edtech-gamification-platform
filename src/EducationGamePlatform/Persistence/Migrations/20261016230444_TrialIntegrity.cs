using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EducationGamePlatform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrialIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AttemptChoices_AttemptQuestions_AttemptQuestionId_QuestionId",
                table: "AttemptChoices");

            migrationBuilder.DropIndex(
                name: "IX_AttemptChoices_AttemptQuestionId_QuestionId",
                table: "AttemptChoices");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_AttemptQuestions_Id_AttemptId_QuestionId",
                table: "AttemptQuestions",
                columns: new[] { "Id", "AttemptId", "QuestionId" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Assessments_Id_TopicId",
                table: "Assessments",
                columns: new[] { "Id", "TopicId" });

            migrationBuilder.CreateIndex(
                name: "IX_RewardGrants_AttemptId_UserId_TopicId",
                table: "RewardGrants",
                columns: new[] { "AttemptId", "UserId", "TopicId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_LessonProgress_AwardedXp",
                table: "LessonProgress",
                sql: "\"AwardedXp\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_AssessmentId_TopicId",
                table: "Attempts",
                columns: new[] { "AssessmentId", "TopicId" });

            migrationBuilder.CreateIndex(
                name: "IX_AttemptChoices_AttemptQuestionId_AttemptId_QuestionId",
                table: "AttemptChoices",
                columns: new[] { "AttemptQuestionId", "AttemptId", "QuestionId" });

            migrationBuilder.AddForeignKey(
                name: "FK_AttemptChoices_AttemptQuestions_AttemptQuestionId_AttemptId~",
                table: "AttemptChoices",
                columns: new[] { "AttemptQuestionId", "AttemptId", "QuestionId" },
                principalTable: "AttemptQuestions",
                principalColumns: new[] { "Id", "AttemptId", "QuestionId" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_Assessments_AssessmentId_TopicId",
                table: "Attempts",
                columns: new[] { "AssessmentId", "TopicId" },
                principalTable: "Assessments",
                principalColumns: new[] { "Id", "TopicId" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RewardGrants_Attempts_AttemptId_UserId_TopicId",
                table: "RewardGrants",
                columns: new[] { "AttemptId", "UserId", "TopicId" },
                principalTable: "Attempts",
                principalColumns: new[] { "Id", "UserId", "TopicId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AttemptChoices_AttemptQuestions_AttemptQuestionId_AttemptId~",
                table: "AttemptChoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_Assessments_AssessmentId_TopicId",
                table: "Attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_RewardGrants_Attempts_AttemptId_UserId_TopicId",
                table: "RewardGrants");

            migrationBuilder.DropIndex(
                name: "IX_RewardGrants_AttemptId_UserId_TopicId",
                table: "RewardGrants");

            migrationBuilder.DropCheckConstraint(
                name: "CK_LessonProgress_AwardedXp",
                table: "LessonProgress");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_AssessmentId_TopicId",
                table: "Attempts");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_AttemptQuestions_Id_AttemptId_QuestionId",
                table: "AttemptQuestions");

            migrationBuilder.DropIndex(
                name: "IX_AttemptChoices_AttemptQuestionId_AttemptId_QuestionId",
                table: "AttemptChoices");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Assessments_Id_TopicId",
                table: "Assessments");

            migrationBuilder.CreateIndex(
                name: "IX_AttemptChoices_AttemptQuestionId_QuestionId",
                table: "AttemptChoices",
                columns: new[] { "AttemptQuestionId", "QuestionId" });

            migrationBuilder.AddForeignKey(
                name: "FK_AttemptChoices_AttemptQuestions_AttemptQuestionId_QuestionId",
                table: "AttemptChoices",
                columns: new[] { "AttemptQuestionId", "QuestionId" },
                principalTable: "AttemptQuestions",
                principalColumns: new[] { "Id", "QuestionId" },
                onDelete: ReferentialAction.Restrict);
        }
    }
}
