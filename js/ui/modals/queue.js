import { getArtworkUrl } from '../../jellyfin/client.js';
import { getQueueState, setCurrentIndex, removeFromQueue, clearQueue } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { openSelectPlaylistModal } from './playlists.js';
import { escapeHtml } from './shared.js';
import { getPlaceholder } from '../placeholders.js';

let lastRenderedSignature = null;
let isClosingInternally = false;

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function isQueueOpen() {
  const desktopSheet = document.getElementById('desktop-queue-sheet');
  const mobileSheet = document.getElementById('mobile-queue-sheet');
  return Boolean((desktopSheet && desktopSheet.open) || (mobileSheet && mobileSheet.open));
}

function updateQueueButtonStates(isOpen) {
  const playerBtn = document.getElementById('player-btn-queue');
  const empBtn = document.getElementById('emp-btn-queue');
  if (isOpen) {
    playerBtn?.classList.add('active');
    empBtn?.classList.add('active');
  } else {
    playerBtn?.classList.remove('active');
    empBtn?.classList.remove('active');
  }
}

function handleSheetClosed() {
  if (isClosingInternally) return;
  updateQueueButtonStates(false);

  if (window.location.hash === '#queue') {
    const empContainer = document.getElementById('expanded-mobile-player');
    const targetHash = empContainer?.classList.contains('open') ? '#player' : '';
    history.replaceState(null, '', window.location.pathname + window.location.search + targetHash);
  }
}

function bindQueueContainerEvents(container) {
  if (!container) return;

  container.addEventListener('click', (e) => {
    // Add to playlist button
    const addBtn = e.target.closest('.btn-queue-add-playlist');
    if (addBtn) {
      e.stopPropagation();
      e.preventDefault();
      const idx = parseInt(addBtn.getAttribute('data-queue-index'), 10);
      const { queue } = getQueueState();
      if (!isNaN(idx) && queue && queue[idx]) {
        openSelectPlaylistModal(queue[idx]);
      }
      return;
    }

    // Remove from queue button
    const removeBtn = e.target.closest('.btn-queue-remove');
    if (removeBtn) {
      e.stopPropagation();
      e.preventDefault();
      const idx = parseInt(removeBtn.getAttribute('data-queue-index'), 10);
      if (!isNaN(idx)) {
        removeFromQueue(idx);
        renderQueueDrawerList(true);
      }
      return;
    }

    // Click on track item
    const row = e.target.closest('.queue-track-item');
    if (row) {
      const idx = parseInt(row.getAttribute('data-queue-index'), 10);
      if (!isNaN(idx)) {
        setCurrentIndex(idx);
        playTrack();
        renderQueueDrawerList(true);
      }
    }
  });
}

export function initQueueDrawer() {
  const desktopSheet = document.getElementById('desktop-queue-sheet');
  const mobileSheet = document.getElementById('mobile-queue-sheet');
  const desktopContainer = document.getElementById('desktop-queue-tracks-list');
  const mobileContainer = document.getElementById('mobile-queue-tracks-list');
  const desktopClearBtn = document.getElementById('desktop-btn-clear-queue');
  const mobileClearBtn = document.getElementById('mobile-btn-clear-queue');

  // Bind track container click delegations
  bindQueueContainerEvents(desktopContainer);
  bindQueueContainerEvents(mobileContainer);

  // Clear queue buttons
  const onClear = (e) => {
    e?.stopPropagation();
    clearQueue();
    renderQueueDrawerList(true);
  };
  desktopClearBtn?.addEventListener('click', onClear);
  mobileClearBtn?.addEventListener('click', onClear);

  // Bind Sheet close / dismiss events
  const closeEvents = ['close', 'cancel', 'scrim-click', 'close-click', 'drag-dismiss'];
  [desktopSheet, mobileSheet].forEach((sheet) => {
    if (!sheet) return;
    closeEvents.forEach((evtName) => {
      sheet.addEventListener(evtName, () => {
        if (!desktopSheet?.open && !mobileSheet?.open) {
          handleSheetClosed();
        }
      });
    });
  });

  // Responsive breakpoint listener: migrate open sheet on window resize
  const mediaQuery = window.matchMedia('(max-width: 768px)');
  mediaQuery.addEventListener('change', (e) => {
    if (!isQueueOpen()) return;
    isClosingInternally = true;
    if (e.matches) {
      // Switched to Mobile
      desktopSheet?.close();
      mobileSheet?.show();
    } else {
      // Switched to Desktop
      mobileSheet?.close();
      desktopSheet?.show();
    }
    isClosingInternally = false;
    renderQueueDrawerList(true);
  });
}

export function openQueueDrawer() {
  const desktopSheet = document.getElementById('desktop-queue-sheet');
  const mobileSheet = document.getElementById('mobile-queue-sheet');

  renderQueueDrawerList(true);

  if (isMobile()) {
    desktopSheet?.close();
    mobileSheet?.show();
  } else {
    mobileSheet?.close();
    desktopSheet?.show();
  }

  updateQueueButtonStates(true);
}

export function closeQueueDrawer() {
  const desktopSheet = document.getElementById('desktop-queue-sheet');
  const mobileSheet = document.getElementById('mobile-queue-sheet');

  isClosingInternally = true;
  desktopSheet?.close();
  mobileSheet?.close();
  isClosingInternally = false;

  updateQueueButtonStates(false);

  if (window.location.hash === '#queue') {
    const empContainer = document.getElementById('expanded-mobile-player');
    const targetHash = empContainer?.classList.contains('open') ? '#player' : '';
    history.replaceState(null, '', window.location.pathname + window.location.search + targetHash);
  }
}

export function toggleQueueDrawer() {
  if (isQueueOpen()) {
    closeQueueDrawer();
  } else {
    openQueueDrawer();
  }
}

export function renderQueueDrawerList(force = false) {
  const desktopContainer = document.getElementById('desktop-queue-tracks-list');
  const mobileContainer = document.getElementById('mobile-queue-tracks-list');
  const desktopBadge = document.getElementById('desktop-queue-count');
  const mobileBadge = document.getElementById('mobile-queue-count');

  if (!desktopContainer && !mobileContainer) return;

  const { queue, currentIndex } = getQueueState();
  const countText = queue && queue.length > 0 ? `(${queue.length})` : '';

  if (desktopBadge) desktopBadge.textContent = countText;
  if (mobileBadge) mobileBadge.textContent = countText;

  if (!queue || queue.length === 0) {
    if (force || lastRenderedSignature !== 'empty') {
      const emptyHtml = `
        <div class="queue-empty-state">
          <span class="material-symbols-outlined queue-empty-icon">queue_music</span>
          <div class="queue-empty-text">Queue is empty</div>
        </div>
      `;
      if (desktopContainer) desktopContainer.innerHTML = emptyHtml;
      if (mobileContainer) mobileContainer.innerHTML = emptyHtml;
      lastRenderedSignature = 'empty';
    }
    return;
  }

  const currentTrackId = queue[currentIndex] ? (queue[currentIndex].Id || queue[currentIndex].id || currentIndex) : 'none';
  const queueSignature = `${currentIndex}_${currentTrackId}_${queue.length}_${queue.map(t => t.Id || t.id || t.Name || '').join(',')}`;

  if (!force && lastRenderedSignature === queueSignature && ((desktopContainer && desktopContainer.children.length > 0) || (mobileContainer && mobileContainer.children.length > 0))) {
    return;
  }
  lastRenderedSignature = queueSignature;

  const currentTrack = queue[currentIndex];
  const upcomingTracks = queue.slice(currentIndex + 1);
  const previousTracks = queue.slice(0, currentIndex);

  const renderQueueItem = (track, idx, isCurrent = false) => {
    const isPodcast = !!(track && (track.isPodcastEpisode || track.enclosureUrl));
    const placeholderType = isPodcast ? 'podcast' : 'song';
    const artUrl = track.image ? track.image : getArtworkUrl(track, 'Primary', 100, placeholderType);
    const artistStr = track.Artists ? track.Artists.join(', ') : (track.AlbumArtist || track.showTitle || 'Unknown Artist');
    const titleStr = track.Name || track.title || 'Unknown Title';
    const canAddToPlaylist = track && track.Id && !track.isPodcastEpisode && !track.enclosureUrl;

    return `
      <div class="queue-track-item ${isCurrent ? 'playing' : ''}" data-queue-index="${idx}">
        <div class="queue-track-status">
          ${isCurrent ? '<span class="material-symbols-outlined playing-indicator">volume_up</span>' : `<span class="queue-track-num">${idx + 1}</span>`}
        </div>
        <div class="queue-track-thumb-container">
          <img src="${artUrl}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('${placeholderType}') : '${getPlaceholder(placeholderType)}';" data-placeholder-type="${placeholderType}" class="queue-track-thumb" alt="Cover">
          ${isCurrent ? '<div class="queue-playing-overlay"><span class="material-symbols-outlined queue-playing-icon">equalizer</span></div>' : ''}
        </div>
        <div class="queue-track-details">
          <div class="queue-track-title">${escapeHtml(titleStr)}</div>
          <div class="queue-track-artist">${escapeHtml(artistStr)}</div>
        </div>
        <div class="queue-track-actions">
          ${canAddToPlaylist ? `
            <button class="btn-queue-action btn-queue-add-playlist btn-icon" title="Add to Playlist" data-queue-index="${idx}" aria-label="Add to Playlist">
              <span class="material-symbols-outlined" style="font-size: 20px;">playlist_add</span>
            </button>
          ` : ''}
          ${!isCurrent ? `
            <button class="btn-queue-action btn-queue-remove btn-icon" title="Remove from Queue" data-queue-index="${idx}" aria-label="Remove from Queue">
              <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
            </button>
          ` : ''}
        </div>
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
    html += `
      <div class="queue-section-header">
        <span>UP NEXT</span>
        <span style="opacity: 0.75; font-size: 11px; font-weight: 500;">(${upcomingTracks.length})</span>
      </div>
    `;
    upcomingTracks.forEach((track, relIdx) => {
      const actualIdx = currentIndex + 1 + relIdx;
      html += renderQueueItem(track, actualIdx, false);
    });
  }

  if (previousTracks.length > 0) {
    html += `
      <div class="queue-section-header previous-section">
        <span>PREVIOUSLY PLAYED</span>
        <span style="opacity: 0.75; font-size: 11px; font-weight: 500;">(${previousTracks.length})</span>
      </div>
    `;
    previousTracks.forEach((track, actualIdx) => {
      html += renderQueueItem(track, actualIdx, false);
    });
  }

  if (desktopContainer) desktopContainer.innerHTML = html;
  if (mobileContainer) mobileContainer.innerHTML = html;
}