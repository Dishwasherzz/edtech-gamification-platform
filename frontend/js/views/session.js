import { element } from "../ui.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { buttonLink } from "../components/button.js";

// Сессия истекла: личные данные и настройки в гостевой оболочке не показываются.
export function renderSessionExpired() {
  return element(`
    ${pageHead({ title: "Войдите заново", description: "Сессия завершилась" })}

    ${panel({
      title: "Сессия завершилась",
      children: `
        <p class="muted">Доступ к аккаунту закрыт. Для продолжения войдите снова.</p>
        <p class="small">Текущая попытка не ставится на паузу: её отсчёт идёт на сервере.</p>
        <div class="actions">
          ${buttonLink({ href: "#/auth", label: "Войти" })}
          ${buttonLink({ href: "#/demo", label: "Пример без входа", kind: "outline" })}
        </div>
      `
    })}
  `);
}

// Гость открыл личный раздел: показываем вход, а не содержимое раздела.
export function renderSignInRequired() {
  return element(`
    ${pageHead({ title: "Нужен вход для обучения", description: "Лекции, испытания и личный прогресс доступны после входа" })}

    ${panel({
      title: "Лекции, испытания и личный прогресс доступны после входа",
      children: `
        <p class="muted">Пример уровня можно посмотреть без аккаунта.</p>
        <div class="actions">
          ${buttonLink({ href: "#/auth", label: "Войти" })}
          ${buttonLink({ href: "#/auth/register", label: "Регистрация", kind: "outline" })}
          <a class="link action-link" href="#/demo">Остаться в демо</a>
        </div>
      `
    })}
  `);
}
