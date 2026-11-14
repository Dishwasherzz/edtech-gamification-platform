import { renderDashboard, renderGuestGate } from "./views/dashboard.js";
import { renderProfile } from "./views/profile.js";
import { renderAuth } from "./views/auth.js";
import { renderRegister } from "./views/register.js";
import { renderSettings, renderAccountDeleted } from "./views/settings.js";
import { renderTopic, renderLesson, renderAssessmentBrief } from "./views/theory.js";
import { renderAttempt } from "./views/attempt.js";
import { renderInstructions } from "./views/instructions.js";
import { renderTopics } from "./views/topics.js";
import { renderConsent, renderConsentDeclined } from "./views/consent.js";
import { renderForgot, renderRecoverySent, renderReset, renderResetDone, renderResetInvalid } from "./views/recovery.js";
import { renderCharacter } from "./views/character.js";
import { renderShop } from "./views/shop.js";
import { renderCompletion } from "./views/completion.js";
import { renderDemo } from "./views/demo.js";
import { renderSessionExpired } from "./views/session.js";
import { state, setContext } from "./state.js";

let version = 0;
let dispose = () => {};

// Эти разделы доступны без входа: демо, инструкция, согласие и формы аккаунта.
const PUBLIC_ROOTS = new Set(["", "auth", "instructions", "demo", "consent", "session"]);

// Название раздела для шапки и сайдбара.
const SECTIONS = {
  "": "Главная",
  "demo": "Пример уровня",
  "topics": "Темы курса",
  "instructions": "Инструкция",
  "profile": "Профиль",
  "settings": "Профиль",
  "character": "Профиль",
  "shop": "Профиль",
  "completion": "Профиль",
  "topic": "Тема",
  "lesson": "Лекция",
  "attempt": "Испытание"
};
const PROFILE_SECTIONS = new Set(["profile", "settings", "character", "shop", "completion"]);

// Активный пункт меню подчёркивается розовым, как в макете.
function markActiveNav(hash) {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const current = path.split("?")[0];
  // Первый запуск: отдельная подпись в шапке и без основной навигации.
  const onboarding = current === "character" && /(^|&)first=1(&|$)/.test(query ?? "");
  document.body.classList.toggle("is-onboarding", onboarding);

  document.querySelectorAll(".navigation a").forEach(link => {
    const target = link.getAttribute("href").replace(/^#\/?/, "").split("?")[0];
    const root = current.split("/")[0];
    const guestGate = !state.isAuth && !PUBLIC_ROOTS.has(root);
    // На страницах аккаунта и под завесой для гостя подсвечена главная — как в макете.
    const active = target === current || (guestGate && target === "") ||
      (["auth", "consent"].includes(root) && target === "");
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelectorAll(".side-item[data-side]").forEach(item => {
    const side = item.dataset.side;
    const active = side === (current || "home") || (side === "profile" && PROFILE_SECTIONS.has(current));
    item.classList.toggle("selected", active);
  });
  setContext(onboarding ? "Первый запуск" : (SECTIONS[current] ?? ""), onboarding);
}

export async function handleRoute() {
  dispose(); dispose = () => {};
  const currentVersion = ++version;
  const url = new URL((window.location.hash || "#/").slice(1), window.location.origin);
  const parts = url.pathname.split("/").filter(Boolean);
  const root = parts[0] ?? "";

  if (root === "auth" && state.isAuth && !["reset", "reset/done", "reset/invalid", "recovery/sent"].includes(parts.slice(1).join("/"))) {
    window.location.hash = "#/";
    return;
  }

  const app = document.getElementById("app");
  app.setAttribute("aria-busy", "true"); app.textContent = "Загрузка…";
  try {
    let view;
    if (root === "account" && parts[1] === "deleted") view = renderAccountDeleted();
    else if (!state.isAuth && !PUBLIC_ROOTS.has(root)) {
      // Гость открыл личный раздел: главная под затемнением и предложением войти.
      view = await renderGuestGate();
    }
    else if (!parts.length) view = await renderDashboard();
    else if (root === "auth" && parts[1] === "register") view = await renderRegister();
    else if (root === "auth" && parts[1] === "forgot") view = renderForgot();
    else if (root === "auth" && parts[1] === "recovery" && parts[2] === "sent") view = renderRecoverySent();
    else if (root === "auth" && parts[1] === "reset" && parts[2] === "done") view = renderResetDone();
    else if (root === "auth" && parts[1] === "reset" && parts[2] === "invalid") view = renderResetInvalid();
    else if (root === "auth" && parts[1] === "reset") {
      view = renderReset(url.searchParams.get("userId"), url.searchParams.get("token"));
    }
    else if (root === "auth") view = renderAuth();
    else if (root === "settings") view = await renderSettings(url.searchParams.get("tab") ?? "account");
    else if (root === "profile") view = await renderProfile(Math.max(1, Number(url.searchParams.get("page")) || 1));
    else if (root === "topic" && parts[1] && parts[2] === "assessment" && parts[3]) {
      view = await renderAssessmentBrief(parts[1], parts[3]);
    }
    else if (root === "topic" && parts[1]) view = await renderTopic(parts[1]);
    else if (root === "lesson" && parts[1]) view = await renderLesson(parts[1]);
    else if (root === "attempt" && parts[1]) view = await renderAttempt(parts[1]);
    else if (root === "instructions") view = await renderInstructions();
    else if (root === "topics") view = await renderTopics();
    else if (root === "consent" && parts[1] === "declined") view = renderConsentDeclined();
    else if (root === "consent") view = await renderConsent();
    else if (root === "character") view = await renderCharacter({ first: url.searchParams.get("first") === "1" });
    else if (root === "shop") view = await renderShop(url.searchParams.get("tab") ?? "shop");
    else if (root === "completion") view = await renderCompletion(parts[1] ?? null);
    else if (root === "demo") view = renderDemo();
    else if (root === "session") view = renderSessionExpired();
    else throw new Error("Страница не найдена.");
    if (currentVersion !== version) { view.dispose?.(); return; }
    app.replaceChildren(view); dispose = () => view.dispose?.();
    markActiveNav(window.location.hash || "#/");
  } catch (error) {
    if (currentVersion !== version) return;
    const box = document.createElement("div"); box.className = "card";
    const message = document.createElement("p"); message.className = "error"; message.setAttribute("role", "alert"); message.textContent = error.message;
    const retry = document.createElement("button"); retry.className = "btn btn-outline"; retry.textContent = "Повторить"; retry.onclick = handleRoute;
    box.append(message, retry); app.replaceChildren(box);
  } finally { if (currentVersion === version) app.removeAttribute("aria-busy"); }
}
