import { api } from "../api.js";
import { element } from "../ui.js";
import { authLayout, field, passwordField, bindForm } from "./auth-layout.js";

const AUTH_TABS = `<a href="#/auth">Вход</a><a href="#/auth/register">Регистрация</a>`;

// Запрос письма со ссылкой для смены пароля.
export function renderForgot() {
  const root = authLayout({
    pageTitle: "Восстановление доступа",
    panelTitle: "Восстановление доступа",
    story: "Укажите почту, с которой регистрировались.",
    steps: ["Аккаунт", "Персонаж", "Обучение"],
    tabs: AUTH_TABS,
    formHtml: `
      <p data-error class="error" role="alert" hidden></p>
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
          <p class="auth-note">Укажите почту, с которой регистрировались.</p>
          <button type="submit" class="btn btn-block">Отправить ссылку</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="link action-link" href="#/auth">Вернуться ко входу</a>`,
  });

  return bindForm(root, async values => {
    await api.forgotPassword(values.get("email").trim());
    window.location.hash = "#/auth/recovery/sent";
  });
}

// Письмо отправлено. Ответ не раскрывает, зарегистрирован ли адрес.
export function renderRecoverySent() {
  return element(`
    <header class="page-head">
      <div><h1>Проверьте почту</h1><p>Письмо для восстановления</p></div>
    </header>

    <section class="card">
      <h2>Письмо для восстановления</h2>
      <p class="muted">Если на этот адрес зарегистрирован аккаунт, придёт письмо со ссылкой для смены пароля. Проверьте также папку «Спам».</p>
      <div class="actions">
        <a class="btn" href="#/auth">Ко входу</a>
        <a class="btn btn-outline" href="#/auth/forgot">Отправить ещё раз</a>
      </div>
    </section>
  `);
}

// Новый пароль по ссылке из письма.
export function renderReset(userId, token) {
  if (!userId || !token) {
    window.location.hash = "#/auth/reset/invalid";
    return element("");
  }

  const root = authLayout({
    pageTitle: "Новый пароль",
    panelTitle: "Новый пароль",
    story: "Создайте новый пароль для входа в аккаунт.",
    steps: ["Аккаунт", "Персонаж", "Обучение"],
    tabs: AUTH_TABS,
    formHtml: `
      <p data-error class="error" role="alert" hidden></p>
      <form novalidate>
        <fieldset>
          ${passwordField({
            label: "Новый пароль",
            name: "newPassword",
            autocomplete: "new-password",
            placeholder: "Введите пароль",
            hint: "От 8 символов, строчная и заглавная буквы, цифра."
          })}
          <p class="auth-note">Создайте новый пароль для входа в аккаунт.</p>
          <button type="submit" class="btn btn-block">Сохранить пароль</button>
        </fieldset>
      </form>
    `,
    altHtml: `<a class="link action-link" href="#/auth">Вернуться ко входу</a>`,
  });

  return bindForm(root, async values => {
    try {
      await api.resetPassword(userId, token, values.get("newPassword"));
    } catch (error) {
      if (error.errors?.token) {
        window.location.hash = "#/auth/reset/invalid";
        return;
      }
      throw error;
    }
    window.location.hash = "#/auth/reset/done";
  });
}

export function renderResetDone() {
  return element(`
    <header class="page-head">
      <div><h1>Пароль изменён</h1><p>Войдите заново</p></div>
    </header>

    <section class="card">
      <h2>Войдите заново</h2>
      <p class="muted">Используйте новый пароль для входа в аккаунт.</p>
      <div class="actions"><a class="btn" href="#/auth">Перейти ко входу</a></div>
    </section>
  `);
}

export function renderResetInvalid() {
  return element(`
    <header class="page-head">
      <div><h1>Ссылка недействительна</h1><p>Запросите новую ссылку</p></div>
    </header>

    <section class="card">
      <h2>Запросите новую ссылку</h2>
      <p class="muted">Текущая ссылка уже использована или срок её действия истёк.</p>
      <div class="actions">
        <a class="btn" href="#/auth/forgot">Запросить ссылку</a>
        <a class="btn btn-outline" href="#/auth">Войти</a>
      </div>
    </section>
  `);
}
