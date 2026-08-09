import '@fontsource-variable/material-symbols-outlined/full.css';
import '@fontsource-variable/plus-jakarta-sans/index.css';

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
