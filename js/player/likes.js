import { markFavorite, unmarkFavorite } from '../jellyfin/client.js';

const LIKED_STORAGE_KEY = 'melo_liked_song_ids';

function getStoredLikedIds() {
  try {
    const raw = localStorage.getItem(LIKED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    console.warn('[Likes] Failed to read liked songs from localStorage:', e);
    return new Set();
  }
}

function saveStoredLikedIds(likedSet) {
  try {
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(Array.from(likedSet)));
  } catch (e) {
    console.warn('[Likes] Failed to save liked songs to localStorage:', e);
  }
}

const likedTrackIds = getStoredLikedIds();

export function isTrackLiked(trackId) {
  if (!trackId) return false;
  return likedTrackIds.has(String(trackId));
}

export function registerTrackFavoriteStatus(track) {
  if (!track || !track.Id) return;
  const idStr = String(track.Id);
  if (track.UserData && typeof track.UserData.IsFavorite === 'boolean') {
    if (track.UserData.IsFavorite) {
      likedTrackIds.add(idStr);
    } else {
      likedTrackIds.delete(idStr);
    }
    saveStoredLikedIds(likedTrackIds);
  }
}

export function registerTracksFavoriteStatus(tracks) {
  if (!Array.isArray(tracks)) return;
  tracks.forEach(registerTrackFavoriteStatus);
}

export async function toggleTrackLiked(track) {
  if (!track) return false;
  const trackId = typeof track === 'object' ? track.Id : track;
  if (!trackId) return false;

  const idStr = String(trackId);
  const currentlyLiked = likedTrackIds.has(idStr);
  const nextLiked = !currentlyLiked;

  if (nextLiked) {
    likedTrackIds.add(idStr);
  } else {
    likedTrackIds.delete(idStr);
  }
  saveStoredLikedIds(likedTrackIds);

  if (typeof track === 'object' && track.UserData) {
    track.UserData.IsFavorite = nextLiked;
  }

  // Dispatch custom event for real-time UI synchronization
  window.dispatchEvent(new CustomEvent('melo-likes-changed', {
    detail: { trackId: idStr, isLiked: nextLiked, track }
  }));

  // Sync with Jellyfin server in background
  try {
    if (nextLiked) {
      await markFavorite(idStr);
    } else {
      await unmarkFavorite(idStr);
    }
  } catch (err) {
    console.warn('[Likes] Jellyfin sync error for track:', idStr, err);
  }

  return nextLiked;
}

export function getLikedTrackIds() {
  return Array.from(likedTrackIds);
}
