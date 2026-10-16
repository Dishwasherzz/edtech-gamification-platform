import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, markdown, showError, modeName } from "../ui.js";

export async function renderTopic(id) {
  const topic = await api.topic(id);
  const [topics, active, lessons] = await Promise.all([api.topics(topic.courseId), api.active(), Promise.all(topic.lessons.map(lesson => api.lesson(lesson.id)))]);
  const current = topics.find(item => item.id === id);
  const root = element(`<a class="back-link" href="#/">← Все темы</a><h1>${e(topic.title)}</h1><p class="muted">${e(topic.description)}</p>
    <div class="card"><h2>Теория</h2>${lessons.map(lesson => `<a class="topic-row" href="#/lesson/${e(lesson.id)}"><span>${e(lesson.title)}</span><span class="badge">${lesson.completedAt ? "Прочитано" : "Читать"}</span></a>`).join("") || '<p>Лекции пока не опубликованы.</p>'}</div>
    <h2>Выбери испытание</h2><p class="muted">Победа в любом режиме засчитывает тему пройденной.</p>
    ${!current.isRead ? '<div class="notice">Сначала прочитай лекцию и нажми «Прочитано».</div>' : ""}
    ${active ? `<div class="notice">Есть активное испытание. <a href="#/attempt/${e(active.id)}">Продолжить</a></div>` : ""}
    <p data-error class="error" role="alert" hidden></p><div class="mode-grid">${topic.assessments.map(assessment => `<article class="card"><h3>${e(modeName(assessment.mode))}</h3>
      <p class="muted">${assessment.mode === "Boss" ? "7 расчётных вопросов. 60 секунд на вопрос. Победи за 5 верных ответов; третья ошибка завершает бой." : "4 шага в виртуальном стенде. 60 секунд на всё. Верно: +10 секунд. Неверно: −10 секунд. Три ошибки — поражение."}</p>
      <button class="btn" data-start="${e(assessment.id)}" ${!current.isRead || (active && active.assessmentId !== assessment.id) ? "disabled" : ""}>${active?.assessmentId === assessment.id ? "Продолжить" : assessment.mode === "Boss" ? "В бой" : "Выбрать аварию"}</button></article>`).join("") || '<div class="card">Испытания ещё не опубликованы.</div>'}</div>`);
  root.querySelectorAll("[data-start]").forEach(button => button.onclick = async () => {
    button.disabled = true;
    try { const attempt = await api.start(button.dataset.start); window.location.hash = `#/attempt/${attempt.id}`; }
    catch (error) { showError(root, error); button.disabled = false; }
  });
  return root;
}

export async function renderLesson(id) {
  const [lesson, rules] = await Promise.all([api.lesson(id), api.instructions()]);
  const root = element(`<a class="back-link" href="#/topic/${e(lesson.topicId)}">← К теме и испытаниям</a><h1>${e(lesson.title)}</h1>
    <article class="card lesson-content">${markdown(lesson.contentMarkdown)}</article><p data-error class="error" role="alert" hidden></p>
    <div class="actions"><button class="btn" data-complete ${lesson.completedAt && lesson.awardedXp > 0 ? "disabled" : ""}>${lesson.completedAt && lesson.awardedXp > 0 ? "Прочитано" : lesson.completedAt ? `Подтвердить прочтение · +${rules.lessonXp} XP` : `Прочитано · +${rules.lessonXp} XP`}</button>
    <a class="btn secondary" href="#/topic/${e(lesson.topicId)}">К испытаниям</a></div><p class="success" data-reward role="status"></p>`);
  const button = root.querySelector("[data-complete]");
  button.onclick = async () => {
    button.disabled = true;
    try {
      const result = await api.complete(id);
      await refreshProfile();
      button.textContent = "Прочитано";
      root.querySelector("[data-reward]").textContent = result.xpAwarded ? `Получено ${result.xpAwarded} XP. Теперь можно пройти испытание.` : "Отметка уже сохранена.";
    } catch (error) { showError(root, error); button.disabled = false; }
  };
  return root;
}
