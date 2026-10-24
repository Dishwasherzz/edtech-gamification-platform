using System.Security.Claims;
using EducationGamePlatform.Infrastructure;

namespace EducationGamePlatform.Features.Cosmetics;

public static class CosmeticsEndpoints
{
    public static void MapCosmeticsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api").RequireAuthorization().WithTags("Cosmetics and shop");
        group.MapGet("/shop/skins", async (ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.SkinsAsync(user.GetUserId(), false, token))).Produces<List<SkinResponse>>();
        group.MapGet("/me/skins", async (ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.SkinsAsync(user.GetUserId(), true, token))).Produces<List<SkinResponse>>();
        group.MapGet("/me/appearance", async (ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.AppearanceAsync(user.GetUserId(), token))).Produces<AppearanceResponse>();
        group.MapPut("/me/skin", async (SelectSkinRequest request, ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.EquipAsync(user.GetUserId(), request.SkinId, token))).Produces<AppearanceResponse>();
        group.MapGet("/mascots", async (CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.MascotsAsync(token))).Produces<List<MascotResponse>>();
        group.MapGet("/mascots/{mascotId:guid}", async (Guid mascotId, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.MascotAsync(mascotId, token))).Produces<MascotDetails>();
        group.MapPut("/me/mascot", async (SelectMascotRequest request, ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.SelectMascotAsync(user.GetUserId(), request.MascotId, token))).Produces<AppearanceResponse>();
        group.MapPost("/shop/skins/{skinId:guid}/purchase", async (Guid skinId, PurchaseSkinRequest request, ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token) =>
            Results.Ok(await cosmetics.PurchaseAsync(user.GetUserId(), skinId, request.RequestId, token))).Produces<PurchaseResponse>();
        group.MapGet("/me/purchases", async (ClaimsPrincipal user, CosmeticsService cosmetics, CancellationToken token, int page = 1) =>
            Results.Ok(await cosmetics.PurchasesAsync(user.GetUserId(), page, token))).Produces<List<PurchaseHistoryResponse>>();
    }
}
