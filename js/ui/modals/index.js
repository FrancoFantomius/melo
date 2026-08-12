import { initLoginModal } from './login.js';
import { initSettingsModal } from './settings.js';
import { initLyricsModal, openLyricsModalInternal, closeLyricsModalInternal } from './lyrics.js';
import { initQueueDrawer, openQueueDrawer, closeQueueDrawer } from './queue.js';
import { initPlaylistModals } from './playlists.js';
import { initAddPodcastModal } from './podcasts.js';

export function initModals() {
  initLoginModal();
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

export function syncOverlaysWithHash() {
  const hash = window.location.hash;

  const empContainer = document.getElementById('expanded-mobile-player');
  const lyricsView = document.getElementById('lyrics-view');

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
    if (!document.getElementById('queue-drawer')?.classList.contains('open')) {
      openQueueDrawer();
    }
  } else {
    if (document.getElementById('queue-drawer')?.classList.contains('open')) {
      closeQueueDrawer();
    }
  }
}