import { api } from "../api.js";
import { element, errorNotice } from "../ui.js";
import { authLayout, field, passwordField, bindForm } from "./auth-layout.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { buttonAction, buttonLink } from "../components/button.js";

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
          ${buttonAction({ label: "Отправить ссылку", type: "submit" })}
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
    ${pageHead({ title: "Проверьте почту", description: "Письмо для восстановления" })}

    ${panel({
      title: "Письмо для восстановления",
      children: `
        <p class="muted">Если на этот адрес зарегистрирован аккаунт, придёт письмо со ссылкой для смены пароля. Проверьте также папку «Спам».</p>
        <div class="actions">
          ${buttonLink({ href: "#/auth", label: "Ко входу" })}
          ${buttonLink({ href: "#/auth/forgot", label: "Отправить ещё раз", kind: "outline" })}
        </div>
      `
    })}
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
          ${buttonAction({ label: "Сохранить пароль", type: "submit" })}
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
    ${pageHead({ title: "Пароль изменён", description: "Войдите заново" })}

    ${panel({
      title: "Войдите заново",
      children: `
        <p class="muted">Используйте новый пароль для входа в аккаунт.</p>
        <div class="actions">${buttonLink({ href: "#/auth", label: "Перейти ко входу" })}</div>
      `
    })}
  `);
}

export function renderResetInvalid() {
  return element(`
    ${pageHead({ title: "Ссылка недействительна", description: "Запросите новую ссылку" })}

    ${panel({
      title: "Запросите новую ссылку",
      children: `
        <p class="muted">Текущая ссылка уже использована или срок её действия истёк.</p>
        <div class="actions">
          ${buttonLink({ href: "#/auth/forgot", label: "Запросить ссылку" })}
          ${buttonLink({ href: "#/auth", label: "Войти", kind: "outline" })}
        </div>
      `
    })}
  `);
}
