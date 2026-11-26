import { api } from "../api.js";
import { state, refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName } from "../ui.js";
import { topicRow } from "../components/topic-row.js";
import { statsGrid } from "../components/stats-grid.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { actions } from "../components/actions.js";
import { buttonLink } from "../components/button.js";
import { companionCharacter } from "../assets.js";
import { mascotPanel, mountMascot } from "../mascot.js";

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
          ${buttonLink({ href: "#/auth", label: "Начать обучение" })}
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
        <div class="bar"><div class="bar-fill" style="width:100%"></div></div>
        <div class="actions">${buttonLink({ href: "#/demo", label: "Открыть пример", kind: "blue" })}</div>
      </div>
    </section>

    <section class="stack">
      <div class="between">
        <h2>Маршрут курса</h2>
        <span class="small">${topics.length ? `${topics.length} темы · тест или авария в каждой` : "Темы пока не опубликованы."}</span>
      </div>
      ${topics.length ? `<div class="grid3">${topics.map(topic => panel({
        title: topic.title,
        children: `
          <p class="muted">${e(topic.subtitle ?? topic.description)}</p>
          <div class="skeleton"></div>
          <div class="skeleton mid"></div>
          <div class="skeleton short"></div>
        `
      })).join("")}</div>` : panel({ children: `<p class="muted">Пока нет опубликованных тем.</p>` })}
    </section>

    <p class="small">Без профиля, настроек и спутника. «Пример уровня» не требует регистрации.</p>
  `);
}

// Гость открыл личный раздел: главная страница под затемнением и входом.
export async function renderGuestGate() {
  const view = await renderGuestHome();
  view.append(element(`
    <div class="modal-layer">
      <section class="modal">
        <h2>Войдите, чтобы начать курс</h2>
        <p>Лекции, испытания и личный прогресс доступны после входа. Пример уровня можно посмотреть без аккаунта.</p>
        <div class="actions">
          ${buttonLink({ href: "#/auth", label: "Войти" })}
          ${buttonLink({ href: "#/auth/register", label: "Регистрация", kind: "outline" })}
          <a class="link action-link" href="#/demo">Остаться в демо</a>
        </div>
      </section>
    </div>
  `));
  return view;
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

  // Событие и подсказка связаны: панель сама берёт настроение и реплику персонажа.
  const mascot = mascotPanel({
    label: active ? "Идёт испытание" : "Готов к занятию",
    character: companionCharacter(user)
  });

  const root = element(`
    ${pageHead({ title: headline, description, actions: buttonLink({ href: ctaHref, label: ctaLabel }) })}

    ${active ? `<div class="notice info">Незавершённое испытание ждёт. <a class="link action-link" href="#/attempt/${e(active.id)}">Вернуться к попытке</a></div>` : ""}

    <div class="grid-main">
      <div class="stack">
        ${statsGrid({
          items: [
            { label: "Прогресс курса", value: overall, unit: "%" },
            { label: "Текущий разряд", value: user.rank, unit: ranks ? `из ${ranks}` : "" },
            { label: "Опыт", value: user.totalXp, unit: "XP" },
            { label: "Баланс", value: user.coinsBalance, unit: "монет" }
          ]
        })}

        ${panel({
          children: `
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
          `
        })}
      </div>

      <div class="stack">
        ${user.nextRankXp ? panel({
          title: "До следующего разряда",
          children: `
            <div class="between"><span>Разряд ${user.rank + 1}</span><strong class="num">${user.xpToNextRank ?? 0} XP</strong></div>
            <div class="bar"><div class="bar-fill" style="width:${user.rankProgressPercent ?? 0}%"></div></div>
            <p class="small" style="margin-top:12px">${user.totalXp} XP · следующий порог ${user.nextRankXp} XP</p>
          `
        }) : panel({ title: "Высший разряд", children: `<p class="muted">Достигнут максимальный разряд курса.</p>` })}

        <div class="mascot-column"></div>
      </div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
