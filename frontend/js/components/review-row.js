import { escapeHtml as e } from "../ui.js";

// Строка разбора ответа: вопрос, статус, ответ пользователя, ошибки, правильный ответ, объяснение.
// Используется в attempt.js (итог попытки).
export function reviewRow({ position, prompt, isCorrect, timedOut, selectedAnswer, wrongChoices, correctAnswer, explanation }) {
  const status = isCorrect ? "Верно"
    : timedOut ? "Время истекло"
      : "Не завершено / ошибка";
  const cls = isCorrect ? "strong" : "";
  return `
    <div class="review-row">
      <h3>${e(position)}. ${e(prompt)}</h3>
      <p><span class="status ${cls}">${e(status)}</span></p>
      ${selectedAnswer ? `<p>Твой ответ: ${e(selectedAnswer)}</p>` : ""}
      ${wrongChoices.length ? `<p>Ошибочные действия: ${wrongChoices.map(e).join("; ")}</p>` : ""}
      <p class="white">Правильный ответ: ${e(correctAnswer)}</p>
      <p class="muted">${e(explanation)}</p>
    </div>`;
}
