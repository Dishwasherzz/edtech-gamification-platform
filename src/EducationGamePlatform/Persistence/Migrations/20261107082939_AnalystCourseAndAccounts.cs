using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EducationGamePlatform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AnalystCourseAndAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "TotalXpAfter",
                table: "RewardGrants",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IconKey",
                table: "Topics",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Subtitle",
                table: "Topics",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CalculationHint",
                table: "Questions",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HeroKey",
                table: "PlayerProfiles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "phase");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedDisplayName",
                table: "PlayerProfiles",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BossIcon",
                table: "AssessmentVersions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BossIntro",
                table: "AssessmentVersions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConsentAcceptedAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConsentVersion",
                table: "AspNetUsers",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CourseCompletionReceipts",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    AcknowledgedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseCompletionReceipts", x => new { x.UserId, x.CourseId });
                    table.ForeignKey(
                        name: "FK_CourseCompletionReceipts_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourseCompletionReceipts_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "UX_PlayerProfiles_NormalizedDisplayName",
                table: "PlayerProfiles",
                column: "NormalizedDisplayName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseCompletionReceipts_CourseId",
                table: "CourseCompletionReceipts",
                column: "CourseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalXpAfter",
                table: "RewardGrants");

            migrationBuilder.DropTable(
                name: "CourseCompletionReceipts");

            migrationBuilder.DropIndex(
                name: "UX_PlayerProfiles_NormalizedDisplayName",
                table: "PlayerProfiles");

            migrationBuilder.DropColumn(
                name: "IconKey",
                table: "Topics");

            migrationBuilder.DropColumn(
                name: "Subtitle",
                table: "Topics");

            migrationBuilder.DropColumn(
                name: "CalculationHint",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "HeroKey",
                table: "PlayerProfiles");

            migrationBuilder.DropColumn(
                name: "NormalizedDisplayName",
                table: "PlayerProfiles");

            migrationBuilder.DropColumn(
                name: "BossIcon",
                table: "AssessmentVersions");

            migrationBuilder.DropColumn(
                name: "BossIntro",
                table: "AssessmentVersions");

            migrationBuilder.DropColumn(
                name: "ConsentAcceptedAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ConsentVersion",
                table: "AspNetUsers");
        }
    }
}
