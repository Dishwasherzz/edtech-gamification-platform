import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName } from "../ui.js";
import { companionAssets } from "../assets.js";
import { mascotPanel, mountMascot, hints } from "../mascot.js";

function topicRow(topic, index) {
  // Закрытая тема остаётся div: клик по ней ничего не делает.
  const locked = topic.status === "Locked";
  const tag = locked ? "div" : "a";
  const href = locked ? "" : ` href="#/topic/${e(topic.id)}"`;
  const action = topic.status === "Completed" ? "Повторить тему"
    : topic.status === "Available" ? "Открыть тему"
      : "Недоступно";
  const hint = locked
    ? `Сначала завершите тему ${index}`
    : topic.subtitle ?? `${topic.completedLessons}/${topic.lessonCount} лекций прочитано`;
  const aside = locked
    ? `<span class="status">${e(statusName(topic.status))}</span><span class="status">Недоступно</span>`
    : `<span class="status strong">${e(statusName(topic.status))}</span>
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

// Полный каталог тем. Главная показывает только ближайшие, здесь — все сразу.
export async function renderTopics() {
  const [user, courses] = await Promise.all([refreshProfile(), api.courses()]);
  const lists = await Promise.all(courses.map(course => api.topics(course.id)));

  const totals = courses.reduce((acc, course) => ({
    topics: acc.topics + course.totalTopics,
    done: acc.done + course.completedTopics
  }), { topics: 0, done: 0 });
  const percent = totals.topics ? Math.floor(totals.done * 100 / totals.topics) : 0;

  const mascot = mascotPanel({
    label: "Готов к занятию",
    message: "Откройте доступную тему и прочитайте лекцию. Испытание появится после отметки «Прочитано».",
    hint: hints.dashboard,
    assetKey: companionAssets(user)
  });

  const root = element(`
    <header class="page-head">
      <div>
        <h1>Темы курса</h1>
        <p>${totals.done ? `Пройдена ${totals.done} тема из ${totals.topics}` : `Всего ${totals.topics} тем`} · ${percent}%</p>
      </div>
    </header>

    <div class="grid-main">
      <div class="stack">
        ${courses.length ? courses.map((course, index) => `
          <section class="stack">
            <div class="between">
              <h2>${e(course.title)}</h2>
              <span class="num subtle">${course.progressPercent}%</span>
            </div>
            <p class="muted">${e(course.description)}</p>
            ${progressBar(course.progressPercent, `Прогресс курса ${course.title}`)}
            <p class="small">Тем пройдено: ${course.completedTopics} из ${course.totalTopics}</p>
            <div class="tight">${lists[index].map(topicRow).join("")}</div>
          </section>`).join("")

          : `<section class="card"><p class="muted">Пока нет опубликованных курсов.</p></section>`}
      </div>

      <div class="stack"><div class="mascot-column"></div></div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
