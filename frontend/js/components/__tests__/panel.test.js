import { test } from "node:test";
import { strict as assert } from "node:assert";
import { panel } from "../panel.js";

test("panel renders title and children", () => {
  const html = panel({ title: "Заголовок", children: "<p>Содержимое</p>" });
  assert.ok(html.includes('class="panel"'));
  assert.ok(html.includes("<h2>Заголовок</h2>"));
  assert.ok(html.includes("<p>Содержимое</p>"));
});

test("panel renders without title", () => {
  const html = panel({ children: "<p>Только контент</p>" });
  assert.ok(html.includes('class="panel"'));
  assert.ok(html.includes("<p>Только контент</p>"));
  assert.ok(!html.includes("<h2>"));
});

test("panel renders className", () => {
  const html = panel({ className: "result", children: "<p>Результат</p>" });
  assert.ok(html.includes('class="panel result"'));
});

test("panel escapes HTML in title", () => {
  const html = panel({ title: "<script>", children: "<b>x</b>" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  // Children are inserted as-is (caller is responsible for escaping)
  assert.ok(html.includes("<b>x</b>"));
});



