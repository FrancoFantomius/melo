import { initSettingsModal } from './settings.js';
import { initLyricsModal, openLyricsModalInternal, closeLyricsModalInternal } from './lyrics.js';
import { initQueueDrawer, openQueueDrawer, closeQueueDrawer, isQueueOpen } from './queue.js';
import { initPlaylistModals } from './playlists.js';
import { initAddPodcastModal } from './podcasts.js';

export function initModals() {
  initSettingsModal();
  initLyricsModal();
  initQueueDrawer();
  initAddPodcastModal();
  initPlaylistModals();

  // Window hash routing & popstate navigation for full-screen overlays
  window.addEventListener('hashchange', syncOverlaysWithHash);
  window.addEventListener('popstate', syncOverlaysWithHash);
  setTimeout(syncOverlaysWithHash, 100);
}

let lastSyncedHash = null;

export function syncOverlaysWithHash() {
  const hash = window.location.hash;

  const empContainer = document.getElementById('expanded-mobile-player');
  const lyricsView = document.getElementById('lyrics-view');

  // Handle #player
  if (hash === '#player') {
    empContainer?.classList.add('open');
  } else if (hash !== '#lyrics' && hash !== '#queue') {
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
    if (!isQueueOpen()) {
      openQueueDrawer();
    }
  } else if (lastSyncedHash === '#queue') {
    if (isQueueOpen()) {
      closeQueueDrawer();
    }
  }

  lastSyncedHash = hash;
}