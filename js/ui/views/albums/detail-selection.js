import { addToQueue } from '../../../player/queue.js';
import { notifyUI } from '../../../player/audio.js';
import { removeTrackFromPlaylist } from '../../../jellyfin/client.js';
import { openSelectPlaylistModal } from '../../modals.js';
import { getTranslation } from '../../../i18n.js';

export function setupTrackSelection({ getSongs, getAlbumId, onRemoveDone }) {
  const selectedKeys = new Set();
  let albumTrackIds = [];

  const applySelectionUI = () => {
    const toolbar = document.getElementById('album-tracks-toolbar');
    const countEl = document.getElementById('album-tracks-selected-count');
    const songsListEl = document.getElementById('album-songs-list');
    const selectAllBtn = document.getElementById('btn-tracks-select-all');
    const selectAllIcon = selectAllBtn?.querySelector('.material-symbols-outlined');

    if (toolbar) toolbar.classList.toggle('visible', selectedKeys.size > 0);
    if (countEl) countEl.textContent = selectedKeys.size > 0 ? `${selectedKeys.size} ${getTranslation('selected')}` : '';

    if (selectAllBtn && selectAllIcon) {
      const total = albumTrackIds.length;
      if (selectedKeys.size === 0) selectAllIcon.textContent = 'check_box_outline_blank';
      else if (total > 0 && selectedKeys.size >= total) selectAllIcon.textContent = 'check_box';
      else selectAllIcon.textContent = 'indeterminate_check_box';
    }

    if (songsListEl) {
      songsListEl.classList.toggle('track-selection-active', selectedKeys.size > 0);
      songsListEl.querySelectorAll('.track-row').forEach(row => {
        const id = row.getAttribute('data-track-id');
        row.classList.toggle('selected', !!id && selectedKeys.has(id));
      });
    }
  };

  const setTrackIds = (ids) => {
    albumTrackIds = ids;
    for (const key of [...selectedKeys]) {
      if (!albumTrackIds.includes(key)) selectedKeys.delete(key);
    }
    applySelectionUI();
  };

  const toggleTrackSelection = (id) => {
    if (!id) return;
    if (selectedKeys.has(id)) selectedKeys.delete(id);
    else selectedKeys.add(id);
    applySelectionUI();
  };

  document.getElementById('btn-tracks-select-all')?.addEventListener('click', () => {
    if (albumTrackIds.length > 0 && selectedKeys.size >= albumTrackIds.length) {
      selectedKeys.clear();
    } else {
      selectedKeys.clear();
      albumTrackIds.forEach(id => selectedKeys.add(id));
    }
    applySelectionUI();
  });

  document.getElementById('btn-tracks-clear-selection')?.addEventListener('click', () => {
    selectedKeys.clear();
    applySelectionUI();
  });

  document.getElementById('btn-tracks-add-playlist')?.addEventListener('click', () => {
    const tracks = getSongs().filter(t => selectedKeys.has(String(t.Id || t.id)));
    if (tracks.length === 0) return;
    openSelectPlaylistModal(tracks);
    selectedKeys.clear();
    applySelectionUI();
  });

  document.getElementById('btn-tracks-add-queue')?.addEventListener('click', () => {
    const tracks = getSongs().filter(t => selectedKeys.has(String(t.Id || t.id)));
    if (tracks.length === 0) return;
    addToQueue(tracks);
    selectedKeys.clear();
    applySelectionUI();
    notifyUI();
  });

  document.getElementById('btn-tracks-remove-playlist')?.addEventListener('click', async () => {
    if (selectedKeys.size === 0) return;
    const entryIds = getSongs()
      .filter(t => selectedKeys.has(String(t.Id || t.id)))
      .map(t => t.PlaylistItemId || String(t.Id || t.id))
      .filter(Boolean);
    if (entryIds.length === 0) return;
    try {
      await removeTrackFromPlaylist(getAlbumId(), entryIds.join(','));
    } catch (err) {
      console.error('[Albums] Failed to remove tracks from playlist:', err);
    }
    selectedKeys.clear();
    applySelectionUI();
    if (onRemoveDone) await onRemoveDone();
  });

  document.getElementById('album-songs-list')?.addEventListener('melo-track-longpress', (e) => {
    toggleTrackSelection(e.detail?.trackId);
  });

  return { setTrackIds, applySelectionUI, toggleTrackSelection };
}