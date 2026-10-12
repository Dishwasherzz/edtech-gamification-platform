const API_URL = "http://localhost:5000/api";

export async function loginUser(email, password) {
  console.log(`Запрос логина к ${API_URL}`);
  return { success: true, token: "fake-jwt-token" };
}

export async function saveProgress(score) {
  console.log(`Отправка очков на сервер: ${score}`);
  return { success: true };
}