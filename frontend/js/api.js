let csrfToken;

export class ApiError extends Error {
  constructor(status, problem) {
    const validation = Object.values(problem.errors || {}).flat().join(" ");
    const title = problem.title === "Invalid credentials." ? "Неверный email или пароль." : problem.title;
    super(validation || title || `Не удалось выполнить запрос (${status}).`);
    this.status = status;
    this.code = problem.code;
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
  const data = text ? JSON.parse(text) : null;
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
  register: (email, password, displayName) => request("/auth/register", "POST", { email, password, displayName }),
  login: async (email, password) => { await request("/auth/login", "POST", { email, password }); csrfToken = undefined; await refreshCsrf(); },
  logout: async () => { await request("/auth/logout", "POST", {}); csrfToken = undefined; },
  profile: () => request("/me"), courses: () => request("/courses"),
  topics: id => request(`/courses/${encodeURIComponent(id)}/topics`),
  topic: id => request(`/topics/${encodeURIComponent(id)}`),
  lesson: id => request(`/lessons/${encodeURIComponent(id)}`),
  complete: id => request(`/me/lessons/${encodeURIComponent(id)}/completion`, "PUT", {}),
  start: id => request(`/assessments/${encodeURIComponent(id)}/attempts`, "POST", {}),
  begin: id => request(`/attempts/${encodeURIComponent(id)}/begin`, "POST", {}),
  attempt: id => request(`/attempts/${encodeURIComponent(id)}`),
  answer: (id, questionId, selectedOptionId, requestId) => request(`/attempts/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}/answer`, "PUT", { selectedOptionId, requestId }),
  abandon: id => request(`/attempts/${encodeURIComponent(id)}/abandon`, "POST", {}),
  active: () => request("/me/attempts/active"), history: page => request(`/me/attempts?page=${page}`),
  instructions: () => request("/instructions")
};
