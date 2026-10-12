import { state, updateHeaderUI } from '../state.js';
import { loginUser } from '../api.js';

export function renderAuth() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="card" style="max-width: 400px; margin: 0 auto;">
      <h2>Вход в систему</h2>
      <label>Email:<input type="email" value="student@mpei.ru"></label>
      <label>Пароль:<input type="password" value="******"></label>
      <button id="login-btn" class="btn" style="width: 100%; margin-top: 10px;">Войти</button>
    </div>
  `;

  div.querySelector('#login-btn').onclick = async () => {
    await loginUser("email", "pass");
    state.isAuth = true;
    updateHeaderUI();
    window.location.hash = '#/profile';
  };

  return div;
}