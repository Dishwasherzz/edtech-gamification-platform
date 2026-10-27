using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace EducationGamePlatform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CosmeticsShop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EquippedSkinId",
                table: "PlayerProfiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SelectedMascotId",
                table: "PlayerProfiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CharacterSkinId",
                table: "Attempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MascotId",
                table: "Attempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CharacterSkins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AssetKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PriceCoins = table.Column<int>(type: "integer", nullable: false),
                    IsStarter = table.Column<bool>(type: "boolean", nullable: false),
                    IsForSale = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CharacterSkins", x => x.Id);
                    table.CheckConstraint("CK_CharacterSkin_Settings", "\"PriceCoins\" >= 0 AND \"SortOrder\" >= 0 AND (NOT \"IsStarter\" OR \"PriceCoins\" = 0)");
                });

            migrationBuilder.CreateTable(
                name: "Mascots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AssetKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mascots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SkinPurchases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkinId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    PricePaid = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkinPurchases", x => x.Id);
                    table.UniqueConstraint("AK_SkinPurchases_Id_UserId_SkinId", x => new { x.Id, x.UserId, x.SkinId });
                    table.CheckConstraint("CK_SkinPurchase_Price", "\"PricePaid\" >= 0");
                    table.ForeignKey(
                        name: "FK_SkinPurchases_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SkinPurchases_CharacterSkins_SkinId",
                        column: x => x.SkinId,
                        principalTable: "CharacterSkins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MascotReactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MascotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Event = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Context = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Variant = table.Column<int>(type: "integer", nullable: false),
                    AssetKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MascotReactions", x => x.Id);
                    table.CheckConstraint("CK_MascotReaction_Variant", "\"Variant\" >= 0");
                    table.ForeignKey(
                        name: "FK_MascotReactions_Mascots_MascotId",
                        column: x => x.MascotId,
                        principalTable: "Mascots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserSkins",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkinId = table.Column<Guid>(type: "uuid", nullable: false),
                    AcquiredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PurchaseId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSkins", x => new { x.UserId, x.SkinId });
                    table.ForeignKey(
                        name: "FK_UserSkins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserSkins_CharacterSkins_SkinId",
                        column: x => x.SkinId,
                        principalTable: "CharacterSkins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserSkins_SkinPurchases_PurchaseId_UserId_SkinId",
                        columns: x => new { x.PurchaseId, x.UserId, x.SkinId },
                        principalTable: "SkinPurchases",
                        principalColumns: new[] { "Id", "UserId", "SkinId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "CharacterSkins",
                columns: new[] { "Id", "AssetKey", "Description", "IsForSale", "IsStarter", "Key", "Name", "PriceCoins", "SortOrder" },
                values: new object[,]
                {
                    { new Guid("60000000-0000-4000-8000-000000000001"), "characters/engineer/default", "Базовый образ доступен каждому игроку.", false, true, "default", "Стандартный инженер", 0, 0 },
                    { new Guid("60000000-0000-4000-8000-000000000002"), "characters/engineer/copper", "Демонстрационный скин. Цена предварительная.", true, false, "copper-engineer", "Медный инженер", 30, 1 },
                    { new Guid("60000000-0000-4000-8000-000000000003"), "characters/engineer/neon", "Демонстрационный скин. Цена предварительная.", true, false, "neon-engineer", "Неоновый инженер", 75, 2 }
                });

            migrationBuilder.InsertData(
                table: "Mascots",
                columns: new[] { "Id", "AssetKey", "Description", "IsEnabled", "Key", "Name", "SortOrder" },
                values: new object[,]
                {
                    { new Guid("70000000-0000-4000-8000-000000000001"), "mascots/spark/idle", "Поддерживает в учебных испытаниях.", true, "spark", "Искра", 0 },
                    { new Guid("70000000-0000-4000-8000-000000000002"), "mascots/ohm/idle", "Помогает спокойно разобрать ошибки.", true, "ohm", "Ом", 1 },
                    { new Guid("70000000-0000-4000-8000-000000000003"), "mascots/relay/idle", "Следит за состоянием учебной цепи.", true, "relay", "Реле", 2 }
                });

            migrationBuilder.InsertData(
                table: "MascotReactions",
                columns: new[] { "Id", "AssetKey", "Context", "Event", "MascotId", "Message", "Variant" },
                values: new object[,]
                {
                    { new Guid("71000000-0000-4000-8000-000000000001"), "mascots/spark/any/idle-0", "Any", "Idle", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Начнём с лекции. Потом можно выбрать тест или аварию.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000002"), "mascots/spark/any/intro-0", "Any", "Intro", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Начни, когда будешь готов. Время испытания считает сервер.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000003"), "mascots/spark/any/correctanswer-0", "Any", "CorrectAnswer", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Верно! Продолжай в том же духе.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000004"), "mascots/spark/any/wronganswer-0", "Any", "WrongAnswer", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Это ошибка. Посмотри на условие ещё раз.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000005"), "mascots/spark/any/timewarning-0", "Any", "TimeWarning", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Времени осталось мало. Выбери действие.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000006"), "mascots/spark/any/timeout-0", "Any", "Timeout", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Время вопроса истекло. Продолжим с текущего состояния.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000007"), "mascots/spark/any/victory-0", "Any", "Victory", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000008"), "mascots/spark/any/defeat-0", "Any", "Defeat", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000009"), "mascots/spark/any/abandoned-0", "Any", "Abandoned", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Попытка прекращена. Можно выбрать другое испытание.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000010"), "mascots/spark/boss/victory-0", "Boss", "Victory", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000011"), "mascots/spark/boss/victory-1", "Boss", "Victory", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Победа! Можно двигаться к следующей теме.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000012"), "mascots/spark/boss/defeat-0", "Boss", "Defeat", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000013"), "mascots/spark/boss/defeat-1", "Boss", "Defeat", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Прогресс сохранён. Повтори теорию и возвращайся.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000014"), "mascots/spark/crisis/victory-0", "Crisis", "Victory", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000015"), "mascots/spark/crisis/victory-1", "Crisis", "Victory", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Победа! Можно двигаться к следующей теме.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000016"), "mascots/spark/crisis/defeat-0", "Crisis", "Defeat", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000017"), "mascots/spark/crisis/defeat-1", "Crisis", "Defeat", new Guid("70000000-0000-4000-8000-000000000001"), "Искра: Прогресс сохранён. Повтори теорию и возвращайся.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000018"), "mascots/ohm/any/idle-0", "Any", "Idle", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Начнём с лекции. Потом можно выбрать тест или аварию.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000019"), "mascots/ohm/any/intro-0", "Any", "Intro", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Начни, когда будешь готов. Время испытания считает сервер.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000020"), "mascots/ohm/any/correctanswer-0", "Any", "CorrectAnswer", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Верно! Продолжай в том же духе.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000021"), "mascots/ohm/any/wronganswer-0", "Any", "WrongAnswer", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Это ошибка. Посмотри на условие ещё раз.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000022"), "mascots/ohm/any/timewarning-0", "Any", "TimeWarning", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Времени осталось мало. Выбери действие.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000023"), "mascots/ohm/any/timeout-0", "Any", "Timeout", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Время вопроса истекло. Продолжим с текущего состояния.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000024"), "mascots/ohm/any/victory-0", "Any", "Victory", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000025"), "mascots/ohm/any/defeat-0", "Any", "Defeat", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000026"), "mascots/ohm/any/abandoned-0", "Any", "Abandoned", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Попытка прекращена. Можно выбрать другое испытание.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000027"), "mascots/ohm/boss/victory-0", "Boss", "Victory", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000028"), "mascots/ohm/boss/victory-1", "Boss", "Victory", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Победа! Можно двигаться к следующей теме.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000029"), "mascots/ohm/boss/defeat-0", "Boss", "Defeat", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000030"), "mascots/ohm/boss/defeat-1", "Boss", "Defeat", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Прогресс сохранён. Повтори теорию и возвращайся.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000031"), "mascots/ohm/crisis/victory-0", "Crisis", "Victory", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000032"), "mascots/ohm/crisis/victory-1", "Crisis", "Victory", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Победа! Можно двигаться к следующей теме.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000033"), "mascots/ohm/crisis/defeat-0", "Crisis", "Defeat", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000034"), "mascots/ohm/crisis/defeat-1", "Crisis", "Defeat", new Guid("70000000-0000-4000-8000-000000000002"), "Ом: Прогресс сохранён. Повтори теорию и возвращайся.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000035"), "mascots/relay/any/idle-0", "Any", "Idle", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Начнём с лекции. Потом можно выбрать тест или аварию.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000036"), "mascots/relay/any/intro-0", "Any", "Intro", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Начни, когда будешь готов. Время испытания считает сервер.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000037"), "mascots/relay/any/correctanswer-0", "Any", "CorrectAnswer", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Верно! Продолжай в том же духе.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000038"), "mascots/relay/any/wronganswer-0", "Any", "WrongAnswer", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Это ошибка. Посмотри на условие ещё раз.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000039"), "mascots/relay/any/timewarning-0", "Any", "TimeWarning", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Времени осталось мало. Выбери действие.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000040"), "mascots/relay/any/timeout-0", "Any", "Timeout", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Время вопроса истекло. Продолжим с текущего состояния.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000041"), "mascots/relay/any/victory-0", "Any", "Victory", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000042"), "mascots/relay/any/defeat-0", "Any", "Defeat", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000043"), "mascots/relay/any/abandoned-0", "Any", "Abandoned", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Попытка прекращена. Можно выбрать другое испытание.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000044"), "mascots/relay/boss/victory-0", "Boss", "Victory", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000045"), "mascots/relay/boss/victory-1", "Boss", "Victory", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Победа! Можно двигаться к следующей теме.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000046"), "mascots/relay/boss/defeat-0", "Boss", "Defeat", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000047"), "mascots/relay/boss/defeat-1", "Boss", "Defeat", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Прогресс сохранён. Повтори теорию и возвращайся.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000048"), "mascots/relay/crisis/victory-0", "Crisis", "Victory", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Испытание пройдено! Результат и награда сохранены.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000049"), "mascots/relay/crisis/victory-1", "Crisis", "Victory", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Победа! Можно двигаться к следующей теме.", 1 },
                    { new Guid("71000000-0000-4000-8000-000000000050"), "mascots/relay/crisis/defeat-0", "Crisis", "Defeat", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Попытка завершена. Разберём ошибки и попробуем снова.", 0 },
                    { new Guid("71000000-0000-4000-8000-000000000051"), "mascots/relay/crisis/defeat-1", "Crisis", "Defeat", new Guid("70000000-0000-4000-8000-000000000003"), "Реле: Прогресс сохранён. Повтори теорию и возвращайся.", 1 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerProfiles_EquippedSkinId",
                table: "PlayerProfiles",
                column: "EquippedSkinId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerProfiles_SelectedMascotId",
                table: "PlayerProfiles",
                column: "SelectedMascotId");

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_CharacterSkinId",
                table: "Attempts",
                column: "CharacterSkinId");

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_MascotId",
                table: "Attempts",
                column: "MascotId");

            migrationBuilder.CreateIndex(
                name: "IX_CharacterSkins_Key",
                table: "CharacterSkins",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MascotReactions_MascotId_Event_Context_Variant",
                table: "MascotReactions",
                columns: new[] { "MascotId", "Event", "Context", "Variant" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Mascots_Key",
                table: "Mascots",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SkinPurchases_SkinId",
                table: "SkinPurchases",
                column: "SkinId");

            migrationBuilder.CreateIndex(
                name: "IX_SkinPurchases_UserId_RequestId",
                table: "SkinPurchases",
                columns: new[] { "UserId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SkinPurchases_UserId_SkinId",
                table: "SkinPurchases",
                columns: new[] { "UserId", "SkinId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSkins_PurchaseId_UserId_SkinId",
                table: "UserSkins",
                columns: new[] { "PurchaseId", "UserId", "SkinId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSkins_SkinId",
                table: "UserSkins",
                column: "SkinId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_CharacterSkins_CharacterSkinId",
                table: "Attempts",
                column: "CharacterSkinId",
                principalTable: "CharacterSkins",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_Mascots_MascotId",
                table: "Attempts",
                column: "MascotId",
                principalTable: "Mascots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlayerProfiles_CharacterSkins_EquippedSkinId",
                table: "PlayerProfiles",
                column: "EquippedSkinId",
                principalTable: "CharacterSkins",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlayerProfiles_Mascots_SelectedMascotId",
                table: "PlayerProfiles",
                column: "SelectedMascotId",
                principalTable: "Mascots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_CharacterSkins_CharacterSkinId",
                table: "Attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_Mascots_MascotId",
                table: "Attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_PlayerProfiles_CharacterSkins_EquippedSkinId",
                table: "PlayerProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_PlayerProfiles_Mascots_SelectedMascotId",
                table: "PlayerProfiles");

            migrationBuilder.DropTable(
                name: "MascotReactions");

            migrationBuilder.DropTable(
                name: "UserSkins");

            migrationBuilder.DropTable(
                name: "Mascots");

            migrationBuilder.DropTable(
                name: "SkinPurchases");

            migrationBuilder.DropTable(
                name: "CharacterSkins");

            migrationBuilder.DropIndex(
                name: "IX_PlayerProfiles_EquippedSkinId",
                table: "PlayerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_PlayerProfiles_SelectedMascotId",
                table: "PlayerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_CharacterSkinId",
                table: "Attempts");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_MascotId",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "EquippedSkinId",
                table: "PlayerProfiles");

            migrationBuilder.DropColumn(
                name: "SelectedMascotId",
                table: "PlayerProfiles");

            migrationBuilder.DropColumn(
                name: "CharacterSkinId",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "MascotId",
                table: "Attempts");
        }
    }
}
