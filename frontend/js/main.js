import { updateHeaderUI } from './state.js';
import { handleRoute } from './router.js';

updateHeaderUI();

handleRoute();

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', handleRoute);