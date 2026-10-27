import { api } from "../api.js";
import { element, escapeHtml as e, progressBar, statusName } from "../ui.js";

function topicRow(topic) {
  // Закрытая тема остаётся div: клик по ней ничего не делает.
  const tag = topic.status === "Locked" ? "div" : "a";
  const href = topic.status === "Locked" ? "" : ` href="#/topic/${e(topic.id)}"`;
  const disabled = topic.status === "Locked" ? ' aria-disabled="true"' : "";

  return `<${tag}${href}${disabled} class="topic-row ${topic.status === "Locked" ? "locked" : ""}">
    <span class="topic-number">${topic.sortOrder}</span>
    <div>
      <h3>${e(topic.title)}</h3>
      <span class="muted">${topic.completedLessons}/${topic.lessonCount} лекций прочитано</span>
    </div>
    <span class="badge">${e(statusName(topic.status))}</span>
  </${tag}>`;
}

// Полный каталог тем. Главная показывает только ближайшие, здесь — все сразу.
export async function renderTopics() {
  const courses = await api.courses();
  const lists = await Promise.all(courses.map(course => api.topics(course.id)));

  return element(`
    <h1 class="page-title">Темы</h1>

    ${courses.length ? courses.map((course, index) => `
      <article class="card">
        <div class="page-heading">
          <h2>${e(course.title)}</h2>
          <span class="muted">${course.progressPercent}%</span>
        </div>
        <p class="muted">${e(course.description)}</p>
        ${progressBar(course.progressPercent, `Прогресс курса ${course.title}`)}
        <p class="muted">Тем пройдено: ${course.completedTopics} из ${course.totalTopics}</p>
        <div class="topic-list">${lists[index].map(topicRow).join("")}</div>
      </article>`).join("")

      : `<div class="card"><p class="muted">Пока нет опубликованных курсов.</p></div>`}
  `);
}