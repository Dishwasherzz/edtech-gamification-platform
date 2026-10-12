import { renderDashboard } from './views/Dashboard.js';
// import { renderTheory } from './views/Theory.js';
// import { renderBattle } from './views/Battle.js';
// import { renderEmergency } from './views/Emergency.js';
import { renderProfile } from './views/Profile.js';
import { renderAuth } from './views/Auth.js';

const routes = {
  '#/': renderDashboard,
  // '#/theory': renderTheory,
  // '#/battle': renderBattle,
  // '#/emergency': renderEmergency,
  '#/profile': renderProfile,
  '#/auth': renderAuth
};

export function handleRoute() {
  const hash = window.location.hash || '#/';
  const renderView = routes[hash] || renderDashboard;
  
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderView());
}