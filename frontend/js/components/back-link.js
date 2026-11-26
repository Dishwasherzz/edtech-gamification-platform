import { escapeHtml as e } from "../ui.js";

// Ссылка «Назад» с подчёркиванием: используется почти на каждой странице.
export function backLink({ href = "#/", label = "Назад" } = {}) {
  return `<a class="back-link" href="${e(href)}">← ${e(label)}</a>`;
}
