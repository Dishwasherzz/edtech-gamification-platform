import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e } from "../ui.js";
import { assetUrl } from "../assets.js";

const HERO_LABELS = { phase: "Мужской персонаж", ampere: "Женский персонаж" };

function heroCard(hero, checked) {
  const image = assetUrl(hero.assetKey);
  return `
    <label class="character-card${checked ? " selected" : ""}" data-hero="${e(hero.key)}">
      <input type="radio" name="hero" value="${e(hero.key)}" ${checked ? "checked" : ""}>
      <span class="character-art ${hero.key === "ampere" ? "female" : "male"}">
        <span class="sprite-img"${image ? ` style="background-image:url('${image}')"` : ""}></span>
      </span>
      <span class="character-name">
        <span class="checkbox${checked ? " is-checked" : ""}" data-mark></span>
        <h2>${e(HERO_LABELS[hero.key] ?? hero.name)}</h2>
      </span>
      <span class="small" data-state>${checked ? "✓ Выбран" : "Выбрать персонажа"}</span>
    </label>`;
}

export async function renderCharacter(options = {}) {
  const first = Boolean(options.first);
  const [config, user] = await Promise.all([
    api.registration().catch(() => ({ heroes: [] })),
    refreshProfile()
  ]);

  const heroes = config.heroes ?? [];
  const current = user.hero?.key ?? config.defaultHeroKey ?? heroes[0]?.key;
  // При первом запуске персонаж ещё не выбран: подтверждать нечего.
  let selected = first ? null : current;

  const root = element(`
    <div class="step-line">
      <span>Аккаунт</span>
      <span aria-hidden="true">→</span>
      <span class="selected">Персонаж</span>
      <span aria-hidden="true">→</span>
      <span>Обучение</span>
    </div>

    <div class="gap"></div>

    <header class="page-head character-head">
      <div>
        <h1>${first ? "Кем будете играть?" : "Сменить персонажа"}</h1>
        <p>Персонаж сопровождает в курсе и объясняет экран. Выбор не меняет задания или награды.</p>
      </div>
    </header>

    <p data-error class="error" role="alert" hidden></p>

    <div class="character-choice">
      ${heroes.map(hero => heroCard(hero, hero.key === selected)).join("")}
    </div>

    <div class="character-actions">
      <button type="button" class="btn" data-save ${selected ? "" : "disabled"}>${first ? "Подтвердить выбор" : "Сохранить выбор"}</button>
      ${first ? `<a class="link action-link" href="#/">Выбрать позже</a>` : `<a class="link action-link" href="#/profile">Отмена</a>`}
    </div>
  `);

  const save = root.querySelector("[data-save]");
  const error = root.querySelector("[data-error]");

  root.querySelectorAll("[data-hero]").forEach(card => {
    card.onclick = event => {
      if (event.target.tagName === "A") return;
      selected = card.dataset.hero;
      root.querySelectorAll("[data-hero]").forEach(other => {
        const checked = other === card;
        other.classList.toggle("selected", checked);
        other.querySelector("input").checked = checked;
        other.querySelector("[data-mark]").classList.toggle("is-checked", checked);
        other.querySelector("[data-state]").textContent = checked ? "✓ Выбран" : "Выбрать персонажа";
      });
      save.disabled = false;
      error.hidden = true;
    };
  });

  save.onclick = async () => {
    if (!selected) return;
    save.disabled = true;
    error.hidden = true;
    try {
      await api.updateHero(selected);
      await refreshProfile();
      window.location.hash = first ? "#/" : "#/profile";
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      save.disabled = false;
    }
  };

  if (!heroes.length) {
    root.querySelector(".character-choice").innerHTML = `<section class="card"><p class="muted">Персонажи пока не настроены на сервере.</p></section>`;
    save.disabled = true;
  }

  return root;
}
