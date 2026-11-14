import { api } from "../api.js";
import { element, escapeHtml as e } from "../ui.js";

// Рабочий текст согласия из документа «сбор_данных».
// Реквизиты оператора и сроки хранения резервных копий в нём не выдуманы.
export const fallbackConsent = {
  version: "2026-10-24",
  sections: [
    {
      title: "Оператор и контакты",
      body: "Оператор: не указан. Адрес сайта и почта для обращений: не указаны."
    },
    {
      title: "Какие данные нужны",
      body: "Электронная почта, никнейм, учебный прогресс и ответы, XP, монеты, разряд и необходимые файлы cookie сессии. Пароль предусмотрено хранить в виде хэша. ФИО, учебная группа, телефон, геолокация и платёжные данные не запрашиваются."
    },
    {
      title: "Для чего их обрабатывают",
      body: "Регистрация, вход в аккаунт и сохранение сессии; восстановление доступа по электронной почте; сохранение прогресса, открытие тем и начисление наград в рамках курса «Электротехника»; анализ результатов обучения в обезличенном виде; защита Сайта от несанкционированного доступа и накрутки результатов."
    },
    {
      title: "Действия и доступ",
      body: "Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, обезличивание, блокирование, удаление и уничтожение данных с использованием средств автоматизации. Другие пользователи Сайта не видят данные: публичных профилей и рейтингов нет. Передача третьим лицам возможна только в случаях, предусмотренных законом."
    },
    {
      title: "Срок и отзыв согласия",
      body: "Согласие действует с момента отметки в поле согласия при регистрации и до достижения целей обработки либо до его отзыва. Данные хранятся, пока существует аккаунт. Согласие можно отозвать в любой момент: удалив аккаунт в разделе «Настройки» или отправив заявление оператору. После отзыва данные удаляются в срок до 30 календарных дней."
    },
    {
      title: "Подтверждение",
      body: "Регистрируясь на Сайте, я подтверждаю, что мне исполнилось 18 лет и что предоставленные мной данные достоверны."
    }
  ]
};

function paragraphs(text) {
  return String(text ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map(block => `<p>${e(block.trim()).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

// Документ согласия: серверный текст, если он настроен, иначе рабочий текст.
export async function renderConsent() {
  let version = fallbackConsent.version;
  let body = "";

  try {
    const config = await api.registration();
    if (config?.consent?.text) {
      version = config.consent.version || version;
      body = paragraphs(config.consent.text);
    }
  } catch {
    // Сервер недоступен: показываем рабочий текст без версии оператора.
  }

  if (!body) {
    body = `<div class="doc-copy">
      <p>Рабочий текст для макета. Версия ${e(version)}. Реквизиты оператора и условия хранения требуют подтверждения.</p>
      ${fallbackConsent.sections.map(section => `
        <section>
          <h2>${e(section.title)}</h2>
          ${paragraphs(section.body)}
        </section>`).join("")}
    </div>`;
  }

  return element(`
    <header class="page-head">
      <div>
        <h1>Согласие на обработку данных</h1>
        <p>Электротехника · рабочий текст</p>
      </div>
    </header>

    <div class="content-page">
      <section class="panel">${body}</section>
    </div>

    <div class="actions">
      <a class="button blue" href="#/auth/register"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Вернуться к регистрации</span></a>
      <a class="button outline" href="#/demo"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Продолжить без аккаунта</span></a>
    </div>
  `);
}

// Отказ от согласия: аккаунт не создаётся, форма никуда не отправляется.
export function renderConsentDeclined() {
  return element(`
    <header class="page-head">
      <div><h1>Аккаунт не создан</h1><p>Согласие не предоставлено</p></div>
    </header>

    <section class="panel">
      <h2>Согласие не предоставлено</h2>
      <p class="muted">Регистрация не отправлена. Данные формы не передаются.</p>
      <p class="small">Отказ не закрывает бесплатный демо-маршрут: пример уровня доступен без входа.</p>
      <div class="actions">
        <a class="button" href="#/demo"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Открыть пример</span></a>
        <a class="button outline" href="#/auth/register"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Вернуться к регистрации</span></a>
      </div>
    </section>
  `);
}
