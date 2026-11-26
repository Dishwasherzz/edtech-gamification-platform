import { escapeHtml as e } from "../ui.js";

// Контейнер группы действий: кнопки и ссылки.
// actions({ children }) — children — уже готовая HTML-строка кнопок/ссылок.
export function actions({ children = "" }) {
  return `<div class="actions">${children}</div>`;
}
