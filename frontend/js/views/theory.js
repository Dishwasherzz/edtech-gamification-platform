import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, markdown, showError, modeName, askDialog } from "../ui.js";
import { mascotPanel, mountMascot, hints } from "../mascot.js";

// Экран закрытой темы: прямой переход не выдаёт доступ.
async function lockedTopic(topic, previous, courseTitle) {
  const user = await refreshProfile().catch(() => null);
  const mascot = user ? mascotPanel({
    label: "Тема закрыта",
    message: "Сначала победите в испытании предыдущей темы. Подойдёт тест или авария.",
    hint: hints.locked,
    assetKey: [user.mascot?.assetKey, user.hero?.assetKey, user.characterSkin?.assetKey]
  }) : null;

  const root = element(`
    <header class="page-head">
      <div>
        <h1>${e(topic?.title ?? "Тема закрыта")}</h1>
        <p>${e(courseTitle ?? "")}</p>
      </div>
    </header>

    <div class="grid-main">
      <div class="stack">
        <section class="card">
          <span class="eyebrow">Тема закрыта</span>
          <h2>Сначала победите в предыдущей теме</h2>
          <p class="muted">Чтобы открыть эту тему, победите в тесте или аварии по теме${previous ? ` «${e(previous.title)}»` : " перед ней"}. Подойдёт любой тип испытания.</p>
          <div class="actions">
            ${previous ? `<a class="btn" href="#/topic/${e(previous.id)}">Открыть предыдущую тему</a>` : ""}
            <a class="btn btn-outline" href="#/topics">Все темы</a>
          </div>
        </section>
      </div>

      <div class="stack"><div class="mascot-column"></div></div>
    </div>
  `);

  if (mascot) {
    mountMascot(root.querySelector(".mascot-column"), mascot);
    root.dispose = () => mascot.dispose?.();
  }
  return root;
}

export async function renderTopic(id) {
  let topic;
  try {
    topic = await api.topic(id);
  } catch (error) {
    if (error.code !== "TopicLocked") throw error;
    // Тема закрыта: находим её в каталоге, чтобы показать предыдущую.
    const courses = await api.courses();
    const lists = await Promise.all(courses.map(course => api.topics(course.id)));
    let found = null;
    let previous = null;
    let courseTitle = null;
    for (let index = 0; index < courses.length; index++) {
      const position = lists[index].findIndex(item => item.id === id);
      if (position < 0) continue;
      found = lists[index][position];
      previous = lists[index][position - 1] ?? null;
      courseTitle = courses[index].title;
    }
    return lockedTopic(found, previous, courseTitle);
  }

  const [user, topics, active, lessons] = await Promise.all([
    refreshProfile(),
    api.topics(topic.courseId),
    api.active(),
    Promise.all(topic.lessons.map(lesson => api.lesson(lesson.id)))
  ]);
  const current = topics.find(item => item.id === id);
  const position = topics.findIndex(item => item.id === id);
  const nextTopic = topics[position + 1] ?? null;

  // На странице темы показываем первую лекцию целиком, остальные — списком.
  const lesson = lessons.find(item => !item.completedAt) ?? lessons[0] ?? null;
  const read = Boolean(current?.isRead);

  const mascot = mascotPanel({
    label: read ? "Лекция" : "Готов к занятию",
    message: read
      ? "Лекция прочитана. Теперь доступны тест и авария."
      : "Откройте доступную тему и прочитайте лекцию. Испытание появится после отметки «Прочитано».",
    hint: hints.lesson,
    assetKey: [user.mascot?.assetKey, user.hero?.assetKey, user.characterSkin?.assetKey]
  });

  const root = element(`
    <a class="back-link" href="#/topics">← Все темы</a>

    <header class="page-head">
      <div>
        <h1>${e(topic.title)}</h1>
        <p>Тема ${position + 1} из ${topics.length}${e(topic.subtitle ? ` · ${topic.subtitle}` : "")}</p>
      </div>
    </header>

    <div class="step-line">
      <span class="selected">Лекция</span>
      <span aria-hidden="true">→</span>
      <span>Испытание</span>
      <span aria-hidden="true">→</span>
      <span>Следующая тема</span>
    </div>

    <div class="gap"></div>

    <div class="grid-main">
      <div class="stack">
        ${lesson ? `<section class="card">
          <div class="between">
            <h2>${e(lesson.title)}</h2>
            <span class="small">${lesson.awardedXp ? "Прочитано" : "Материал лекции"}</span>
          </div>
          <div class="lesson-content">${markdown(lesson.contentMarkdown)}</div>
          <p data-error class="error" role="alert" hidden></p>
          <div class="actions">
            <button type="button" class="btn" data-complete ${lesson.awardedXp > 0 ? "disabled" : ""}>
              ${lesson.awardedXp > 0 ? "Прочитано" : "Отметить прочитанной · +20 XP"}</button>
            <a class="link action-link" href="#/lesson/${e(lesson.id)}">Открыть лекцию</a>
          </div>
          <p class="success" data-reward role="status"></p>
        </section>` : `<section class="card"><p class="muted">Лекции пока не опубликованы.</p></section>`}

        ${lessons.length > 1 ? `<section class="card">
          <h2>Все лекции темы</h2>
          <div class="tight">${lessons.map(item => `
            <div class="feed-row">
              <span>${e(item.title)}</span>
              <a class="link action-link" href="#/lesson/${e(item.id)}">${item.completedAt ? "Прочитано" : "Читать"}</a>
            </div>`).join("")}</div>
        </section>` : ""}

        ${nextTopic ? `<section class="card">
          <h2>Следующая тема</h2>
          <p class="muted">${e(nextTopic.title)}</p>
          <p class="small">${nextTopic.status === "Locked" ? "Откроется после победы в этом испытании." : "Тема уже доступна."}</p>
          ${nextTopic.status !== "Locked" ? `<div class="actions"><a class="btn btn-outline" href="#/topic/${e(nextTopic.id)}">Открыть тему</a></div>` : ""}
        </section>` : `<section class="card"><h2>Это последняя тема курса</h2><p class="muted">После победы откроется итог курса.</p></section>`}
      </div>

      <div class="stack">
        <section class="card">
          <h2>Допуск к испытанию</h2>
          <p class="muted">${read
            ? "Выберите тест или аварию. Победа в любом режиме засчитывает тему пройденной."
            : "Отметьте лекцию как прочитанную, чтобы открыть испытания."}</p>

          ${active ? `<div class="notice info">Идёт другое испытание. <a class="link action-link" href="#/attempt/${e(active.id)}">Вернуться к попытке</a></div>` : ""}

          <div class="tight">
            ${topic.assessments.map(assessment => `
              <div class="feed-row">
                <span>${e(modeName(assessment.mode))}</span>
                ${!read || (active && active.assessmentId !== assessment.id)
                  ? `<span class="status">Действие недоступно</span>`
                  : `<a class="link action-link" href="#/topic/${e(topic.id)}/assessment/${e(assessment.id)}">
                      ${active?.assessmentId === assessment.id ? "Продолжить" : assessment.mode === "Boss" ? "Выбрать тест" : "Выбрать аварию"}
                    </a>`}
              </div>`).join("") || `<p class="muted">Испытания ещё не опубликованы.</p>`}
          </div>

          ${topic.assessments.length > 1 ? `<div class="actions"><button type="button" class="btn btn-outline" data-compare>Сравнить испытания</button></div>` : ""}
        </section>

        <div class="mascot-column"></div>
      </div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);

  const complete = root.querySelector("[data-complete]");
  if (complete) {
    complete.onclick = async () => {
      complete.disabled = true;
      try {
        const result = await api.complete(lesson.id);
        await refreshProfile();
        complete.textContent = "Прочитано";
        root.querySelector("[data-reward]").textContent = result.xpAwarded
          ? `Начислено ${result.xpAwarded} XP. Испытания доступны.`
          : "XP за лекцию уже начислялись при первом прочтении.";
        // Допуск открывается сразу: перерисовываем список испытаний.
        window.location.hash = `#/topic/${id}`;
      } catch (error) {
        showError(root, error);
        complete.disabled = false;
      }
    };
  }

  const compare = root.querySelector("[data-compare]");
  if (compare) {
    compare.onclick = () => askDialog({
      title: "Сравнение испытаний",
      body: `<div class="compare">
        <article><h3>Тест · бой с боссом</h3><p>До 7 расчётных вопросов по 4 варианта. На вопрос 45–60 секунд. Верный ответ снимает 20% HP. Пять верных — победа, три ошибки — поражение.</p></article>
        <article><h3>Авария · QTE</h3><p>4 шага, по 3 варианта. Общий отсчёт 60 секунд, включая чтение. Верный выбор даёт +10 секунд, неверный отнимает 10 секунд и блокирует выбранный вариант.</p></article>
      </div>`,
      actions: [{ label: "Понятно", value: "ok", kind: "" }]
    });
  }

  root.dispose = () => mascot.dispose?.();
  return root;
}

// Экран перед боем: условия испытания и запуск отсчёта по подтверждению.
export async function renderAssessmentBrief(topicId, assessmentId) {
  const [topic, user] = await Promise.all([api.topic(topicId), refreshProfile()]);
  const assessment = topic.assessments.find(item => item.id === assessmentId);
  if (!assessment) throw new Error("Испытание не найдено.");

  const boss = assessment.mode === "Boss";
  const mascot = mascotPanel({
    label: boss ? "Готов к бою" : "Готов к действию",
    message: boss
      ? "Условия расчётных задач будут показаны по одному. Проверьте формулу, единицы и оставшееся время."
      : "После старта общий отсчёт идёт и во время чтения условия шага.",
    hint: hints.attempt,
    assetKey: [user.mascot?.assetKey, user.hero?.assetKey, user.characterSkin?.assetKey]
  });

  const root = element(`
    <a class="back-link" href="#/topic/${e(topic.id)}">← Назад к выбору</a>

    <header class="page-head">
      <div>
        <h1>${boss ? "Бой с боссом" : "Авария в электрощите"}</h1>
        <p>${e(topic.title)} · ${e(boss ? "тест" : "авария (QTE)")}</p>
      </div>
    </header>

    <div class="grid-main">
      <div class="stack">
        <section class="card">
          <h2>${boss ? "Перед боем" : "Сценарий 1 из 3"}</h2>
          <div class="media-placeholder large"><span>${boss ? "Босс" : "Сценарий аварии"}</span></div>
          <p class="muted">${e(boss
            ? "Условия расчётных задач будут показаны по одному. Проверьте формулу, единицы и оставшееся время."
            : "В распределительном щите замечены признаки аварии. Нужно выбрать безопасный порядок действий.")}</p>
          <p data-error class="error" role="alert" hidden></p>
          <div class="actions">
            <button type="button" class="btn" data-start="${e(assessment.id)}">${boss ? "В бой" : "Действовать"}</button>
            <a class="link action-link" href="#/topic/${e(topic.id)}">Назад к выбору</a>
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <h2>Условия испытания</h2>
          <div class="metric-list">
            ${(boss ? [
              ["Вопросов", "7"],
              ["Варианты на вопрос", "4"],
              ["Время на вопрос", "45–60 с"],
              ["Для победы", "5 верных"]
            ] : [
              ["Шаги", "4"],
              ["Варианты на шаг", "3"],
              ["Стартовый отсчёт", "60 с"],
              ["Верно / неверно", "+10 / −10 с"]
            ]).map(([label, value]) => `<div class="metric-row"><span>${e(label)}</span><strong>${e(value)}</strong></div>`).join("")}
          </div>
          <p class="small" style="margin-top:16px">${boss
            ? "Третья ошибка завершает бой."
            : "После старта время идёт и при чтении."}</p>
        </section>

        <div class="mascot-column"></div>
      </div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);

  const start = root.querySelector("[data-start]");
  start.onclick = async () => {
    start.disabled = true;
    try {
      const attempt = await api.start(assessment.id);
      window.location.hash = `#/attempt/${attempt.id}`;
    } catch (error) {
      showError(root, error);
      start.disabled = false;
    }
  };

  root.dispose = () => mascot.dispose?.();
  return root;
}

export async function renderLesson(id) {
  const [lesson, rules, user] = await Promise.all([api.lesson(id), api.instructions(), refreshProfile()]);
  const mascot = mascotPanel({
    label: "Лекция",
    message: "В конце лекции отметьте её как прочитанной. За это начисляется 20 XP один раз.",
    hint: hints.lesson,
    assetKey: [user.mascot?.assetKey, user.hero?.assetKey, user.characterSkin?.assetKey]
  });

  const root = element(`
    <a class="back-link" href="#/topic/${e(lesson.topicId)}">← К теме и испытаниям</a>

    <header class="page-head">
      <div><h1>${e(lesson.title)}</h1><p>Материал лекции</p></div>
    </header>

    <div class="grid-main">
      <div class="stack">
        <section class="card lesson-content">${markdown(lesson.contentMarkdown)}</section>
        <p data-error class="error" role="alert" hidden></p>
        <div class="actions">
          <button type="button" class="btn" data-complete ${lesson.awardedXp > 0 ? "disabled" : ""}>
            ${lesson.awardedXp > 0 ? "Прочитано" : `Отметить прочитанной · +${rules.lessonXp} XP`}</button>
          <a class="btn btn-outline" href="#/topic/${e(lesson.topicId)}">К испытаниям</a>
        </div>
        <p class="success" data-reward role="status"></p>
      </div>

      <div class="stack"><div class="mascot-column"></div></div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);

  const button = root.querySelector("[data-complete]");
  button.onclick = async () => {
    button.disabled = true;
    try {
      const result = await api.complete(id);
      await refreshProfile();
      button.textContent = "Прочитано";
      root.querySelector("[data-reward]").textContent = result.xpAwarded
        ? `Получено ${result.xpAwarded} XP. Теперь можно пройти испытание.`
        : "Отметка уже сохранена.";
    } catch (error) {
      showError(root, error);
      button.disabled = false;
    }
  };

  root.dispose = () => mascot.dispose?.();
  return root;
}
