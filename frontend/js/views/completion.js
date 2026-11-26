import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, render, progressBar } from "../ui.js";
import { rewardStat } from "../components/reward-stat.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { buttonEdge, buttonLink } from "../components/button.js";
import { companionCharacter } from "../assets.js";
import { mascotPanel, mountMascot } from "../mascot.js";

// Итог курса: все темы пройдены, учебные материалы и разборы остаются доступны.
export async function renderCompletion(courseId) {
  const courses = await api.courses();
  const course = courseId
    ? courses.find(item => item.id === courseId)
    : courses.find(item => item.progressPercent === 100);

  if (!course || course.progressPercent < 100) {
    return element(`${pageHead({ title: "Итог курса" })}
      ${panel({ children: `<p class="muted">Итог появится после прохождения всех тем.</p>
        ${buttonLink({ href: "#/topics", label: "К темам курса", kind: "outline" })}` })}`);
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
    ${pageHead({
      title: "Курс завершён",
      description: `${e(course.title)} · пройдены все темы курса. Учебные материалы и разборы остаются доступны.`,
      actions: journey.completionPending
        ? buttonAction({ label: "Забрать итог курса", dataset: { claim: "" } })
        : `<span class="status strong">Итог курса уже получен</span>`
    })}

    <div class="grid-main">
      <div class="stack">
        ${panel({ className: "result", children: `
          <div class="reward-grid">
            <div class="reward-stat"><span>Опыт</span><strong>${user.totalXp}</strong></div>
            <div class="reward-stat"><span>Монеты</span><strong>${user.coinsBalance}</strong></div>
            <div class="reward-stat"><span>Прогресс курса</span><strong>${course.progressPercent}%</strong></div>
          </div>
          ${progressBar(100, "Прогресс курса")}
          ${summary ? `<p class="small" style="margin-top:12px">Всего попыток: ${summary.attempts}. Итог курса рассчитан на ${summary.totalXp} XP и ${summary.coinsBalance} монет.</p>` : ""}

          <div class="actions">
            ${buttonLink({ href: "#/topics", label: "К темам курса", kind: "outline" })}
            ${buttonLink({ href: "#/profile", label: "В профиль", kind: "outline" })}
          </div>
          <p data-claim-status class="success" role="status" hidden></p>
        ` })}
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
        render(root.querySelector(".reward-grid"), `
          ${rewardStat({ label: "Опыт", value: result.totalXp })}
          ${rewardStat({ label: "Монеты", value: result.coinsBalance })}
          ${rewardStat({ label: "Разряд", value: result.rank })}`);
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
