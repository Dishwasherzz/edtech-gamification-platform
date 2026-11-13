import { api } from "../api.js";
import { state, refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName } from "../ui.js";
import { mascotPanel, mountMascot, hints } from "../mascot.js";

// Строка темы в маршруте курса: номер, название, статус и действие справа.
function topicRow(topic, index) {
  const status = topic.status ?? "Available";
  const locked = status === "Locked";
  const action = status === "Completed" ? "Повторить тему"
    : status === "Available" ? "Открыть тему"
      : "Недоступно";
  const hint = locked
    ? `Сначала завершите тему ${index}`
    : topic.subtitle ?? topic.description;
  const tag = locked ? "div" : "a";
  const href = locked ? "" : ` href="#/topic/${e(topic.id)}"`;
  const aside = locked
    ? `<span class="status">${e(statusName(status))}</span><span class="status">Недоступно</span>`
    : `<span class="status strong">${e(statusName(status))}</span>
       <a class="link action-link" href="#/topic/${e(topic.id)}">${e(action)}</a>`;

  return `
    <${tag}${href} class="topic-row${locked ? " locked" : ""}"${locked ? ' aria-disabled="true"' : ""}>
      <span class="num subtle">${topic.sortOrder ?? index + 1}</span>
      <div>
        <h3 class="topic-title">${e(topic.title)}</h3>
        <p class="small">${e(hint ?? "")}</p>
      </div>
      <div class="topic-aside">${aside}</div>
    </${tag}>`;
}

// Гостевая главная: механика курса, пример уровня и маршрут без аккаунта.
async function renderGuestHome() {
  const courses = await api.publicCourses().catch(() => []);
  const lists = await Promise.all(courses.map(course => api.publicTopics(course.id).catch(() => [])));
  const topics = lists.flat();

  return element(`
    <section class="landing-hero">
      <div class="hero-backdrop" aria-hidden="true"></div>
      <div class="hero-copy">
        <h1>Электротехника в испытаниях</h1>
        <p>Изучайте схемы, решайте задачи в бою с боссом и принимайте решения в аварийных сценариях.</p>
        <div class="actions">
          <a class="btn" href="#/auth">Начать обучение</a>
          <a class="link action-link" href="#/instructions">Как устроен курс</a>
        </div>
      </div>

      <div class="demo-level">
        <span class="demo-badge">Пример уровня · без входа</span>
        <h2>Постоянный ток</h2>
        <p class="muted">Вычислите ток в цепи и посмотрите, как ответ влияет на HP босса.</p>
        <div class="circuit" aria-label="Пример цепи: источник 12 вольт и сопротивление 6 ом">
          <span class="circuit-node">12 В</span>
          <span aria-hidden="true">──</span>
          <span class="circuit-node">6 Ом</span>
        </div>
        <div class="between"><span class="small">HP босса</span><span class="num">100%</span></div>
        <div class="progress"><div style="width:100%"></div></div>
        <div class="actions"><a class="btn btn-cta" href="#/demo">Открыть пример</a></div>
      </div>
    </section>

    <section class="stack">
      <div class="between">
        <h2>Маршрут курса</h2>
        <span class="small">${topics.length ? `${topics.length} темы · тест или авария в каждой` : "Темы пока не опубликованы."}</span>
      </div>
      ${topics.length ? `<div class="grid3">${topics.map(topic => `
        <section class="card">
          <h2>${e(topic.title)}</h2>
          <p class="muted">${e(topic.subtitle ?? topic.description)}</p>
          <div class="skeleton"></div>
          <div class="skeleton mid"></div>
          <div class="skeleton short"></div>
        </section>`).join("")}</div>`
        : `<div class="card"><p class="muted">Пока нет опубликованных тем.</p></div>`}
    </section>

    <p class="small">Без профиля, настроек и спутника. «Пример уровня» не требует регистрации.</p>
  `);
}

export async function renderDashboard() {
  if (!state.isAuth) return renderGuestHome();

  const [user, courses, active, rules] = await Promise.all([
    refreshProfile(),
    api.courses(),
    api.active(),
    api.instructions().catch(() => ({}))
  ]);
  const ranks = rules.rankThresholds?.length ?? 0;
  const lists = await Promise.all(courses.map(course => api.topics(course.id)));
  const course = courses[0];
  const topics = lists[0] ?? [];

  const totals = courses.reduce((acc, item) => ({
    topics: acc.topics + item.totalTopics,
    done: acc.done + item.completedTopics
  }), { topics: 0, done: 0 });
  const overall = totals.topics ? Math.floor(totals.done * 100 / totals.topics) : 0;

  // Куда продолжать: сервер знает про активную попытку, лекцию и следующую тему.
  let ctaHref = "#/topics";
  let ctaLabel = "Продолжить обучение";
  let headline = "Мой курс";
  let description = `Следующая тема: ${topics.find(topic => topic.status === "Available")?.title ?? "—"}.`;

  if (active) {
    ctaHref = `#/attempt/${active.id}`;
    description = "Незавершённое испытание ждёт. Отсчёт идёт на сервере.";
  } else if (course) {
    try {
      const journey = await api.journey(course.id);
      if (journey.destination === "Attempt" && journey.attemptId) ctaHref = `#/attempt/${journey.attemptId}`;
      else if (journey.destination === "Lesson" && journey.lessonId) ctaHref = `#/lesson/${journey.lessonId}`;
      else if (journey.destination === "Topic" && journey.topicId) ctaHref = `#/topic/${journey.topicId}`;
      else if (journey.destination === "Completed") ctaHref = `#/completion/${course.id}`;
    } catch {
      // Маршрут не обязателен: остаёмся на общем списке тем.
    }
  }
  if (overall >= 100) { ctaLabel = "Итог курса"; description = "Курс пройден. Заберите итог и посмотрите разборы."; }

  const mascot = mascotPanel({
    label: active ? "Идёт испытание" : "Готов к занятию",
    message: active
      ? "Я не подсказываю правильный ответ и не останавливаю отсчёт."
      : "Откройте доступную тему и прочитайте лекцию. Испытание появится после отметки «Прочитано».",
    hint: active ? hints.attempt : hints.dashboard,
    assetKey: [user.mascot?.assetKey, user.hero?.assetKey, user.characterSkin?.assetKey]
  });

  const root = element(`
    <header class="page-head">
      <div>
        <h1>${e(headline)}</h1>
        <p>${e(description)}</p>
      </div>
      <div class="top-actions"><a class="btn" href="${e(ctaHref)}">${e(ctaLabel)}</a></div>
    </header>

    ${active ? `<div class="notice info">Незавершённое испытание ждёт. <a class="link action-link" href="#/attempt/${e(active.id)}">Вернуться к попытке</a></div>` : ""}

    <div class="grid-main">
      <div class="stack">
        <div class="stats">
          <div class="stat"><span>Прогресс курса</span><strong>${overall} <span class="unit">%</span></strong></div>
          <div class="stat"><span>Текущий разряд</span><strong>${user.rank} <span class="unit">${ranks ? `из ${ranks}` : ""}</span></strong></div>
          <div class="stat"><span>Опыт</span><strong>${user.totalXp} <span class="unit">XP</span></strong></div>
          <div class="stat"><span>Баланс</span><strong>${user.coinsBalance} <span class="unit">монет</span></strong></div>
        </div>

        <section class="card">
          <div class="between">
            <h2>Маршрут курса</h2>
            <span class="small">Лекция → Испытание → Следующая тема</span>
          </div>
          <div class="step-line">
            <span class="selected">Лекция</span>
            <span aria-hidden="true">→</span>
            <span>Испытание</span>
            <span aria-hidden="true">→</span>
            <span>Следующая тема</span>
          </div>
          <div class="gap"></div>
          ${topics.length ? `<div class="tight">${topics.map(topicRow).join("")}</div>`
            : `<p class="muted">Пока нет опубликованных тем.</p>`}
        </section>
      </div>

      <div class="stack">
        ${user.nextRankXp ? `<section class="card">
          <h2>До следующего разряда</h2>
          <div class="between"><span>Разряд ${user.rank + 1}</span><strong class="num">${user.xpToNextRank ?? 0} XP</strong></div>
          ${progressBar(user.rankProgressPercent, "Прогресс до следующего разряда")}
          <p class="small" style="margin-top:12px">${user.totalXp} XP · следующий порог ${user.nextRankXp} XP</p>
        </section>` : `<section class="card"><h2>Высший разряд</h2><p class="muted">Достигнут максимальный разряд курса.</p></section>`}

        <div class="mascot-column"></div>
      </div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
