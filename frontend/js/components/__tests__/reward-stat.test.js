import { test } from "node:test";
import { strict as assert } from "node:assert";
import { rewardStat } from "../reward-stat.js";

test("rewardStat renders label and value", () => {
  const html = rewardStat({ label: "Опыт", value: "+50" });
  assert.ok(html.includes('class="reward-stat"'));
  assert.ok(html.includes("<span>Опыт</span>"));
  assert.ok(html.includes("<strong>+50</strong>"));
});

test("rewardStat escapes HTML", () => {
  const html = rewardStat({ label: "<script>alert(1)</script>", value: "+<b>50</b>" });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;"));
});



