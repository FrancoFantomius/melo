import { getCurrentTrack } from './queue.js';
import { getArtworkUrl } from '../jellyfin/client.js';
import { audio, state } from './state.js';

export function setupMediaSessionMetadata(track) {
  if ('mediaSession' in navigator && track) {
    const artworkUrl = track.artwork || track.imageUrl || getArtworkUrl(track, 'Primary', 512) || './img/icons/icon_512x.png';
    const artistName = track.Artists && track.Artists.length > 0
      ? track.Artists.join(', ')
      : (track.AlbumArtist || track.artist || track.showTitle || track.podcastTitle || 'Melo');
    const albumName = track.Album || track.album || track.podcastTitle || track.showTitle || 'Melo';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.Name || track.title || 'Unknown Title',
      artist: artistName,
      album: albumName,
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: artworkUrl, sizes: '96x96', type: 'image/png' }
      ]
    });
    updateMediaSessionPositionState();
  }
}

export function updateMediaSessionState() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    updateMediaSessionPositionState();
  }
}

export function updateMediaSessionPositionState() {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    const track = getCurrentTrack();
    let effectiveDuration = 0;
    if (track && track.RunTimeTicks) {
      effectiveDuration = track.RunTimeTicks / 10000000;
    } else if (isFinite(audio.duration) && audio.duration > 0) {
      effectiveDuration = audio.duration + state.seekOffset;
    }

    const realCurrentTime = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);

    if (isFinite(effectiveDuration) && effectiveDuration > 0 && isFinite(realCurrentTime) && realCurrentTime >= 0) {
      try {
        const safePosition = Math.min(realCurrentTime, effectiveDuration);
        navigator.mediaSession.setPositionState({
          duration: effectiveDuration,
          playbackRate: audio.playbackRate || 1.0,
          position: safePosition
        });
      } catch (err) {
        console.warn('[Audio Engine] mediaSession.setPositionState error:', err);
      }
    }
  }
}

// Handlers are injected by the engine to avoid an import cycle (the actions
// need to call audio.js primitives like seekTo/playNextTrack).
export function setupMediaSessionHandlers(handlers) {
  if (!('mediaSession' in navigator)) return;

  const actions = {
    play: () => handlers.togglePlayPause(),
    pause: () => handlers.togglePlayPause(),
    previoustrack: () => handlers.playPrevTrack(),
    nexttrack: () => handlers.playNextTrack(),
    seekbackward: (details) => {
      const skipTime = (details && details.seekOffset) || 10;
      const realPosition = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
      handlers.seekTo(Math.max(0, realPosition - skipTime));
    },
    seekforward: (details) => {
      const skipTime = (details && details.seekOffset) || 10;
      const realPosition = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
      handlers.seekTo(realPosition + skipTime);
    },
    seekto: (details) => {
      if (details && details.seekTime !== undefined && details.seekTime !== null) {
        handlers.seekTo(details.seekTime);
      }
    },
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      state.isPlaying = false;
      handlers.notifyUI();
    }
  };

  for (const [action, handler] of Object.entries(actions)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      console.warn(`[Audio Engine] MediaSession action '${action}' not supported:`, err);
    }
  }
}