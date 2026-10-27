import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { authLayout, field, bindForm } from "./auth-layout.js";

export function renderAuth() {
  const root = authLayout({
    pageTitle: "Вход",
    panelTitle: "Войти в профиль",
    formHtml: `
      <p data-error class="error" role="alert" hidden></p>

      <form novalidate>
        <fieldset>
          ${field({ label: "Email", name: "email", type: "email", autocomplete: "username", placeholder: "student@example.com" })}
          ${field({ label: "Пароль", name: "password", type: "password", autocomplete: "current-password", placeholder: "••••••••" })}
          <p class="auth-note">После входа можно продолжить обучение с сохранённым прогрессом.</p>
          <button type="submit" class="btn btn-block">Войти</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="btn-link" href="#/auth/register">Нет аккаунта? Зарегистрироваться</a>`,
  });

  return bindForm(root, async values => {
    await api.login(values.get("email").trim(), values.get("password"));
    await refreshProfile();
    window.location.hash = "#/";
  });
}
