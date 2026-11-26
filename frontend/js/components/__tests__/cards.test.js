import { test } from "node:test";
import { strict as assert } from "node:assert";
import { heroCard, skinCard } from "../cards.js";

test("heroCard renders selected hero card", () => {
  const html = heroCard({ hero: { key: "phase", name: "Фаза" }, checked: true, labels: { phase: "Мужской персонаж" } });
  assert.ok(html.includes('class="character-card selected"'));
  assert.ok(html.includes('data-hero="phase"'));
  assert.ok(html.includes("aria-checked=\"true\""));
  assert.ok(html.includes("Мужской персонаж"));
  assert.ok(html.includes("✓"));
  assert.ok(html.includes("Выбран"));
});

test("heroCard renders unselected hero card", () => {
  const html = heroCard({ hero: { key: "ampere", name: "Ампер" }, checked: false, labels: { ampere: "Женский персонаж" } });
  assert.ok(html.includes('class="character-card"'));
  assert.ok(html.includes('aria-checked="false"'));
  assert.ok(html.includes("Женский персонаж"));
  assert.ok(!html.includes("✓"));
  assert.ok(html.includes("Выбрать персонажа"));
});

test("heroCard escapes HTML in hero name", () => {
  const html = heroCard({ hero: { key: "x", name: "<script>alert(1)</script>" }, checked: false, labels: {} });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("skinCard renders purchasable skin", () => {
  const html = skinCard({
    skin: {
      id: "s1", name: "Медный", description: "Описание скина", priceCoins: 100,
      isStarter: false, isOwned: false, isEquipped: false, isForSale: true,
      assetKey: "/assets/skins/copper.png"
    },
    balance: 200
  });
  assert.ok(html.includes('class="panel skin-card"'));
  assert.ok(html.includes('data-skin="s1"'));
  assert.ok(html.includes("Медный"));
  assert.ok(html.includes("Описание скина"));
  assert.ok(html.includes("100 монет"));
  assert.ok(html.includes('src="/assets/skins/copper.png"'));
});

test("skinCard renders equipped skin", () => {
  const html = skinCard({
    skin: { id: "s2", name: "Надето", description: "d", priceCoins: 50, isStarter: false, isOwned: true, isEquipped: true, isForSale: false },
    balance: 0
  });
  assert.ok(html.includes("is-equipped"));
  assert.ok(html.includes("Надето"));
  assert.ok(!html.includes("Купить"));
});

test("skinCard falls back to picture-mark for unmapped logical assetKey", () => {
  const html = skinCard({
    skin: { id: "s5", name: "Искра", description: "d", priceCoins: 50, isStarter: false, isOwned: false, isEquipped: false, isForSale: true, assetKey: "skins/spark" },
    balance: 100
  });
  assert.ok(html.includes('class="picture-mark"'));
  assert.ok(!html.includes("<img"));
});

test("skinCard renders disabled buy when insufficient balance", () => {
  const html = skinCard({
    skin: { id: "s3", name: "Дорогой", description: "d", priceCoins: 999, isStarter: false, isOwned: false, isEquipped: false, isForSale: true },
    balance: 10
  });
  assert.ok(html.includes("is-disabled"));
  assert.ok(html.includes(" disabled"));
});

test("skinCard escapes HTML in skin fields", () => {
  const html = skinCard({
    skin: { id: "s4", name: "<img src=x>", description: "<script>alert(1)</script>", priceCoins: 10, isStarter: false, isOwned: false, isEquipped: false, isForSale: true },
    balance: 100
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("onerror"));
  assert.ok(html.includes("&lt;img src=x&gt;"));
});



