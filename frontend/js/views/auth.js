import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { authLayout, field, passwordField, bindForm } from "./auth-layout.js";

export function renderAuth() {
  const root = authLayout({
    pageTitle: "Вход",
    panelTitle: "Войти в профиль",
    story: "Продолжите обучение с сохранённого места.",
    steps: ["Аккаунт", "Персонаж", "Обучение"],
    tabs: `<span class="selected">Вход</span><a href="#/auth/register">Регистрация</a>`,
    formHtml: `
      <p data-error class="error" role="alert" hidden></p>

      <form novalidate>
        <fieldset>
          ${field({ label: "Электронная почта", name: "email", type: "email", autocomplete: "username", placeholder: "name@example.com" })}
          ${passwordField({ label: "Пароль", name: "password", autocomplete: "current-password", placeholder: "Введите пароль" })}
          <p class="auth-note">После входа можно продолжить обучение с сохранённым прогрессом.</p>
          <button type="submit" class="btn btn-block">Войти</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="link action-link" href="#/auth/register">Нет аккаунта? Зарегистрироваться</a>`,
  });

  return bindForm(root, async values => {
    await api.login(values.get("email").trim(), values.get("password"));
    await refreshProfile();
    window.location.hash = "#/";
  });
}
