import { api } from "./api.js";

// displayName — локальная правка ника. Серверного маршрута для его смены нет,
// поэтому refreshProfile() перезаписывает state.user и забыл бы правку.
export const state = { isAuth: false, user: null, displayName: null };

export function updateHeaderUI() {
  // По макету в шапке либо «Войти», либо «Выйти» и строка прогресса — не оба сразу.
  const link = document.getElementById("auth-btn");
  link.hidden = state.isAuth;
  link.textContent = "Войти";
  link.href = "#/auth";

  const counters = document.getElementById("header-progress");
  counters.hidden = !state.isAuth;
  counters.textContent = state.isAuth
    ? `Разряд ${state.user.rank} · ${state.user.totalXp} XP · ${state.user.coinsBalance} монет`
    : "";

  document.getElementById("logout-btn").hidden = !state.isAuth;
}

export async function refreshProfile() {
  state.user = await api.profile();
  if (state.displayName !== null) state.user.displayName = state.displayName;
  state.isAuth = true;
  updateHeaderUI();
  return state.user;
}

// Никнейм меняется только в памяти вкладки: серверного маршрута для
// его смены нет, поэтому после обновления страницы вернётся прежний.
export function setDisplayName(displayName) {
  state.displayName = displayName;
  if (state.user) state.user.displayName = displayName;
  updateHeaderUI();
}

export function clearSession() {
  state.user = null;
  state.isAuth = false;
  state.displayName = null;
  updateHeaderUI();
}
