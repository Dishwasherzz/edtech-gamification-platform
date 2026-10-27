import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName, modeName, date } from "../ui.js";

const bannerPlaceholder = `
  <div class="media-placeholder profile-banner">
    <span>Баннер профиля</span>
  </div>`;

function statCard(label, value, sub, extra = "") {
  return `
    <dl class="stat-card">
      <dt>${e(label)}</dt>
      <dd>${e(value)}</dd>
      ${sub ? `<p class="stat-sub">${e(sub)}</p>` : ""}
      ${extra}
    </dl>`;
}

export async function renderProfile(page = 1) {
  await api.active();
  const [user, history, courses] = await Promise.all([
    refreshProfile(),
    api.history(page),
    api.courses()
  ]);

  const totals = courses.reduce((acc, course) => ({
    topics: acc.topics + course.totalTopics,
    done: acc.done + course.completedTopics
  }), { topics: 0, done: 0 });
  const percent = totals.topics ? Math.round(totals.done * 100 / totals.topics) : 0;

  const nextCourse = courses.find(course => course.progressPercent < 100);

  return element(`
    <h1 class="page-title">Профиль</h1>

    ${bannerPlaceholder}

    <div class="profile-head">
      <div class="avatar-circle" aria-hidden="true">⚡</div>
      <div>
        <h2>${e(user.displayName)}</h2>
        <p class="muted">Текущий разряд: ${user.rank}</p>
      </div>
    </div>

    <dl class="stat-grid">
      ${statCard("Прогресс курса", `${percent}%`, `${totals.done} из ${totals.topics} тем`)}
      ${statCard("Текущий разряд", String(user.rank), `от ${user.rankStartXp} XP`)}
      ${statCard("Опыт", `${user.totalXp} XP`, null, progressBar(user.rankProgressPercent, "Прогресс до следующего разряда"))}
      ${statCard("Монеты", String(user.coinsBalance), "баланс")}
    </dl>

    <div class="actions" style="margin-bottom: 30px">
      <a class="btn btn-outline" href="#/settings">Настройки</a>
      <a class="btn btn-cta" href="${nextCourse ? "#/" : "#/instructions"}">Продолжить обучение</a>
    </div>

    <div class="split-2">
      <article class="card">
        <h2>Прогресс курса</h2>
        <p class="muted">${totals.done} из ${totals.topics} тем пройдено · ${percent}%</p>
        ${progressBar(percent, "Прогресс курса")}
        <p class="muted">Победа в любом испытании засчитывает тему один раз.</p>
      </article>

      <article class="card">
        <h2>История испытаний</h2>
        ${history.length ? `<div class="topic-list">${history.map(attempt => `
          <a class="history-row topic-row" href="#/attempt/${e(attempt.id)}">
            <div>
              <h3>${e(attempt.topicTitle)}</h3>
              <p class="muted">${e(modeName(attempt.mode))} · ${e(date(attempt.startedAt))}</p>
            </div>
            <div style="text-align:right">
              <span class="badge">${e(statusName(attempt.status))}</span>
              <p class="muted">${attempt.xp} XP · ${attempt.coins} монет</p>
            </div>
          </a>`).join("")}</div>`
        : `<p class="muted">Попыток пока нет.</p>`}

        ${page > 1 || history.length === 20 ? `<div class="actions">
          ${page > 1 ? `<a class="btn btn-outline" href="#/profile?page=${page - 1}">Назад</a>` : ""}
          ${history.length === 20 ? `<a class="btn btn-outline" href="#/profile?page=${page + 1}">Дальше</a>` : ""}
        </div>` : ""}
      </article>
    </div>

    <div class="notice">Разряд и баланс сохраняются в профиле. Интерфейс магазина и выбора внешнего вида ещё в разработке.</div>
  `);
}
