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
      { label: "Выйти", value: "logout", kind: "is-error" },
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

// Выпадающее меню профиля в шапке.
const accountToggle = document.getElementById("account-toggle");
const profileMenu = document.getElementById("menu-panel");
const closeMenu = () => { if (profileMenu && accountToggle) { profileMenu.hidden = true; accountToggle.setAttribute("aria-expanded", "false"); } };

if (accountToggle && profileMenu) {
  accountToggle.onclick = event => {
    event.stopPropagation();
    const willOpen = profileMenu.hidden;
    profileMenu.hidden = !willOpen;
    accountToggle.setAttribute("aria-expanded", String(willOpen));
  };
  profileMenu.onclick = event => { if (event.target.closest("a")) closeMenu(); };
  document.addEventListener("click", event => {
    if (!profileMenu.hidden && !accountToggle.contains(event.target) && !profileMenu.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
}

// Выезжающее меню на узких экранах.
const sheetToggle = document.getElementById("mobile-menu-toggle");
const sheet = document.getElementById("mobile-sheet");
const closeSheet = () => { if (sheet && sheetToggle) { sheet.hidden = true; sheetToggle.setAttribute("aria-expanded", "false"); } };

if (sheetToggle && sheet) {
  sheetToggle.onclick = event => {
    event.stopPropagation();
    const willOpen = sheet.hidden;
    sheet.hidden = !willOpen;
    sheetToggle.setAttribute("aria-expanded", String(willOpen));
  };
  sheet.onclick = event => { if (event.target.closest("a")) closeSheet(); };
  document.addEventListener("click", event => {
    if (!sheet.hidden && !sheetToggle.contains(event.target) && !sheet.contains(event.target)) closeSheet();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeSheet(); });
}

try { await refreshProfile(); }
catch (error) { clearSession(); if (error.status !== 401) document.getElementById("global-error").textContent = error.message; }
updateHeaderUI();
window.addEventListener("hashchange", () => { closeMenu(); closeSheet(); handleRoute(); });
await handleRoute();
