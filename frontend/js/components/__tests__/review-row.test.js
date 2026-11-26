import { test } from "node:test";
import { strict as assert } from "node:assert";
import { reviewRow } from "../review-row.js";

test("reviewRow renders correct answer", () => {
  const html = reviewRow({
    position: 1,
    prompt: "Сколько будет 2+2?",
    isCorrect: true,
    timedOut: false,
    selectedAnswer: "4",
    wrongChoices: [],
    correctAnswer: "4",
    explanation: "Верно."
  });
  assert.ok(html.includes('class="review-row"'));
  assert.ok(html.includes("<h3>1. Сколько будет 2+2?</h3>"));
  assert.ok(html.includes('class="status strong"'));
  assert.ok(html.includes("Верно"));
  assert.ok(html.includes("Твой ответ: 4"));
  assert.ok(html.includes("Правильный ответ: 4"));
  assert.ok(html.includes("Верно."));
});

test("reviewRow renders timed out answer", () => {
  const html = reviewRow({
    position: 2,
    prompt: "Вопрос 2",
    isCorrect: false,
    timedOut: true,
    selectedAnswer: "",
    wrongChoices: [],
    correctAnswer: "B",
    explanation: "Время вышло."
  });
  assert.ok(html.includes("Время истекло"));
  assert.ok(html.includes("Правильный ответ: B"));
});

test("reviewRow renders wrong choices", () => {
  const html = reviewRow({
    position: 3,
    prompt: "Вопрос 3",
    isCorrect: false,
    timedOut: false,
    selectedAnswer: "A",
    wrongChoices: ["A", "C"],
    correctAnswer: "B",
    explanation: "Неверно."
  });
  assert.ok(html.includes("Ошибочные действия: A; C"));
});

test("reviewRow escapes HTML", () => {
  const html = reviewRow({
    position: 4,
    prompt: "<img src=x>",
    isCorrect: false,
    timedOut: false,
    selectedAnswer: "<b>bad</b>",
    wrongChoices: ["<script>"],
    correctAnswer: "C",
    explanation: "<i>bad</i>"
  });
  assert.ok(!html.includes("<img>"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>"));
  assert.ok(!html.includes("<i>"));
  assert.ok(html.includes("&lt;img src=x&gt;"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;"));
  assert.ok(html.includes("&lt;i&gt;"));
});



