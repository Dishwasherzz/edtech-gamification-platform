import { escapeHtml as e } from "../ui.js";

// Строка метрики: метка слева, значение жирным справа.
// Используется в theory.js (условия испытания) и demo.js (показатели).
export function metricRow({ label, value, valueClass = "" }) {
  return `
    <div class="metric-row">
      <span>${e(label)}</span>
      <strong class="${e(valueClass)}">${e(value)}</strong>
    </div>`;
}
