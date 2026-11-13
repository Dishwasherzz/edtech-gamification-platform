import { element } from "../ui.js";

// Сессия истекла: личные данные и настройки в гостевой оболочке не показываются.
export function renderSessionExpired() {
  return element(`
    <header class="page-head">
      <div><h1>Войдите заново</h1><p>Сессия завершилась</p></div>
    </header>

    <section class="card">
      <h2>Сессия завершилась</h2>
      <p class="muted">Доступ к аккаунту закрыт. Для продолжения войдите снова.</p>
      <p class="small">Текущая попытка не ставится на паузу: её отсчёт идёт на сервере.</p>
      <div class="actions">
        <a class="btn" href="#/auth">Войти</a>
        <a class="btn btn-outline" href="#/demo">Пример без входа</a>
      </div>
    </section>
  `);
}

// Гость открыл личный раздел: показываем вход, а не содержимое раздела.
export function renderSignInRequired() {
  return element(`
    <header class="page-head">
      <div><h1>Нужен вход для обучения</h1><p>Лекции, испытания и личный прогресс доступны после входа</p></div>
    </header>

    <section class="card">
      <h2>Лекции, испытания и личный прогресс доступны после входа</h2>
      <p class="muted">Пример уровня можно посмотреть без аккаунта.</p>
      <div class="actions">
        <a class="btn" href="#/auth">Войти</a>
        <a class="btn btn-outline" href="#/auth/register">Регистрация</a>
        <a class="link action-link" href="#/demo">Остаться в демо</a>
      </div>
    </section>
  `);
}
