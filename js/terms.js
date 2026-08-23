import '@fontsource-variable/material-symbols-outlined/full.css';
import '@fontsource-variable/roboto-flex/index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { initPWA } from './pwa.js';
import { initTheme } from './ui/theme.js';
import { requireAuth } from './auth-guard.js';
import { initI18n } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  initI18n();
  initPWA();
  initTheme();
});
