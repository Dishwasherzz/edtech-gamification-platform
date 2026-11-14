import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { errorNotice } from "../ui.js";
import { authLayout, field, passwordField, bindForm } from "./auth-layout.js";

export function renderAuth() {
  const root = authLayout({
    pageTitle: "Вход",
    panelTitle: "Войти в профиль",
    story: "Продолжите обучение с сохранённого места.",
    steps: ["Аккаунт", "Персонаж", "Обучение"],
    tabs: `<span class="selected">Вход</span><a href="#/auth/register">Регистрация</a>`,
    formHtml: `
      ${errorNotice("Не удалось войти")}

      <form novalidate>
        <fieldset>
          ${field({ label: "Электронная почта", name: "email", type: "email", autocomplete: "username", placeholder: "name@example.com" })}
          ${passwordField({ label: "Пароль", name: "password", autocomplete: "current-password", placeholder: "Введите пароль" })}

          <button type="submit" class="button"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Войти</span></button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="link action-link" href="#/auth/forgot">Забыли пароль?</a>`,
  });

  return bindForm(root, async values => {
    await api.login(values.get("email").trim(), values.get("password"));
    await refreshProfile();
    window.location.hash = "#/";
  });
}
