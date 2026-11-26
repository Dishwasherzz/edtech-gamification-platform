import { test } from "node:test";
import { strict as assert } from "node:assert";
import { backLink } from "../back-link.js";

test("backLink renders default link", () => {
  const html = backLink();
  assert.ok(html.includes('class="back-link"'));
  assert.ok(html.includes('href="#/"'));
  assert.ok(html.includes("← Назад"));
});

test("backLink renders custom href and label", () => {
  const html = backLink({ href: "#/topics", label: "Все темы" });
  assert.ok(html.includes('href="#/topics"'));
  assert.ok(html.includes("← Все темы"));
});

test("backLink escapes HTML", () => {
  const html = backLink({ href: "javascript:alert(1)", label: "<b>x</b>" });
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;b&gt;"));
});



