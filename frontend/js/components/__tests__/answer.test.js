import { test } from "node:test";
import { strict as assert } from "node:assert";
import { answerButton } from "../answer.js";

test("answerButton renders enabled answer", () => {
  const html = answerButton({ option: { id: "a1", text: "Вариант А" }, disabled: false });
  assert.ok(html.includes('class="answer"'));
  assert.ok(html.includes('data-option="a1"'));
  assert.ok(html.includes("Вариант А"));
  assert.ok(!html.includes("disabled"));
});

test("answerButton renders disabled answer", () => {
  const html = answerButton({ option: { id: "a2", text: "Вариант Б" }, disabled: true });
  assert.ok(html.includes(" disabled"));
});

test("answerButton renders already selected answer", () => {
  const html = answerButton({ option: { id: "a3", text: "Уже выбрано", isDisabled: true }, disabled: false });
  assert.ok(html.includes("disabled"));
  assert.ok(html.includes(" · уже выбрано"));
});

test("answerButton escapes HTML in option text", () => {
  const html = answerButton({ option: { id: "a4", text: "<b>bold</b>" }, disabled: false });
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;b&gt;"));
});



