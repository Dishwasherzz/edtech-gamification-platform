import { escapeHtml as e } from "../ui.js";

// Контейнер панели: заголовок + содержимое.
// panel({ title?, children, className? })
export function panel({ title, children = "", className = "" }) {
  return `
    <section class="panel${className ? " " + e(className) : ""}">
      ${title ? `<h2>${e(title)}</h2>` : ""}
      ${children}
    </section>`;
}
