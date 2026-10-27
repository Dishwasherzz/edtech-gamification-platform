import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { authLayout, field, bindForm } from "./auth-layout.js";

export function renderRegister() {
  const root = authLayout({
    pageTitle: "Регистрация",
    panelTitle: "Создать профиль",
    formHtml: `
      <p data-error class="error" role="alert" hidden></p>

      <form novalidate>
        <fieldset>
          ${field({ label: "Никнейм", name: "displayName", autocomplete: "nickname", placeholder: "Как тебя показывать", max: 80 })}
          ${field({ label: "Email", name: "email", type: "email", autocomplete: "email", placeholder: "student@example.com" })}
          ${field({
            label: "Пароль",
            name: "password",
            type: "password",
            autocomplete: "new-password",
            placeholder: "••••••••",
            hint: "От 10 символов, строчная и заглавная буквы, цифра."
          })}
          <p class="auth-note">Регистрация создаёт профиль, но не открывает сессию: вход выполняется следом.</p>
          <button type="submit" class="btn btn-block">Зарегистрироваться</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="btn-link" href="#/auth">Уже есть аккаунт? Войти</a>`,
  });

  return bindForm(root, async values => {
    const email = values.get("email").trim();
    const password = values.get("password");
    await api.register(email, password, values.get("displayName").trim());
    await api.login(email, password);
    await refreshProfile();
    window.location.hash = "#/";
  });
}