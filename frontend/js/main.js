import { api } from "./api.js";
import { state, clearSession, refreshProfile, updateHeaderUI } from "./state.js";
import { handleRoute } from "./router.js";

window.addEventListener("session-expired", () => {
  const wasAuthenticated = state.isAuth;
  clearSession();
  if (wasAuthenticated || (window.location.hash && !["#/", "#/auth"].includes(window.location.hash)))
    window.location.hash = "#/auth";
});
document.getElementById("logout-btn").onclick = async event => {
  event.target.disabled = true;
  try { await api.logout(); clearSession(); window.location.hash = "#/auth"; }
  catch (error) { document.getElementById("global-error").textContent = error.message; }
  finally { event.target.disabled = false; }
};
try { await refreshProfile(); }
catch (error) { clearSession(); if (error.status !== 401) document.getElementById("global-error").textContent = error.message; }
updateHeaderUI();
window.addEventListener("hashchange", handleRoute);
await handleRoute();
