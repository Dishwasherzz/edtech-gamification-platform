import { escapeHtml as e } from "./ui.js";
import { state } from "./state.js";
import { moodAsset } from "./assets.js";

// Состояния персонажа: как он выглядит на экране.
export const MOODS = {
  calm: "Спокойствие",
  focus: "Фокус",
  joy: "Радость",
  surprise: "Удивление",
  support: "Поддержка"
};

// Персонаж по умолчанию, если его не выбрали.
const DEFAULT_CHARACTER = "male";

// Событие интерфейса → состояние персонажа и подсказка по экрану.
// У каждого события две реплики: мужская и женская. Выбор зависит от
// выбранного героя: у «Фаза» мужской, у «Ампера» женский.
export const COMPANION_EVENTS = {
  "Готов к занятию": {
    mood: "calm",
    male: "Я на связи и готов к занятию. Открой доступную тему и прочитай лекцию — испытание появится после отметки «Прочитано».",
    female: "Я на связи и готова к занятию. Открой доступную тему и прочитай лекцию — испытание появится после отметки «Прочитано»."
  },
  "Лекция": {
    mood: "calm",
    male: "Я спокоен и готов помочь. В конце лекции отметь её прочитанной — за это начисляется 20 XP один раз.",
    female: "Я спокойна и готова помочь. В конце лекции отметь её прочитанной — за это начисляется 20 XP один раз."
  },
  "Тема закрыта": {
    mood: "focus",
    male: "Я сфокусирован. Сначала победи в испытании предыдущей темы — подойдёт тест или авария.",
    female: "Я сфокусирована. Сначала победи в испытании предыдущей темы — подойдёт тест или авария."
  },
  "Идёт испытание": {
    mood: "focus",
    male: "Я настроен на работу: не подсказываю правильный ответ и не останавливаю отсчёт.",
    female: "Я настроена на работу: не подсказываю правильный ответ и не останавливаю отсчёт."
  },
  "Верный ответ": {
    mood: "joy",
    male: "Я рад: ответ верный. Проверь, как изменились показатели испытания, и переходи дальше.",
    female: "Я рада: ответ верный. Проверь, как изменились показатели испытания, и переходи дальше."
  },
  "Неверный ответ": {
    mood: "surprise",
    male: "Я удивлён, но это не конец. Причина ошибки показана рядом с заданием — после попытки будет разбор.",
    female: "Я удивлена, но это не конец. Причина ошибки показана рядом с заданием — после попытки будет разбор."
  },
  "Тема пройдена": {
    mood: "joy",
    male: "Я рад: результат сохранён, и следующая тема уже доступна.",
    female: "Я рада: результат сохранён, и следующая тема уже доступна."
  },
  "Повтор завершён": {
    mood: "joy",
    male: "Я рад: повтор завершён. Уже пройденная тема не увеличивает прогресс курса второй раз.",
    female: "Я рада: повтор завершён. Уже пройденная тема не увеличивает прогресс курса второй раз."
  },
  "Курс завершён": {
    mood: "joy",
    male: "Я рад: все темы пройдены. Разборы и материалы остаются в курсе.",
    female: "Я рада: все темы пройдены. Разборы и материалы остаются в курсе."
  },
  "Попытка завершена": {
    mood: "support",
    male: "Я рядом и готов помочь. Ничего не списано — можно повторить теорию и выбрать новое испытание.",
    female: "Я рядом и готова помочь. Ничего не списано — можно повторить теорию и выбрать новое испытание."
  }
};

// Событие интерфейса → состояние персонажа.
export const EVENT_MOODS = Object.fromEntries(
  Object.entries(COMPANION_EVENTS).map(([label, item]) => [label, item.mood])
);

// Событие сервера → состояние персонажа.
export const SERVER_MOODS = {
  Idle: "calm",
  Intro: "focus",
  CorrectAnswer: "joy",
  WrongAnswer: "surprise",
  TimeWarning: "focus",
  Timeout: "surprise",
  Victory: "joy",
  Defeat: "support",
  Abandoned: "support"
};

// Состояние по событию интерфейса: «Спутник · Тема пройдена» → радость.
export function moodForLabel(label) {
  const text = String(label ?? "").replace(/^Спутник\s*·\s*/, "").trim();
  return EVENT_MOODS[text] ?? "calm";
}

// Состояние по событию сервера.
export function moodForEvent(event) {
  return SERVER_MOODS[event] ?? "calm";
}

// Подсказка по событию: мужская или женская реплика выбранного персонажа.
export function hintForLabel(label, character = DEFAULT_CHARACTER) {
  const text = String(label ?? "").replace(/^Спутник\s*·\s*/, "").trim();
  const item = COMPANION_EVENTS[text];
  if (!item) return "";
  return character === "female" ? item.female : item.male;
}

// Портрет персонажа: отдельный файл на каждое состояние.
function portrait(character, mood, label, width, height) {
  return `<img class="character-img character-portrait mascot-sprite" src="${e(moodAsset(character, mood))}" alt="${e(label)}" data-sprite width="${width}" height="${height}">`;
}

// Панель спутника: портрет, реакция на событие и подсказка по текущему экрану.
export function mascotPanel({ label = "Готов к занятию", message = null, hint = null,
  character = DEFAULT_CHARACTER, mood = null, href = "#/settings?tab=mascot",
  hrefLabel = "Настроить спутника", collapsed = false } = {}) {
  let currentLabel = label;
  let currentCharacter = character;
  let currentMood = mood ?? moodForLabel(label);
  let currentMessage = message ?? hint ?? hintForLabel(label, character);
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
      ${portrait(currentCharacter, currentMood, "Спутник", 64, 72)}
      <div>
        <p class="white" data-label>${e(label)}</p>
        <p class="small">Подсказка по экрану</p>
      </div>
    </div>
    <p class="pet-message" data-message>${e(currentMessage)}</p>
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
    if (next.label !== undefined) {
      currentLabel = next.label;
      root.querySelector("[data-label]").textContent = next.label;
    }
    // Состояние меняется вместе с событием, если его не задали явно.
    const nextCharacter = next.character ?? currentCharacter;
    const nextMood = next.mood
      ?? (next.label !== undefined ? moodForLabel(next.label) : currentMood);
    // Подсказка — реплика выбранного персонажа: меняется с событием или героем.
    let nextMessage = currentMessage;
    if (next.message !== undefined) nextMessage = next.message;
    else if (next.hint !== undefined) nextMessage = next.hint;
    else if (next.label !== undefined || nextCharacter !== currentCharacter) {
      nextMessage = hintForLabel(currentLabel, nextCharacter);
    }
    if (nextMessage !== currentMessage) {
      currentMessage = nextMessage;
      root.querySelector("[data-message]").textContent = nextMessage;
    }
    if (nextCharacter === currentCharacter && nextMood === currentMood) return;
    currentCharacter = nextCharacter;
    currentMood = nextMood;
    sprite.src = moodAsset(currentCharacter, currentMood);
    sprite.alt = `Спутник · ${MOODS[currentMood]}`;
  };
  root.setHint = text => {
    currentMessage = text;
    root.querySelector("[data-message]").textContent = text;
  };

  root.hidden = !state.mascotVisible;
  const onVisibility = () => { root.hidden = !state.mascotVisible; };
  window.addEventListener("mascot-visibility", onVisibility);
  root.dispose = () => window.removeEventListener("mascot-visibility", onVisibility);
  return root;
}

// Компактная строка спутника: портрет, подпись и ссылка «Открыть».
export function mascotMini({ label = "Спутник", character = DEFAULT_CHARACTER, mood = null,
  href = "#/settings?tab=mascot" } = {}) {
  let currentCharacter = character;
  let currentMood = mood ?? moodForLabel(label);
  const root = document.createElement("aside");
  root.className = "pet-mini";
  root.setAttribute("data-pet", "mini");
  root.innerHTML = `
    ${portrait(currentCharacter, currentMood, "Спутник", 32, 36)}
    <span data-label>${e(label)}</span>
    <a class="link action-link" href="${e(href)}">Открыть</a>`;

  const sprite = root.querySelector("[data-sprite]");
  root.update = next => {
    if (!next) return;
    if (next.label !== undefined) root.querySelector("[data-label]").textContent = next.label;
    const nextCharacter = next.character ?? currentCharacter;
    const nextMood = next.mood
      ?? (next.label !== undefined ? moodForLabel(next.label) : currentMood);
    if (nextCharacter === currentCharacter && nextMood === currentMood) return;
    currentCharacter = nextCharacter;
    currentMood = nextMood;
    sprite.src = moodAsset(currentCharacter, currentMood);
    sprite.alt = `Спутник · ${MOODS[currentMood]}`;
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
