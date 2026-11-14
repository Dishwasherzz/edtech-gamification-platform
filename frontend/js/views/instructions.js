import { api } from "../api.js";
import { state, refreshProfile } from "../state.js";
import { element, escapeHtml as e } from "../ui.js";

function step(number, title, body) {
  return `
    <section class="panel">
      <h2>${number}. ${title}</h2>
      <p class="muted">${body}</p>
    </section>`;
}

// Пороги разрядов приходят с сервера: список отсортирован по возрастанию.
function rankTable(thresholds) {
  if (!Array.isArray(thresholds) || !thresholds.length) return "";
  const rows = thresholds.map((threshold, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="num">${threshold} XP</td>
      <td class="muted">${index === thresholds.length - 1 ? "Высший разряд" : `Следующий: ${thresholds[index + 1]} XP`}</td>
    </tr>`).join("");
  return `
    <section class="panel">
      <h2>Разряды</h2>
      <table class="history-table">
        <thead><tr><th>Разряд</th><th>Порог</th><th>Следующая отметка</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

export async function renderInstructions() {
  const rules = await api.instructions();
  const guest = !state.isAuth;
  if (!guest) await refreshProfile();

  const root = element(`
    <header class="page-head">
      <div>
        <h1>Как устроен курс</h1>
        <p>${guest ? "До регистрации можно посмотреть пример задания." : "Ваш маршрут от первой лекции до завершения курса."}</p>
      </div>
    </header>

    <div class="stack">
      <section class="panel">
        <h2>Маршрут темы</h2>
        <div class="step-line">
          <span class="selected">Лекция</span>
          <span aria-hidden="true">→</span>
          <span>Испытание</span>
          <span aria-hidden="true">→</span>
          <span>Следующая тема</span>
        </div>
        <p class="muted" style="margin-top:16px">Отметьте лекцию как прочитанную и выберите одно испытание. Первая победа в любом типе открывает следующую тему.</p>
      </section>

      <div class="grid3">
        ${step(1, "Изучить лекцию",
          `Прочитай лекцию в доступной теме и нажми «Отметить прочитанной». За первую отметку начислится ${rules.lessonXp} XP. Повторная отметка не даёт дополнительный опыт.`)}
        ${step(2, "Выбрать испытание",
          "Для каждой темы доступны «Тест» и «Авария». Одновременно можно проходить одно испытание. Заверши или прекрати текущую попытку, чтобы начать другую; число повторений не ограничено.")}
        ${step(3, "Получить результат",
          "Любая победа завершает тему и открывает следующую. Поражения не уменьшают XP, монеты и достигнутый прогресс.")}
      </div>

      <div class="grid2">
        <section class="panel">
          <h2>Босс-тест</h2>
          <ul class="rule-list">
            <li>До 7 расчётных вопросов по 4 варианта. На вопрос 45–60 секунд.</li>
            <li>Верный ответ снимает 20% HP. Пять верных — победа, три ошибки — поражение.</li>
            <li>Истечение времени считается ошибкой.</li>
          </ul>
        </section>

        <section class="panel">
          <h2>Авария · QTE</h2>
          <ul class="rule-list">
            <li>4 шага, по 3 варианта. Общий отсчёт 60 секунд, включая чтение.</li>
            <li>Верный выбор даёт +10 секунд, неверный отнимает 10 секунд и блокирует выбранный вариант.</li>
            <li>Третья ошибка или ноль секунд — поражение.</li>
          </ul>
        </section>
      </div>

      <section class="panel">
        <h2>Разряды и награды</h2>
        <p>Первая победа даёт ${rules.firstWinXp} XP и ${rules.firstWinCoins} монет. Бонус за первую победу без ошибок: +${rules.perfectBonusXp} XP и +${rules.perfectBonusCoins} монет.</p>
        <p>За первые ${rules.paidRepeatWinLimit} повторные победы по теме — ${rules.repeatWinXp} XP и ${rules.repeatWinCoins} монет за каждую, дальше — 0. Попытки не ограничены.</p>
        <p class="small">Значения наград предварительные и требуют согласования с командой.</p>
        <div class="actions">
          ${guest
            ? `<a class="button blue" href="#/demo"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Открыть пример</span></a>
               <a class="button outline" href="#/auth"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Войти</span></a>
               <a class="button outline" href="#/auth/register"><span class="button-edge" aria-hidden="true"></span><span class="button-label">Регистрация</span></a>`
            : `<a class="button" href="#/topics"><span class="button-edge" aria-hidden="true"></span><span class="button-label">К темам курса</span></a>`}
        </div>
      </section>

      ${rankTable(rules.rankThresholds)}
    </div>
  `);

  root.dispose = () => {};
  return root;
}
