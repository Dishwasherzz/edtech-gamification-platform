import { api } from "../api.js";
import { state, refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName, modeName } from "../ui.js";

export async function renderDashboard() {
  if (!state.isAuth) return element(`<div class="card hero"><span class="eyebrow">ЭЛЕКТРОТЕХНИКА · ОБУЧЕНИЕ ЧЕРЕЗ ИГРУ</span><h1>Разберись в цепях.<br>Пройди испытание.</h1>
    <p>Изучай теорию, сражайся с боссом или устраняй аварию в виртуальном стенде. Победа открывает следующую тему.</p><a class="btn" href="#/auth">Начать обучение</a></div>`);
  await refreshProfile();
  const [courses, active] = await Promise.all([api.courses(), api.active()]);
  const lists = await Promise.all(courses.map(course => api.topics(course.id)));
  return element(`<div class="page-heading"><div><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>Привет, ${e(state.user.displayName)}!</h1></div><a class="btn secondary" href="#/instructions">Как играть</a></div>
    ${active ? `<div class="notice">Есть незавершённое испытание: ${e(modeName(active.mode))}. <a href="#/attempt/${e(active.id)}">Продолжить</a></div>` : ""}
    <div class="stats"><div class="card"><span class="muted">Разряд</span><strong>${state.user.rank}</strong></div><div class="card"><span class="muted">Опыт</span><strong>${state.user.totalXp} XP</strong></div><div class="card"><span class="muted">Монеты</span><strong>${state.user.coinsBalance}</strong></div></div>
    ${courses.length ? courses.map((course, i) => `<article class="card"><div class="page-heading"><h2>${e(course.title)}</h2><span>${course.progressPercent}%</span></div>
      <p class="muted">${e(course.description)}</p>${progressBar(course.progressPercent, "Прогресс курса")}<p class="muted">Тем пройдено: ${course.completedTopics} из ${course.totalTopics}</p>
      ${course.progressPercent === 100 ? '<p class="success">Курс пройден! Испытания доступны для повторения.</p>' : ""}
      <div class="topic-list">${lists[i].map((topic, index) => `<${topic.status === "Locked" ? "div" : "a"} ${topic.status === "Locked" ? 'aria-disabled="true"' : `href="#/topic/${e(topic.id)}"`} class="topic-row ${topic.status === "Locked" ? "locked" : ""}"><span class="topic-number">${index + 1}</span><div><h3>${e(topic.title)}</h3><span class="muted">${topic.completedLessons}/${topic.lessonCount} лекций прочитано</span></div><span class="badge">${e(statusName(topic.status))}</span></${topic.status === "Locked" ? "div" : "a"}>`).join("")}</div></article>`).join("") : '<div class="card">Пока нет опубликованных курсов.</div>'}`);
}
