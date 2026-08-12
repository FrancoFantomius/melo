import { getSession } from '../../jellyfin/session.js';
import { authenticateServer } from '../../jellyfin/client.js';
import { updateHeaderUI } from '../header.js';

export function initLoginModal() {
  const btnLoginClose = document.getElementById('btn-login-close');
  const btnLoginCancel = document.getElementById('btn-login-cancel');
  const btnSaveSync = document.getElementById('btn-save-sync');
  const loginModal = document.getElementById('login-modal');

  btnLoginClose?.addEventListener('click', () => closeLoginModal());
  btnLoginCancel?.addEventListener('click', () => closeLoginModal());
  loginModal?.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLoginModal();
  });

  btnSaveSync?.addEventListener('click', async () => {
    const serverUrl = document.getElementById('sync-server-url').value;
    const username = document.getElementById('sync-username').value;
    const password = document.getElementById('sync-password').value;
    const statusEl = document.getElementById('sync-settings-status');

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

    try {
      await authenticateServer(serverUrl, username, password);
      if (statusEl) {
        statusEl.textContent = 'Connected successfully!';
        statusEl.style.color = 'var(--success)';
      }
      setTimeout(() => {
        closeLoginModal();
        updateHeaderUI();
        window.location.reload();
      }, 800);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Connection error: ${err.message}`;
        statusEl.style.color = 'var(--danger)';
      }
    }
  });
}

export function openLoginModal() {
  const session = getSession();
  const loginModal = document.getElementById('login-modal');
  if (!loginModal) return;

  document.getElementById('sync-server-url').value = session.serverUrl || '';
  document.getElementById('sync-username').value = session.username || '';
  document.getElementById('sync-password').value = '';
  document.getElementById('sync-settings-status').textContent = '';

  loginModal.style.display = 'flex';
}

export function closeLoginModal() {
  const loginModal = document.getElementById('login-modal');
  if (loginModal) loginModal.style.display = 'none';
}