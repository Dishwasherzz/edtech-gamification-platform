import { api } from "../api.js";
import { state, refreshProfile } from "../state.js";
import { element, escapeHtml as e } from "../ui.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { buttonLink } from "../components/button.js";

function step(number, title, body) {
  return panel({
    title: `${number}. ${title}`,
    children: `<p class="muted">${body}</p>`
  });
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
  return panel({
    title: "Разряды",
    children: `
      <table class="history-table">
        <thead><tr><th>Разряд</th><th>Порог</th><th>Следующая отметка</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `
  });
}

export async function renderInstructions() {
  const rules = await api.instructions();
  const guest = !state.isAuth;
  if (!guest) await refreshProfile();

  const root = element(`
    ${pageHead({
      title: "Как устроен курс",
      description: guest ? "До регистрации можно посмотреть пример задания." : "Ваш маршрут от первой лекции до завершения курса."
    })}

    <div class="stack">
      ${panel({
        title: "Маршрут темы",
        children: `
          <div class="step-line">
            <span class="selected">Лекция</span>
            <span aria-hidden="true">→</span>
            <span>Испытание</span>
            <span aria-hidden="true">→</span>
            <span>Следующая тема</span>
          </div>
          <p class="muted" style="margin-top:16px">В темах с испытаниями прочитайте лекцию и победите в тесте или аварии. Темы без испытаний завершаются отметкой всех лекций «Прочитано». Завершение темы открывает следующую.</p>
        `
      })}

      <div class="grid3">
        ${step(1, "Изучить лекцию",
          `Прочитай лекцию в доступной теме и нажми «Отметить прочитанной». За первую отметку начислится ${rules.lessonXp} XP. Повторная отметка не даёт дополнительный опыт.`)}
        ${step(2, "Выбрать испытание",
          "Для каждой темы доступны «Тест» и «Авария». Одновременно можно проходить одно испытание. Заверши или прекрати текущую попытку, чтобы начать другую; число повторений не ограничено.")}
        ${step(3, "Получить результат",
          "Любая победа завершает тему и открывает следующую. Поражения не уменьшают XP, монеты и достигнутый прогресс.")}
      </div>

      <div class="grid2">
        ${panel({
          title: "Босс-тест",
          children: `
            <ul class="rule-list">
              <li>До 7 расчётных вопросов по 4 варианта. На вопрос 45–60 секунд.</li>
              <li>Верный ответ снимает 20% HP. Пять верных — победа, три ошибки — поражение.</li>
              <li>Истечение времени считается ошибкой.</li>
            </ul>
          `
        })}

        ${panel({
          title: "Авария · QTE",
          children: `
            <ul class="rule-list">
              <li>4 шага, по 3 варианта. Общий отсчёт 60 секунд, включая чтение.</li>
              <li>Верный выбор даёт +10 секунд, неверный отнимает 10 секунд и блокирует выбранный вариант.</li>
              <li>Третья ошибка или ноль секунд — поражение.</li>
            </ul>
          `
        })}
      </div>

      ${panel({
        title: "Разряды и награды",
        children: `
          <p>Первая победа даёт ${rules.firstWinXp} XP и ${rules.firstWinCoins} монет. Бонус за первую победу без ошибок: +${rules.perfectBonusXp} XP и +${rules.perfectBonusCoins} монет.</p>
          <p>За первые ${rules.paidRepeatWinLimit} повторные победы по теме — ${rules.repeatWinXp} XP и ${rules.repeatWinCoins} монет за каждую, дальше — 0. Попытки не ограничены.</p>
          <p class="small">Значения наград предварительные и требуют согласования с командой.</p>
          <div class="actions">
            ${guest
              ? `${buttonLink({ href: "#/demo", label: "Открыть пример", kind: "blue" })}${buttonLink({ href: "#/auth", label: "Войти", kind: "outline" })}${buttonLink({ href: "#/auth/register", label: "Регистрация", kind: "outline" })}`
              : buttonLink({ href: "#/topics", label: "К темам курса" })}
          </div>
        `
      })}

      ${rankTable(rules.rankThresholds)}
    </div>
  `);

  root.dispose = () => {};
  return root;
}
