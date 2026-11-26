import { test } from "node:test";
import { strict as assert } from "node:assert";
import { historyTable } from "../history-table.js";

test("historyTable renders empty state", () => {
  const html = historyTable({ history: [] });
  assert.ok(html.includes("Пока нет завершенных попыток"));
  assert.ok(html.includes("Открыть первую тему"));
});

test("historyTable renders attempts", () => {
  const html = historyTable({
    history: [
      { id: "a1", topicTitle: "Тема 1", mode: "Boss", startedAt: "2026-01-01T10:00:00Z", status: "Passed", xp: 100, coins: 50 }
    ]
  });
  assert.ok(html.includes('class="history-table"'));
  assert.ok(html.includes("Тема 1"));
  assert.ok(html.includes("Победа"));
  assert.ok(html.includes("+100 XP<br>+50 монет"));
});

test("historyTable renders failed attempt", () => {
  const html = historyTable({
    history: [
      { id: "a2", topicTitle: "Тема 2", mode: "Crisis", startedAt: "2026-01-02T10:00:00Z", status: "Failed", xp: 0, coins: 0 }
    ]
  });
  assert.ok(html.includes("Поражение"));
  assert.ok(html.includes("—"));
});

test("historyTable accepts direct array as well as object", () => {
  const html = historyTable([
    { id: "a4", topicTitle: "Прямой массив", mode: "Boss", startedAt: "2026-01-04T10:00:00Z", status: "Passed", xp: 50, coins: 25 }
  ]);
  assert.ok(html.includes('class="history-table"'));
  assert.ok(html.includes("Прямой массив"));
  assert.ok(html.includes("Победа"));
});

test("historyTable escapes HTML", () => {
  const html = historyTable({
    history: [
      { id: "a3", topicTitle: "<img>", mode: "Boss", startedAt: "2026-01-03T10:00:00Z", status: "Passed", xp: 10, coins: 5 }
    ]
  });
  assert.ok(!html.includes("<img>"));
  assert.ok(html.includes("&lt;img&gt;"));
});



