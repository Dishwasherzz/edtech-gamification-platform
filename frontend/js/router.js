import { renderDashboard } from "./views/dashboard.js";
import { renderProfile } from "./views/profile.js";
import { renderAuth } from "./views/auth.js";
import { renderRegister } from "./views/register.js";
import { renderSettings } from "./views/settings.js";
import { renderTopic, renderLesson } from "./views/theory.js";
import { renderAttempt } from "./views/attempt.js";
import { renderInstructions } from "./views/instructions.js";
import { renderTopics } from "./views/topics.js";
import { state } from "./state.js";

let version = 0;
let dispose = () => {};

// Активный пункт меню подчёркивается розовым, как в макете.
function markActiveNav(hash) {
  const current = hash.replace(/^#\/?/, "").split("?")[0];
  document.querySelectorAll(".nav-links a").forEach(link => {
    const target = link.getAttribute("href").replace(/^#\/?/, "").split("?")[0];
    if (target === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export async function handleRoute() {
  dispose(); dispose = () => {};
  const currentVersion = ++version;
  const url = new URL((window.location.hash || "#/").slice(1), window.location.origin);
  const parts = url.pathname.split("/").filter(Boolean);
  if (!state.isAuth && parts.length && parts[0] !== "auth") { window.location.hash = "#/auth"; return; }
  if (parts[0] === "auth" && state.isAuth) { window.location.hash = "#/"; return; }
  const app = document.getElementById("app");
  app.setAttribute("aria-busy", "true"); app.textContent = "Загрузка…";
  try {
    let view;
    if (!parts.length) view = await renderDashboard();
    else if (parts[0] === "auth" && parts[1] === "register") view = renderRegister();
    else if (parts[0] === "auth") view = renderAuth();
    else if (parts[0] === "settings") view = renderSettings();
    else if (parts[0] === "profile") view = await renderProfile(Math.max(1, Number(url.searchParams.get("page")) || 1));
    else if (parts[0] === "topic" && parts[1]) view = await renderTopic(parts[1]);
    else if (parts[0] === "lesson" && parts[1]) view = await renderLesson(parts[1]);
    else if (parts[0] === "attempt" && parts[1]) view = await renderAttempt(parts[1]);
    else if (parts[0] === "instructions") view = await renderInstructions();
    else if (parts[0] === "topics") view = await renderTopics();
    else throw new Error("Страница не найдена.");
    if (currentVersion !== version) { view.dispose?.(); return; }
    app.replaceChildren(view); dispose = () => view.dispose?.();
    markActiveNav(window.location.hash || "#/");
  } catch (error) {
    if (currentVersion !== version) return;
    const box = document.createElement("div"); box.className = "card";
    const message = document.createElement("p"); message.className = "error"; message.setAttribute("role", "alert"); message.textContent = error.message;
    const retry = document.createElement("button"); retry.className = "btn secondary"; retry.textContent = "Повторить"; retry.onclick = handleRoute;
    box.append(message, retry); app.replaceChildren(box);
  } finally { if (currentVersion === version) app.removeAttribute("aria-busy"); }
}
