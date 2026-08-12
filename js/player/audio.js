import {
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped
} from '../jellyfin/client.js';
import { getCurrentTrack, nextTrack, prevTrack, getQueueState, setCurrentTrack } from './queue.js';
import { getEpisodeState, saveEpisodeProgress, getSavedPlaybackSpeed, savePlaybackSpeed } from '../podcasts/storage.js';
import { cleanAudioUrl } from '../podcasts/rss.js';
import { isTrackDownloaded } from '../jellyfin/offline.js';
import { audio, state } from './state.js';
import { resolveStreamUrl, buildSeekStreamUrl, resolvePodcastProxyBlobUrl } from './stream.js';
import { savePlayerState, savePlayerStateThrottled, restorePlayerState } from './persistence.js';
import { setupMediaSessionMetadata, updateMediaSessionState, updateMediaSessionPositionState, setupMediaSessionHandlers } from './media-session.js';
import { startProgressReporting, stopProgressReporting } from './progress.js';
import { ensureBackgroundContext, armAutoAdvanceRetry, initBackgroundKeepalive } from './background.js';

export async function playTrack(trackOverride = null) {
  if (trackOverride) {
    setCurrentTrack(trackOverride);
  }

  const track = getCurrentTrack();
  if (!track) return;

  // Reset seek offset when starting a new track from the beginning
  state.seekOffset = 0;

  let streamUrl = '';
  let startPositionSec = 0;

  if (track.isPodcastEpisode || track.enclosureUrl) {
    const epState = getEpisodeState(track.id);
    if (epState && epState.position > 5 && !epState.isPlayed) {
      startPositionSec = epState.position;
    }
  }

  streamUrl = await resolveStreamUrl(track, 0);
  if (!streamUrl) return;

  if (audio.src === streamUrl) {
    audio.currentTime = startPositionSec > 0 ? startPositionSec : 0;
  } else {
    audio.src = streamUrl;
    if (startPositionSec > 0) {
      audio.currentTime = startPositionSec;
    }
  }

  audio.playbackRate = state.currentPlaybackSpeed;

  audio.play().then(() => {
    if (track.Id) reportPlaybackStart(track.Id, Math.floor(startPositionSec * 10000000));
    setupMediaSessionMetadata(track);
    savePlayerState();
    notifyUI();
  }).catch((err) => {
    console.warn('[Audio Engine] Autoplay interrupted:', err);
    // When the phone screen is off the browser may block this play(); keep the
    // new track's index in state and retry as soon as the app is foregrounded.
    savePlayerState();
    armAutoAdvanceRetry(notifyUI);
  });
}

export function setPlaybackSpeed(speed) {
  const num = parseFloat(speed);
  if (isNaN(num) || num <= 0) return state.currentPlaybackSpeed;
  state.currentPlaybackSpeed = num;
  audio.playbackRate = state.currentPlaybackSpeed;
  savePlaybackSpeed(state.currentPlaybackSpeed);
  notifyUI();
  return state.currentPlaybackSpeed;
}

export function getPlaybackSpeed() {
  return state.currentPlaybackSpeed;
}

export function skipSeconds(secs) {
  const realCurrent = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
  seekTo(realCurrent + secs);
}

export function togglePlayPause() {
  if (!audio.src || !getCurrentTrack()) {
    playNextTrack();
    return;
  }

  if (audio.paused) {
    audio.play().catch((err) => {
      console.warn('[Audio Engine] Play interrupted:', err);
    });
  } else {
    audio.pause();
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

  // Downloaded tracks are stored as a full local blob, so seeking is always native.
  const trackKey = track.Id || track.id;
  if (trackKey && await isTrackDownloaded(trackKey)) {
    audio.currentTime = Math.max(0, seconds);
    reportPlaybackProgress(track.Id, Math.floor(seconds * 10000000), audio.paused);
    notifyUI();
    return;
  }

  let totalDuration = 0;
  if (track.RunTimeTicks) {
    totalDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(audio.duration) && audio.duration > 0) {
    totalDuration = audio.duration + state.seekOffset;
  }

  if (totalDuration > 0 && seconds > totalDuration) {
    seconds = Math.max(0, totalDuration - 0.5);
  }

  // Check if native seeking within currently playing stream is possible
  const relativeTarget = seconds - state.seekOffset;
  if (
    relativeTarget >= 0 &&
    audio.seekable.length > 0 &&
    relativeTarget <= audio.seekable.end(0)
  ) {
    audio.currentTime = relativeTarget;
    reportPlaybackProgress(track.Id, Math.floor(seconds * 10000000), audio.paused);
    notifyUI();
    return;
  }

  // Server-side seeking: request a new stream from the desired position
  const wasPaused = audio.paused;
  const startTicks = Math.floor(seconds * 10000000);
  state.seekOffset = seconds;
  audio.src = buildSeekStreamUrl(track, startTicks);
  if (!wasPaused) {
    audio.play().catch((err) => {
      console.warn('[Audio Engine] Seek autoplay interrupted:', err);
    });
  }
  reportPlaybackProgress(track.Id, startTicks, wasPaused);
  notifyUI();
  savePlayerState();
}

export function setVolume(value) {
  const clamped = Math.max(0, Math.min(1, value));
  audio.volume = clamped;
  if (clamped > 0) {
    state.previousVolume = clamped;
  }
  savePlayerState();
  notifyUI();
}

export function toggleMute() {
  if (audio.volume > 0) {
    state.previousVolume = audio.volume;
    setVolume(0);
  } else {
    setVolume(state.previousVolume > 0 ? state.previousVolume : 0.8);
  }
}

export function initAudioPlayer(onStateChange) {
  state.onStateChangeCallback = onStateChange;
  state.currentPlaybackSpeed = getSavedPlaybackSpeed();
  audio.playbackRate = state.currentPlaybackSpeed;

  audio.addEventListener('play', () => {
    state.isPlaying = true;
    // Must be created/resumed inside a user-gesture-driven play() so the
    // context is not suspended (a suspended context would mute the element).
    ensureBackgroundContext();
    startProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    // A pause that happens while the app is hidden was not caused by the user
    // (the screen is off), so it can be safely auto-resumed on next unlock.
    if (document.visibilityState === 'hidden') state.pausedWhileHidden = true;
    stopProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audio.addEventListener('ended', () => {
    const track = getCurrentTrack();
    if (track) {
      const realPosition = state.seekOffset + audio.currentTime;
      reportPlaybackStopped(track.Id, Math.floor(realPosition * 10000000));
    }
    savePlayerState();
    playNextTrack(true);
  });

  audio.addEventListener('timeupdate', () => {
    const track = getCurrentTrack();
    if (track && track.isPodcastEpisode) {
      saveEpisodeProgress(track.id, audio.currentTime, audio.duration || track.duration || 0);
    }
    notifyUI();
    savePlayerStateThrottled();
  });

  audio.addEventListener('loadedmetadata', () => {
    notifyUI();
  });

  audio.addEventListener('durationchange', () => {
    notifyUI();
  });

  audio.addEventListener('error', (e) => {
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
        audio.src = blobUrl;
        audio.play().catch((err) => {
          console.warn('[Audio Engine] Podcast proxy play interrupted:', err);
        });
      });
    }
  });

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

  initBackgroundKeepalive();

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
  let effectiveDuration = 0;
  if (track && track.RunTimeTicks) {
    // Always prefer track metadata for total duration since audio.duration
    // only reflects the remaining stream length after a server-side seek
    effectiveDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(audio.duration) && audio.duration > 0) {
    effectiveDuration = audio.duration + state.seekOffset;
  }

  const realCurrentTime = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);

  updateMediaSessionPositionState();

  if (state.onStateChangeCallback) {
    state.onStateChangeCallback({
      track,
      isPlaying: state.isPlaying,
      currentTime: realCurrentTime,
      duration: isFinite(effectiveDuration) ? effectiveDuration : 0,
      volume: audio.volume,
      playbackSpeed: state.currentPlaybackSpeed,
      bitrateMode: state.currentBitrateMode,
      queueState: getQueueState()
    });
  }
}

// Kept as the public facade exports (backwards compatible with views/UI).
export { resolveCurrentBitrate, resolveStreamUrl } from './stream.js';
export { savePlayerState, restorePlayerState };