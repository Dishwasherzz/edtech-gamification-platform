import { api } from "../api.js";
import { state, refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName } from "../ui.js";

// Плейсхолдер картинки из макета: перечёркнутая область с подписью.
// Позже заменяется на реальное изображение курса.
const mediaPlaceholder = `<div class="media-placeholder"><span>Изображение / лого</span></div>`;

function hero({ title, description, ctaHref, ctaLabel }) {
  return `
    <div class="hero">
      <div>
        <span class="eyebrow">Курс электротехники</span>
        <h1>${e(title)}</h1>
        <p class="muted">${e(description)}</p>
        <div class="actions">
          <a class="btn btn-cta" href="${e(ctaHref)}">${e(ctaLabel)}</a>
          <a class="btn btn-outline" href="#/instructions">Инструкция</a>
        </div>
      </div>
      ${mediaPlaceholder}
    </div>`;
}

function statCard(label, value, sub, extra = "") {
  return `
    <dl class="stat-card">
      <dt>${e(label)}</dt>
      <dd>${e(value)}</dd>
      ${sub ? `<p class="stat-sub">${e(sub)}</p>` : ""}
      ${extra}
    </dl>`;
}

export async function renderDashboard() {
  if (!state.isAuth) {
    return element(hero({
      title: "Разберись в цепях. Пройди испытание.",
      description: "Изучай теорию, сражайся с боссом или устраняй аварию в виртуальном стенде. Победа открывает следующую тему.",
      ctaHref: "#/auth",
      ctaLabel: "Начать обучение"
    }));
  }

  const active = await api.active();
  const [user, courses] = await Promise.all([refreshProfile(), api.courses()]);
  const lists = await Promise.all(courses.map(course => api.topics(course.id)));

  // «Последние темы» — открытые темы из всех курсов, закрытые пропускаем.
  const recent = courses
    .flatMap((course, index) =>
      (lists[index] ?? [])
        .filter(topic => topic.status !== "Locked")
        .map(topic => ({ course, topic })))
    .slice(0, 4);

  const totals = courses.reduce((acc, course) => ({
    topics: acc.topics + course.totalTopics,
    done: acc.done + course.completedTopics
  }), { topics: 0, done: 0 });

  const overall = totals.topics ? Math.round(totals.done * 100 / totals.topics) : 0;
  const next = recent.find(({ topic }) => topic.status === "Available") ?? recent[0];

  return element(`
    ${hero({
      title: `Привет, ${user.displayName}!`,
      description: "Продолжай курс: следующая тема ждёт своего испытания.",
      ctaHref: active ? `#/attempt/${active.id}` : next ? `#/topic/${next.topic.id}` : "#/topics",
      ctaLabel: "Продолжить обучение"
    })}

    ${active ? `<div class="notice">Незавершённое испытание ждёт. <a href="#/attempt/${e(active.id)}">Вернуться к попытке</a></div>` : ""}

    <h2 class="section-title">Ваш прогресс</h2>

    <dl class="stat-grid">
      ${statCard("Прогресс курса", `${overall}%`, `${totals.done} из ${totals.topics} темы`)}
      ${statCard("Текущий разряд", String(user.rank), `от ${user.rankStartXp} XP`)}
      ${statCard("Опыт", `${user.totalXp} XP`, null, progressBar(user.rankProgressPercent, "Прогресс до следующего разряда"))}
      ${statCard("Монеты", String(user.coinsBalance), "баланс")}
    </dl>

    <div class="card">
      <h2>Последние темы</h2>
      ${recent.length ? `<div class="topic-list">${recent.map(({ course, topic }) => `
        <a class="topic-row" href="#/topic/${e(topic.id)}">
          <div>
            <h3>${e(topic.title)}</h3>
            <span class="muted">${e(course.title)} · ${topic.completedLessons}/${topic.lessonCount} лекций</span>
          </div>
          <span class="badge">${e(statusName(topic.status))}</span>
        </a>`).join("")}</div>`
      : `<p class="muted">${courses.length ? "Пока нет доступных тем." : "Пока нет опубликованных курсов."}</p>`}
    </div>
  `);
}
