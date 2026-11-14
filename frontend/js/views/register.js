import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { escapeHtml as e, askDialog } from "../ui.js";
import { assetUrl } from "../assets.js";
import { authLayout, field, passwordField, consentField, bindForm } from "./auth-layout.js";

const HERO_LABELS = { phase: "Мужской персонаж", ampere: "Женский персонаж" };

function heroCard(hero, checked) {
  const image = assetUrl(hero.assetKey);
  return `
    <label class="character-card${checked ? " selected" : ""}" data-hero="${e(hero.key)}">
      <input type="radio" name="heroKey" value="${e(hero.key)}" ${checked ? "checked" : ""}>
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

export async function renderRegister() {
  let config = { heroes: [], defaultHeroKey: "phase", minimumPasswordLength: 8, requiresConsent: false, canRegister: true, consent: null };
  try {
    config = await api.registration();
  } catch {
    // Без конфигурации сервера показываем базовую форму.
  }

  const heroes = config.heroes ?? [];
  const consent = config.consent ?? null;
  const consentRequired = Boolean(config.requiresConsent && consent);
  const consentDisabled = !consent;

  const root = authLayout({
    pageTitle: "Регистрация",
    panelTitle: "Создать профиль",
    story: "Сохраните прогресс курса и выберите персонажа.",
    steps: ["Аккаунт", "Персонаж", "Обучение"],
    tabs: `<a href="#/auth">Вход</a><span class="selected">Регистрация</span>`,
    formHtml: `
      <p data-error class="error" role="alert" hidden></p>

      ${config.canRegister === false ? `<div class="notice error">Регистрация временно недоступна: сервер не настроен на работу с согласием.</div>` : ""}

      <form novalidate>
        <fieldset>
          ${field({
            label: "Электронная почта",
            name: "email",
            type: "email",
            autocomplete: "email",
            placeholder: "name@example.com",
            max: 256
          })}
          ${field({
            label: "Никнейм",
            name: "displayName",
            autocomplete: "nickname",
            placeholder: "Имя в курсе",
            max: 20,
            hint: "ФИО и учебная группа не нужны."
          })}
          ${passwordField({
            label: "Пароль",
            name: "password",
            autocomplete: "new-password",
            placeholder: "Введите пароль",
            hint: `От ${config.minimumPasswordLength ?? 8} символов, строчная и заглавная буквы, цифра.`
          })}

          ${heroes.length ? `
            <div class="field">
              <span>Кем будете играть?</span>
              <div class="character-choice">${heroes.map(hero => heroCard(hero, hero.key === (config.defaultHeroKey ?? heroes[0].key))).join("")}</div>
              <p class="field-hint">Персонаж сопровождает в курсе и объясняет экран. Выбор не меняет задания или награды.</p>
            </div>` : ""}

          ${consentField({
            hint: consentDisabled
              ? "Согласие сейчас не настроено на сервере: отметка не требуется для регистрации."
              : consentRequired
                ? "Отметьте согласие, чтобы продолжить."
                : "Отметка желательна, но сервер её не требует."
          })}

          <p class="auth-note">После регистрации ты автоматически войдёшь в свой профиль.</p>
          <button type="submit" class="btn btn-block" ${config.canRegister === false ? "disabled" : ""}>Создать аккаунт</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="link action-link" href="#/auth">Вернуться ко входу</a>`,
  });

  const checkbox = root.querySelector('input[name="consent"]');
  const hint = root.querySelector("[data-consent-hint]");

  root.querySelector("[data-why]").onclick = () => askDialog({
    title: "Зачем нужно согласие",
    body: "<p>Аккаунт хранит почту, никнейм и данные о прохождении курса: прочитанные лекции, пройденные темы, историю попыток, ответы в испытаниях, XP, монеты и разряд.</p><p>Без согласия аккаунт не создаётся. Пример уровня доступен без регистрации.</p>",
    actions: [{ label: "Понятно", value: "ok", kind: "" }]
  });

  if (consentDisabled) {
    checkbox.checked = false;
    checkbox.disabled = true;
  } else {
    checkbox.onchange = () => {
      if (consentRequired && !checkbox.checked) hint.textContent = "Отметьте согласие, чтобы продолжить.";
      else hint.textContent = consentRequired ? "Согласие отмечено." : "Отметка желательна, но сервер её не требует.";
      hint.classList.remove("error");
    };
  }

  // Выбор персонажа в форме регистрации.
  root.querySelectorAll("[data-hero]").forEach(card => {
    card.onclick = () => {
      root.querySelectorAll("[data-hero]").forEach(other => {
        const checked = other === card;
        other.classList.toggle("selected", checked);
        other.querySelector("input").checked = checked;
        other.querySelector("[data-mark]").classList.toggle("is-checked", checked);
        other.querySelector("[data-state]").textContent = checked ? "✓ Выбран" : "Выбрать персонажа";
      });
    };
  });

  return bindForm(root, async values => {
    if (consentRequired && !values.get("consent")) {
      hint.textContent = "Отметьте согласие, чтобы продолжить.";
      hint.classList.add("error");
      throw new Error("Отметьте согласие на обработку персональных данных.");
    }

    const email = values.get("email").trim();
    const password = values.get("password");
    const displayName = values.get("displayName").trim();
    const heroKey = values.get("heroKey") || config.defaultHeroKey;

    const payload = { email, password, displayName, heroKey };
    if (!consentDisabled && values.get("consent")) {
      payload.acceptConsent = true;
      payload.consentVersion = consent.version;
    }

    await api.register(payload);
    await refreshProfile();
    window.location.hash = "#/character?first=1";
  });
}
