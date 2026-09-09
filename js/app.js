import '@francofantomius/material-components/top-app-bar';
import '@francofantomius/material-components/navigation-drawer';
import '@francofantomius/material-components/navigation-rail';
import '@francofantomius/material-components/navigation-bar';
import '@francofantomius/material-components/search-bar';
import '@francofantomius/material-components/account-menu';
import '@francofantomius/material-components/app-drawer';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/divider';
import '@francofantomius/material-components/side-sheet';
import '@francofantomius/material-components/bottom-sheet';
import '@francofantomius/material-components/badge';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/tooltip';

import { initPWA } from './pwa.js';
import { initTheme } from './ui/theme.js';
import './ui/placeholders.js';
import { initHeader } from './ui/header.js';
import { initModals } from './ui/modals.js';
import { initViews } from './ui/views.js';
import { initPlayerUI } from './ui/player.js';
import { requireAuth } from './auth-guard.js';
import { initCacheDB } from './jellyfin/cache.js';
import { reportCapabilities } from './jellyfin/client.js';
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

  // 7. Report client capabilities & device icon to Jellyfin
  reportCapabilities();
});
