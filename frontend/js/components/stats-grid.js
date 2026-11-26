import { escapeHtml as e } from "../ui.js";

// Сетка статистики: массив { label, value, unit? }.
// Используется в dashboard.js и profile.js.
export function statsGrid({ items } = { items: [] }) {
  return `
    <div class="stats">
      ${items.map(item => `
        <div class="stat">
          <span>${e(item.label)}</span>
          <strong>${e(item.value)} <span class="unit">${e(item.unit ?? "")}</span></strong>
        </div>`).join("")}
    </div>`;
}
