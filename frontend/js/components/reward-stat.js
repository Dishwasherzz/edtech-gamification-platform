import { escapeHtml as e } from "../ui.js";

// Статистика награды: метка + большое число. Используется в attempt.js и completion.js.
export function rewardStat({ label, value }) {
  return `
    <div class="reward-stat">
      <span>${e(label)}</span>
      <strong>${e(value)}</strong>
    </div>`;
}
