import { escapeHtml as e } from "../ui.js";
import { shortModeName, dateShort } from "../ui.js";
import { buttonLink } from "./button.js";

// Таблица истории попыток: тема, результат, награда.
// history — массив попыток с полями: id, topicTitle, mode, startedAt, status, xp, coins.
export function historyTable({ history = [] } = {}) {
  if (!history.length) {
    return `<p class="muted">Пока нет завершенных попыток.</p>
      <div class="actions">${buttonLink({ href: "#/topics", label: "Открыть первую тему", kind: "outline" })}</div>`;
  }
  const rows = history.map(attempt => {
    const result = attempt.status === "Passed" ? "Победа"
      : attempt.status === "Failed" ? "Поражение"
        : attempt.status === "Abandoned" ? "Прервана" : "В процессе";
    const reward = attempt.xp || attempt.coins
      ? `+${attempt.xp} XP<br>+${attempt.coins} монет`
      : "—";
    return `
      <tr>
        <td>
          <a class="link" href="#/attempt/${e(attempt.id)}">${e(attempt.topicTitle)}</a><br>
          <span class="small">${e(shortModeName(attempt.mode))} · ${e(dateShort(attempt.startedAt))}</span>
        </td>
        <td>${e(result)}</td>
        <td class="num">${reward}</td>
      </tr>`;
  }).join("");
  return `
    <table class="history-table">
      <thead><tr><th>Тема и испытание</th><th>Результат</th><th>Награда</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
