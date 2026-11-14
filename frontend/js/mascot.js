import { escapeHtml as e } from "./ui.js";
import { state } from "./state.js";
import { firstAsset } from "./assets.js";

// Панель спутника: портрет, реакция на событие и подсказка по текущему экрану.
// Режимы присутствия из макета: открыт в колонке, свёрнут в строку или скрыт настройкой.
export function mascotPanel({ label = "Готов к занятию", message = "", hint = "", assetKey = null,
  href = "#/settings?tab=mascot", hrefLabel = "Настроить спутника", collapsed = false } = {}) {
  const root = document.createElement("aside");
  root.className = `pet-panel${collapsed ? " is-collapsed" : ""}`;
  root.setAttribute("data-mascot", "");
  root.setAttribute("aria-label", "Спутник");
  root.innerHTML = `
    <header class="pet-title">
      <h2>Спутник</h2>
      <button type="button" class="link action-link" data-collapse>${collapsed ? "Открыть" : "Свернуть"}</button>
    </header>
    <div class="pet-portrait">
      <span class="avatar-dot mascot-avatar" data-avatar aria-hidden="true"></span>
      <div>
        <p class="white" data-label>${e(label)}</p>
        <p class="small">Подсказка по экрану</p>
      </div>
    </div>
    <p class="pet-message" data-message>${e(message)}</p>
    <div class="actions"><a class="link action-link" href="${e(href)}">${e(hrefLabel)}</a></div>`;

  const avatar = root.querySelector("[data-avatar]");
  const image = firstAsset(assetKey);
  if (image) {
    avatar.style.backgroundImage = `url("${image}")`;
    avatar.textContent = "";
  } else {
    avatar.textContent = "⚡";
  }

  const toggle = root.querySelector("[data-collapse]");
  toggle.onclick = () => {
    const isCollapsed = root.classList.toggle("is-collapsed");
    toggle.textContent = isCollapsed ? "Открыть" : "Свернуть";
    root.querySelector("[data-message]").hidden = isCollapsed;
    root.querySelector(".actions").hidden = isCollapsed;
  };
  if (collapsed) {
    root.querySelector("[data-message]").hidden = true;
    root.querySelector(".actions").hidden = true;
  }

  root.update = next => {
    if (!next) return;
    if (next.label !== undefined) root.querySelector("[data-label]").textContent = next.label;
    if (next.message !== undefined) root.querySelector("[data-message]").textContent = next.message;
    if (next.assetKey !== undefined) {
      const url = firstAsset(next.assetKey);
      if (url) { avatar.style.backgroundImage = `url("${url}")`; avatar.textContent = ""; }
    }
  };
  // Подсказка по экрану живёт в тексте сообщения — отдельного блока нет.
  root.setHint = text => {
    root.querySelector("[data-message]").textContent = text;
  };

  root.hidden = !state.mascotVisible;
  const onVisibility = () => { root.hidden = !state.mascotVisible; };
  window.addEventListener("mascot-visibility", onVisibility);
  root.dispose = () => window.removeEventListener("mascot-visibility", onVisibility);
  return root;
}

// Компактная строка спутника: портрет, подпись и ссылка «Открыть».
// В макете так выглядит спутник на странице профиля и во время испытания.
export function mascotMini({ label = "Спутник", assetKey = null, href = "#/settings?tab=mascot" } = {}) {
  const root = document.createElement("aside");
  root.className = "pet-mini";
  root.setAttribute("data-pet", "mini");
  root.innerHTML = `
    <span class="avatar-dot" data-avatar aria-hidden="true"></span>
    <span data-label>${e(label)}</span>
    <a class="link action-link" href="${e(href)}">Открыть</a>`;

  const avatar = root.querySelector("[data-avatar]");
  const image = firstAsset(assetKey);
  if (image) {
    avatar.style.backgroundImage = `url("${image}")`;
    avatar.textContent = "";
  } else {
    avatar.textContent = "⚡";
  }

  root.update = next => {
    if (!next) return;
    if (next.label !== undefined) root.querySelector("[data-label]").textContent = next.label;
    if (next.assetKey !== undefined) {
      const url = firstAsset(next.assetKey);
      if (url) { avatar.style.backgroundImage = `url("${url}")`; avatar.textContent = ""; }
    }
  };
  // Спутник может быть выключен в настройках — тогда строка прячется.
  root.hidden = !state.mascotVisible;
  const onVisibility = () => { root.hidden = !state.mascotVisible; };
  window.addEventListener("mascot-visibility", onVisibility);
  root.dispose = () => window.removeEventListener("mascot-visibility", onVisibility);
  return root;
}

// Панель спутника в колонке страницы. Скрытый спутник убирает и колонку.
export function mountMascot(column, mascot) {
  column.replaceChildren(mascot);
  const sync = () => { column.hidden = !state.mascotVisible; };
  sync();
  window.addEventListener("mascot-visibility", sync);
  const dispose = mascot.dispose;
  mascot.dispose = () => { window.removeEventListener("mascot-visibility", sync); dispose?.(); };
  return mascot;
}

// Текст-подсказка для экранов курса.
export const hints = {
  dashboard: "Откройте доступную тему и прочитайте лекцию. Испытание появится после отметки «Прочитано».",
  lesson: "В конце лекции отметьте её как прочитанной. За это начисляется 20 XP один раз.",
  locked: "Сначала победите в испытании предыдущей темы. Подойдёт тест или авария.",
  attempt: "Я не подсказываю правильный ответ и не останавливаю отсчёт.",
  correct: "Проверьте, как изменились показатели испытания, и переходите дальше.",
  wrong: "Причина ошибки показана рядом с заданием. После попытки будет разбор.",
  passed: "Результат сохранён. Следующая тема уже доступна.",
  failed: "Ничего не списано. Можно повторить теорию и выбрать новое испытание."
};
