import { getArtworkUrl } from '../../jellyfin/client.js';
import { getQueueState, setCurrentIndex } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { openSelectPlaylistModal } from './playlists.js';
import { syncOverlaysWithHash } from './index.js';
import { escapeHtml } from './shared.js';

export function initQueueDrawer() {
  const queueDrawer = document.getElementById('queue-drawer');
  const btnQueueClose = document.getElementById('btn-queue-close');

  btnQueueClose?.addEventListener('click', () => toggleQueueDrawer());
}

export function openQueueDrawer() {
  const queueDrawer = document.getElementById('queue-drawer');
  if (!queueDrawer) return;
  renderQueueDrawerList();
  queueDrawer.classList.add('open');
  document.getElementById('player-btn-queue')?.classList.add('active');
  document.getElementById('emp-btn-queue')?.classList.add('active');
}

export function closeQueueDrawer() {
  const queueDrawer = document.getElementById('queue-drawer');
  if (!queueDrawer) return;
  queueDrawer.classList.remove('open');
  document.getElementById('player-btn-queue')?.classList.remove('active');
  document.getElementById('emp-btn-queue')?.classList.remove('active');
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
      closeQueueDrawer();
    }
  } else {
    if (window.location.hash !== '#queue') {
      window.location.hash = 'queue';
    } else {
      openQueueDrawer();
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