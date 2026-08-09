import '@fontsource-variable/material-symbols-outlined/full.css';
import '@fontsource-variable/plus-jakarta-sans/index.css';

import { initPWA } from './pwa.js';
import { initTheme } from './ui/theme.js';
import { initHeader } from './ui/header.js';
import { initModals } from './ui/modals.js';
import { initViews } from './ui/views.js';
import { initPlayerUI } from './ui/player.js';
import { requireAuth } from './auth-guard.js';
import { initCacheDB } from './jellyfin/cache.js';
import { initI18n } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  // 0. Run Auth Guard (Redirects unauthenticated users to login.html)
  if (!requireAuth()) return;

  // 1. Initialize i18n, PWA & Cache DB
  initI18n();
  initPWA();
  initCacheDB();

  // 2. Initialize Theme Engine
  initTheme();

  // 3. Initialize Header UI & Controls
  initHeader();

  // 4. Initialize Modals
  initModals();

  // 5. Initialize Views & Navigation Router
  initViews();

  // 6. Initialize Audio Player & Bind Player UI Controls
  initPlayerUI();

  // 7. Initial view rendering is handled by initViews() and handleUrlRouting()
});
