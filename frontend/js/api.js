let csrfToken;

export class ApiError extends Error {
  constructor(status, problem) {
    const errors = problem.errors || {};
    const validation = Object.values(errors).flat().join(" ");
    const title = problem.title === "Invalid credentials." ? "Неверный email или пароль." : problem.title;
    super(validation || title || `Не удалось выполнить запрос (${status}).`);
    this.status = status;
    this.code = problem.code;
    this.errors = errors;
  }
}

async function refreshCsrf() {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Не удалось подготовить защищённое соединение. Обнови страницу.");
  csrfToken = (await response.json()).token;
}

async function request(path, method = "GET", body, retried = false) {
  const changesData = method !== "GET";
  if (changesData && !csrfToken) await refreshCsrf();
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(changesData ? { "X-CSRF-TOKEN": csrfToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error("Нет связи с сервером. Проверь соединение и повтори запрос.");
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = null; }
  }
  if (!response.ok) {
    if (response.status === 400 && data?.code === "InvalidCsrfToken" && !retried) {
      await refreshCsrf();
      return request(path, method, body, true);
    }
    if (response.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(response.status, data || {});
  }
  return data;
}

export const api = {
  // --- Аккаунт -------------------------------------------------------
  registration: () => request("/auth/registration"),
  register: payload => request("/auth/register", "POST", payload),
  login: async (email, password) => { await request("/auth/login", "POST", { email, password }); csrfToken = undefined; await refreshCsrf(); },
  logout: async () => { await request("/auth/logout", "POST", {}); csrfToken = undefined; },
  forgotPassword: email => request("/auth/forgot-password", "POST", { email }),
  resetPassword: (userId, token, newPassword) => request("/auth/reset-password", "POST", { userId, token, newPassword }),

  // --- Профиль и настройки -------------------------------------------
  profile: () => request("/me"),
  updateNickname: displayName => request("/me/nickname", "PUT", { displayName }),
  updateHero: heroKey => request("/me/hero", "PUT", { heroKey }),
  updatePassword: (currentPassword, newPassword) => request("/me/password", "PUT", { currentPassword, newPassword }),
  deleteAccount: password => request("/me", "DELETE", { password }),

  // --- Каталог --------------------------------------------------------
  courses: () => request("/courses"),
  topics: id => request(`/courses/${encodeURIComponent(id)}/topics`),
  topic: id => request(`/topics/${encodeURIComponent(id)}`),
  lesson: id => request(`/lessons/${encodeURIComponent(id)}`),
  complete: id => request(`/me/lessons/${encodeURIComponent(id)}/completion`, "PUT", {}),
  publicCourses: () => request("/public/courses"),
  publicTopics: id => request(`/public/courses/${encodeURIComponent(id)}/topics`),
  journey: id => request(`/me/courses/${encodeURIComponent(id)}/journey`),
  claimCompletion: id => request(`/me/courses/${encodeURIComponent(id)}/completion/claim`, "POST", {}),

  // --- Испытания -------------------------------------------------------
  start: id => request(`/assessments/${encodeURIComponent(id)}/attempts`, "POST", {}),
  begin: id => request(`/attempts/${encodeURIComponent(id)}/begin`, "POST", {}),
  attempt: id => request(`/attempts/${encodeURIComponent(id)}`),
  answer: (id, questionId, selectedOptionId, requestId) => request(`/attempts/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}/answer`, "PUT", { selectedOptionId, requestId }),
  abandon: id => request(`/attempts/${encodeURIComponent(id)}/abandon`, "POST", {}),
  active: () => request("/me/attempts/active"),
  history: page => request(`/me/attempts?page=${page}`),
  instructions: () => request("/instructions"),

  // --- Магазин и внешний вид -------------------------------------------
  shopSkins: () => request("/shop/skins"),
  mySkins: () => request("/me/skins"),
  appearance: () => request("/me/appearance"),
  equipSkin: skinId => request("/me/skin", "PUT", { skinId }),
  mascots: () => request("/mascots"),
  mascot: id => request(`/mascots/${encodeURIComponent(id)}`),
  selectMascot: mascotId => request("/me/mascot", "PUT", { mascotId }),
  purchaseSkin: (skinId, requestId) => request(`/shop/skins/${encodeURIComponent(skinId)}/purchase`, "POST", { requestId }),
  purchases: page => request(`/me/purchases?page=${page}`)
};
