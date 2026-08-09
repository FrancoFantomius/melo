import { getSession, saveSession } from '../jellyfin/session.js';
import { authenticateServer, getLyrics, getArtworkUrl, createPlaylist, updatePlaylist, uploadPlaylistImage, deletePlaylist, addTracksToPlaylist, searchJellyfinCached, getSongsCached, getPlaylistsCached } from '../jellyfin/client.js';
import { updateHeaderUI } from './header.js';
import { applyTheme, getCurrentTheme } from './theme.js';
import { getQueueState, setCurrentIndex, getCurrentTrack } from '../player/queue.js';
import { playTrack, seekTo } from '../player/audio.js';
import { getCurrentLanguageMode, setLanguage, getTranslation } from '../i18n.js';

let currentLyricsTrackId = null;
let currentLyricsLines = [];
let activeLineIndex = -1;

export function initModals() {
  // Login modal triggers
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

  // Settings modal triggers
  const settingsModal = document.getElementById('settings-modal');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  btnSaveSettings?.addEventListener('click', () => saveSettingsFromModal());
  btnSettingsClose?.addEventListener('click', () => closeSettingsModal());
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  // Lyrics view triggers
  const btnLyricsClose = document.getElementById('btn-lyrics-close');
  btnLyricsClose?.addEventListener('click', () => closeLyricsModal());

  // Queue drawer close
  const queueDrawer = document.getElementById('queue-drawer');
  const btnQueueClose = document.getElementById('btn-queue-close');

  const closeQueue = () => toggleQueueDrawer();

  btnQueueClose?.addEventListener('click', closeQueue);

  // Add Podcast modal triggers
  const addPodcastModal = document.getElementById('add-podcast-modal');
  const btnAddPodcastClose = document.getElementById('btn-add-podcast-close');
  btnAddPodcastClose?.addEventListener('click', () => closeAddPodcastModal());
  addPodcastModal?.addEventListener('click', (e) => {
    if (e.target === addPodcastModal) closeAddPodcastModal();
  });

  // Playlist management modal triggers
  initPlaylistModals();

  // Window hash routing & popstate navigation for full-screen overlays
  window.addEventListener('hashchange', syncOverlaysWithHash);
  window.addEventListener('popstate', syncOverlaysWithHash);
  setTimeout(syncOverlaysWithHash, 100);
}

export function syncOverlaysWithHash() {
  const hash = window.location.hash;

  const empContainer = document.getElementById('expanded-mobile-player');
  const lyricsView = document.getElementById('lyrics-view');
  const queueDrawer = document.getElementById('queue-drawer');

  const btnQueue = document.getElementById('player-btn-queue');
  const empBtnQueue = document.getElementById('emp-btn-queue');

  // Handle #player
  if (hash === '#player') {
    if (window.innerWidth <= 768) {
      empContainer?.classList.add('open');
    }
  } else if (hash !== '#lyrics') {
    empContainer?.classList.remove('open');
  }

  // Handle #lyrics
  if (hash === '#lyrics') {
    openLyricsModalInternal();
  } else {
    closeLyricsModalInternal();
  }

  // Handle #queue
  if (hash === '#queue') {
    if (queueDrawer && !queueDrawer.classList.contains('open')) {
      renderQueueDrawerList();
      queueDrawer.classList.add('open');
      btnQueue?.classList.add('active');
      empBtnQueue?.classList.add('active');
    }
  } else {
    if (queueDrawer && queueDrawer.classList.contains('open')) {
      queueDrawer.classList.remove('open');
      btnQueue?.classList.remove('active');
      empBtnQueue?.classList.remove('active');
    }
  }
}

export function openAddPodcastModal() {
  const modal = document.getElementById('add-podcast-modal');
  if (!modal) return;
  const input = document.getElementById('podcast-rss-url');
  const errEl = document.getElementById('podcast-add-error');
  if (input) input.value = '';
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  modal.style.display = 'flex';
}

export function closeAddPodcastModal() {
  const modal = document.getElementById('add-podcast-modal');
  if (modal) modal.style.display = 'none';
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

let currentOrderState = ['playlists', 'songs', 'artists', 'podcasts', 'albums'];

const CATEGORY_NAMES = {
  playlists: 'Playlists',
  songs: 'Recommended Songs',
  artists: 'Artists',
  podcasts: 'Podcasts',
  albums: 'Albums'
};

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

export async function openLyricsModal(track = null) {
  if (window.location.hash !== '#lyrics') {
    window.location.hash = 'lyrics';
  }
  return openLyricsModalInternal(track);
}

async function openLyricsModalInternal(track = null) {
  const currentTrack = track || getCurrentTrack();
  if (!currentTrack) return;

  const lyricsView = document.getElementById('lyrics-view');
  const bgArtEl = document.getElementById('lyrics-bg-art');
  const titleEl = document.getElementById('lyrics-track-title');
  const artistEl = document.getElementById('lyrics-track-artist');
  const bodyEl = document.getElementById('lyrics-view-body');
  const btnLyrics = document.getElementById('player-btn-lyrics');
  const empBtnLyrics = document.getElementById('emp-btn-lyrics');

  if (!lyricsView || !bodyEl) return;

  btnLyrics?.classList.add('active');
  empBtnLyrics?.classList.add('active');
  lyricsView.style.display = 'flex';

  if (bgArtEl) {
    bgArtEl.src = getArtworkUrl(currentTrack, 'Primary', 600);
  }
  if (titleEl) {
    titleEl.textContent = currentTrack.Name || 'Track';
  }
  if (artistEl) {
    artistEl.textContent = currentTrack.Artists?.join(', ') || currentTrack.AlbumArtist || '';
  }

  if (currentLyricsTrackId === currentTrack.Id && bodyEl.children.length > 0 && !bodyEl.querySelector('.lyrics-loading')) {
    return;
  }

  currentLyricsTrackId = currentTrack.Id;
  currentLyricsLines = [];
  activeLineIndex = -1;

  bodyEl.innerHTML = '<div class="lyrics-loading" style="color: rgba(255,255,255,0.7); text-align: center; padding: 20px;">Loading lyrics...</div>';

  const data = await getLyrics(currentTrack.Id);

  if (currentLyricsTrackId !== currentTrack.Id) return;

  if (data && data.Lyrics && Array.isArray(data.Lyrics) && data.Lyrics.length > 0) {
    currentLyricsLines = data.Lyrics.map((item, idx) => ({
      index: idx,
      text: item.Text || '',
      startSec: item.Start !== undefined && item.Start !== null ? item.Start / 10000000 : null
    }));

    bodyEl.innerHTML = currentLyricsLines.map((line) => {
      const isSynced = line.startSec !== null && isFinite(line.startSec);
      return `<div class="lyric-line ${isSynced ? 'synced' : ''}" data-index="${line.index}" ${isSynced ? `data-start="${line.startSec}"` : ''}>${escapeHtml(line.text || '♪')}</div>`;
    }).join('');

    bodyEl.querySelectorAll('.lyric-line.synced').forEach(el => {
      el.addEventListener('click', () => {
        const startSec = parseFloat(el.getAttribute('data-start'));
        if (isFinite(startSec)) {
          seekTo(startSec);
        }
      });
    });
  } else if (data && typeof data === 'string' && data.trim()) {
    const lines = data.split('\n');
    currentLyricsLines = lines.map((line, idx) => ({
      index: idx,
      text: line,
      startSec: null
    }));
    bodyEl.innerHTML = lines.map(line => `<div class="lyric-line">${escapeHtml(line || '♪')}</div>`).join('');
  } else {
    bodyEl.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 20px;">No lyrics available for this track</div>';
  }
}

export function closeLyricsModal() {
  if (window.location.hash === '#lyrics') {
    window.history.back();
    setTimeout(() => {
      if (window.location.hash === '#lyrics') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        closeLyricsModalInternal();
      }
    }, 50);
  } else {
    closeLyricsModalInternal();
  }
}

function closeLyricsModalInternal() {
  const lyricsView = document.getElementById('lyrics-view');
  if (lyricsView) lyricsView.style.display = 'none';
  document.getElementById('player-btn-lyrics')?.classList.remove('active');
  document.getElementById('emp-btn-lyrics')?.classList.remove('active');
}

export function toggleLyricsModal(track = null) {
  const lyricsView = document.getElementById('lyrics-view');
  if (!lyricsView) return;

  const isOpen = (lyricsView.style.display === 'flex') || window.location.hash === '#lyrics';
  if (isOpen) {
    closeLyricsModal();
  } else {
    openLyricsModal(track);
  }
}

export function updateLyricsSync(currentTime) {
  const lyricsView = document.getElementById('lyrics-view');
  if (!lyricsView || lyricsView.style.display === 'none') return;

  const currentTrack = getCurrentTrack();
  if (currentTrack && currentLyricsTrackId !== currentTrack.Id) {
    openLyricsModalInternal(currentTrack);
    return;
  }

  if (!currentLyricsLines || currentLyricsLines.length === 0) return;

  let nextActiveIndex = -1;
  for (let i = 0; i < currentLyricsLines.length; i++) {
    const line = currentLyricsLines[i];
    if (line.startSec !== null && isFinite(line.startSec) && currentTime >= line.startSec - 0.2) {
      nextActiveIndex = i;
    } else if (line.startSec !== null && isFinite(line.startSec) && currentTime < line.startSec - 0.2) {
      break;
    }
  }

  if (nextActiveIndex !== activeLineIndex) {
    activeLineIndex = nextActiveIndex;
    const bodyEl = document.getElementById('lyrics-view-body');
    if (!bodyEl) return;

    const lineEls = bodyEl.querySelectorAll('.lyric-line');
    lineEls.forEach((el) => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (idx === activeLineIndex) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('active');
      }
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function toggleQueueDrawer() {
  const queueDrawer = document.getElementById('queue-drawer');
  if (!queueDrawer) return;

  const isOpen = queueDrawer.classList.contains('open') || window.location.hash === '#queue';
  if (isOpen) {
    if (window.location.hash === '#queue') {
      window.history.back();
      setTimeout(() => {
        if (window.location.hash === '#queue') {
          history.replaceState(null, '', window.location.pathname + window.location.search);
          syncOverlaysWithHash();
        }
      }, 50);
    } else {
      queueDrawer.classList.remove('open');
      document.getElementById('player-btn-queue')?.classList.remove('active');
      document.getElementById('emp-btn-queue')?.classList.remove('active');
    }
  } else {
    if (window.location.hash !== '#queue') {
      window.location.hash = 'queue';
    } else {
      renderQueueDrawerList();
      queueDrawer.classList.add('open');
      document.getElementById('player-btn-queue')?.classList.add('active');
      document.getElementById('emp-btn-queue')?.classList.add('active');
    }
  }
}

export function renderQueueDrawerList() {
  const container = document.getElementById('queue-tracks-list');
  const countBadge = document.getElementById('queue-count-badge');
  if (!container) return;

  const { queue, currentIndex } = getQueueState();

  if (countBadge) {
    countBadge.textContent = queue && queue.length > 0 ? `(${queue.length})` : '';
  }

  if (!queue || queue.length === 0) {
    container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 30px 20px;">Queue is empty</div>';
    return;
  }

  const currentTrack = queue[currentIndex];
  const upcomingTracks = queue.slice(currentIndex + 1);
  const previousTracks = queue.slice(0, currentIndex);

  const renderQueueItem = (track, idx, isCurrent = false) => {
    const artUrl = track.image ? track.image : getArtworkUrl(track, 'Primary', 100);
    const artistStr = track.Artists ? track.Artists.join(', ') : (track.AlbumArtist || track.showTitle || 'Unknown Artist');
    const titleStr = track.Name || track.title || 'Unknown Title';

    const canAddToPlaylist = track && track.Id && !track.isPodcastEpisode && !track.enclosureUrl;

    return `
      <div class="queue-track-item ${isCurrent ? 'playing' : ''}" data-queue-index="${idx}">
        <div class="queue-track-status">
          ${isCurrent ? '<span class="material-symbols-outlined playing-indicator">volume_up</span>' : `<span class="queue-track-num">${idx + 1}</span>`}
        </div>
        <div class="queue-track-thumb-container">
          <img src="${artUrl}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="queue-track-thumb" alt="Cover">
          ${isCurrent ? '<div class="queue-playing-overlay"><span class="material-symbols-outlined queue-playing-icon">equalizer</span></div>' : ''}
        </div>
        <div class="queue-track-details">
          <div class="queue-track-title">${escapeHtml(titleStr)}</div>
          <div class="queue-track-artist">${escapeHtml(artistStr)}</div>
        </div>
        ${canAddToPlaylist ? `
          <button class="btn-queue-add-playlist btn-icon" title="Add to Playlist" data-queue-index="${idx}" style="margin-left: auto; padding: 4px;">
            <span class="material-symbols-outlined" style="font-size: 18px;">playlist_add</span>
          </button>
        ` : ''}
      </div>
    `;
  };

  let html = '';

  if (currentTrack) {
    html += `
      <div class="queue-section-header">NOW PLAYING</div>
      ${renderQueueItem(currentTrack, currentIndex, true)}
    `;
  }

  if (upcomingTracks.length > 0) {
    html += `<div class="queue-section-header" style="margin-top: 16px;">UP NEXT (${upcomingTracks.length})</div>`;
    upcomingTracks.forEach((track, relIdx) => {
      const actualIdx = currentIndex + 1 + relIdx;
      html += renderQueueItem(track, actualIdx, false);
    });
  }

  if (previousTracks.length > 0) {
    html += `<div class="queue-section-header" style="margin-top: 16px; opacity: 0.6;">PREVIOUSLY PLAYED</div>`;
    previousTracks.forEach((track, actualIdx) => {
      html += renderQueueItem(track, actualIdx, false);
    });
  }

  container.innerHTML = html;

  container.querySelectorAll('.queue-track-item').forEach(row => {
    const addBtn = row.querySelector('.btn-queue-add-playlist');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idx = parseInt(addBtn.getAttribute('data-queue-index'), 10);
        if (!isNaN(idx) && queue[idx]) {
          openSelectPlaylistModal(queue[idx]);
        }
      });
    }

    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-queue-add-playlist')) return;
      const idx = parseInt(row.getAttribute('data-queue-index'), 10);
      if (!isNaN(idx)) {
        setCurrentIndex(idx);
        playTrack();
        renderQueueDrawerList();
      }
    });
  });
}

let currentCreatePlaylistCallback = null;
let currentEditPlaylistCallback = null;
let currentAddTracksCallback = null;
let currentDeletePlaylistCallback = null;

function initPlaylistModals() {
  // Create Playlist modal triggers
  const createModal = document.getElementById('create-playlist-modal');
  const btnCreateClose = document.getElementById('btn-create-playlist-close');
  const btnCreateCancel = document.getElementById('btn-cancel-create-playlist');
  const createForm = document.getElementById('create-playlist-form');

  btnCreateClose?.addEventListener('click', () => closeCreatePlaylistModal());
  btnCreateCancel?.addEventListener('click', () => closeCreatePlaylistModal());
  createModal?.addEventListener('click', (e) => {
    if (e.target === createModal) closeCreatePlaylistModal();
  });

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('create-playlist-name');
    const publicCheckbox = document.getElementById('create-playlist-public');
    const fileInput = document.getElementById('create-playlist-image');
    const submitBtn = document.getElementById('btn-submit-create-playlist');
    const errorEl = document.getElementById('create-playlist-error');

    const name = nameInput?.value?.trim();
    const isPublic = publicCheckbox?.checked || false;

    if (!name) return;
    if (submitBtn) submitBtn.disabled = true;
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    try {
      const playlistId = await createPlaylist({ name, isPublic });

      if (playlistId && fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const base64Str = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        try {
          await uploadPlaylistImage(playlistId, base64Str, file.type || 'image/jpeg');
        } catch (imgErr) {
          console.warn('[Playlist] Image upload failed:', imgErr.message);
        }
      }

      closeCreatePlaylistModal();
      if (currentCreatePlaylistCallback) currentCreatePlaylistCallback(playlistId);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Failed to create playlist';
        errorEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Edit Playlist modal triggers
  const editModal = document.getElementById('edit-playlist-modal');
  const btnEditClose = document.getElementById('btn-edit-playlist-close');
  const btnEditCancel = document.getElementById('btn-cancel-edit-playlist');
  const editForm = document.getElementById('edit-playlist-form');

  btnEditClose?.addEventListener('click', () => closeEditPlaylistModal());
  btnEditCancel?.addEventListener('click', () => closeEditPlaylistModal());
  editModal?.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditPlaylistModal();
  });

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const playlistId = document.getElementById('edit-playlist-id')?.value;
    const newName = document.getElementById('edit-playlist-name')?.value;
    const fileInput = document.getElementById('edit-playlist-image');
    const saveBtn = document.getElementById('btn-save-edit-playlist');
    const errorEl = document.getElementById('edit-playlist-error');

    if (!playlistId) return;
    if (saveBtn) saveBtn.disabled = true;
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    try {
      if (newName) {
        await updatePlaylist(playlistId, { name: newName });
      }

      let imageError = null;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const base64Str = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        try {
          await uploadPlaylistImage(playlistId, base64Str, file.type || 'image/jpeg');
        } catch (imgErr) {
          imageError = imgErr;
        }
      }

      closeEditPlaylistModal();
      if (currentEditPlaylistCallback) currentEditPlaylistCallback();

      if (imageError && errorEl) {
        // Show a brief notification about the image failure
        console.warn('[Playlist] Image upload failed:', imageError.message);
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  // Add Tracks modal triggers
  const addTracksModal = document.getElementById('add-tracks-modal');
  const btnAddTracksClose = document.getElementById('btn-add-tracks-close');
  const btnAddTracksCancel = document.getElementById('btn-cancel-add-tracks');
  const addTracksSearchInput = document.getElementById('add-tracks-search-input');
  let addTracksDebounce = null;

  btnAddTracksClose?.addEventListener('click', () => closeAddTracksModal());
  btnAddTracksCancel?.addEventListener('click', () => closeAddTracksModal());
  addTracksModal?.addEventListener('click', (e) => {
    if (e.target === addTracksModal) closeAddTracksModal();
  });

  addTracksSearchInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const playlistId = document.getElementById('add-tracks-playlist-id')?.value;
    if (addTracksDebounce) clearTimeout(addTracksDebounce);
    addTracksDebounce = setTimeout(async () => {
      if (!q) {
        const res = await getSongsCached({ limit: 30 });
        renderAddTracksResults(res?.Items || [], playlistId);
      } else {
        const res = await searchJellyfinCached(q);
        const tracks = (res?.Items || []).filter(item => item.Type === 'Audio');
        renderAddTracksResults(tracks, playlistId);
      }
    }, 300);
  });

  // Delete Playlist modal triggers
  const deleteModal = document.getElementById('delete-playlist-modal');
  const btnDeleteClose = document.getElementById('btn-delete-playlist-close');
  const btnDeleteCancel = document.getElementById('btn-cancel-delete-playlist');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete-playlist');

  btnDeleteClose?.addEventListener('click', () => closeDeletePlaylistModal());
  btnDeleteCancel?.addEventListener('click', () => closeDeletePlaylistModal());
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeletePlaylistModal();
  });

  btnConfirmDelete?.addEventListener('click', async () => {
    const playlistId = document.getElementById('delete-playlist-id')?.value;
    const errorEl = document.getElementById('delete-playlist-error');
    if (!playlistId) return;

    btnConfirmDelete.disabled = true;
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    try {
      await deletePlaylist(playlistId);
      closeDeletePlaylistModal();
      if (currentDeletePlaylistCallback) currentDeletePlaylistCallback();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    } finally {
      btnConfirmDelete.disabled = false;
    }
  });

  // Select Playlist modal triggers
  const selectPlaylistModal = document.getElementById('select-playlist-modal');
  const btnSelectPlaylistClose = document.getElementById('btn-select-playlist-close');
  const btnSelectPlaylistCancel = document.getElementById('btn-cancel-select-playlist');
  const btnSelectPlaylistCreateNew = document.getElementById('btn-select-playlist-create-new');

  btnSelectPlaylistClose?.addEventListener('click', () => closeSelectPlaylistModal());
  btnSelectPlaylistCancel?.addEventListener('click', () => closeSelectPlaylistModal());
  selectPlaylistModal?.addEventListener('click', (e) => {
    if (e.target === selectPlaylistModal) closeSelectPlaylistModal();
  });

  btnSelectPlaylistCreateNew?.addEventListener('click', () => {
    closeSelectPlaylistModal();
    openCreatePlaylistModal(async (newPlaylistId) => {
      if (newPlaylistId && currentTargetTrackIds && currentTargetTrackIds.length > 0) {
        try {
          await addTracksToPlaylist(newPlaylistId, currentTargetTrackIds);
        } catch (err) {
          console.error('[Playlist] Failed to add tracks to newly created playlist:', err);
        }
      }
    });
  });
}

export function openEditPlaylistModal(playlistId, currentName, onSaveCallback) {
  const modal = document.getElementById('edit-playlist-modal');
  const idInput = document.getElementById('edit-playlist-id');
  const nameInput = document.getElementById('edit-playlist-name');
  const fileInput = document.getElementById('edit-playlist-image');
  const errorEl = document.getElementById('edit-playlist-error');

  if (!modal) return;
  currentEditPlaylistCallback = onSaveCallback;
  if (idInput) idInput.value = playlistId;
  if (nameInput) nameInput.value = currentName || '';
  if (fileInput) fileInput.value = '';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  modal.style.display = 'flex';
}

export function closeEditPlaylistModal() {
  const modal = document.getElementById('edit-playlist-modal');
  if (modal) modal.style.display = 'none';
}

export function openAddTracksModal(playlistId, onAddCallback) {
  const modal = document.getElementById('add-tracks-modal');
  const idInput = document.getElementById('add-tracks-playlist-id');
  const searchInput = document.getElementById('add-tracks-search-input');
  const listEl = document.getElementById('add-tracks-list');
  const errorEl = document.getElementById('add-tracks-error');

  if (!modal) return;
  currentAddTracksCallback = onAddCallback;
  if (idInput) idInput.value = playlistId;
  if (searchInput) searchInput.value = '';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  if (listEl) {
    listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 12px; text-align: center;">Loading tracks...</div>';
  }

  modal.style.display = 'flex';

  getSongsCached({ limit: 30 }).then(res => {
    renderAddTracksResults(res?.Items || [], playlistId);
  }).catch(err => {
    if (listEl) listEl.innerHTML = `<div style="color: var(--danger); font-size: 13px; text-align: center;">Failed to load library: ${err.message}</div>`;
  });
}

function renderAddTracksResults(items, playlistId) {
  const listEl = document.getElementById('add-tracks-list');
  if (!listEl) return;

  if (!items || items.length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; padding: 12px; text-align: center;">No tracks found matching query.</div>';
    return;
  }

  listEl.innerHTML = items.map(track => {
    const artistName = track.Artists?.join(', ') || track.AlbumArtist || 'Unknown Artist';
    const artUrl = getArtworkUrl(track, 'Primary', 80);
    return `
      <div class="add-track-item" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
          <img src="${artUrl}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" style="width: 36px; height: 36px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" alt="Cover">
          <div style="overflow: hidden;">
            <div style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${escapeHtml(track.Name || '')}</div>
            <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(artistName)}</div>
          </div>
        </div>
        <button class="btn-add-single-track btn btn-primary" data-track-id="${track.Id}" style="padding: 4px 10px; font-size: 12px; height: 30px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
          <span>Add</span>
        </button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-add-single-track').forEach(btn => {
    btn.addEventListener('click', async () => {
      const trackId = btn.getAttribute('data-track-id');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">sync</span><span>Adding...</span>';
      try {
        await addTracksToPlaylist(playlistId, [trackId]);
        btn.style.background = 'var(--success)';
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">check</span><span>Added</span>';
        if (currentAddTracksCallback) currentAddTracksCallback();
      } catch (err) {
        btn.disabled = false;
        btn.style.background = 'var(--danger)';
        btn.innerHTML = 'Failed';
        console.error('[Playlist] Add track failed:', err);
      }
    });
  });
}

export function closeAddTracksModal() {
  const modal = document.getElementById('add-tracks-modal');
  if (modal) modal.style.display = 'none';
}

export function openDeletePlaylistModal(playlistId, playlistName, onDeleteCallback) {
  const modal = document.getElementById('delete-playlist-modal');
  const idInput = document.getElementById('delete-playlist-id');
  const nameEl = document.getElementById('delete-playlist-name-text');
  const errorEl = document.getElementById('delete-playlist-error');

  if (!modal) return;
  currentDeletePlaylistCallback = onDeleteCallback;
  if (idInput) idInput.value = playlistId;
  if (nameEl) nameEl.textContent = playlistName || 'this playlist';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  modal.style.display = 'flex';
}

export function closeDeletePlaylistModal() {
  const modal = document.getElementById('delete-playlist-modal');
  if (modal) modal.style.display = 'none';
}

export function openCreatePlaylistModal(onCreateCallback) {
  const modal = document.getElementById('create-playlist-modal');
  const nameInput = document.getElementById('create-playlist-name');
  const publicCheckbox = document.getElementById('create-playlist-public');
  const fileInput = document.getElementById('create-playlist-image');
  const errorEl = document.getElementById('create-playlist-error');

  if (!modal) return;
  currentCreatePlaylistCallback = onCreateCallback;
  if (nameInput) nameInput.value = '';
  if (publicCheckbox) publicCheckbox.checked = false;
  if (fileInput) fileInput.value = '';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  modal.style.display = 'flex';
}

export function closeCreatePlaylistModal() {
  const modal = document.getElementById('create-playlist-modal');
  if (modal) modal.style.display = 'none';
}

let currentTargetTrackIds = [];

export function openSelectPlaylistModal(targetTracks) {
  const modal = document.getElementById('select-playlist-modal');
  const listEl = document.getElementById('select-playlist-list');
  const statusEl = document.getElementById('select-playlist-status');

  if (!modal) return;

  let tracksArray = Array.isArray(targetTracks) ? targetTracks : [targetTracks];
  currentTargetTrackIds = tracksArray
    .map(t => typeof t === 'string' ? t : (t?.Id || t?.id))
    .filter(Boolean);

  if (currentTargetTrackIds.length === 0) {
    console.warn('[Playlist] No track IDs provided to openSelectPlaylistModal');
    return;
  }

  if (statusEl) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
  }

  if (listEl) {
    listEl.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; padding: 16px; text-align: center;">${getTranslation('Loading playlists...')}</div>`;
  }

  modal.style.display = 'flex';

  getPlaylistsCached().then(res => {
    renderSelectPlaylistItems(res?.Items || []);
  }).catch(err => {
    if (listEl) {
      listEl.innerHTML = `<div style="color: var(--danger); font-size: 13px; text-align: center;">Failed to load playlists: ${err.message}</div>`;
    }
  });
}

function renderSelectPlaylistItems(playlists) {
  const listEl = document.getElementById('select-playlist-list');
  const statusEl = document.getElementById('select-playlist-status');
  if (!listEl) return;

  if (!playlists || playlists.length === 0) {
    listEl.innerHTML = `<div style="color: var(--text-secondary); font-size: 13px; padding: 16px; text-align: center;">${getTranslation('No playlists found. Create one to get started!')}</div>`;
    return;
  }

  listEl.innerHTML = playlists.map(pl => {
    const artUrl = getArtworkUrl(pl, 'Primary', 80);
    const count = pl.ChildCount !== undefined ? `${pl.ChildCount} tracks` : 'Playlist';
    return `
      <div class="select-playlist-item" data-playlist-id="${pl.Id}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--bg-tertiary)'">
        <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex: 1;">
          <img src="${artUrl}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" alt="Cover">
          <div style="overflow: hidden;">
            <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${escapeHtml(pl.Name || 'Playlist')}</div>
            <div style="font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(count)}</div>
          </div>
        </div>
        <button class="btn btn-primary btn-add-to-this-playlist" data-playlist-id="${pl.Id}" style="padding: 6px 12px; font-size: 12px; height: 32px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
          <span data-i18n>Add</span>
        </button>
      </div>
    `;
  }).join('');

  const handleAddToPlaylist = async (playlistId, playlistName) => {
    if (!playlistId || currentTargetTrackIds.length === 0) return;
    if (statusEl) {
      statusEl.textContent = getTranslation('Adding to playlist...');
      statusEl.style.color = 'var(--accent)';
      statusEl.style.display = 'block';
    }

    try {
      await addTracksToPlaylist(playlistId, currentTargetTrackIds);
      if (statusEl) {
        statusEl.textContent = `✓ ${getTranslation('Added')} ${currentTargetTrackIds.length > 1 ? `${currentTargetTrackIds.length} ${getTranslation('tracks')}` : getTranslation('track')} ${getTranslation('to')} ${playlistName || getTranslation('playlist')}`;
        statusEl.style.color = 'var(--success)';
      }
      setTimeout(() => {
        closeSelectPlaylistModal();
      }, 900);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `${getTranslation('Failed to add to playlist')}: ${err.message}`;
        statusEl.style.color = 'var(--danger)';
      }
    }
  };

  listEl.querySelectorAll('.select-playlist-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const playlistId = item.getAttribute('data-playlist-id');
      const playlistName = item.querySelector('div[style*="font-weight: 600"]')?.textContent;
      handleAddToPlaylist(playlistId, playlistName);
    });
  });
}

export function closeSelectPlaylistModal() {
  const modal = document.getElementById('select-playlist-modal');
  if (modal) modal.style.display = 'none';
}



