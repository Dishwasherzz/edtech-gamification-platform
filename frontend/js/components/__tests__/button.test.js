import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buttonEdge, buttonLink, buttonAction } from "../button.js";

test("buttonEdge renders label inside button-label span", () => {
  const html = buttonEdge("Кнопка");
  assert.ok(html.includes("<span class=\"button-edge\" aria-hidden=\"true\"></span>"));
  assert.ok(html.includes("<span class=\"button-label\">Кнопка</span>"));
});

test("buttonEdge escapes HTML in label", () => {
  const html = buttonEdge("<script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("buttonLink renders anchor with button classes", () => {
  const html = buttonLink({ href: "#/topics", label: "К темам", kind: "outline" });
  assert.ok(html.includes('class="button outline"'));
  assert.ok(html.includes('href="#/topics"'));
  assert.ok(html.includes("К темам"));
});

test("buttonLink adds disabled attribute when disabled", () => {
  const html = buttonLink({ href: "#/", label: "Выход", disabled: true });
  assert.ok(html.includes(" disabled"));
});

test("buttonAction renders button element", () => {
  const html = buttonAction({ label: "Сохранить", dataset: { save: "" } });
  assert.ok(html.includes('type="button"'));
  assert.ok(html.includes('class="button"'));
  assert.ok(html.includes('data-save=""'));
  assert.ok(html.includes("Сохранить"));
});

test("buttonAction renders submit type", () => {
  const html = buttonAction({ label: "Войти", type: "submit" });
  assert.ok(html.includes('type="submit"'));
});

test("buttonAction escapes HTML in dataset values", () => {
  const html = buttonAction({ label: "ОК", dataset: { id: "<svg onload=alert(1)>" } });
  assert.ok(!html.includes("<svg"));
  assert.ok(html.includes("&lt;svg onload=alert(1)&gt;"));
});



