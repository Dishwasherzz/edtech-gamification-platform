import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, render, markdown, showError, modeName, askDialog } from "../ui.js";
import { companionCharacter } from "../assets.js";
import { mascotPanel, mountMascot } from "../mascot.js";
import { metricRow } from "../components/metric-row.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { actions } from "../components/actions.js";
import { buttonLink, buttonAction } from "../components/button.js";
import { backLink } from "../components/back-link.js";

function renderAccessSection(topic, read, active, nextTopic = null) {
  if (!topic.assessments.length) {
    return panel({
      title: read ? "Лекция прочитана" : "Тема для чтения",
      children: `<p class="muted">${read ? "Тема завершена." : "Отметьте все лекции прочитанными, чтобы завершить тему. Испытание не требуется."}</p>
        ${read ? buttonLink({ href: nextTopic ? `#/topic/${e(nextTopic.id)}` : `#/completion/${e(topic.courseId)}`,
          label: nextTopic ? "К следующей теме" : "К итогу курса" }) : ""}`
    });
  }
  return panel({
    title: "Допуск к испытанию",
    children: `
      <p class="muted">${read
        ? "Выберите тест или аварию. Победа в любом режиме засчитывает тему пройденной."
        : "Отметьте лекцию как прочитанную, чтобы открыть испытания."}</p>

      ${active ? `<div class="notice info">Идёт другое испытание. <a class="link action-link" href="#/attempt/${e(active.id)}">Вернуться к попытке</a></div>` : ""}

      ${topic.assessments.length
        ? `${actions({ children: `
            ${!read
              ? `<span class="status">Действие недоступно</span>`
              : `<a class="button" href="#/topic/${e(topic.id)}/assessment">Выбрать испытание</a>`}
          ` })}`
        : `<p class="muted">Испытания ещё не опубликованы.</p>`}
      ${topic.assessments.length > 1 ? `${actions({ children: `<button type="button" class="button outline" data-compare>Сравнить испытания</button>` })}` : ""}
    `
  });
}

// Экран закрытой темы: прямой переход не выдаёт доступ.
async function lockedTopic(topic, previous, courseTitle) {
  const user = await refreshProfile().catch(() => null);
  const mascot = user ? mascotPanel({
    label: "Тема закрыта",
    character: companionCharacter(user)
  }) : null;

  const root = element(`
    ${pageHead({
      title: topic?.title ?? "Тема закрыта",
      description: courseTitle ?? ""
    })}

    <div class="grid-main">
      <div class="stack">
        ${panel({
          children: `
            <span class="eyebrow">Тема закрыта</span>
            <h2>Сначала завершите предыдущую тему</h2>
            <p class="muted">Чтобы открыть эту тему, завершите предыдущую${previous ? ` «${e(previous.title)}»` : ""}: победите в испытании или прочитайте все лекции, если испытаний нет.</p>
            <div class="actions">
              ${previous ? buttonLink({ href: `#/topic/${e(previous.id)}`, label: "Открыть предыдущую тему" }) : ""}
              ${buttonLink({ href: "#/topics", label: "Все темы", kind: "outline" })}
            </div>
          `
        })}
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
    message: read ? (topic.assessments.length ? "Лекция прочитана. Теперь доступны тест и авария." : "Лекция прочитана. Тема завершена.") : null,
    character: companionCharacter(user)
  });

  const root = element(`
    ${backLink({ href: "#/topics", label: "Все темы" })}

    ${pageHead({
      title: topic.title,
      description: `Тема ${position + 1} из ${topics.length}${topic.subtitle ? ` · ${topic.subtitle}` : ""}`
    })}

    <div class="step-line">
      <span class="selected">Лекция</span>
      <span aria-hidden="true">→</span>
      <span>${topic.assessments.length ? "Испытание" : "Отметка о чтении"}</span>
      <span aria-hidden="true">→</span>
      <span>Следующая тема</span>
    </div>

    <div class="gap"></div>

    <div class="grid-main">
      <div class="stack">
        ${lesson ? panel({
          children: `
            <div class="between">
              <h2>${e(lesson.title)}</h2>
              <span class="small">${lesson.awardedXp ? "Прочитано" : "Материал лекции"}</span>
            </div>
            <div class="lesson-content">${markdown(lesson.contentMarkdown)}</div>
            <p data-error class="error" role="alert" hidden></p>
            <div class="actions">
              <button type="button" class="button${lesson.awardedXp > 0 ? " is-disabled" : ""}" data-complete ${lesson.awardedXp > 0 ? "disabled" : ""}>
                ${lesson.awardedXp > 0 ? "Прочитано" : "Отметить прочитанной · +20 XP"}</button>
              <a class="link action-link" href="#/lesson/${e(lesson.id)}">Открыть лекцию</a>
            </div>
            <p class="success" data-reward role="status"></p>
          `
        }) : panel({ children: `<p class="muted">Лекции пока не опубликованы.</p>` })}

        ${lessons.length > 1 ? panel({
          title: "Все лекции темы",
          children: `
            <div class="tight">${lessons.map(item => `
              <div class="feed-row">
                <span>${e(item.title)}</span>
                <a class="link action-link" href="#/lesson/${e(item.id)}">${item.completedAt ? "Прочитано" : "Читать"}</a>
              </div>`).join("")}</div>
          `
        }) : ""}

        ${nextTopic ? panel({
          title: "Следующая тема",
          children: `
            <p class="muted">${e(nextTopic.title)}</p>
            <p class="small">${nextTopic.status === "Locked" ? (topic.assessments.length ? "Откроется после победы в этом испытании." : "Откроется после прочтения лекции.") : "Тема уже доступна."}</p>
            ${nextTopic.status !== "Locked" ? `${actions({ children: `<a class="button outline" href="#/topic/${e(nextTopic.id)}">Открыть тему</a>` })}` : ""}
          `
        }) : panel({ title: "Это последняя тема курса", children: `<p class="muted">После завершения темы доступен итог курса.</p>` })}
      </div>

      <div class="stack">
        <div data-access-section>
          ${renderAccessSection(topic, read, active, nextTopic)}
        </div>

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
        complete.disabled = true;
        root.querySelector("[data-reward]").textContent = result.xpAwarded
          ? `Начислено ${result.xpAwarded} XP. ${topic.assessments.length ? "Испытания доступны." : "Тема завершена."}`
          : "XP за лекцию уже начислялись при первом прочтении.";
        // F01 fix: перерисовываем допуск явно, а не полагаемся на повторное присваивание того же hash.
        const accessContainer = root.querySelector("[data-access-section]");
        if (accessContainer) {
          render(accessContainer, renderAccessSection(topic, true, active, nextTopic));
          const compare = accessContainer.querySelector("[data-compare]");
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
        }
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
    character: companionCharacter(user),
    mood: "focus"
  });

  const root = element(`
    ${backLink({ href: `#/topic/${e(topic.id)}`, label: "Назад к выбору" })}

    ${pageHead({
      title: boss ? "Бой с боссом" : "Подготовка к аварии",
      description: `${topic.title} · ${boss ? "тест" : "авария (QTE)"}`
    })}

    <div class="grid-main">
      <div class="stack">
        ${panel({
          title: boss ? "Перед боем" : "Сценарий аварии",
          children: `
            <div class="media-placeholder large"><span>${boss ? "Босс" : "Сценарий аварии"}</span></div>
            <p class="muted">${e(boss
              ? "Условия расчётных задач будут показаны по одному. Проверьте формулу, единицы и оставшееся время."
              : "После ответа API покажет название и условия сценария. Выберите безопасный порядок действий.")}</p>
            <p data-error class="error" role="alert" hidden></p>
            <div class="actions">
              ${buttonAction({ label: boss ? "В бой" : "Открыть сценарий", dataset: { start: assessment.id } })}
              <a class="link action-link" href="#/topic/${e(topic.id)}">Назад к выбору</a>
            </div>
          `
        })}
      </div>

      <div class="stack">
        ${panel({
          title: "Условия испытания",
          children: `
            <div class="metric-list">
              ${(boss ? [
                { label: "Вопросов", value: "7" },
                { label: "Варианты на вопрос", value: "4" },
                { label: "Время на вопрос", value: "45–60 с" },
                { label: "Для победы", value: "5 верных" }
              ] : [
                { label: "Шаги", value: "4" },
                { label: "Варианты на шаг", value: "3" },
                { label: "Стартовый отсчёт", value: "60 с" },
                { label: "Верно / неверно", value: "+10 / −10 с" }
              ]).map(item => metricRow(item)).join("")}
            </div>
            <p class="small" style="margin-top:16px">${boss
              ? "Третья ошибка завершает бой."
              : "После старта время идёт и при чтении."}</p>
          `
        })}

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
    character: companionCharacter(user)
  });

  const root = element(`
    ${backLink({ href: `#/topic/${e(lesson.topicId)}`, label: "К теме и испытаниям" })}

    ${pageHead({
      title: lesson.title,
      description: "Материал лекции"
    })}

    <div class="grid-main">
      <div class="stack">
        ${panel({ className: "lesson-content", children: `${markdown(lesson.contentMarkdown)}` })}
        <p data-error class="error" role="alert" hidden></p>
        <div class="actions">
          <button type="button" class="button${lesson.awardedXp > 0 ? " is-disabled" : ""}" data-complete ${lesson.awardedXp > 0 ? "disabled" : ""}>
            ${lesson.awardedXp > 0 ? "Прочитано" : `Отметить прочитанной · +${rules.lessonXp} XP`}</button>
          <a class="button outline" href="#/topic/${e(lesson.topicId)}">К теме</a>
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
        ? `Получено ${result.xpAwarded} XP. Вернитесь к теме, чтобы продолжить обучение.`
        : "Отметка уже сохранена.";
    } catch (error) {
      showError(root, error);
      button.disabled = false;
    }
  };

  root.dispose = () => mascot.dispose?.();
  return root;
}

// Экран выбора испытания: две карточки — тест и авария.
export async function renderAssessmentSelect(topicId) {
  const topic = await api.topic(topicId);
  const [topics, user, active] = await Promise.all([
    api.topics(topic.courseId),
    refreshProfile(),
    api.active().catch(() => null)
  ]);
  const current = topics.find(item => item.id === topicId);
  const read = Boolean(current?.isRead);

  const boss = topic.assessments.find(item => item.mode === "Boss");
  const crisis = topic.assessments.find(item => item.mode === "Crisis");

  const pictureIcon = `<span class="picture-mark" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4">
      <rect x="1" y="2" width="14" height="12" rx="1"></rect>
      <circle cx="5" cy="6" r="1.5"></circle>
      <path d="M2 12l4-4 3 3 2-2 3 3"></path>
    </svg>
  </span>`;

  function card(assessment) {
    if (!assessment) return "";
    const isBoss = assessment.mode === "Boss";
    const title = isBoss ? "Тест · бой с боссом" : "Авария · QTE";
    const text = isBoss
      ? "Расчётные задачи: 4 варианта, до 7 вопросов, 45–60 секунд на вопрос."
      : "4 шага по 3 варианта. Общий отсчёт — 60 секунд, включая чтение.";
    const label = isBoss ? "Выбрать тест" : "Выбрать аварию";
    const isCurrent = active?.assessmentId === assessment.id;
    let button = "";
    if (!read) {
      button = `<span class="status">Действие недоступно</span>`;
    } else if (isCurrent) {
      button = `<a class="button" href="#/attempt/${e(active.id)}">Продолжить</a>`;
    } else if (active && active.assessmentId !== assessment.id) {
      button = `<span class="status">Действие недоступно</span>`;
    } else {
      button = buttonLink({ href: `#/topic/${e(topic.id)}/assessment/${e(assessment.id)}`, label, kind: isBoss ? "blue" : "outline" });
    }
    return panel({
      title: title,
      children: `
        <div class="media-placeholder large" aria-hidden="true">${pictureIcon}</div>
        <p class="muted">${e(text)}</p>
        <div class="actions">${button}</div>
      `
    });
  }

  const root = element(`
    ${backLink({ href: `#/topic/${e(topic.id)}`, label: "К лекции" })}

    ${pageHead({
      title: "Выберите испытание",
      description: topic.title,
      actions: `<a class="link action-link" href="#/topic/${e(topic.id)}">К лекции</a>`
    })}

    <div class="step-line">
      <span>Лекция</span>
      <span aria-hidden="true">→</span>
      <span class="selected">Испытание</span>
      <span aria-hidden="true">→</span>
      <span>Следующая тема</span>
    </div>

    <div class="gap"></div>

    <div class="grid2">
      ${card(boss)}
      ${card(crisis)}
    </div>

    <div class="gap"></div>

    <div class="notice">
      <h3>Одна победа на тему</h3>
      <p>Первая победа в любом испытании открывает следующую тему. Между попытками тип можно менять.</p>
    </div>
  `);

  return root;
}
