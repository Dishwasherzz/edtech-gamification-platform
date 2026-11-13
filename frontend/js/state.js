import { api } from "./api.js";
import { assetUrl } from "./assets.js";

// Профиль, полученный с сервера: никаких локальных начислений XP или монет.
// `user.hero` — выбранный герой, `user.mascot` — спутник, `user.characterSkin` — скин.
export const state = { isAuth: false, user: null, mascotVisible: true };

const MASCOT_KEY = "edtech.mascot.visible";

// Видимость спутника — локальная настройка вкладки: сервер её не хранит.
export function loadMascotPreference() {
  try {
    const raw = localStorage.getItem(MASCOT_KEY);
    if (raw !== null) state.mascotVisible = raw === "1";
  } catch {
    // Приватный режим может запрещать localStorage — тогда остаётся значение по умолчанию.
  }
  return state.mascotVisible;
}

export function setMascotVisible(value) {
  state.mascotVisible = Boolean(value);
  try { localStorage.setItem(MASCOT_KEY, state.mascotVisible ? "1" : "0"); } catch { /* см. loadMascotPreference */ }
  window.dispatchEvent(new Event("mascot-visibility"));
  return state.mascotVisible;
}

// Заголовок раздела в шапке: «Учебный курс / Главная».
export function setContext(text) {
  const target = document.querySelector("[data-context]");
  if (target) target.textContent = text ? `Учебный курс / ${text}` : "Учебный курс";
}

export function updateHeaderUI() {
  // Гостевая оболочка без сайдбара и без хлебных crumbs — как в макете.
  document.body.classList.toggle("is-guest", !state.isAuth);

  const guestOnly = document.querySelectorAll("[data-guest-nav]");
  guestOnly.forEach(item => { item.hidden = state.isAuth; });
  const authOnly = document.querySelectorAll("[data-auth-nav]");
  authOnly.forEach(item => { item.hidden = !state.isAuth; });

  const menu = document.getElementById("menu-panel");
  if (menu) {
    menu.querySelectorAll("[data-auth]").forEach(item => { item.hidden = !state.isAuth; });
    menu.querySelectorAll("[data-guest]").forEach(item => { item.hidden = state.isAuth; });
    const account = menu.querySelector("[data-account]");
    if (account) account.textContent = state.isAuth ? state.user.displayName : "Гость";
  }

  const avatar = document.getElementById("header-avatar");
  if (avatar) {
    // В шапке — портрет спутника: полный рост персонажа здесь нечитаем.
    const image = assetUrl([state.user?.mascot?.assetKey, state.user?.hero?.assetKey]);
    avatar.style.backgroundImage = image ? `url("${image}")` : "";
    avatar.textContent = image ? "" : "⚡";
  }
}

export async function refreshProfile() {
  state.user = await api.profile();
  state.isAuth = true;
  updateHeaderUI();
  return state.user;
}

export function clearSession() {
  state.user = null;
  state.isAuth = false;
  updateHeaderUI();
}
