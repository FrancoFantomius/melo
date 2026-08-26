
import { initPWA } from './pwa.js';
import { initTheme } from './ui/theme.js';
import { getSession } from './jellyfin/session.js';
import { authenticateServer } from './jellyfin/client.js';
import { requireAuth } from './auth-guard.js';
import { initI18n } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Run auth guard check (redirects to index.html if already logged in)
  if (!requireAuth()) return;

  // 2. Initialize i18n, PWA & Theme
  initI18n();
  initPWA();
  initTheme();

  const session = getSession();
  const form = document.getElementById('login-form');
  const serverInput = document.getElementById('sync-server-url');
  const usernameInput = document.getElementById('sync-username');
  const passwordInput = document.getElementById('sync-password');
  const statusEl = document.getElementById('sync-settings-status');
  const submitBtn = document.getElementById('btn-login-submit');

  if (serverInput) serverInput.value = session.serverUrl || '';
  if (usernameInput) usernameInput.value = session.username || '';

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serverUrl = serverInput.value;
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!serverUrl || !username) {
      if (statusEl) {
        statusEl.textContent = 'Server URL and Username are required.';
        statusEl.style.color = 'var(--danger)';
      }
      return;
    }

    if (statusEl) {
      statusEl.textContent = 'Connecting to Jellyfin server...';
      statusEl.style.color = 'var(--accent)';
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      await authenticateServer(serverUrl, username, password);
      if (statusEl) {
        statusEl.textContent = 'Connected successfully! Redirecting...';
        statusEl.style.color = 'var(--success)';
      }
      setTimeout(() => {
        window.location.href = './index.html';
      }, 600);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Connection error: ${err.message}`;
        statusEl.style.color = 'var(--danger)';
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
