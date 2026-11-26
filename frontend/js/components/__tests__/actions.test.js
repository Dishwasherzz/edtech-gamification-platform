import { test } from "node:test";
import { strict as assert } from "node:assert";
import { actions } from "../actions.js";

test("actions renders children in div.actions", () => {
  const html = actions({ children: "<button>Кнопка</button>" });
  assert.ok(html.includes('class="actions"'));
  assert.ok(html.includes("<button>Кнопка</button>"));
});

test("actions handles empty children", () => {
  const html = actions({});
  assert.ok(html.includes('class="actions"'));
  assert.ok(html.includes("<div class=\"actions\"></div>"));
});



