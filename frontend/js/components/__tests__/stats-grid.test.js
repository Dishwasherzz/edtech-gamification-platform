import { test } from "node:test";
import { strict as assert } from "node:assert";
import { statsGrid } from "../stats-grid.js";

test("statsGrid renders stats", () => {
  const html = statsGrid({
    items: [
      { label: "Опыт", value: "100", unit: "XP" },
      { label: "Баланс", value: "50", unit: "монет" }
    ]
  });
  assert.ok(html.includes('class="stats"'));
  assert.ok(html.includes("class=\"stat\""));
  assert.ok(html.includes("<span>Опыт</span>"));
  assert.ok(html.includes("<strong>100 <span class=\"unit\">XP</span></strong>"));
  assert.ok(html.includes("<span>Баланс</span>"));
  assert.ok(html.includes("<strong>50 <span class=\"unit\">монет</span></strong>"));
});

test("statsGrid handles empty items", () => {
  const html = statsGrid({ items: [] });
  assert.ok(html.includes('class="stats"'));
  assert.ok(!html.includes("class=\"stat\""));
});

test("statsGrid escapes HTML", () => {
  const html = statsGrid({ items: [{ label: "<script>", value: "<b>1</b>", unit: "<i>u</i>" }] });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>"));
  assert.ok(!html.includes("<i>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;"));
  assert.ok(html.includes("&lt;i&gt;"));
});



