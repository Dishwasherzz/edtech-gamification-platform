import { api } from "../api.js";
import { element } from "../ui.js";

function step(number, title, body) {
  return `
    <article class="card">
      <h2>${number}. ${title}</h2>
      <p class="muted">${body}</p>
    </article>`;
}

export async function renderInstructions() {
  const rules = await api.instructions();

  return element(`
    <h1 class="page-title">Как проходить курс</h1>

    <div class="step-grid">
      ${step(1, "Изучить лекцию",
        `Открой доступную тему и нажми «Прочитано». За первую отметку начислится ${rules.lessonXp} XP — и только при первом открытии.`)}
      ${step(2, "Выбрать испытание",
        "Для каждой темы доступны «Тест» и «Авария». Выбор свободный: попытки не блокируют друг друга, а повторить испытание можно сколько угодно раз.")}
      ${step(3, "Получить результат",
        "Любая победа завершает тему и открывает следующую. Поражения не уменьшают XP, монеты и достигнутый прогресс.")}
    </div>

    <div class="split-2">
      <article class="card">
        <h2>Тест / бой с боссом</h2>
        <ul class="rule-list">
          <li>7 вопросов, один из них 4 варианта ответа.</li>
          <li>HP босса 100%, верный ответ снимает 20%.</li>
          <li>Победа сразу при 5 верных; поражение при третьей ошибке.</li>
          <li>45–60 секунд на вопрос. Истечение времени считается ошибкой.</li>
        </ul>
      </article>

      <article class="card">
        <h2>Авария / QTE</h2>
        <ul class="rule-list">
          <li>4 шага, три действия на шаге; 3 сценария на тему.</li>
          <li>Общий отсчёт 60 секунд, включая чтение.</li>
          <li>Верный выбор +10 с и следующий шаг; неверный −10 с и та же ошибка.</li>
          <li>Неверный вариант блокируется. Победа после 4 шагов.</li>
          <li>Третья ошибка или 0 секунд — поражение.</li>
        </ul>
      </article>
    </div>

    <article class="card">
      <h2>Награды и повторные попытки</h2>
      <p>Первая победа: ${rules.firstWinXp} XP и ${rules.firstWinCoins} монет. Без ошибок дополнительно ${rules.perfectBonusXp} XP и ${rules.perfectBonusCoins} монет.</p>
      <p>Повторная победа в любом режиме: ${rules.repeatWinXp} XP и ${rules.repeatWinCoins} монет. Это 25% базовой награды, бонус за чистоту при этом не начисляется.</p>
      <p class="muted">Числа условные, для согласования экономики. Нет ни лиг, ни страхов, ни магазина — награда за самостоятельность.</p>
      <div class="actions"><a class="btn btn-cta" href="#/">К темам</a></div>
    </article>
  `);
}