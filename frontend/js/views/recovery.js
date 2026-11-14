import { api } from "../api.js";
import { element, errorNotice } from "../ui.js";
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
      ${errorNotice("Не удалось отправить ссылку")}
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
          <p class="small">Укажите почту, с которой регистрировались.</p>
          <button type="submit" class="button"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Отправить ссылку</span></button>
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

    <section class="panel">
      <h2>Письмо для восстановления</h2>
      <p class="muted">Если на этот адрес зарегистрирован аккаунт, придёт письмо со ссылкой для смены пароля. Проверьте также папку «Спам».</p>
      <div class="actions">
        <a class="button" href="#/auth"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Ко входу</span></a>
        <a class="button outline" href="#/auth/forgot"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Отправить ещё раз</span></a>
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
      ${errorNotice("Не удалось сохранить пароль")}
      <form novalidate>
        <fieldset>
          ${passwordField({
            label: "Новый пароль",
            name: "newPassword",
            autocomplete: "new-password",
            placeholder: "Введите пароль",
            hint: "От 8 символов, строчная и заглавная буквы, цифра."
          })}
          <p class="small">Создайте новый пароль для входа в аккаунт.</p>
          <button type="submit" class="button"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Сохранить пароль</span></button>
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

    <section class="panel">
      <h2>Войдите заново</h2>
      <p class="muted">Используйте новый пароль для входа в аккаунт.</p>
      <div class="actions"><a class="button" href="#/auth"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Перейти ко входу</span></a></div>
    </section>
  `);
}

export function renderResetInvalid() {
  return element(`
    <header class="page-head">
      <div><h1>Ссылка недействительна</h1><p>Запросите новую ссылку</p></div>
    </header>

    <section class="panel">
      <h2>Запросите новую ссылку</h2>
      <p class="muted">Текущая ссылка уже использована или срок её действия истёк.</p>
      <div class="actions">
        <a class="button" href="#/auth/forgot"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Запросить ссылку</span></a>
        <a class="button outline" href="#/auth"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Войти</span></a>
      </div>
    </section>
  `);
}
