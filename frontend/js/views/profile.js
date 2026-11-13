import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName, dateShort, shortModeName } from "../ui.js";
import { mascotPanel, mountMascot, hints } from "../mascot.js";
import { assetUrl } from "../assets.js";

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
          const reward = attempt.xp || attempt.coins ? `+${attempt.xp} XP · +${attempt.coins} монет` : "—";
          return `
            <tr>
              <td>
                <a class="link" href="#/attempt/${e(attempt.id)}">${e(attempt.topicTitle)}</a>
                <p class="small">${e(shortModeName(attempt.mode))} · ${e(dateShort(attempt.startedAt))}</p>
              </td>
              <td><span class="status${attempt.status === "Passed" ? " strong" : ""}">${e(result)}</span></td>
              <td class="num">${e(reward)}</td>
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

  const mascot = mascotPanel({
    label: active ? "Идёт испытание" : "Готов к занятию",
    message: active
      ? "Я не подсказываю правильный ответ и не останавливаю отсчёт."
      : "Откройте доступную тему и прочитайте лекцию. Испытание появится после отметки «Прочитано».",
    hint: active ? hints.attempt : hints.dashboard,
    assetKey: [user.mascot?.assetKey, user.hero?.assetKey, user.characterSkin?.assetKey]
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
          <div class="profile-head">
            <span class="profile-art ${user.hero?.key === "ampere" ? "female" : "male"}">
              <span class="sprite-img"${heroImage ? ` style="background-image:url('${heroImage}')"` : ""}></span>
            </span>
            <div class="profile-identity">
              <h2>${e(user.displayName)}</h2>
              <p class="small">${e(user.email ?? "")}</p>
              <p class="small">Разряд ${user.rank} · ${e(user.hero?.name ?? "")}</p>
            </div>
            <div class="stats plain">
              <div class="stat"><span>Прогресс курса</span><strong>${percent} <span class="unit">%</span></strong></div>
              <div class="stat"><span>Текущий разряд</span><strong>${user.rank} <span class="unit">${ranks ? `из ${ranks}` : ""}</span></strong></div>
              <div class="stat"><span>Опыт</span><strong>${user.totalXp} <span class="unit">XP</span></strong></div>
              <div class="stat"><span>Баланс</span><strong>${user.coinsBalance} <span class="unit">монет</span></strong></div>
            </div>
          </div>
          ${progressBar(percent, "Прогресс курса")}
          <p class="small" style="margin-top:12px">${totals.done} из ${totals.topics} тем пройдено. Победа в любом испытании засчитывает тему один раз, поражение ничего не списывает.</p>
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

  mountMascot(root.querySelector(".mascot-column"), mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
