import {
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped
} from '../jellyfin/client.js';
import { getCurrentTrack, nextTrack, prevTrack, peekNextTrack, getQueueState, setCurrentTrack } from './queue.js';
import { getEpisodeState, saveEpisodeProgress, getSavedPlaybackSpeed, savePlaybackSpeed } from '../podcasts/storage.js';
import { cleanAudioUrl } from '../podcasts/rss.js';
import { isTrackDownloaded, warmOfflineCache } from '../jellyfin/offline.js';
import { audio, audioA, audioB, state } from './state.js';
import { resolveStreamUrl, buildSeekStreamUrl, resolvePodcastProxyBlobUrl } from './stream.js';
import { savePlayerState, savePlayerStateThrottled, restorePlayerState } from './persistence.js';
import { setupMediaSessionMetadata, updateMediaSessionState, updateMediaSessionPositionState, setupMediaSessionHandlers } from './media-session.js';
import { startProgressReporting, stopProgressReporting } from './progress.js';
import { armAutoAdvanceRetry, initBackgroundKeepalive } from './background.js';

function swapAudioElements() {
  const prevActive = state.activeAudio;
  state.activeAudio = state.standbyAudio;
  state.standbyAudio = prevActive;

  // Stop, release previous active audio stream to free decoder and network resources
  prevActive.pause();
  prevActive.removeAttribute('src');
  prevActive.load();
}

export function preloadNextTrack() {
  const next = peekNextTrack(true);
  if (!next) {
    if (state.preloadedTrackId !== null) {
      state.preloadedTrackId = null;
      state.preloadedStreamUrl = null;
      state.standbyAudio.removeAttribute('src');
      state.standbyAudio.load();
    }
    return;
  }

  const nextId = next.Id || next.id;
  if (state.preloadedTrackId === nextId && state.standbyAudio.src && state.standbyAudio.src === state.preloadedStreamUrl) {
    return; // Already preloaded
  }

  const streamUrl = resolveStreamUrl(next, 0);
  if (!streamUrl) return;

  state.preloadedTrackId = nextId;
  state.preloadedStreamUrl = streamUrl;
  state.standbyAudio.src = streamUrl;
  state.standbyAudio.preload = 'auto';
  state.standbyAudio.volume = state.activeAudio.volume;
  state.standbyAudio.playbackRate = state.currentPlaybackSpeed;
  state.standbyAudio.load();
}

export function playTrack(trackOverride = null) {
  if (trackOverride) {
    setCurrentTrack(trackOverride);
  }

  const track = getCurrentTrack();
  if (!track) return;

  // Reset seek offset when starting a new track from the beginning
  state.seekOffset = 0;
  state.pausedWhileHidden = false;

  let streamUrl = '';
  let startPositionSec = 0;

  if (track.isPodcastEpisode || track.enclosureUrl) {
    const epState = getEpisodeState(track.id);
    if (epState && epState.position > 5 && !epState.isPlayed) {
      startPositionSec = epState.position;
    }
  }

  streamUrl = resolveStreamUrl(track, 0);
  if (!streamUrl) return;

  const trackKey = track.Id || track.id;
  const isPreloaded = (
    startPositionSec === 0 &&
    state.preloadedTrackId === trackKey &&
    state.standbyAudio.src &&
    state.standbyAudio.src === state.preloadedStreamUrl
  );

  if (isPreloaded) {
    swapAudioElements();
    state.preloadedTrackId = null;
    state.preloadedStreamUrl = null;
    state.activeAudio.playbackRate = state.currentPlaybackSpeed;
  } else {
    if (state.activeAudio.src === streamUrl) {
      state.activeAudio.currentTime = startPositionSec > 0 ? startPositionSec : 0;
    } else {
      state.activeAudio.src = streamUrl;
      if (startPositionSec > 0) {
        state.activeAudio.currentTime = startPositionSec;
      }
    }
    state.activeAudio.playbackRate = state.currentPlaybackSpeed;
  }

  const playPromise = state.activeAudio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      state.isPlaying = true;
      if (track.Id) reportPlaybackStart(track.Id, Math.floor(startPositionSec * 10000000));
      setupMediaSessionMetadata(track);
      savePlayerState();
      preloadNextTrack();
      notifyUI();
    }).catch((err) => {
      console.warn('[Audio Engine] Autoplay interrupted:', err);
      // When the phone screen is off the browser may block this play(); keep the
      // new track's index in state and retry as soon as the app is foregrounded.
      savePlayerState();
      armAutoAdvanceRetry(notifyUI);
    });
  }

  setupMediaSessionMetadata(track);
  preloadNextTrack();
  notifyUI();
}

export function setPlaybackSpeed(speed) {
  const num = parseFloat(speed);
  if (isNaN(num) || num <= 0) return state.currentPlaybackSpeed;
  state.currentPlaybackSpeed = num;
  state.activeAudio.playbackRate = state.currentPlaybackSpeed;
  state.standbyAudio.playbackRate = state.currentPlaybackSpeed;
  savePlaybackSpeed(state.currentPlaybackSpeed);
  notifyUI();
  return state.currentPlaybackSpeed;
}

export function getPlaybackSpeed() {
  return state.currentPlaybackSpeed;
}

export function skipSeconds(secs) {
  const realCurrent = state.seekOffset + (isFinite(state.activeAudio.currentTime) ? state.activeAudio.currentTime : 0);
  seekTo(realCurrent + secs);
}

export function togglePlayPause() {
  if (!state.activeAudio.src || !getCurrentTrack()) {
    playNextTrack();
    return;
  }

  if (state.activeAudio.paused) {
    state.activeAudio.play().catch((err) => {
      console.warn('[Audio Engine] Play interrupted:', err);
    });
  } else {
    state.activeAudio.pause();
  }
}

export function playNextTrack(isAutoEnd = false) {
  const track = nextTrack(isAutoEnd);
  if (track) {
    playTrack(track);
  }
}

export function playPrevTrack() {
  const track = prevTrack();
  if (track) {
    playTrack(track);
  }
}

export async function seekTo(seconds) {
  if (!isFinite(seconds) || seconds < 0) return;

  const track = getCurrentTrack();
  if (!track) return;

  const currentAudio = state.activeAudio;

  // Downloaded tracks are stored as a full local blob, so seeking is always native.
  const trackKey = track.Id || track.id;
  if (trackKey && await isTrackDownloaded(trackKey)) {
    currentAudio.currentTime = Math.max(0, seconds);
    reportPlaybackProgress(track.Id, Math.floor(seconds * 10000000), currentAudio.paused);
    notifyUI();
    return;
  }

  let totalDuration = 0;
  if (track.RunTimeTicks) {
    totalDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(currentAudio.duration) && currentAudio.duration > 0) {
    totalDuration = currentAudio.duration + state.seekOffset;
  }

  if (totalDuration > 0 && seconds > totalDuration) {
    seconds = Math.max(0, totalDuration - 0.5);
  }

  // Check if native seeking within currently playing stream is possible
  const relativeTarget = seconds - state.seekOffset;
  if (
    relativeTarget >= 0 &&
    currentAudio.seekable.length > 0 &&
    relativeTarget <= currentAudio.seekable.end(0)
  ) {
    currentAudio.currentTime = relativeTarget;
    reportPlaybackProgress(track.Id, Math.floor(seconds * 10000000), currentAudio.paused);
    notifyUI();
    return;
  }

  // Server-side seeking: request a new stream from the desired position
  const wasPaused = currentAudio.paused;
  const startTicks = Math.floor(seconds * 10000000);
  state.seekOffset = seconds;
  currentAudio.src = buildSeekStreamUrl(track, startTicks);
  if (!wasPaused) {
    currentAudio.play().catch((err) => {
      console.warn('[Audio Engine] Seek autoplay interrupted:', err);
    });
  }
  reportPlaybackProgress(track.Id, startTicks, wasPaused);
  notifyUI();
  savePlayerState();
}

export function setVolume(value) {
  const clamped = Math.max(0, Math.min(1, value));
  state.activeAudio.volume = clamped;
  state.standbyAudio.volume = clamped;
  if (clamped > 0) {
    state.previousVolume = clamped;
  }
  savePlayerState();
  notifyUI();
}

export function toggleMute() {
  if (state.activeAudio.volume > 0) {
    state.previousVolume = state.activeAudio.volume;
    setVolume(0);
  } else {
    setVolume(state.previousVolume > 0 ? state.previousVolume : 0.8);
  }
}

function attachAudioListeners(audioEl) {
  audioEl.addEventListener('play', () => {
    if (audioEl !== state.activeAudio) return;
    state.isPlaying = true;
    state.pausedWhileHidden = false;
    startProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audioEl.addEventListener('pause', () => {
    if (audioEl !== state.activeAudio) return;
    state.isPlaying = false;
    // A pause that happens while the app is hidden was not caused by the user
    // (the screen is off), so it can be safely auto-resumed on next unlock.
    if (document.visibilityState === 'hidden' && !audioEl.ended) {
      state.pausedWhileHidden = true;
    }
    stopProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audioEl.addEventListener('ended', () => {
    if (audioEl !== state.activeAudio) return;
    const track = getCurrentTrack();
    if (track) {
      const realPosition = state.seekOffset + audioEl.currentTime;
      reportPlaybackStopped(track.Id, Math.floor(realPosition * 10000000));
    }
    savePlayerState();
    playNextTrack(true);
  });

  audioEl.addEventListener('timeupdate', () => {
    if (audioEl !== state.activeAudio) return;
    const track = getCurrentTrack();
    if (track && track.isPodcastEpisode) {
      saveEpisodeProgress(track.id, audioEl.currentTime, audioEl.duration || track.duration || 0);
    }
    // Check if next track should be preloaded as track progresses
    if (audioEl.duration && (audioEl.duration - audioEl.currentTime <= 30)) {
      preloadNextTrack();
    }
    notifyUI();
    savePlayerStateThrottled();
  });

  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl !== state.activeAudio) return;
    notifyUI();
  });

  audioEl.addEventListener('durationchange', () => {
    if (audioEl !== state.activeAudio) return;
    notifyUI();
  });

  audioEl.addEventListener('error', (e) => {
    if (audioEl !== state.activeAudio) return;
    console.error('[Audio Engine] Playback error:', e);
    state.isPlaying = false;
    notifyUI();

    // Fall back to a CORS proxy blob for podcast hosts that don't answer with
    // Access-Control-Allow-Origin (which the crossOrigin fetch now requires).
    const track = getCurrentTrack();
    if (track && (track.isPodcastEpisode || track.enclosureUrl) && track.id !== state.podcastProxyTrackKey) {
      state.podcastProxyTrackKey = track.id;
      resolvePodcastProxyBlobUrl(cleanAudioUrl(track.enclosureUrl)).then((blobUrl) => {
        if (!blobUrl) return;
        if (state.podcastProxyBlobUrl) URL.revokeObjectURL(state.podcastProxyBlobUrl);
        state.podcastProxyBlobUrl = blobUrl;
        audioEl.src = blobUrl;
        audioEl.play().catch((err) => {
          console.warn('[Audio Engine] Podcast proxy play interrupted:', err);
        });
      });
    }
  });
}

export function initAudioPlayer(onStateChange) {
  state.onStateChangeCallback = onStateChange;
  state.currentPlaybackSpeed = getSavedPlaybackSpeed();
  audioA.playbackRate = state.currentPlaybackSpeed;
  audioB.playbackRate = state.currentPlaybackSpeed;
  audioA.volume = state.previousVolume;
  audioB.volume = state.previousVolume;

  warmOfflineCache().catch(() => {});

  attachAudioListeners(audioA);
  attachAudioListeners(audioB);

  window.addEventListener('beforeunload', () => {
    savePlayerState();
  });

  setupMediaSessionHandlers({
    togglePlayPause,
    playNextTrack,
    playPrevTrack,
    seekTo,
    notifyUI
  });

  initBackgroundKeepalive(notifyUI);

  restorePlayerState().then((saved) => {
    if (saved) {
      const track = getCurrentTrack();
      if (track) setupMediaSessionMetadata(track);
      notifyUI();
    }
  });
}

export function notifyUI() {
  const track = getCurrentTrack();
  const currentAudio = state.activeAudio;
  let effectiveDuration = 0;
  if (track && track.RunTimeTicks) {
    // Always prefer track metadata for total duration since audio.duration
    // only reflects the remaining stream length after a server-side seek
    effectiveDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(currentAudio.duration) && currentAudio.duration > 0) {
    effectiveDuration = currentAudio.duration + state.seekOffset;
  }

  const realCurrentTime = state.seekOffset + (isFinite(currentAudio.currentTime) ? currentAudio.currentTime : 0);

  updateMediaSessionPositionState();
  if (state.isPlaying) {
    preloadNextTrack();
  }

  if (state.onStateChangeCallback) {
    state.onStateChangeCallback({
      track,
      isPlaying: state.isPlaying,
      currentTime: realCurrentTime,
      duration: isFinite(effectiveDuration) ? effectiveDuration : 0,
      volume: currentAudio.volume,
      playbackSpeed: state.currentPlaybackSpeed,
      bitrateMode: state.currentBitrateMode,
      queueState: getQueueState()
    });
  }
}

// Kept as the public facade exports (backwards compatible with views/UI).
export { resolveCurrentBitrate, resolveStreamUrl } from './stream.js';
export { savePlayerState, restorePlayerState };