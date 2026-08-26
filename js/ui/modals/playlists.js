import { createPlaylist, updatePlaylist, uploadPlaylistImage, deletePlaylist, addTracksToPlaylist, searchJellyfinCached, getSongsCached, getPlaylistsCached, getArtworkUrl } from '../../jellyfin/client.js';
import { getTranslation } from '../../i18n.js';
import { escapeHtml } from './shared.js';
import { getPlaceholder } from '../placeholders.js';

let currentCreatePlaylistCallback = null;
let currentEditPlaylistCallback = null;
let currentEditPlaylistDeleteCallback = null;
let currentAddTracksCallback = null;
let currentDeletePlaylistCallback = null;
let currentTargetTrackIds = [];

export function initPlaylistModals() {
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

  const btnEditDelete = document.getElementById('btn-delete-playlist-in-edit');
  btnEditDelete?.addEventListener('click', () => {
    const playlistId = document.getElementById('edit-playlist-id')?.value;
    const playlistName = document.getElementById('edit-playlist-name')?.value;
    closeEditPlaylistModal();
    openDeletePlaylistModal(playlistId, playlistName, currentEditPlaylistDeleteCallback);
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

export function openEditPlaylistModal(playlistId, currentName, onSaveCallback, onDeleteCallback) {
  const modal = document.getElementById('edit-playlist-modal');
  const idInput = document.getElementById('edit-playlist-id');
  const nameInput = document.getElementById('edit-playlist-name');
  const fileInput = document.getElementById('edit-playlist-image');
  const errorEl = document.getElementById('edit-playlist-error');

  if (!modal) return;
  currentEditPlaylistCallback = onSaveCallback;
  currentEditPlaylistDeleteCallback = onDeleteCallback || null;
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
    const artUrl = getArtworkUrl(track, 'Primary', 80, 'song');
    return `
      <div class="add-track-item" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
          <img src="${artUrl}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('song') : '${getPlaceholder('song')}';" data-placeholder-type="song" style="width: 36px; height: 36px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" alt="Cover">
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
    const artUrl = getArtworkUrl(pl, 'Primary', 80, 'playlist');
    const count = pl.ChildCount !== undefined ? `${pl.ChildCount} tracks` : 'Playlist';
    return `
      <div class="select-playlist-item" data-playlist-id="${pl.Id}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--bg-tertiary)'">
        <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex: 1;">
          <img src="${artUrl}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('playlist') : '${getPlaceholder('playlist')}';" data-placeholder-type="playlist" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" alt="Cover">
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