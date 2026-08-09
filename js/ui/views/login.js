import { getSession } from '../../jellyfin/session.js';
import { authenticateServer } from '../../jellyfin/client.js';
import { updateHeaderUI } from '../header.js';
import { switchView } from '../views.js';

export function renderLoginView(container) {
  const session = getSession();
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 20px;">
      <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); width: 100%; max-width: 440px; padding: 32px; box-shadow: var(--shadow-modal); display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;">
          <img src="./img/icons/icon.svg" style="width: 64px; height: 64px;" alt="Logo">
          <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Sign in to Jellyfin</h1>
          <p style="font-size: 13px; color: var(--text-secondary);">
            Connect your Jellyfin server to access your music library, albums, artists, playlists, and audio streaming.
          </p>
        </div>

        <form id="view-login-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="input-group">
            <label for="view-server-url">Jellyfin Server URL</label>
            <input type="url" id="view-server-url" placeholder="https://jellyfin.example.com" value="${session.serverUrl || ''}" required>
          </div>

          <div class="input-group">
            <label for="view-username">Username</label>
            <input type="text" id="view-username" placeholder="Enter username" value="${session.username || ''}" required>
          </div>

          <div class="input-group">
            <label for="view-password">Password</label>
            <input type="password" id="view-password" placeholder="Enter password">
          </div>

          <div id="view-login-status" style="font-size: 13px; font-weight: 600; text-align: center; min-height: 20px;"></div>

          <button type="submit" id="btn-view-login-submit" class="btn btn-primary" style="width: 100%; padding: 12px; margin-top: 8px;">
            <span class="material-symbols-outlined">bolt</span>
            <span>Connect & Sign In</span>
          </button>
        </form>

        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 16px;">
          <a href="./terms.html" style="color: var(--text-secondary); text-decoration: none; font-weight: 500;">Terms of Service</a>
          <span>•</span>
          <a href="./privacy.html" style="color: var(--text-secondary); text-decoration: none; font-weight: 500;">Privacy Policy</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('view-login-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serverUrl = document.getElementById('view-server-url').value;
    const username = document.getElementById('view-username').value;
    const password = document.getElementById('view-password').value;
    const statusEl = document.getElementById('view-login-status');
    const submitBtn = document.getElementById('btn-view-login-submit');

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
        statusEl.textContent = 'Connected successfully!';
        statusEl.style.color = 'var(--success)';
      }
      updateHeaderUI();
      setTimeout(() => {
        switchView('home');
      }, 500);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Connection error: ${err.message}`;
        statusEl.style.color = 'var(--danger)';
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
