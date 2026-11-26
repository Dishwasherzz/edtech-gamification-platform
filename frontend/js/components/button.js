import { escapeHtml as e } from "../ui.js";

// Внутренняя обводка кнопки + подпись: повторяющийся паттерн во всех вью.
// Используется вместо развёрнутой HTML-строки прямо в шаблонах.
export function buttonEdge(label) {
  return `<span class="button-edge" aria-hidden="true"></span><span class="button-label">${e(label)}</span>`;
}

// Кнопка-ссылка с обводкой: href, подклассы и подпись.
export function buttonLink({ href, label, kind = "", disabled = false }) {
  const cls = ["button", kind, disabled ? "is-disabled" : ""].filter(Boolean).join(" ");
  const attr = disabled ? " disabled" : "";
  return `<a class="${cls}" href="${e(href)}"${attr}>${buttonEdge(label)}</a>`;
}

// Кнопка-действие (button type="button") с обводкой и подписью.
export function buttonAction({ label, kind = "", disabled = false, dataset = {}, type = "button" }) {
  const cls = ["button", kind, disabled ? "is-disabled" : ""].filter(Boolean).join(" ");
  const attr = disabled ? " disabled" : "";
  const dataAttrs = Object.entries(dataset).map(([k, v]) => ` data-${k}="${e(v)}"`).join("");
  return `<button type="${type}" class="${cls}"${attr}${dataAttrs}>${buttonEdge(label)}</button>`;
}
