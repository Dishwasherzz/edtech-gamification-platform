import { element, escapeHtml as e, progressBar } from "../ui.js";

// Демонстрационный уровень для гостя: показывает механику босса без аккаунта,
// прогресса и начислений. Данные задачи заданы в макете.
const DEMO = {
  title: "Закон Ома",
  formula: [{ value: "12 В" }, { value: "6 Ом" }],
  prompt: "Напряжение — 12 В, сопротивление — 6 Ом. Чему равна сила тока?",
  options: [
    { key: "А", text: "1 А" },
    { key: "Б", text: "2 А", correct: true },
    { key: "В", text: "6 А" },
    { key: "Г", text: "12 А" }
  ],
  explanation: "Ток равен 2 А. I = U / R = 12 / 6. Верный ответ снимает 20% HP босса."
};

export function renderDemo() {
  const root = element(`
    <a class="back-link" href="#/">← На главную</a>

    <header class="page-head">
      <div>
        <h1>Пример уровня</h1>
        <p>Демонстрационная задача · без аккаунта и наград</p>
      </div>
    </header>

    <div class="grid-main">
      <div class="stack">
        <section class="card">
          <h2>${e(DEMO.title)}</h2>
          <div class="circuit" aria-label="Пример цепи: источник 12 вольт и сопротивление 6 ом">
            ${DEMO.formula.map(part => `<span class="circuit-node">${e(part.value)}</span>`).join('<span aria-hidden="true">──</span>')}
          </div>

          <p class="question-prompt">${e(DEMO.prompt)}</p>
          <div class="answers">
            ${DEMO.options.map(option => `<button class="answer" data-option="${e(option.key)}"><span class="num">${e(option.key)}</span><span>${e(option.text)}</span></button>`).join("")}
          </div>

          <p class="feedback" data-feedback role="status"></p>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <h2>Демо-показатели</h2>
          <div class="metric-list">
            <div class="metric-row"><span>HP босса</span><strong class="num" data-hp>100%</strong></div>
          </div>
          ${progressBar(100, "HP босса")}
          <p class="small" style="margin-top:12px">Демо не записывается в прогресс и не начисляет XP или монеты.</p>
          <div class="actions">
            <button type="button" class="btn btn-cta" data-reveal>Показать ответ</button>
            <a class="link action-link" href="#/auth/register">Зарегистрироваться</a>
            <a class="link action-link" href="#/">На главную</a>
          </div>
        </section>
      </div>
    </div>
  `);

  const feedback = root.querySelector("[data-feedback]");
  const bar = root.querySelector(".progress > div");
  const reveal = root.querySelector("[data-reveal]");

  reveal.onclick = () => {
    root.querySelectorAll("[data-option]").forEach(button => {
      const option = DEMO.options.find(item => item.key === button.dataset.option);
      button.disabled = true;
      if (option.correct) {
        button.classList.add("correct");
        button.innerHTML = `<span class="num">${e(option.key)}</span><span>${e(option.text)}</span><span class="answer-result">Верно</span>`;
      }
    });
    root.querySelector("[data-hp]").textContent = "80%";
    bar.style.width = "80%";
    feedback.textContent = DEMO.explanation;
    reveal.disabled = true;
    reveal.textContent = "Ответ показан";
  };

  return root;
}
