import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar } from "../ui.js";

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

    <section class="panel result">
      <div class="reward-grid">
        <div class="reward-stat"><span>Опыт</span><strong>${user.totalXp}</strong></div>
        <div class="reward-stat"><span>Монеты</span><strong>${user.coinsBalance}</strong></div>
        <div class="reward-stat"><span>Прогресс курса</span><strong>${course.progressPercent}%</strong></div>
      </div>
      ${progressBar(100, "Прогресс курса")}
      ${summary ? `<p class="small" style="margin-top:12px">Испытаний пройдено: ${summary.attempts}. Итог курса рассчитан на ${summary.totalXp} XP и ${summary.coinsBalance} монет.</p>` : ""}

      <div class="actions">
        <a class="button outline" href="#/topics"><span class="button-edge" aria-hidden="true"></span><span class="button-label">К темам курса</span></a>
        <a class="button outline" href="#/profile"><span class="button-edge" aria-hidden="true"></span><span class="button-label">В профиль</span></a>
      </div>
      <p data-error class="error" role="alert" hidden></p>
    </section>
  `);

  const claim = root.querySelector("[data-claim]");
  if (claim) {
    claim.onclick = async () => {
      claim.disabled = true;
      const error = root.querySelector("[data-error]");
      error.hidden = true;
      try {
        const result = await api.claimCompletion(course.id);
        await refreshProfile();
        if (!result) {
          error.textContent = "Итог курса уже получен: повторный вызов ничего не начисляет.";
          error.hidden = false;
          claim.disabled = true;
          claim.textContent = "Итог курса уже получен";
          return;
        }
        root.querySelector(".reward-grid").innerHTML = `
          <div class="reward-stat"><span>Опыт</span><strong>${result.totalXp}</strong></div>
          <div class="reward-stat"><span>Монеты</span><strong>${result.coinsBalance}</strong></div>
          <div class="reward-stat"><span>Разряд</span><strong>${result.rank}</strong></div>`;
        claim.remove();
        error.textContent = "Итог курса сохранён.";
        error.hidden = false;
      } catch (problem) {
        error.textContent = problem.message;
        error.hidden = false;
        claim.disabled = false;
      }
    };
  }

  return root;
}
