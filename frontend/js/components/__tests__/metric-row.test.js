import { test } from "node:test";
import { strict as assert } from "node:assert";
import { metricRow } from "../metric-row.js";

test("metricRow renders label and value", () => {
  const html = metricRow({ label: "Вопросов", value: "7" });
  assert.ok(html.includes('class="metric-row"'));
  assert.ok(html.includes("<span>Вопросов</span>"));
  assert.ok(html.includes("<strong class=\"\">7</strong>"));
});

test("metricRow supports custom value class", () => {
  const html = metricRow({ label: "HP", value: "100%", valueClass: "num" });
  assert.ok(html.includes('<strong class="num">100%</strong>'));
});

test("metricRow escapes HTML", () => {
  const html = metricRow({ label: "<img>", value: "<b>10</b>" });
  assert.ok(!html.includes("<img>"));
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;img&gt;"));
  assert.ok(html.includes("&lt;b&gt;"));
});



