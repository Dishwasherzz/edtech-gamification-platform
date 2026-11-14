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
        <section class="panel">
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
        <section class="panel">
          <h2>Демо-показатели</h2>
          <div class="metric-list">
            <div class="metric-row"><span>HP босса</span><strong class="num" data-hp>100%</strong></div>
          </div>
          ${progressBar(100, "HP босса")}
          <p class="small" style="margin-top:12px">Демо не записывается в прогресс и не начисляет XP или монеты.</p>
          <div class="actions">
            <button type="button" class="button blue" data-reveal><span class="button-edge" aria-hidden="true"></span><span class="button-label">Показать ответ</span></button>
            <a class="link action-link" href="#/auth/register">Зарегистрироваться</a>
            <a class="link action-link" href="#/">На главную</a>
          </div>
        </section>
      </div>
    </div>
  `);

  const feedback = root.querySelector("[data-feedback]");
  const bar = root.querySelector(".bar .bar-fill");
  const reveal = root.querySelector("[data-reveal]");
  const revealLabel = reveal.querySelector(".button-label");

  let answered = false;
  function showAnswer(selected) {
    if (answered) return;
    answered = true;
    const correct = Boolean(selected?.correct);
    root.querySelectorAll("[data-option]").forEach(button => {
      const option = DEMO.options.find(item => item.key === button.dataset.option);
      button.disabled = true;
      button.classList.toggle("correct", Boolean(option.correct));
      button.classList.toggle("wrong", option === selected && !correct);
      if (option.correct) {
        const result = document.createElement("span");
        result.className = "answer-result";
        result.textContent = "Верно";
        button.append(result);
      }
    });
    const hp = correct ? 80 : 100;
    root.querySelector("[data-hp]").textContent = hp + "%";
    bar.style.width = hp + "%";
    root.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(hp));
    feedback.textContent = selected
      ? (correct ? "Верно. " : "Неверно. HP босса осталось прежним. ") + DEMO.explanation
      : "Решение показано. " + DEMO.explanation;
    reveal.disabled = true;
    revealLabel.textContent = "Ответ показан";
  }
  root.querySelectorAll("[data-option]").forEach(button => {
    button.onclick = () => showAnswer(DEMO.options.find(item => item.key === button.dataset.option));
  });
  reveal.onclick = () => showAnswer(null);

  return root;
}
