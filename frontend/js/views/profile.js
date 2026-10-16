import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName, modeName, date } from "../ui.js";

export async function renderProfile(page = 1) {
  await api.active();
  const [user, history] = await Promise.all([refreshProfile(), api.history(page)]);
  return element(`<h1>Мой прогресс</h1><div class="card"><div class="avatar" aria-hidden="true">⚡</div><h2>${e(user.displayName)}</h2>
    <p>Разряд ${user.rank} · ${user.totalXp} XP · ${user.coinsBalance} монет</p>${progressBar(user.rankProgressPercent, "До следующего разряда")}
    <p class="muted">${user.nextRankXp === null ? "Достигнут максимальный разряд" : `До следующего разряда: ${user.nextRankXp - user.totalXp} XP`}</p></div>
    <h2>История испытаний</h2>${history.length ? history.map(attempt => `<a class="card history-row" href="#/attempt/${e(attempt.id)}"><div><h3>${e(attempt.topicTitle)}</h3><p class="muted">${e(modeName(attempt.mode))} · ${e(date(attempt.startedAt))}</p></div><div><span class="badge">${e(statusName(attempt.status))}</span><p>${attempt.xp} XP · ${attempt.coins} монет</p></div></a>`).join("") : '<p class="muted">На этой странице пока нет попыток.</p>'}
    <div class="actions">${page > 1 ? `<a class="btn secondary" href="#/profile?page=${page - 1}">Назад</a>` : ""}${history.length === 20 ? `<a class="btn secondary" href="#/profile?page=${page + 1}">Дальше</a>` : ""}</div>`);
}
