import { api } from "./api.js";

export const state = { isAuth: false, user: null };

export function updateHeaderUI() {
  const link = document.getElementById("auth-btn");
  link.textContent = state.isAuth ? state.user.displayName : "Войти / Регистрация";
  link.href = state.isAuth ? "#/profile" : "#/auth";
  const counters = document.getElementById("header-progress");
  counters.hidden = !state.isAuth;
  counters.textContent = state.isAuth ? `Разряд ${state.user.rank} · ${state.user.totalXp} XP · ${state.user.coinsBalance} монет` : "";
  document.getElementById("logout-btn").hidden = !state.isAuth;
}

export async function refreshProfile() {
  state.user = await api.profile();
  state.isAuth = true;
  updateHeaderUI();
  return state.user;
}

export function clearSession() { state.user = null; state.isAuth = false; updateHeaderUI(); }
