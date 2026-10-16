import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, showError } from "../ui.js";

export function renderAuth() {
  const root = element(`<div class="card auth-card"><h1>Начни обучение</h1><p class="muted">Войди, чтобы сохранить прогресс и пройти испытания.</p>
    <div class="tabs"><button type="button" data-tab="login" class="btn">Вход</button><button type="button" data-tab="register" class="btn secondary">Регистрация</button></div>
    <p data-error class="error" role="alert" hidden></p>
    <form data-form="login"><h2>Вход</h2><fieldset><label>Email<input name="email" type="email" required maxlength="256" autocomplete="username"></label>
      <label>Пароль<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="btn" type="submit">Войти</button></fieldset></form>
    <form data-form="register" hidden><h2>Регистрация</h2><fieldset><label>Имя<input name="displayName" required maxlength="80" autocomplete="nickname"></label>
      <label>Email<input name="email" type="email" required maxlength="256" autocomplete="username"></label>
      <label>Пароль<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="new-password" aria-describedby="password-help"></label>
      <p class="muted" id="password-help">От 10 символов, строчная и заглавная буквы, цифра.</p><button class="btn" type="submit">Создать аккаунт</button></fieldset></form></div>`);
  root.querySelectorAll("[data-tab]").forEach(button => button.onclick = () => {
    root.querySelectorAll("form").forEach(form => form.hidden = form.dataset.form !== button.dataset.tab);
    root.querySelector("[data-error]").hidden = true;
  });
  root.querySelectorAll("form").forEach(form => form.onsubmit = async event => {
    event.preventDefault();
    const values = new FormData(form);
    const fieldset = form.querySelector("fieldset");
    fieldset.disabled = true;
    root.querySelector("[data-error]").hidden = true;
    try {
      if (form.dataset.form === "register") await api.register(values.get("email"), values.get("password"), values.get("displayName"));
      await api.login(values.get("email"), values.get("password"));
      await refreshProfile();
      window.location.hash = "#/";
    } catch (error) { showError(root, error); }
    finally { fieldset.disabled = false; }
  });
  return root;
}
