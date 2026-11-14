import { api } from "./api.js";
import { state, clearSession, refreshProfile, updateHeaderUI, loadMascotPreference } from "./state.js";
import { handleRoute } from "./router.js";
import { askDialog } from "./ui.js";

loadMascotPreference();

window.addEventListener("session-expired", () => {
  const wasAuthenticated = state.isAuth;
  clearSession();
  // Истёкшая сессия — отдельный экран. Гостю показываем вход, а не ошибку.
  if (wasAuthenticated) window.location.hash = "#/session";
});

async function logout() {
  const answer = await askDialog({
    title: "Выйти из аккаунта?",
    body: "<p>Сохранённый прогресс останется в профиле. Если идёт испытание, его отсчёт не остановится.</p>",
    actions: [
      { label: "Выйти", value: "logout", kind: "" },
      { label: "Остаться", value: "stay", kind: "outline" }
    ]
  });
  if (answer !== "logout") return;
  try {
    await api.logout();
    clearSession();
    window.location.hash = "#/";
  } catch (error) {
    document.getElementById("global-error").textContent = error.message;
  }
}

document.querySelectorAll("[data-logout]").forEach(button => { button.onclick = logout; });

// Меню: дополнительные разделы профиля и выход.
const menuButton = document.getElementById("menu-btn");
const menuPanel = document.getElementById("menu-panel");
const closeMenu = () => { menuPanel.hidden = true; menuButton.setAttribute("aria-expanded", "false"); };

menuButton.onclick = event => {
  event.stopPropagation();
  const open = menuPanel.hidden;
  menuPanel.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
};
menuPanel.onclick = event => { if (event.target.closest("a")) closeMenu(); };
document.addEventListener("click", event => {
  if (!menuPanel.hidden && !menuPanel.contains(event.target) && event.target !== menuButton) closeMenu();
});
document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });

try { await refreshProfile(); }
catch (error) { clearSession(); if (error.status !== 401) document.getElementById("global-error").textContent = error.message; }
updateHeaderUI();
window.addEventListener("hashchange", () => { closeMenu(); handleRoute(); });
await handleRoute();
