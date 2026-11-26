import { escapeHtml as e } from "../ui.js";

// Кнопка варианта ответа: используется в attempt.js (боевая сетка) и demo.js.
// option: { id, text, isDisabled, correct? }
// disabled — отправка в процессе или попытка неактивна.
export function answerButton({ option, disabled = false }) {
  const cls = ["answer", option.isDisabled ? "disabled" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ");
  const attr = disabled || option.isDisabled ? " disabled" : "";
  return `<button class="${cls}" data-option="${e(option.id)}"${attr}>${e(option.text)}${option.isDisabled ? " · уже выбрано" : ""}</button>`;
}
