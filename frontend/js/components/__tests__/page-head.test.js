import { test } from "node:test";
import { strict as assert } from "node:assert";
import { pageHead } from "../page-head.js";

test("pageHead renders title and description", () => {
  const html = pageHead({ title: "Заголовок", description: "Описание страницы" });
  assert.ok(html.includes('class="page-head"'));
  assert.ok(html.includes("<h1>Заголовок</h1>"));
  assert.ok(html.includes("<p>Описание страницы</p>"));
});

test("pageHead renders eyebrow", () => {
  const html = pageHead({ title: "Тема", eyebrow: "Метка" });
  assert.ok(html.includes('<span class="eyebrow">Метка</span>'));
  assert.ok(html.includes("<h1>Тема</h1>"));
});

test("pageHead renders actions", () => {
  const html = pageHead({ title: "Страница", actions: "<a href=\"#/\">На главную</a>" });
  assert.ok(html.includes('class="top-actions"'));
  assert.ok(html.includes("На главную"));
});

test("pageHead renders className", () => {
  const html = pageHead({ title: "Персонаж", className: "character-head" });
  assert.ok(html.includes('class="page-head character-head"'));
});

test("pageHead escapes HTML", () => {
  const html = pageHead({ title: "<script>alert(1)</script>", description: "<b>desc</b>" });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;"));
});



