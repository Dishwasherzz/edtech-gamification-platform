export function renderProfile() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="placeholder-card">
      <h2>Ваш прогресс</h2>
      <p style="color: #6c757d; margin: 10px 0;">Здесь будет статистика, разряд студента и баланс.</p>
    </div>
  `;
  return div;
}