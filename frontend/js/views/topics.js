import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName } from "../ui.js";
import { topicRow } from "../components/topic-row.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { companionCharacter } from "../assets.js";
import { mascotPanel, mountMascot } from "../mascot.js";

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
    character: companionCharacter(user)
  });

  const root = element(`
    ${pageHead({
      title: "Темы курса",
      description: `${totals.done ? `Пройдена ${totals.done} тема из ${totals.topics}` : `Всего ${totals.topics} тем`} · ${percent}%`
    })}

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

          : panel({ title: "", children: `<p class="muted">Пока нет опубликованных тем.</p>` })}
      </div>

      <div class="stack"><div class="mascot-column"></div></div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
