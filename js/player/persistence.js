import { getCurrentTrack, getQueueState, restoreQueueState } from './queue.js';
import { isTrackDownloaded, getDownloadedBlobUrl } from '../jellyfin/offline.js';
import { resolveStreamUrl } from './stream.js';
import { audio, state } from './state.js';

const PLAYER_STATE_KEY = 'melo_player_state';

export function savePlayerStateThrottled() {
  const now = Date.now();
  if (now - state.lastSaveTimestamp > 2000) {
    state.lastSaveTimestamp = now;
    savePlayerState();
  }
}

export function savePlayerState() {
  const track = getCurrentTrack();
  if (!track) return;

  const realPosition = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
  const queueState = getQueueState();

  const playerState = {
    queue: queueState.queue,
    originalQueue: queueState.originalQueue,
    currentIndex: queueState.currentIndex,
    shuffle: queueState.shuffle,
    repeat: queueState.repeat,
    position: isFinite(realPosition) ? realPosition : 0,
    volume: audio.volume
  };

  try {
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(playerState));
  } catch (e) {
    console.warn('[Audio Engine] Failed to save player state:', e);
  }
}

// Restores queue + position + volume and loads the track source. Returns the
// saved state when a playable queue was restored so the caller can apply
// media-session metadata and notify the UI.
export async function restorePlayerState() {
  try {
    const raw = localStorage.getItem(PLAYER_STATE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);

    if (saved.queue && Array.isArray(saved.queue) && saved.queue.length > 0
      && typeof saved.currentIndex === 'number' && saved.currentIndex >= 0) {
      restoreQueueState(saved);

      if (typeof saved.volume === 'number' && isFinite(saved.volume)) {
        audio.volume = Math.max(0, Math.min(1, saved.volume));
        if (audio.volume > 0) {
          state.previousVolume = audio.volume;
        }
      }

      const track = getCurrentTrack();
      if (track) {
        const savedPos = saved.position || 0;
        const trackKey = track.Id || track.id;
        const downloaded = trackKey && await isTrackDownloaded(trackKey);

        if (downloaded) {
          const blobUrl = await getDownloadedBlobUrl(trackKey);
          if (blobUrl) {
            state.seekOffset = 0;
            audio.src = blobUrl;
            if (savedPos > 0) audio.currentTime = savedPos;
            return saved;
          }
        }

        state.seekOffset = savedPos;
        const startTicks = Math.floor(savedPos * 10000000);
        audio.src = resolveStreamUrl(track, startTicks);
        return saved;
      }
    }
  } catch (err) {
    console.warn('[Audio Engine] Failed to restore player state:', err);
  }
  return null;
}