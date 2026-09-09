import { getSession } from './session.js';
import { jellyfinFetch, buildApiError } from './http.js';
import { clearApiCache } from './cache.js';

export async function createPlaylist({ name, isPublic = false, trackIds = [] }) {
  const session = getSession();
  if (!session.serverUrl || !session.userId) {
    throw new Error('Not logged in to Jellyfin server');
  }
  if (!name || !name.trim()) {
    throw new Error('Playlist name is required');
  }

  const idsStr = Array.isArray(trackIds) ? trackIds.join(',') : '';

  const resData = await jellyfinFetch('/Playlists', {
    method: 'POST',
    params: {
      Name: name.trim(),
      UserId: session.userId,
      MediaType: 'Audio',
      ...(idsStr ? { Ids: idsStr } : {})
    }
  });

  const playlistId = resData?.Id;

  if (playlistId && isPublic) {
    try {
      await jellyfinFetch(`/Playlists/${playlistId}`, {
        method: 'POST',
        body: { IsPublic: true }
      });
    } catch (err) {
      console.warn('[Jellyfin] Failed to update public status for playlist:', err);
    }
  }

  await clearApiCache();
  return playlistId;
}

export async function updatePlaylist(playlistId, { name }) {
  const session = getSession();
  if (!session.serverUrl || !playlistId) return;

  const body = {};
  if (name) body.Name = name;

  try {
    await jellyfinFetch(`/Playlists/${playlistId}`, { method: 'POST', body });
  } catch (err) {
    throw buildApiError(`Failed to update playlist metadata (HTTP ${err.status || 'unknown'})`, err.status);
  }

  await clearApiCache();
}

export async function uploadPlaylistImage(playlistId, base64ImageString, mimeType = 'image/jpeg') {
  const session = getSession();
  if (!session.serverUrl || !playlistId || !base64ImageString) return;

  const base64Data = base64ImageString.includes(',') ? base64ImageString.split(',')[1] : base64ImageString;

  try {
    await jellyfinFetch(`/Items/${playlistId}/Images/Primary`, {
      method: 'POST',
      contentType: mimeType,
      body: base64Data
    });
  } catch (err) {
    if (err.status === 403) {
      throw new Error('Image upload requires admin permissions on the Jellyfin server.');
    }
    throw buildApiError(`Failed to upload playlist image (HTTP ${err.status || 'unknown'})`, err.status);
  }

  await clearApiCache();
}

export async function deletePlaylist(playlistId) {
  const session = getSession();
  if (!session.serverUrl || !playlistId) return;

  try {
    await jellyfinFetch(`/Items/${playlistId}`, { method: 'DELETE' });
  } catch (err) {
    throw buildApiError(`Failed to delete playlist (HTTP ${err.status || 'unknown'})`, err.status);
  }

  await clearApiCache();
}

export async function addTracksToPlaylist(playlistId, trackIds) {
  const session = getSession();
  if (!session.serverUrl || !playlistId || !trackIds || trackIds.length === 0) return;

  const idsStr = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;

  try {
    await jellyfinFetch(`/Playlists/${playlistId}/Items`, {
      method: 'POST',
      params: { Ids: idsStr, UserId: session.userId }
    });
  } catch (err) {
    throw buildApiError(`Failed to add tracks to playlist (HTTP ${err.status || 'unknown'})`, err.status);
  }

  await clearApiCache();
}

export async function removeTrackFromPlaylist(playlistId, entryIdOrTrackId) {
  const session = getSession();
  if (!session.serverUrl || !playlistId || !entryIdOrTrackId) return;

  try {
    await jellyfinFetch(`/Playlists/${playlistId}/Items`, {
      method: 'DELETE',
      params: { EntryIds: entryIdOrTrackId }
    });
  } catch (err) {
    try {
      // Fallback to legacy ItemIds param for older Jellyfin servers
      await jellyfinFetch(`/Playlists/${playlistId}/Items`, {
        method: 'DELETE',
        params: { ItemIds: entryIdOrTrackId }
      });
    } catch (fallbackErr) {
      console.warn('[Jellyfin] Failed to remove track from playlist:', fallbackErr);
    }
  }

  await clearApiCache();
}
