import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, modeName, statusName } from "../ui.js";

function illustration(key) {
  // Local vector illustration: no external assets or user-provided SVG markup.
  const symbol = key === "panel" ? "▣" : key === "cable" ? "⌁" : "Ω";
  return `<div class="circuit-art" aria-label="Виртуальная электрическая цепь"><span>＋</span><i></i><strong>${symbol}</strong><i></i><span>−</span></div>`;
}

export async function renderAttempt(id) {
  let data = await api.attempt(id);
  const root = element("");
  let disposed = false;
  let busy = false;
  let offset = Date.parse(data.serverNow) - Date.now();
  let pending = null;
  let errorMessage = "";
  let feedback = "";

  function accept(next) {
    data = next;
    offset = Date.parse(next.serverNow) - Date.now();
    if (next.feedback) feedback = next.feedback.message;
    if (pending && (data.status !== "Active" || data.currentQuestion?.id !== pending.questionId ||
        data.currentQuestion.options.some(option => option.id === pending.optionId && option.isDisabled))) pending = null;
  }

  function draw() {
    if (disposed) return;
    if (data.status !== "Active") {
      root.innerHTML = `<div class="card result ${data.status === "Passed" ? "victory" : ""}"><span class="eyebrow">${e(modeName(data.mode))}</span><h1>${e(statusName(data.status))}</h1><h2>${e(data.topicTitle)}</h2>
        <p>Верных: ${data.correctAnswers}. Ошибок: ${data.errors}.</p><p>${data.finishReason === "TimeExpired" ? "Время истекло." : data.finishReason === "ThreeErrors" ? "Допущены три ошибки." : ""}</p>
        ${data.reward ? `<div class="reward">+${data.reward.xp} XP · +${data.reward.coins} монет</div><p class="muted">${data.reward.isFirstPass ? "Первая победа по теме" : "Повторная победа: 25% награды"}${data.reward.perfectBonus ? " · Бонус без ошибок" : ""}</p>` : '<p class="muted">Награды не начислены. Опыт, монеты и ранее пройденные темы сохранены.</p>'}
        <div class="actions"><a class="btn" href="#/">К темам курса</a><a class="btn secondary" href="#/topic/${e(data.topicId)}">Повторить теорию / выбрать испытание</a><button class="btn secondary" data-retry>Попробовать снова</button></div><p data-error class="error" role="alert"></p></div>
        <h2>${data.mode === "Crisis" ? "Правильная последовательность" : "Разбор ответов"}</h2>${(data.review || []).map(item => `<article class="card review"><span class="badge">${item.position}. ${item.isCorrect ? "Верно" : item.timedOut ? "Время истекло" : "Не завершено / ошибка"}</span><h3>${e(item.prompt)}</h3>
          ${item.selectedAnswer ? `<p>Твой ответ: ${e(item.selectedAnswer)}</p>` : ""}${item.wrongChoices.length ? `<p class="error">Ошибочные действия: ${item.wrongChoices.map(e).join("; ")}</p>` : ""}<p class="success">Правильный ответ: ${e(item.correctAnswer)}</p><p class="muted">${e(item.explanation)}</p></article>`).join("")}`;
      root.querySelector("[data-retry]").onclick = async event => {
        event.target.disabled = true;
        try { const next = await api.start(data.assessmentId); window.location.hash = `#/attempt/${next.id}`; }
        catch (error) { root.querySelector("[data-error]").textContent = error.message; event.target.disabled = false; }
      };
      return;
    }
    if (data.isReady) {
      root.innerHTML = `<a class="back-link" href="#/topic/${e(data.topicId)}">← К теме</a><div class="card"><span class="eyebrow">АВАРИЯ · ВИРТУАЛЬНЫЙ СТЕНД</span><h1>${e(data.scenario.title)}</h1>${illustration(data.scenario.illustrationKey)}<p>${e(data.scenario.introduction)}</p>
        <div class="actions"><button class="btn" data-begin ${busy ? "disabled" : ""}>Действовать</button><button class="btn secondary" data-abandon>Отменить подготовку</button></div><p class="error" data-error role="alert">${e(errorMessage)}</p></div>`;
      root.querySelector("[data-begin]").onclick = async () => {
        if (busy || disposed) return;
        busy = true; draw();
        try { accept(await api.begin(id)); errorMessage = ""; }
        catch (error) { errorMessage = error.message; }
        finally { busy = false; draw(); }
      };
    } else {
      const question = data.currentQuestion;
      root.innerHTML = `<div class="page-heading"><div><span class="eyebrow">${e(modeName(data.mode))}</span><h1>${e(data.topicTitle)}</h1></div><div class="timer" data-timer aria-label="Осталось секунд"></div></div>
        <div class="card ${data.mode === "Crisis" ? `crisis intensity-${data.errors}` : ""}">
        ${data.mode === "Boss" ? `<div class="boss-icon" aria-hidden="true">Ω</div><h2>${e(data.bossName)}</h2><p>HP: ${data.bossHpRemaining} / ${data.bossMaxHp}</p>${progressBar(data.bossHpRemaining, "Здоровье босса")}` : `${illustration(data.scenario.illustrationKey)}<h2>${e(data.scenario.title)}</h2><p class="muted">${data.errors ? "В модели нарастает перегрузка. Выбери другое действие." : "Состояние модели стабильно."}</p>`}
        <div class="battle-counters"><span>${data.mode === "Boss" ? "Вопрос" : "Шаг"} ${question.position} из ${data.questionCount}</span><span>Верных: ${data.correctAnswers}</span><span>Ошибок: ${data.errors} / 3</span></div>
        <h2 class="question-prompt">${e(question.prompt)}</h2><div class="answers">${question.options.map(option => `<button class="answer" data-option="${e(option.id)}" ${option.isDisabled || pending || busy ? "disabled" : ""}>${e(option.text)}${option.isDisabled ? " · уже выбрано" : ""}</button>`).join("")}</div>
        <p class="feedback" role="status">${e(feedback)}</p><p class="error" data-error role="alert">${e(errorMessage)}</p>
        ${pending ? '<button class="btn secondary" data-resend>Повторить отправку ответа</button>' : ""}<button class="text-button" data-abandon>Прекратить попытку</button></div>`;
      root.querySelectorAll("[data-option]").forEach(button => button.onclick = () => {
        if (busy || pending) return;
        pending = { questionId: data.currentQuestion.id, optionId: button.dataset.option, requestId: crypto.randomUUID() };
        sendPending();
      });
      root.querySelector("[data-resend]")?.addEventListener("click", sendPending);
      tick();
    }
    root.querySelector("[data-abandon]").onclick = async () => {
      if (busy || !window.confirm("Завершить попытку без награды?")) return;
      busy = true;
      try { accept(await api.abandon(id)); }
      catch (error) { errorMessage = error.message; }
      finally { busy = false; draw(); }
    };
  }

  async function sendPending() {
    if (busy || !pending || disposed) return;
    busy = true; draw();
    const answer = pending;
    try {
      accept(await api.answer(id, answer.questionId, answer.optionId, answer.requestId));
      pending = null; errorMessage = "";
      if (data.status !== "Active") await refreshProfile();
    } catch (error) { errorMessage = error.message; if (error.status && error.status < 500) pending = null; }
    finally { busy = false; draw(); }
  }

  function tick() {
    const timer = root.querySelector("[data-timer]");
    if (!timer) return;
    const remaining = Math.max(0, Math.ceil((Date.parse(data.expiresAt) - (Date.now() + offset)) / 1000));
    timer.textContent = `${remaining} с`;
    timer.classList.toggle("urgent", remaining <= 10);
  }

  async function poll() {
    if (busy || disposed || data.status !== "Active") return;
    busy = true;
    try {
      const next = await api.attempt(id);
      const changed = next.status !== data.status || next.currentQuestion?.id !== data.currentQuestion?.id || next.errors !== data.errors || next.isReady !== data.isReady || next.expiresAt !== data.expiresAt || !!errorMessage;
      accept(next); errorMessage = "";
      if (next.status !== "Active") await refreshProfile();
      if (changed) { busy = false; draw(); }
    } catch (error) { errorMessage = error.message; const target = root.querySelector("[data-error]"); if (target) target.textContent = errorMessage; }
    finally { busy = false; }
  }

  if (data.status !== "Active") await refreshProfile();
  draw();
  const timer = window.setInterval(tick, 200);
  const polling = window.setInterval(poll, 1500);
  root.dispose = () => { disposed = true; clearInterval(timer); clearInterval(polling); };
  return root;
}
