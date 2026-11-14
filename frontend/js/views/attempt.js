import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, modeName, statusName, mascotEventName } from "../ui.js";
import { mascotPanel, mountMascot, hints } from "../mascot.js";

function illustration(key) {
  // Локальная векторная схема: без внешних ресурсов и пользовательской разметки.
  const symbol = key === "panel" ? "▣" : key === "cable" ? "⌁" : "Ω";
  return `<div class="circuit-art" aria-label="Виртуальная электрическая цепь"><span>＋</span><i></i><strong>${symbol}</strong><i></i><span>−</span></div>`;
}

export async function renderAttempt(id) {
  let data = await api.attempt(id);
  const root = element(`<div class="grid-main"><div data-main></div><div class="stack"><div class="mascot-column"></div></div></div>`);
  const main = root.querySelector("[data-main]");
  let disposed = false;
  let busy = false;
  let offset = Date.parse(data.serverNow) - Date.now();
  let pending = null;
  let errorMessage = "";
  let feedback = "";
  let offline = false;
  let restored = false;
  let coursePercent = null;

  // Процент курса нужен только на экране итога: считаем его один раз.
  async function loadCoursePercent() {
    if (coursePercent !== null) return coursePercent;
    // Даже при недоступном каталоге результат должен оставаться на экране.
    coursePercent = undefined;
    try {
      const courses = await api.courses();
      for (const course of courses) {
        const topics = await api.topics(course.id);
        if (topics.some(topic => topic.id === data.topicId)) { coursePercent = course.progressPercent; break; }
      }
    } catch {
      // Прогресс курса не критичен для показа итога.
    }
    return coursePercent;
  }

  const mascot = mascotPanel({
    label: mascotEventName(data.mascot?.event),
    message: data.mascot?.message ?? "Продолжай обучение: состояние попытки сохраняется.",
    hint: hints.attempt,
    assetKey: [data.mascot?.character?.assetKey, data.characterSkin?.assetKey],
    collapsed: true
  });
  mountMascot(root.querySelector(".mascot-column"), mascot);

  function accept(next) {
    data = next;
    offset = Date.parse(next.serverNow) - Date.now();
    if (next.feedback) feedback = next.feedback.message;
    if (pending && (data.status !== "Active" || data.currentQuestion?.id !== pending.questionId ||
        data.currentQuestion.options.some(option => option.id === pending.optionId && option.isDisabled))) pending = null;
    if (data.mascot) {
      mascot.update({
        label: mascotEventName(data.mascot.event),
        message: data.mascot.message,
        assetKey: [data.mascot.character?.assetKey, data.characterSkin?.assetKey]
      });
    }
  }

  function connectionNotice() {
    if (!offline) return "";
    return `<div class="notice error">
      <h3>Связь прервалась</h3>
      <p>Не удалось подтвердить ответ. Время попытки продолжает идти. После восстановления связи проверим, успел ли сервер принять ответ.</p>
      <div class="actions"><button type="button" class="btn btn-outline" data-reconnect>Проверить связь</button><a class="link action-link" href="#/">На главную</a></div>
    </div>`;
  }

  function draw() {
    if (disposed) return;
    if (data.status !== "Active") {
      main.innerHTML = `
        ${restored ? `<div class="notice info">Попытка восстановлена. Предыдущий ответ учтён.</div>` : ""}
        <section class="card result">
          <span class="eyebrow">${e(modeName(data.mode))}</span>
          <h1>${e(statusName(data.status))}</h1>
          <h2>${e(data.topicTitle)}</h2>
          <p class="muted">Верных: ${data.correctAnswers}. Ошибок: ${data.errors}.</p>
          <p class="muted">${data.finishReason === "TimeExpired" ? "Время истекло." : data.finishReason === "ThreeErrors" ? "Допущены три ошибки." : data.finishReason === "Abandoned" ? "Попытка прекращена." : ""}</p>

          ${data.reward ? `<div class="reward-grid">
              <div class="reward-stat"><span>Опыт</span><strong>+${data.reward.xp}</strong></div>
              <div class="reward-stat"><span>Монеты</span><strong>+${data.reward.coins}</strong></div>
              <div class="reward-stat"><span>Прогресс курса</span><strong>${coursePercent == null ? "—" : `${coursePercent}%`}</strong></div>
            </div>
            <p class="small" style="margin-top:12px">${data.reward.isFirstPass ? "Первая победа по теме" : "Повторная победа"}${data.reward.perfectBonus ? " · Бонус без ошибок" : ""}</p>
            ${data.reward.repeatLimitReached ? '<p class="small">Лимит наград за повторы в этой теме исчерпан.</p>' : ""}
            ${data.reward.newRank ? `<p class="small">Новый разряд: ${data.reward.newRank}.</p>` : ""}`
            : `<p class="muted">Награды не начислены. Опыт, монеты и ранее пройденные темы сохранены.</p>`}

          <div class="actions">
            ${data.nextTopicId ? `<a class="btn" href="#/topic/${e(data.nextTopicId)}">К следующей теме</a>` : ""}
            ${data.completedCourseId ? `<a class="btn" href="#/completion/${e(data.completedCourseId)}">Курс завершён</a>` : ""}
            <a class="btn btn-outline" href="#/topics">К темам курса</a>
            <a class="link action-link" href="#/topic/${e(data.topicId)}">Повторить теорию / выбрать испытание</a>
            <button class="btn btn-outline" data-retry>Попробовать снова</button>
          </div>
          <p data-error class="error" role="alert"></p>
        </section>

        <section class="card">
          <h2>${data.mode === "Crisis" ? "Правильная последовательность" : "Разбор ответов"}</h2>
          ${(data.review || []).map(item => `
            <div class="review-row">
              <h3>${item.position}. ${e(item.prompt)}</h3>
              <p><span class="status${item.isCorrect ? " strong" : ""}">${item.isCorrect ? "Верно" : item.timedOut ? "Время истекло" : "Не завершено / ошибка"}</span></p>
              ${item.selectedAnswer ? `<p>Твой ответ: ${e(item.selectedAnswer)}</p>` : ""}
              ${item.wrongChoices.length ? `<p>Ошибочные действия: ${item.wrongChoices.map(e).join("; ")}</p>` : ""}
              <p class="white">Правильный ответ: ${e(item.correctAnswer)}</p>
              <p class="muted">${e(item.explanation)}</p>
            </div>`).join("") || `<p class="muted">Разбор появится после завершения попытки.</p>`}
        </section>`;
      const retry = main.querySelector("[data-retry]");
      if (retry) {
        retry.onclick = async event => {
          event.target.disabled = true;
          try { const next = await api.start(data.assessmentId); window.location.hash = `#/attempt/${next.id}`; }
          catch (error) { main.querySelector("[data-error]").textContent = error.message; event.target.disabled = false; }
        };
      }
      if (coursePercent === null) {
        loadCoursePercent().then(() => { if (!disposed) draw(); });
      }
      return;
    }

    if (data.isReady) {
      main.innerHTML = `
        ${connectionNotice()}
        <a class="back-link" href="#/topic/${e(data.topicId)}">← К теме</a>
        <section class="card">
          <span class="eyebrow">Авария · виртуальный стенд</span>
          <h1>${e(data.scenario.title)}</h1>
          ${illustration(data.scenario.illustrationKey)}
          <p class="muted">${e(data.scenario.introduction)}</p>
          <div class="actions">
            <button class="btn" data-begin ${busy ? "disabled" : ""}>Действовать</button>
            <button class="btn btn-outline" data-abandon>Отменить подготовку</button>
          </div>
          <p class="error" data-error role="alert">${e(errorMessage)}</p>
        </section>`;
      main.querySelector("[data-begin]").onclick = async () => {
        if (busy || disposed) return;
        busy = true; draw();
        try { accept(await api.begin(id)); errorMessage = ""; offline = false; }
        catch (error) { errorMessage = error.message; }
        finally { busy = false; draw(); }
      };
    } else {
      const question = data.currentQuestion;
      const isBoss = data.mode === "Boss";
      main.innerHTML = `
        ${connectionNotice()}
        ${restored ? `<div class="notice info">Попытка восстановлена. Продолжите с вопроса ${question?.position ?? 1}. Состояние и оставшееся время получены от сервера.</div>` : ""}

        <header class="page-head">
          <div><span class="eyebrow">${e(modeName(data.mode))}</span><h1>${e(data.topicTitle)}</h1></div>
        </header>

        <div class="timer-hud">
          ${isBoss ? `
            <div>
              <span class="hud-label">HP босса</span>
              <strong class="hud-value">${data.bossHpRemaining}%</strong>
              ${progressBar(data.bossHpRemaining, "Здоровье босса")}
            </div>
            <div><span class="hud-label">Вопрос</span><strong class="hud-value">${question.position} / ${data.questionCount}</strong></div>
            <div><span class="hud-label">Ошибки</span><strong class="hud-value">${data.errors} / 3</strong></div>
            <div><span class="hud-label">На вопрос</span><strong class="hud-value" data-timer>00:00</strong></div>`
          : `
            <div>
              <span class="hud-label">До замыкания</span>
              <strong class="hud-value" data-timer>00:00</strong>
              ${progressBar(Math.max(0, Math.min(100, Math.round((Date.parse(data.expiresAt) - (Date.now() + offset)) / 600))), "Обратный отсчёт")}
            </div>
            <div><span class="hud-label">Шаг</span><strong class="hud-value">${question.position} / ${data.questionCount}</strong></div>
            <div><span class="hud-label">Ошибки</span><strong class="hud-value">${data.errors} / 3</strong></div>
            <div><span class="hud-label">Верные шаги</span><strong class="hud-value">${data.correctAnswers} / ${data.questionCount}</strong></div>`}
        </div>

        <div class="battle-grid">
          <section class="card ${isBoss ? "" : `crisis intensity-${data.errors}`}">
            <h2>${isBoss ? "Состояние босса" : "Состояние установки"}</h2>
            ${isBoss
              ? `<div class="media-placeholder large"><span>${e(data.bossName)}</span></div>
                 <p class="muted">Каждый верный ответ снимает 20% HP.</p>`
              : `${illustration(data.scenario.illustrationKey)}
                 <p class="muted">${data.errors ? "В модели нарастает перегрузка. Выбери другое действие." : "Состояние модели стабильно."}</p>`}
          </section>

          <section class="card">
            <h2 class="question-prompt">${e(question.prompt)}</h2>
            <div class="answers">${question.options.map(option => `<button class="answer" data-option="${e(option.id)}" ${option.isDisabled || pending || busy ? "disabled" : ""}>${e(option.text)}${option.isDisabled ? " · уже выбрано" : ""}</button>`).join("")}</div>
            <p class="feedback" role="status">${e(feedback)}</p>
            <p class="error" data-error role="alert">${e(errorMessage)}</p>
            ${pending ? '<button class="btn btn-outline" data-resend>Повторить отправку ответа</button>' : ""}
            <button class="text-button" data-abandon>Прекратить попытку</button>
          </section>
        </div>`;
      main.querySelectorAll("[data-option]").forEach(button => {
        button.onclick = () => {
          if (busy || pending) return;
          pending = { questionId: data.currentQuestion.id, optionId: button.dataset.option, requestId: crypto.randomUUID() };
          sendPending();
        };
      });
      main.querySelector("[data-resend]")?.addEventListener("click", sendPending);
      tick();
    }

    const reconnect = main.querySelector("[data-reconnect]");
    if (reconnect) {
      reconnect.onclick = async () => {
        reconnect.disabled = true;
        try { accept(await api.attempt(id)); offline = false; restored = true; errorMessage = ""; }
        catch (error) { errorMessage = error.message; }
        finally { reconnect.disabled = false; draw(); }
      };
    }

    const abandon = main.querySelector("[data-abandon]");
    if (abandon) {
      abandon.onclick = async () => {
        if (busy || !window.confirm("Завершить попытку без награды?")) return;
        busy = true;
        try { accept(await api.abandon(id)); }
        catch (error) { errorMessage = error.message; }
        finally { busy = false; draw(); }
      };
    }
  }

  async function sendPending() {
    if (busy || !pending || disposed) return;
    busy = true; draw();
    const answer = pending;
    try {
      accept(await api.answer(id, answer.questionId, answer.optionId, answer.requestId));
      pending = null; errorMessage = ""; offline = false;
      if (data.status !== "Active") await refreshProfile();
    } catch (error) {
      errorMessage = error.message;
      offline = error.status === undefined;
      if (error.status && error.status < 500) pending = null;
    }
    finally { busy = false; draw(); }
  }

  function tick() {
    const timer = main.querySelector("[data-timer]");
    if (!timer) return;
    const remaining = Math.max(0, Math.ceil((Date.parse(data.expiresAt) - (Date.now() + offset)) / 1000));
    timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
    timer.classList.toggle("urgent", remaining <= 10);
  }

  async function poll() {
    if (busy || disposed || data.status !== "Active") return;
    busy = true;
    try {
      const next = await api.attempt(id);
      const changed = next.status !== data.status || next.currentQuestion?.id !== data.currentQuestion?.id ||
        next.errors !== data.errors || next.isReady !== data.isReady || next.expiresAt !== data.expiresAt ||
        !!errorMessage || offline;
      accept(next); errorMessage = "";
      if (offline) restored = true;
      offline = false;
      if (next.status !== "Active") await refreshProfile();
      if (changed) { busy = false; draw(); }
    } catch (error) {
      errorMessage = error.message;
      offline = true;
      const target = main.querySelector("[data-error]");
      if (target) target.textContent = errorMessage;
    }
    finally { busy = false; }
  }

  if (data.status !== "Active") await refreshProfile();
  draw();
  const timer = window.setInterval(tick, 200);
  const polling = window.setInterval(poll, 1500);
  root.dispose = () => { disposed = true; clearInterval(timer); clearInterval(polling); mascot.dispose?.(); };
  return root;
}
