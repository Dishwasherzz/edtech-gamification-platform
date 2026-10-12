export function renderDashboard() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="placeholder-card">
      <h2 style="color: #22c55e;">Главная страница (Дашборд)</h2>
      <p style="color: #6c757d; margin: 10px 0;">Здесь будут темы курса и ваш прогресс</p>
      <div class="skeleton-bar" style="width: 60%;"></div>
      <div class="skeleton-bar" style="width: 40%;"></div>
    </div>
  `;
  return div;
}