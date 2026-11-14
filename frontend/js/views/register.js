import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { escapeHtml as e, askDialog, errorNotice } from "../ui.js";
import { authLayout, field, passwordField, consentField, bindForm } from "./auth-layout.js";

export async function renderRegister() {
  let config = { minimumPasswordLength: 8, requiresConsent: false, canRegister: true, consent: null };
  try {
    config = await api.registration();
  } catch {
    // Без конфигурации сервера показываем базовую форму.
  }

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
      ${errorNotice("Регистрация не завершена")}

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

          ${consentField({
            hint: consentDisabled
              ? "Согласие сейчас не настроено на сервере: отметка не требуется для регистрации."
              : consentRequired
                ? "Отметьте согласие, чтобы продолжить."
                : "Отметка желательна, но сервер её не требует."
          })}

          <p class="auth-note">После регистрации ты автоматически войдёшь в свой профиль.</p>
          <button type="submit" class="btn btn-block" ${config.canRegister === false || consentRequired ? "disabled" : ""}>Создать аккаунт</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="link action-link" href="#/auth">Вернуться ко входу</a>`,
  });

  const checkbox = root.querySelector('input[name="consent"]');
  const hint = root.querySelector("[data-consent-hint]");
  const submit = root.querySelector('button[type="submit"]');
  const checkRow = root.querySelector(".check-row");

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
      if (consentRequired) {
        submit.disabled = !checkbox.checked;
        hint.textContent = checkbox.checked ? "Согласие отмечено." : "Отметьте согласие, чтобы продолжить.";
      } else {
        hint.textContent = "Отметка желательна, но сервер её не требует.";
      }
      hint.classList.remove("error");
      checkRow?.classList.remove("check-error");
    };
  }

  return bindForm(root, async values => {
    if (consentRequired && !values.get("consent")) {
      hint.textContent = "Отметьте согласие, чтобы продолжить.";
      hint.classList.add("error");
      checkRow?.classList.add("check-error");
      throw new Error("Отметьте согласие на обработку персональных данных.");
    }

    const email = values.get("email").trim();
    const password = values.get("password");
    const displayName = values.get("displayName").trim();

    // Персонажа выбирают на отдельной странице после регистрации.
    const payload = { email, password, displayName };
    if (!consentDisabled && values.get("consent")) {
      payload.acceptConsent = true;
      payload.consentVersion = consent.version;
    }

    await api.register(payload);
    await refreshProfile();
    window.location.hash = "#/character?first=1";
  });
}
