import { IndexedDBCacheAdapter } from '@francofantomius/jellyfin';
import { getCurrentTrack, getQueueState, restoreQueueState } from './queue.js';
import { isTrackDownloaded, getDownloadedBlobUrl } from '../jellyfin/offline.js';
import { resolveStreamUrl, resolveHlsStreamUrl, isHlsEligible } from './stream.js';
import { loadHlsStream, isHlsSupported, isNativeHlsSupported } from './hls-engine.js';
import { audio, state } from './state.js';

const PLAYER_STATE_KEY = 'melo_player_state';
const idbStateStorage = new IndexedDBCacheAdapter('MeloPlayerStorage', 1, 'player_state');

let saveQueuePromise = Promise.resolve();

function sanitizeTrackForStorage(track) {
  if (!track || typeof track !== 'object') return track;
  return {
    Id: track.Id || track.id,
    id: track.Id || track.id,
    Name: track.Name || track.title || '',
    title: track.title || track.Name || '',
    Artists: track.Artists || (track.Artist ? [track.Artist] : []),
    Artist: track.Artist || (Array.isArray(track.Artists) ? track.Artists.join(', ') : ''),
    AlbumArtist: track.AlbumArtist || '',
    Album: track.Album || '',
    AlbumId: track.AlbumId || '',
    RunTimeTicks: track.RunTimeTicks,
    duration: track.duration,
    IndexNumber: track.IndexNumber,
    ImageTags: track.ImageTags ? { Primary: track.ImageTags.Primary } : undefined,
    AlbumPrimaryImageTag: track.AlbumPrimaryImageTag,
    image: track.image,
    isPodcastEpisode: track.isPodcastEpisode,
    enclosureUrl: track.enclosureUrl,
    showTitle: track.showTitle,
    HasLyrics: track.HasLyrics ?? track.hasLyrics,
    hasLyrics: track.hasLyrics ?? track.HasLyrics,
    MediaSources: track.MediaSources?.[0]?.Id ? [{ Id: track.MediaSources[0].Id }] : undefined
  };
}

function saveCompactPlayerStateToLocalStorage(playerState) {
  try {
    const maxFallbackTracks = 50;
    const queue = Array.isArray(playerState.queue) ? playerState.queue : [];
    const currentIdx = typeof playerState.currentIndex === 'number' ? playerState.currentIndex : 0;

    const startIdx = Math.max(0, currentIdx - 10);
    const endIdx = Math.min(queue.length, startIdx + maxFallbackTracks);
    const compactQueue = queue.slice(startIdx, endIdx).map(sanitizeTrackForStorage);
    const compactIndex = Math.max(0, currentIdx - startIdx);

    const compactState = {
      queue: compactQueue,
      currentIndex: compactIndex,
      shuffle: playerState.shuffle,
      repeat: playerState.repeat,
      position: playerState.position,
      volume: playerState.volume
    };

    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(compactState));
  } catch (e) {
    try {
      const currentTrack = playerState.queue?.[playerState.currentIndex];
      const singleTrackState = {
        queue: currentTrack ? [sanitizeTrackForStorage(currentTrack)] : [],
        currentIndex: 0,
        shuffle: playerState.shuffle,
        repeat: playerState.repeat,
        position: playerState.position,
        volume: playerState.volume
      };
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(singleTrackState));
    } catch (innerErr) {
      try {
        localStorage.removeItem(PLAYER_STATE_KEY);
      } catch (_) {}
    }
  }
}

export function savePlayerStateThrottled() {
  const now = Date.now();
  if (now - state.lastSaveTimestamp > 2000) {
    state.lastSaveTimestamp = now;
    savePlayerState();
  }
}

export function savePlayerState() {
  const track = getCurrentTrack();
  if (!track) return Promise.resolve();

  const realPosition = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
  const queueState = getQueueState();

  const playerState = {
    queue: queueState.queue,
    originalQueue: queueState.originalQueue || queueState.queue,
    currentIndex: queueState.currentIndex,
    shuffle: queueState.shuffle,
    repeat: queueState.repeat,
    position: isFinite(realPosition) ? realPosition : 0,
    volume: audio.volume
  };

  saveQueuePromise = saveQueuePromise.then(async () => {
    // 1. Primary: Save to IndexedDB (handles large queues without quota issues)
    try {
      await idbStateStorage.set(PLAYER_STATE_KEY, playerState);
    } catch (idbErr) {
      console.warn('[Audio Engine] Failed to save player state to IndexedDB:', idbErr);
    }

    // 2. Fallback: Save a compact, sanitized version to localStorage
    saveCompactPlayerStateToLocalStorage(playerState);
  }).catch((err) => {
    console.warn('[Audio Engine] Error during savePlayerState:', err);
  });

  return saveQueuePromise;
}

export async function clearSavedPlayerState() {
  try {
    localStorage.removeItem(PLAYER_STATE_KEY);
  } catch (_) {}
  try {
    await idbStateStorage.delete(PLAYER_STATE_KEY);
  } catch (_) {}
}

// Restores queue + position + volume and loads the track source. Returns the
// saved state when a playable queue was restored so the caller can apply
// media-session metadata and notify the UI.
export async function restorePlayerState() {
  try {
    let saved = null;

    // 1. Primary: Try restoring from IndexedDB
    try {
      saved = await idbStateStorage.get(PLAYER_STATE_KEY);
    } catch (err) {
      console.warn('[Audio Engine] Failed to restore from IndexedDB:', err);
    }

    // 2. Fallback: Try localStorage if IndexedDB had nothing (e.g. migration)
    if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) {
      try {
        const raw = localStorage.getItem(PLAYER_STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.queue) && parsed.queue.length > 0) {
            saved = parsed;
            // Migrate to IndexedDB
            idbStateStorage.set(PLAYER_STATE_KEY, saved).catch(() => {});
          }
        }
      } catch (lsErr) {
        console.warn('[Audio Engine] Failed to restore from localStorage:', lsErr);
      }
    }

    if (!saved) return null;

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
            state.isHls = false;
            state.streamType = 'blob';
            state.seekOffset = 0;
            audio.src = blobUrl;
            if (savedPos > 0 && isFinite(savedPos)) {
              try { audio.currentTime = savedPos; } catch (_) {}
              const applyBlobPos = () => {
                try { audio.currentTime = savedPos; } catch (_) {}
              };
              if (audio.readyState < 1) {
                audio.addEventListener('loadedmetadata', applyBlobPos, { once: true });
              }
            }
            return saved;
          }
        }

        const eligibleHls = isHlsEligible(track) && (isHlsSupported() || isNativeHlsSupported(audio));
        if (eligibleHls) {
          state.isHls = true;
          state.streamType = 'hls';
          state.seekOffset = 0;
          const hlsUrl = resolveHlsStreamUrl(track, 0);
          loadHlsStream(audio, hlsUrl, savedPos, {
            onFallback: () => {
              console.warn('[Audio Engine] Restored HLS stream failed, falling back to direct stream...');
              state.isHls = false;
              state.streamType = 'direct';
              state.seekOffset = 0;
              audio.src = resolveStreamUrl(track, 0);
              if (savedPos > 0 && isFinite(savedPos)) {
                try { audio.currentTime = savedPos; } catch (_) {}
                const applyPos = () => {
                  try { audio.currentTime = savedPos; } catch (_) {}
                };
                if (audio.readyState < 1) {
                  audio.addEventListener('loadedmetadata', applyPos, { once: true });
                }
              }
            }
          }).catch(() => {});
          return saved;
        }

        state.isHls = false;
        state.streamType = 'direct';
        state.seekOffset = 0;
        audio.src = resolveStreamUrl(track, 0);

        if (savedPos > 0 && isFinite(savedPos)) {
          try { audio.currentTime = savedPos; } catch (_) {}
          const applySavedPosition = () => {
            try {
              audio.currentTime = savedPos;
            } catch (e) {
              console.warn('[Audio Engine] Error restoring currentTime:', e);
            }
          };

          if (audio.readyState < 1) {
            audio.addEventListener('loadedmetadata', applySavedPosition, { once: true });
          }
        }
        return saved;
      }
    }
  } catch (err) {
    console.warn('[Audio Engine] Failed to restore player state:', err);
  }
  return null;
}