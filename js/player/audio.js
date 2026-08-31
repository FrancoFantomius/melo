import {
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped
} from '../jellyfin/client.js';
import { getCurrentTrack, nextTrack, prevTrack, peekNextTrack, getQueueState, setCurrentTrack } from './queue.js';
import { getEpisodeState, saveEpisodeProgress, getSavedPlaybackSpeed, savePlaybackSpeed } from '../podcasts/storage.js';
import { cleanAudioUrl } from '../podcasts/rss.js';
import { isTrackDownloaded, warmOfflineCache } from '../jellyfin/offline.js';
import { audio, state } from './state.js';
import {
  resolveStreamUrl,
  resolveHlsStreamUrl,
  isHlsEligible,
  buildSeekStreamUrl,
  resolvePodcastProxyBlobUrl
} from './stream.js';
import { savePlayerState, savePlayerStateThrottled, restorePlayerState } from './persistence.js';
import { setupMediaSessionMetadata, updateMediaSessionState, updateMediaSessionPositionState, setupMediaSessionHandlers } from './media-session.js';
import { startProgressReporting, stopProgressReporting } from './progress.js';
import {
  armAutoAdvanceRetry,
  initBackgroundKeepalive,
  startKeepaliveAnchor,
  stopKeepaliveAnchor
} from './background.js';
import {
  loadHlsStream,
  destroyHls,
  isHlsSupported,
  isNativeHlsSupported
} from './hls-engine.js';

let preloadedUrlKey = null;

export function preloadNextTrack() {
  const next = peekNextTrack(true);
  if (!next) {
    preloadedUrlKey = null;
    return;
  }

  const nextId = next.Id || next.id;
  if (preloadedUrlKey === nextId) return;
  preloadedUrlKey = nextId;

  // Warm up connection/transcoding cache for the upcoming track
  try {
    if (isHlsEligible(next) && (isHlsSupported() || isNativeHlsSupported(audio))) {
      const hlsUrl = resolveHlsStreamUrl(next, 0);
      if (hlsUrl) {
        fetch(hlsUrl, { method: 'GET', mode: 'cors' }).catch(() => {});
      }
    } else {
      const streamUrl = resolveStreamUrl(next, 0);
      if (streamUrl && !streamUrl.startsWith('blob:')) {
        fetch(streamUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-32768' },
          mode: 'cors'
        }).catch(() => {});
      }
    }
  } catch (e) {
    // Non-critical prewarm failure
  }
}

function playDirectStream(track, startPositionSec = 0) {
  const streamUrl = resolveStreamUrl(track, 0);
  if (!streamUrl) return;

  destroyHls();
  state.isHls = false;
  state.streamType = streamUrl.startsWith('blob:') ? 'blob' : 'direct';

  if (audio.src === streamUrl) {
    audio.currentTime = startPositionSec > 0 ? startPositionSec : 0;
  } else {
    audio.src = streamUrl;
    if (startPositionSec > 0) {
      audio.currentTime = startPositionSec;
    }
  }

  audio.playbackRate = state.currentPlaybackSpeed;
  executeAudioPlay(track, startPositionSec);
}

function executeAudioPlay(track, startPositionSec = 0) {
  startKeepaliveAnchor();

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      state.isPlaying = true;
      if (track && track.Id) {
        reportPlaybackStart(track.Id, Math.floor(startPositionSec * 10000000));
      }
      setupMediaSessionMetadata(track);
      savePlayerState();
      preloadNextTrack();
      notifyUI();
    }).catch((err) => {
      console.warn('[Audio Engine] Autoplay interrupted:', err);
      savePlayerState();
      armAutoAdvanceRetry(notifyUI);
    });
  }

  setupMediaSessionMetadata(track);
  preloadNextTrack();
  notifyUI();
}

export function playTrack(trackOverride = null) {
  if (trackOverride) {
    setCurrentTrack(trackOverride);
  }

  const track = getCurrentTrack();
  if (!track) return;

  state.seekOffset = 0;
  state.pausedWhileHidden = false;

  let startPositionSec = 0;
  if (track.isPodcastEpisode || track.enclosureUrl) {
    const epState = getEpisodeState(track.id);
    if (epState && epState.position > 5 && !epState.isPlayed) {
      startPositionSec = epState.position;
    }
  }

  const eligibleForHls = isHlsEligible(track) && (isHlsSupported() || isNativeHlsSupported(audio));

  if (eligibleForHls) {
    state.isHls = true;
    state.streamType = 'hls';
    const hlsUrl = resolveHlsStreamUrl(track, 0);

    loadHlsStream(audio, hlsUrl, startPositionSec, {
      onParsed: () => {
        executeAudioPlay(track, startPositionSec);
      },
      onFallback: () => {
        console.warn('[Audio Engine] HLS playback failed, falling back to direct stream...');
        playDirectStream(track, startPositionSec);
      }
    });
  } else {
    playDirectStream(track, startPositionSec);
  }
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
  if (!audio.src && !state.isHls && !getCurrentTrack()) {
    playNextTrack();
    return;
  }

  if (audio.paused) {
    startKeepaliveAnchor();
    audio.play().catch((err) => {
      console.warn('[Audio Engine] Play interrupted:', err);
    });
  } else {
    audio.pause();
    stopKeepaliveAnchor();
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

  // Downloaded tracks are stored as a full local blob: native seeking
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

  // If playing via HLS, Hls.js allows seeking across the timeline directly
  if (state.isHls) {
    audio.currentTime = seconds;
    if (track.Id) reportPlaybackProgress(track.Id, Math.floor(seconds * 10000000), audio.paused);
    notifyUI();
    savePlayerState();
    return;
  }

  // Check if native seeking within currently playing direct stream is possible
  const relativeTarget = seconds - state.seekOffset;
  if (
    relativeTarget >= 0 &&
    audio.seekable.length > 0 &&
    relativeTarget <= audio.seekable.end(0)
  ) {
    audio.currentTime = relativeTarget;
    if (track.Id) reportPlaybackProgress(track.Id, Math.floor(seconds * 10000000), audio.paused);
    notifyUI();
    return;
  }

  // Server-side seeking for direct streams: request new stream from offset
  const wasPaused = audio.paused;
  const startTicks = Math.floor(seconds * 10000000);
  state.seekOffset = seconds;
  audio.src = buildSeekStreamUrl(track, startTicks);
  if (!wasPaused) {
    audio.play().catch((err) => {
      console.warn('[Audio Engine] Seek autoplay interrupted:', err);
    });
  }
  if (track.Id) reportPlaybackProgress(track.Id, startTicks, wasPaused);
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

function attachAudioListeners(audioEl) {
  audioEl.addEventListener('play', () => {
    state.isPlaying = true;
    state.pausedWhileHidden = false;
    startKeepaliveAnchor();
    startProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audioEl.addEventListener('pause', () => {
    state.isPlaying = false;
    if (document.visibilityState === 'hidden' && !audioEl.ended) {
      state.pausedWhileHidden = true;
    } else {
      stopKeepaliveAnchor();
    }
    stopProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audioEl.addEventListener('ended', () => {
    const track = getCurrentTrack();
    if (track && track.Id) {
      const realPosition = state.seekOffset + audioEl.currentTime;
      reportPlaybackStopped(track.Id, Math.floor(realPosition * 10000000));
    }
    savePlayerState();
    playNextTrack(true);
  });

  audioEl.addEventListener('timeupdate', () => {
    const track = getCurrentTrack();
    if (track && track.isPodcastEpisode) {
      saveEpisodeProgress(track.id, audioEl.currentTime, audioEl.duration || track.duration || 0);
    }
    if (audioEl.duration && (audioEl.duration - audioEl.currentTime <= 30)) {
      preloadNextTrack();
    }
    notifyUI();
    savePlayerStateThrottled();
  });

  audioEl.addEventListener('loadedmetadata', () => {
    notifyUI();
  });

  audioEl.addEventListener('durationchange', () => {
    notifyUI();
  });

  audioEl.addEventListener('error', (e) => {
    console.error('[Audio Engine] Playback error:', e);
    state.isPlaying = false;
    notifyUI();

    // Fall back to a CORS proxy blob for podcast hosts that don't answer with CORS
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
  audio.playbackRate = state.currentPlaybackSpeed;
  audio.volume = state.previousVolume;

  warmOfflineCache().catch(() => {});
  attachAudioListeners(audio);

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
  let effectiveDuration = 0;
  if (track && track.RunTimeTicks) {
    effectiveDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(audio.duration) && audio.duration > 0) {
    effectiveDuration = audio.duration + state.seekOffset;
  }

  const realCurrentTime = state.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);

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
      volume: audio.volume,
      playbackSpeed: state.currentPlaybackSpeed,
      bitrateMode: state.currentBitrateMode,
      queueState: getQueueState()
    });
  }
}

export { resolveCurrentBitrate, resolveStreamUrl, resolveHlsStreamUrl } from './stream.js';
export { savePlayerState, restorePlayerState };