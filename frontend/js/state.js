export const state = {
  isAuth: true,
  user: {
    name: "Студент-Электрик",
    rank: 1,
    xp: 0,
    coins: 50
  }
};

export function updateHeaderUI() {
  const rankEl = document.getElementById('header-rank');
  const xpEl = document.getElementById('header-xp');
  const coinsEl = document.getElementById('header-coins');
  const authBtn = document.getElementById('auth-btn');

  if (rankEl) rankEl.textContent = `Разряд: ${state.user.rank}`;
  if (xpEl) xpEl.textContent = `XP: ${state.user.xp}`;
  if (coinsEl) coinsEl.textContent = `${state.user.coins}`;
  if (authBtn) authBtn.textContent = state.isAuth ? "Профиль" : "Регистрация";
}

export function addRewards(xp, coins) {
  state.user.xp += xp;
  state.user.coins += coins;
  updateHeaderUI();
}