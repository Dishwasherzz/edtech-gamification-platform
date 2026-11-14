import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName, dateShort, shortModeName } from "../ui.js";
import { mascotMini } from "../mascot.js";
import { assetUrl, companionAssets } from "../assets.js";

function historyTable(history) {
  if (!history.length) {
    return `<p class="muted">Пока нет завершенных попыток.</p>
      <div class="actions"><a class="btn btn-outline" href="#/topics">Открыть первую тему</a></div>`;
  }
  return `
    <table class="history-table">
      <thead><tr><th>Тема и испытание</th><th>Результат</th><th>Награда</th></tr></thead>
      <tbody>
        ${history.map(attempt => {
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
        }).join("")}
      </tbody>
    </table>`;
}

export async function renderProfile(page = 1) {
  const active = await api.active();
  const [user, history, courses, rules] = await Promise.all([
    refreshProfile(),
    api.history(page),
    api.courses(),
    api.instructions().catch(() => ({}))
  ]);
  const ranks = rules.rankThresholds?.length ?? 0;

  const totals = courses.reduce((acc, course) => ({
    topics: acc.topics + course.totalTopics,
    done: acc.done + course.completedTopics
  }), { topics: 0, done: 0 });
  const percent = totals.topics ? Math.floor(totals.done * 100 / totals.topics) : 0;
  const nextCourse = courses.find(course => course.progressPercent < 100);

  const mascot = mascotMini({
    label: active ? "Спутник · Идёт испытание" : "Спутник · Готов к занятию",
    assetKey: companionAssets(user)
  });
  const heroImage = assetUrl(user.hero?.assetKey);

  const root = element(`
    <header class="page-head">
      <div>
        <h1>Профиль</h1>
        <p>${e(user.displayName)}${user.email ? ` · ${e(user.email)}` : ""}</p>
      </div>
      <div class="top-actions">
        <a class="btn btn-outline" href="#/settings">Настройки профиля</a>
        <a class="btn" href="${nextCourse ? "#/" : "#/instructions"}">Продолжить обучение</a>
      </div>
    </header>

    <div class="grid-main">
      <div class="stack">
        <section class="card">
          <div class="row">
            <span class="profile-art ${user.hero?.key === "ampere" ? "female" : "male"}">
              <span class="sprite-img"${heroImage ? ` style="background-image:url('${heroImage}')"` : ""}></span>
            </span>
            <div>
              <h2 style="margin-bottom:4px">${e(user.displayName)}</h2>
              <p class="small">${e(user.email ?? "")}</p>
            </div>
          </div>
          <div class="gap"></div>
          <div class="stats">
            <div class="stat"><span>Прогресс курса</span><strong>${percent} <span class="unit">%</span></strong></div>
            <div class="stat"><span>Текущий разряд</span><strong>${user.rank} <span class="unit">${ranks ? `из ${ranks}` : ""}</span></strong></div>
            <div class="stat"><span>Опыт</span><strong>${user.totalXp} <span class="unit">XP</span></strong></div>
            <div class="stat"><span>Баланс</span><strong>${user.coinsBalance} <span class="unit">монет</span></strong></div>
          </div>
        </section>

        <section class="card">
          <h2>История испытаний</h2>
          ${historyTable(history)}
          ${page > 1 || history.length === 20 ? `<div class="actions">
            ${page > 1 ? `<a class="btn btn-outline" href="#/profile?page=${page - 1}">Назад</a>` : ""}
            ${history.length === 20 ? `<a class="btn btn-outline" href="#/profile?page=${page + 1}">Дальше</a>` : ""}
          </div>` : ""}
        </section>
      </div>

      <div class="stack">
        ${user.nextRankXp ? `<section class="card">
          <h2>До следующего разряда</h2>
          <div class="between"><span>Разряд ${user.rank + 1}</span><strong class="num">${user.xpToNextRank ?? 0} XP</strong></div>
          ${progressBar(user.rankProgressPercent, "Прогресс до следующего разряда")}
          <p class="small" style="margin-top:12px">${user.totalXp} XP · следующий порог ${user.nextRankXp} XP</p>
        </section>` : ""}

        <div class="mascot-column"></div>
      </div>
    </div>
  `);

  const column = root.querySelector(".mascot-column");
  column.replaceChildren(mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
