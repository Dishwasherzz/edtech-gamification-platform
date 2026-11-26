import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, render, dateShort } from "../ui.js";
import { skinCard } from "../components/cards.js";
import { pageHead } from "../components/page-head.js";

// requestId покупки живёт до определённого ответа сервера: повтор с тем же id
// не списывает монеты второй раз (см. docs/cosmetics-and-shop.md).
const purchaseIds = new Map();

export async function renderShop(tab = "shop") {
  const [user, catalog, wardrobe] = await Promise.all([
    refreshProfile(),
    api.shopSkins(),
    api.mySkins()
  ]);

  let balance = user.coinsBalance;
  let shopList = catalog;
  let wardrobeList = wardrobe;

  const active = ["shop", "wardrobe", "purchases"].includes(tab) ? tab : "shop";
  const root = element(`
    ${pageHead({
      title: "Магазин и гардероб",
      description: "Скины меняют внешний вид персонажа и не влияют на награды.",
      actions: `<div class="shop-balance"><span class="small">Баланс</span><strong class="num">${balance}</strong><span class="small">монет</span></div>`
    })}

    <p data-error class="error" role="alert" hidden></p>

    <nav class="tabs-settings">
      <button type="button" class="tab${active === "shop" ? " is-active" : ""}" data-tab="shop">Магазин</button>
      <button type="button" class="tab${active === "wardrobe" ? " is-active" : ""}" data-tab="wardrobe">Гардероб</button>
      <button type="button" class="tab${active === "purchases" ? " is-active" : ""}" data-tab="purchases">Покупки</button>
    </nav>

    <section data-panel="shop" ${active === "shop" ? "" : "hidden"}>
      <div class="grid3" data-grid="shop"></div>
    </section>

    <section data-panel="wardrobe" ${active === "wardrobe" ? "" : "hidden"}>
      <div class="grid3" data-grid="wardrobe"></div>
    </section>

    <section data-panel="purchases" ${active === "purchases" ? "" : "hidden"} data-purchases>
      <p class="muted">Загрузка истории…</p>
    </section>
  `);

  const error = root.querySelector("[data-error]");
  const balanceLabel = root.querySelector(".shop-balance .num");
  const showProblem = problem => {
    error.textContent = problem.message;
    error.className = "error";
    error.hidden = false;
  };

  // Каталог и гардероб перерисовываются после покупки и надевания.
  const paint = () => {
    render(
      root.querySelector('[data-grid="shop"]'),
      shopList.length
        ? shopList.map(skin => skinCard({ skin, balance })).join("")
        : `<div class="panel shop-empty"><p class="muted">Новых скинов пока нет.</p></div>`
    );
    render(
      root.querySelector('[data-grid="wardrobe"]'),
      wardrobeList.length
        ? wardrobeList.map(skin => skinCard({ skin, balance })).join("")
        : `<div class="panel shop-empty"><p class="muted">В гардеробе пока пусто — выберите скин во вкладке «Магазин».</p></div>`
    );
    balanceLabel.textContent = balance;
    bind();
  };

  const bind = () => {
    root.querySelectorAll("[data-equip]").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        error.hidden = true;
        try {
          await api.equipSkin(button.dataset.equip);
          await refreshProfile();
          [shopList, wardrobeList] = await Promise.all([api.shopSkins(), api.mySkins()]);
          paint();
        } catch (problem) {
          showProblem(problem);
          button.disabled = false;
        }
      };
    });

    root.querySelectorAll("[data-buy]").forEach(button => {
      button.onclick = async () => {
        const skinId = button.dataset.buy;
        button.disabled = true;
        error.hidden = true;
        if (!purchaseIds.has(skinId)) purchaseIds.set(skinId, crypto.randomUUID());
        try {
          const result = await api.purchaseSkin(skinId, purchaseIds.get(skinId));
          purchaseIds.delete(skinId);
          balance = result?.coinsBalance ?? balance;
          [shopList, wardrobeList] = await Promise.all([api.shopSkins(), api.mySkins()]);
          paint();
          error.className = "success";
          error.textContent = result?.isReplay
            ? "Покупка уже проходила: списания не было."
            : `Списано ${result?.coinsSpent ?? 0} монет. Баланс: ${balance}.`;
          error.hidden = false;
        } catch (problem) {
          // Сбрасываем идентификатор только на окончательные ошибки (недостаточно монет, валидация).
          // При обрыве связи или 5xx сохраняем ID — сервер мог уже обработать покупку.
          if (problem.code === "InsufficientCoins" || (problem.status && problem.status >= 400 && problem.status < 500)) {
            purchaseIds.delete(skinId);
          }
          showProblem(problem);
          button.disabled = false;
        }
      };
    });
  };

  root.querySelectorAll("[data-tab]").forEach(button => {
    button.onclick = () => {
      const key = button.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach(other => {
        other.classList.toggle("is-active", other === button);
      });
      root.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== key; });
      history.replaceState(null, "", `#/shop?tab=${key}`);
      if (key === "purchases") loadPurchases();
    };
  });

  const loadPurchases = async (page = 1) => {
    const panel = root.querySelector("[data-purchases]");
    try {
      const purchases = await api.purchases(page);
      const hasMore = purchases.length === 20;
      render(panel, purchases.length
        ? `<table class="history-table">
            <thead><tr><th>Скин</th><th>Дата</th><th>Цена</th></tr></thead>
            <tbody>${purchases.map(item => `
              <tr><td>${e(item.skinName)}</td><td class="muted">${e(dateShort(item.purchasedAt))}</td><td class="num">−${item.coinsSpent} монет</td></tr>`).join("")}</tbody>
          </table>${hasMore ? `<div class="actions"><button type="button" class="button outline" data-purchases-page="${page + 1}">Показать ещё</button></div>` : ""}`
        : `<p class="muted">Покупок пока нет.</p>`);
      const more = panel.querySelector("[data-purchases-page]");
      if (more) {
        more.onclick = () => loadPurchases(Number(more.dataset.purchasesPage));
      }
    } catch (problem) {
      render(panel, `<p class="error">${e(problem.message)}</p>`);
    }
  };

  paint();
  if (active === "purchases") loadPurchases();
  return root;
}
