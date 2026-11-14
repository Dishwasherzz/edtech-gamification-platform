import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar } from "../ui.js";
import { companionCharacter } from "../assets.js";
import { mascotPanel, mountMascot } from "../mascot.js";

// Итог курса: все темы пройдены, учебные материалы и разборы остаются доступны.
export async function renderCompletion(courseId) {
  const courses = await api.courses();
  const course = courseId
    ? courses.find(item => item.id === courseId)
    : courses.find(item => item.progressPercent === 100);

  if (!course || course.progressPercent < 100) {
    return element(`<header class="page-head"><div><h1>Итог курса</h1></div></header>
      <section class="panel"><p class="muted">Итог появится после прохождения всех тем.</p>
        <a class="button outline" href="#/topics"><span class="button-edge" aria-hidden="true"></span><span class="button-label">К темам курса</span></a></section>`);
  }

  const journey = await api.journey(course.id);
  const user = await refreshProfile();
  const summary = journey.summary;

  // Курс завершён — спутник радуется вместе с игроком.
  const mascot = mascotPanel({
    label: "Курс завершён",
    character: companionCharacter(user)
  });

  const root = element(`
    <header class="page-head">
      <div>
        <h1>Курс завершён</h1>
        <p>${e(course.title)} · пройдены все темы курса. Учебные материалы и разборы остаются доступны.</p>
      </div>
      <div class="top-actions">
        ${journey.completionPending
          ? `<button type="button" class="button" data-claim><span class="button-edge" aria-hidden="true"></span><span class="button-label">Забрать итог курса</span></button>`
          : `<span class="status strong">Итог курса уже получен</span>`}
      </div>
    </header>

    <div class="grid-main">
      <div class="stack">
        <section class="panel result">
          <div class="reward-grid">
            <div class="reward-stat"><span>Опыт</span><strong>${user.totalXp}</strong></div>
            <div class="reward-stat"><span>Монеты</span><strong>${user.coinsBalance}</strong></div>
            <div class="reward-stat"><span>Прогресс курса</span><strong>${course.progressPercent}%</strong></div>
          </div>
          ${progressBar(100, "Прогресс курса")}
          ${summary ? `<p class="small" style="margin-top:12px">Всего попыток: ${summary.attempts}. Итог курса рассчитан на ${summary.totalXp} XP и ${summary.coinsBalance} монет.</p>` : ""}

          <div class="actions">
            <a class="button outline" href="#/topics"><span class="button-edge" aria-hidden="true"></span><span class="button-label">К темам курса</span></a>
            <a class="button outline" href="#/profile"><span class="button-edge" aria-hidden="true"></span><span class="button-label">В профиль</span></a>
          </div>
          <p data-claim-status class="success" role="status" hidden></p>
        </section>
      </div>

      <div class="stack"><div class="mascot-column"></div></div>
    </div>
  `);

  mountMascot(root.querySelector(".mascot-column"), mascot);

  const claim = root.querySelector("[data-claim]");
  if (claim) {
    claim.onclick = async () => {
      claim.disabled = true;
      const status = root.querySelector("[data-claim-status]");
      status.hidden = true;
      status.textContent = "";
      status.className = "success";
      status.setAttribute("role", "status");
      try {
        const result = await api.claimCompletion(course.id);
        await refreshProfile();
        if (!result) {
          status.textContent = "Итог курса уже получен: повторный вызов ничего не начисляет.";
          status.className = "error";
          status.setAttribute("role", "alert");
          status.hidden = false;
          claim.disabled = true;
          claim.textContent = "Итог курса уже получен";
          return;
        }
        root.querySelector(".reward-grid").innerHTML = `
          <div class="reward-stat"><span>Опыт</span><strong>${result.totalXp}</strong></div>
          <div class="reward-stat"><span>Монеты</span><strong>${result.coinsBalance}</strong></div>
          <div class="reward-stat"><span>Разряд</span><strong>${result.rank}</strong></div>`;
        claim.remove();
        status.textContent = "Итог курса сохранён.";
        status.hidden = false;
      } catch (problem) {
        status.textContent = problem.message;
        status.className = "error";
        status.setAttribute("role", "alert");
        status.hidden = false;
        claim.disabled = false;
      }
    };
  }

  root.dispose = () => mascot.dispose?.();
  return root;
}
