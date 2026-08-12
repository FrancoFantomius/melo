import { getSession, saveSession } from '../../jellyfin/session.js';
import { applyTheme, getCurrentTheme } from '../theme.js';
import { getCurrentLanguageMode, setLanguage } from '../../i18n.js';

let currentOrderState = ['playlists', 'songs', 'artists', 'podcasts', 'albums'];

const CATEGORY_NAMES = {
  playlists: 'Playlists',
  songs: 'Recommended Songs',
  artists: 'Artists',
  podcasts: 'Podcasts',
  albums: 'Albums'
};

export function initSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  btnSaveSettings?.addEventListener('click', () => saveSettingsFromModal());
  btnSettingsClose?.addEventListener('click', () => closeSettingsModal());
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });
}

function renderSectionOrderListUI(container, orderArray) {
  if (!container) return;
  currentOrderState = [...orderArray];

  container.innerHTML = currentOrderState.map((catKey, idx) => `
    <div class="section-order-item" data-key="${catKey}">
      <span>${CATEGORY_NAMES[catKey] || catKey}</span>
      <div class="section-order-actions">
        <button type="button" class="btn-order-move btn-move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Up">
          <span class="material-symbols-outlined" style="font-size: 16px;">arrow_upward</span>
        </button>
        <button type="button" class="btn-order-move btn-move-down" data-idx="${idx}" ${idx === currentOrderState.length - 1 ? 'disabled' : ''} title="Move Down">
          <span class="material-symbols-outlined" style="font-size: 16px;">arrow_downward</span>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (idx > 0) {
        const temp = currentOrderState[idx];
        currentOrderState[idx] = currentOrderState[idx - 1];
        currentOrderState[idx - 1] = temp;
        renderSectionOrderListUI(container, currentOrderState);
      }
    });
  });

  container.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (idx < currentOrderState.length - 1) {
        const temp = currentOrderState[idx];
        currentOrderState[idx] = currentOrderState[idx + 1];
        currentOrderState[idx + 1] = temp;
        renderSectionOrderListUI(container, currentOrderState);
      }
    });
  });
}

export function openSettingsModal() {
  const session = getSession();
  const settingsModal = document.getElementById('settings-modal');
  if (!settingsModal) return;

  const langSelect = document.getElementById('setting-language');
  const wifiSelect = document.getElementById('setting-quality-wifi');
  const mobileSelect = document.getElementById('setting-quality-mobile');
  const forceCheck = document.getElementById('setting-force-transcode');
  const searchPodcastsCheck = document.getElementById('setting-search-podcasts');
  const themeSelect = document.getElementById('setting-theme');
  const orderListContainer = document.getElementById('home-section-order-list');

  if (langSelect) langSelect.value = getCurrentLanguageMode();
  if (wifiSelect) wifiSelect.value = session.qualityWifi || 'Direct';
  if (mobileSelect) mobileSelect.value = session.qualityMobile || '128000';
  if (forceCheck) forceCheck.checked = !!session.forceTranscode;
  if (searchPodcastsCheck) searchPodcastsCheck.checked = session.searchPodcasts !== false;
  if (themeSelect) themeSelect.value = getCurrentTheme();

  const savedOrder = session.homeSectionOrder || ['playlists', 'songs', 'artists', 'podcasts', 'albums'];
  renderSectionOrderListUI(orderListContainer, savedOrder);

  document.getElementById('btn-settings-open')?.classList.add('active');
  settingsModal.style.display = 'flex';
}

export function saveSettingsFromModal() {
  const langSelect = document.getElementById('setting-language');
  const wifiSelect = document.getElementById('setting-quality-wifi');
  const mobileSelect = document.getElementById('setting-quality-mobile');
  const forceCheck = document.getElementById('setting-force-transcode');
  const searchPodcastsCheck = document.getElementById('setting-search-podcasts');
  const themeSelect = document.getElementById('setting-theme');

  if (langSelect && langSelect.value !== getCurrentLanguageMode()) {
    setLanguage(langSelect.value);
  }

  saveSession({
    qualityWifi: wifiSelect ? wifiSelect.value : 'Direct',
    qualityMobile: mobileSelect ? mobileSelect.value : '128000',
    forceTranscode: forceCheck ? forceCheck.checked : false,
    searchPodcasts: searchPodcastsCheck ? searchPodcastsCheck.checked : true,
    homeSectionOrder: currentOrderState
  });

  if (themeSelect) {
    applyTheme(themeSelect.value);
  }

  closeSettingsModal();
}

export function closeSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) settingsModal.style.display = 'none';
  document.getElementById('btn-settings-open')?.classList.remove('active');
}