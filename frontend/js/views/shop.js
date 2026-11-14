import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, dateShort } from "../ui.js";

// requestId покупки живёт до определённого ответа сервера: повтор с тем же id
// не списывает монеты второй раз (см. docs/cosmetics-and-shop.md).
const purchaseIds = new Map();

function skinCard(skin, balance) {
  const action = skin.isEquipped
    ? `<span class="status strong">Надето</span>`
    : skin.isOwned
      ? `<button type="button" class="button outline" data-equip="${e(skin.id)}">Надеть</button>`
      : skin.isForSale
        ? `<button type="button" class="button${balance < skin.priceCoins ? " is-disabled" : ""}" data-buy="${e(skin.id)}" ${balance < skin.priceCoins ? "disabled" : ""}>Купить · ${skin.priceCoins}</button>`
        : `<span class="status">Нет в продаже</span>`;

  return `
    <section class="panel skin-card" data-skin="${e(skin.id)}">
      <div class="media-placeholder skin-art"><span>${e(skin.assetKey)}</span></div>
      <h3>${e(skin.name)}</h3>
      <p class="muted">${e(skin.description)}</p>
      <p class="small">${skin.isStarter ? "Базовый скин" : `${skin.priceCoins} монет`}</p>
      <div class="actions">${action}</div>
    </section>`;
}

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
    <header class="page-head">
      <div>
        <h1>Магазин и гардероб</h1>
        <p>Скины меняют внешний вид персонажа и не влияют на награды.</p>
      </div>
      <div class="top-actions">
        <span class="num">${balance}</span> <span class="small">монет</span>
      </div>
    </header>

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
  const balanceLabel = root.querySelector(".top-actions .num");
  const showProblem = problem => {
    error.textContent = problem.message;
    error.className = "error";
    error.hidden = false;
  };

  // Каталог и гардероб перерисовываются после покупки и надевания.
  const paint = () => {
    root.querySelector('[data-grid="shop"]').innerHTML = shopList.map(skin => skinCard(skin, balance)).join("");
    root.querySelector('[data-grid="wardrobe"]').innerHTML = wardrobeList.map(skin => skinCard(skin, balance)).join("");
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
          // Ошибка «недостаточно монет» не резервирует идентификатор: покупку можно повторить позже.
          if (problem.code !== "InsufficientCoins") purchaseIds.delete(skinId);
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

  const loadPurchases = async () => {
    const panel = root.querySelector("[data-purchases]");
    try {
      const purchases = await api.purchases(1);
      panel.innerHTML = purchases.length
        ? `<table class="history-table">
            <thead><tr><th>Скин</th><th>Дата</th><th>Цена</th></tr></thead>
            <tbody>${purchases.map(item => `
              <tr><td>${e(item.skinName)}</td><td class="muted">${e(dateShort(item.purchasedAt))}</td><td class="num">−${item.coinsSpent} монет</td></tr>`).join("")}</tbody>
          </table>`
        : `<p class="muted">Покупок пока нет.</p>`;
    } catch (problem) {
      panel.innerHTML = `<p class="error">${e(problem.message)}</p>`;
    }
  };

  paint();
  if (active === "purchases") loadPurchases();
  return root;
}
