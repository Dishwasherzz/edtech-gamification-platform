import { test } from "node:test";
import { strict as assert } from "node:assert";
import { topicRow } from "../topic-row.js";

const statusName = (s) => ({ Completed: "Пройдена", Available: "Доступна", Locked: "Закрыта" })[s] || s;

test("topicRow renders available topic with link", () => {
  const topic = { id: "t1", title: "Постоянный ток", status: "Available", subtitle: "Описание", sortOrder: 1 };
  const html = topicRow(topic, 1, { statusName });
  assert.ok(html.includes('class="topic-row"'));
  assert.ok(html.includes('href="#/topic/t1"'));
  assert.ok(html.includes("Постоянный ток"));
  assert.ok(html.includes("Доступна"));
  assert.ok(!html.includes("locked"));
});

test("topicRow renders locked topic without link", () => {
  const topic = { id: "t2", title: "Закрытая тема", status: "Locked", sortOrder: 2 };
  const html = topicRow(topic, 2, { statusName });
  assert.ok(html.includes('class="topic-row locked"'));
  assert.ok(html.includes('aria-disabled="true"'));
  assert.ok(!html.includes('href="#/topic/t2"'));
  assert.ok(html.includes("Закрыта"));
  assert.ok(html.includes("button small-button is-disabled"));
  assert.ok(html.includes("Недоступно"));
});

test("topicRow defaults statusName when mapped directly", () => {
  const list = [
    { id: "t1", title: "Тема 1", status: "Completed" },
    { id: "t2", title: "Тема 2", status: "Available" },
    { id: "t3", title: "Тема 3", status: "Locked" }
  ];
  const html = list.map(topicRow).join("");
  assert.ok(html.includes("Пройдена"));
  assert.ok(html.includes("Доступна"));
  assert.ok(html.includes("Закрыта"));
});

test("topicRow renders completed topic with repeat link", () => {
  const topic = { id: "t3", title: "Пройденная", status: "Completed", subtitle: "Ещё раз", sortOrder: 3 };
  const html = topicRow(topic, 3, { statusName });
  assert.ok(html.includes("Повторить тему"));
  assert.ok(html.includes("Ещё раз"));
});

test("topicRow escapes HTML in title", () => {
  const topic = { id: "t4", title: "<img src=x onerror=alert(1)>", status: "Available", sortOrder: 4 };
  const html = topicRow(topic, 4, { statusName });
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});



