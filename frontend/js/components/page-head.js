import { escapeHtml as e } from "../ui.js";
import { buttonLink } from "./button.js";

// Заголовок страницы: eyebrow (метка сверху), h1, необязательное описание и блок действий справа.
// pageHead({ title, description?, actions?, eyebrow?, className? })
export function pageHead({ title, description, actions = "", eyebrow, className }) {
  return `
    <header class="page-head${className ? " " + e(className) : ""}">
      <div>
        ${eyebrow ? `<span class="eyebrow">${e(eyebrow)}</span>` : ""}
        <h1>${e(title)}</h1>
        ${description ? `<p>${e(description)}</p>` : ""}
      </div>
      ${actions ? `<div class="top-actions">${actions}</div>` : ""}
    </header>`;
}
