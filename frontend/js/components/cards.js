import { escapeHtml as e } from "../ui.js";
import { buttonEdge } from "./button.js";
import { skinAsset } from "../assets.js";

// Карточки персонажа (выбор героя) и скина (магазин/гардероб).

// Карточка персонажа на экране выбора.
// hero: { key, name }; checked — выбран ли сейчас.
// labels — карта ключа героя к человекочитаемому названию.
export function heroCard({ hero, checked, labels }) {
  const label = e(labels?.[hero.key] ?? hero.name);
  const characterName = hero.key.includes("ampere") || hero.key.includes("female") ? "female" : "male";
  return `
    <section class="character-card${checked ? " selected" : ""}" data-hero="${e(hero.key)}" role="radio" aria-checked="${checked ? "true" : "false"}" tabindex="0">
      <input type="radio" name="hero" value="${e(hero.key)}" ${checked ? "checked" : ""}" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">
      <div class="character-art ${characterName}">
        <img class="character-img character-full" src="/assets/characters/${characterName}_full_front.png" alt="${label}" width="152" height="360">
      </div>
      <div class="between character-name">
        <h2>${label}</h2>
        <span class="checkbox${checked ? " checked" : ""}">${checked ? "✓" : ""}</span>
      </div>
      <span class="small" data-state>${checked ? "Выбран" : "Выбрать персонажа"}</span>
    </section>`;
}

// Карточка скина в магазине и гардеробе.
// skin: { id, name, description, priceCoins, isStarter, isOwned, isEquipped, isForSale, assetKey }
// balance — текущий баланс монет пользователя.
export function skinCard({ skin, balance }) {
  const action = skin.isEquipped
    ? `<span class="status strong">Надето</span>`
    : skin.isOwned
      ? `<button type="button" class="button outline small-button" data-equip="${e(skin.id)}">${buttonEdge("Надеть")}</button>`
      : skin.isForSale
        ? `<button type="button" class="button small-button${balance < skin.priceCoins ? " is-disabled" : ""}" data-buy="${e(skin.id)}" ${balance < skin.priceCoins ? "disabled" : ""}>${buttonEdge(`Купить · ${skin.priceCoins}`)}</button>`
        : `<span class="status">Нет в продаже</span>`;

  const resolvedSrc = skinAsset(skin)
    ?? (typeof skin.assetKey === "string" && /^(https?:|\/)/.test(skin.assetKey) ? skin.assetKey : null);
  const picture = resolvedSrc
    ? `<img class="character-img character-portrait" src="${e(resolvedSrc)}" alt="${e(skin.name)}" width="80" height="88">`
    : `<span class="picture-mark">${e(skin.name)}</span>`;

  return `
    <section class="panel skin-card${skin.isEquipped ? " is-equipped" : ""}" data-skin="${e(skin.id)}">
      <div class="media-placeholder skin-art">
        ${picture}
      </div>
      <h3>${e(skin.name)}</h3>
      <p class="muted">${e(skin.description)}</p>
      <p class="small skin-price">${skin.isStarter ? "Базовый скин" : `${e(skin.priceCoins)} монет`}</p>
      <div class="actions">${action}</div>
    </section>`;
}
