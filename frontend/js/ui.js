import { escapeHtml as escape } from "./markdown.js";

export { escapeHtml, markdown } from "./markdown.js";

export function element(html) { const root = document.createElement("section"); root.innerHTML = html; return root; }

// Блок ошибки в стиле макета: розовая полоса слева, заголовок и текст.
export function errorNotice(title = "Не удалось выполнить действие") {
  return `<div class="notice error" data-error-box hidden>
    <h3>${escape(title)}</h3>
    <p data-error role="alert" hidden></p>
  </div>`;
}
export function showError(root, error) {
  const target = root.querySelector("[data-error]");
  if (!target) return;
  target.textContent = error.message || String(error);
  target.hidden = false;
  const box = target.closest("[data-error-box]");
  if (box) box.hidden = false;
}
export function clearError(root) {
  const target = root.querySelector("[data-error]");
  if (!target) return;
  target.textContent = "";
  target.hidden = true;
  const box = target.closest("[data-error-box]");
  if (box) box.hidden = true;
}
export function progressBar(percent, label) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="bar" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><div class="bar-fill" style="width:${value}%"></div></div>`;
}

// Русские склонения: plural(3, "тема", "темы", "тем").
export function plural(count, one, few, many) {
  const abs = Math.abs(Number(count) || 0);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
export const topicsWord = count => plural(count, "тема", "темы", "тем");
export const lessonsWord = count => plural(count, "лекция", "лекции", "лекций");
export const coinsWord = count => plural(count, "монета", "монеты", "монет");

// Модальное окно подтверждения. Возвращает значение нажатой кнопки.
export function askDialog({ title, body, actions = [{ label: "ОК", value: "ok", kind: "button" }] }) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    const form = document.createElement("form");
    form.method = "dialog";
    // Класс .modal-box в макете отсутствует; форма наследует стили от .modal.
    form.innerHTML = `<h2>${escape(title)}</h2><div class="modal-body">${body}</div>`;
    const row = document.createElement("div");
    row.className = "actions";
    for (const action of actions) {
      const button = document.createElement("button");
      button.className = `button ${action.kind ?? ""}`.trim();
      button.value = action.value;
      button.textContent = action.label;
      row.append(button);
    }
    form.append(row);
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener("close", () => { dialog.remove(); resolve(dialog.returnValue); });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else { dialog.setAttribute("open", ""); resolve("cancel"); }
  });
}

export const statusName = status => ({ Completed: "Пройдена", Available: "Доступна", Locked: "Закрыта", Active: "В процессе", Passed: "Победа", Failed: "Поражение", Abandoned: "Попытка прекращена" })[status] || status;
export const modeName = mode => mode === "Boss" ? "Тест · Бой с боссом" : "Авария · QTE";
export const shortModeName = mode => mode === "Boss" ? "Босс-тест" : "Авария (QTE)";
export const date = value => value ? new Date(value).toLocaleString("ru-RU") : "—";
export const dateShort = value => value ? new Date(value).toLocaleDateString("ru-RU") : "—";

// Заголовок и подпись события маскота — из текста реакции сервера.
export const mascotEventName = event => ({
  Idle: "Готов к занятию",
  Intro: "Знакомится с заданием",
  CorrectAnswer: "Верный ответ",
  WrongAnswer: "Неверный ответ",
  TimeWarning: "Внимание, время",
  Timeout: "Время вышло",
  Victory: "Тема пройдена",
  Defeat: "Попытка завершена",
  Abandoned: "Попытка завершена"
})[event] || "Спутник";
