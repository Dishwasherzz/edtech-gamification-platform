import { escapeHtml as e } from "./ui.js";
import { state } from "./state.js";
import { firstAsset } from "./assets.js";

// Кадры спутника из листа character-male.webp (макет components-pet).
// Женский персонаж в исходнике имеет только нейтральный кадр.
const MALE_FRAMES = new Set(["neutral", "focused", "happy", "surprised", "rest"]);
const FEMALE_FRAMES = new Set(["neutral"]);

function spriteClass(character, frame) {
  const safeFrame = (character === "female" ? FEMALE_FRAMES : MALE_FRAMES).has(frame) ? frame : "neutral";
  return `sprite sprite--${character}-${safeFrame}`;
}

function detectCharacter(assetKey) {
  return String(assetKey || "").includes("female") ? "female" : "male";
}

// Панель спутника: портрет, реакция на событие и подсказка по текущему экрану.
export function mascotPanel({ label = "Готов к занятию", message = "", hint = "", assetKey = null,
  frame = "neutral", href = "#/settings?tab=mascot", hrefLabel = "Настроить спутника", collapsed = false } = {}) {
  const character = detectCharacter(assetKey);
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
      <div class="${spriteClass(character, frame)} mascot-sprite" role="img" aria-label="Спутник" data-sprite style="width:64px;height:72px"></div>
      <div>
        <p class="white" data-label>${e(label)}</p>
        <p class="small">Подсказка по экрану</p>
      </div>
    </div>
    <p class="pet-message" data-message>${e(message)}</p>
    <div class="actions"><a class="link action-link" href="${e(href)}">${e(hrefLabel)}</a></div>`;

  const sprite = root.querySelector("[data-sprite]");
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
    if (next.frame !== undefined || next.assetKey !== undefined) {
      const ch = next.assetKey !== undefined ? detectCharacter(next.assetKey) : character;
      const fr = next.frame !== undefined ? next.frame : frame;
      sprite.className = `${spriteClass(ch, fr)} mascot-sprite`;
    }
  };
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
export function mascotMini({ label = "Спутник", assetKey = null, frame = "neutral", href = "#/settings?tab=mascot" } = {}) {
  const character = detectCharacter(assetKey);
  const root = document.createElement("aside");
  root.className = "pet-mini";
  root.setAttribute("data-pet", "mini");
  root.innerHTML = `
    <div class="${spriteClass(character, frame)} mascot-sprite" role="img" aria-label="Спутник" data-sprite style="width:32px;height:36px"></div>
    <span data-label>${e(label)}</span>
    <a class="link action-link" href="${e(href)}">Открыть</a>`;

  const sprite = root.querySelector("[data-sprite]");
  root.update = next => {
    if (!next) return;
    if (next.label !== undefined) root.querySelector("[data-label]").textContent = next.label;
    if (next.frame !== undefined || next.assetKey !== undefined) {
      const ch = next.assetKey !== undefined ? detectCharacter(next.assetKey) : character;
      const fr = next.frame !== undefined ? next.frame : frame;
      sprite.className = `${spriteClass(ch, fr)} mascot-sprite`;
    }
  };
  root.hidden = !state.mascotVisible;
  const onVisibility = () => { root.hidden = !state.mascotVisible; };
  window.addEventListener("mascot-visibility", onVisibility);
  root.dispose = () => window.removeEventListener("mascot-visibility", onVisibility);
  return root;
}

export function mountMascot(column, mascot) {
  column.replaceChildren(mascot);
  const sync = () => { column.hidden = !state.mascotVisible; };
  sync();
  window.addEventListener("mascot-visibility", sync);
  const dispose = mascot.dispose;
  mascot.dispose = () => { window.removeEventListener("mascot-visibility", sync); dispose?.(); };
  return mascot;
}

export const hints = {
  dashboard: "Откройте доступную тему и прочитайте лекцию. Испытание появится после отметки «Прочитано».",
  lesson: "В конце лекции отметьте её как прочитанную. За это начисляется 20 XP один раз.",
  locked: "Сначала победите в испытании предыдущей темы. Подойдёт тест или авария.",
  attempt: "Я не подсказываю правильный ответ и не останавливаю отсчёт.",
  correct: "Проверьте, как изменились показатели испытания, и переходите дальше.",
  wrong: "Причина ошибки показана рядом с заданием. После попытки будет разбор.",
  passed: "Результат сохранён. Следующая тема уже доступна.",
  failed: "Ничего не списано. Можно повторить теорию и выбрать новое испытание."
};