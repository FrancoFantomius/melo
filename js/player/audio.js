import { getSession } from '../jellyfin/session.js';
import { getAudioStreamUrl, getArtworkUrl, reportPlaybackStart, reportPlaybackProgress, reportPlaybackStopped } from '../jellyfin/client.js';
import { getCurrentTrack, nextTrack, prevTrack, toggleShuffle, toggleRepeat, getQueueState, restoreQueueState, setCurrentTrack, setCurrentIndex } from './queue.js';
import { getEpisodeState, saveEpisodeProgress, getSavedPlaybackSpeed, savePlaybackSpeed } from '../podcasts/storage.js';
import { cleanAudioUrl } from '../podcasts/rss.js';

let audio = new Audio();
let isPlaying = false;
let updateProgressTimer = null;
let currentBitrateMode = 'Direct';
let lastSaveTimestamp = 0;
let previousVolume = 0.8;
let currentPlaybackSpeed = 1.0;

// Server-side seek offset: when we request a stream starting at e.g. 160s,
// audio.currentTime starts at 0 but the real position is seekOffset + audio.currentTime
let seekOffset = 0;

// Callbacks for UI updates
let onStateChangeCallback = null;

export function initAudioPlayer(onStateChange) {
  onStateChangeCallback = onStateChange;
  currentPlaybackSpeed = getSavedPlaybackSpeed();
  audio.playbackRate = currentPlaybackSpeed;

  audio.addEventListener('play', () => {
    isPlaying = true;
    startProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    stopProgressReporting();
    updateMediaSessionState();
    notifyUI();
    savePlayerState();
  });

  audio.addEventListener('ended', () => {
    const track = getCurrentTrack();
    if (track) {
      const realPosition = seekOffset + audio.currentTime;
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
    isPlaying = false;
    notifyUI();
  });

  window.addEventListener('beforeunload', () => {
    savePlayerState();
  });

  setupMediaSessionHandlers();
  restorePlayerState();
}

export function resolveCurrentBitrate() {
  const session = getSession();
  let isMobile = false;

  if (navigator.connection) {
    const type = navigator.connection.type || navigator.connection.effectiveType || '';
    if (type.includes('cellular') || type.includes('2g') || type.includes('3g') || type.includes('4g')) {
      isMobile = true;
    }
  }

  const selected = isMobile ? session.qualityMobile : session.qualityWifi;
  currentBitrateMode = session.forceTranscode && selected === 'Direct' ? '320000' : selected;
  return currentBitrateMode;
}

export function playTrack(trackOverride = null) {
  if (trackOverride) {
    setCurrentTrack(trackOverride);
  }

  const track = getCurrentTrack();
  if (!track) return;

  // Reset seek offset when starting a new track from the beginning
  seekOffset = 0;

  let streamUrl = '';
  let startPositionSec = 0;

  if (track.isPodcastEpisode || track.enclosureUrl) {
    streamUrl = cleanAudioUrl(track.enclosureUrl);
    const epState = getEpisodeState(track.id);
    if (epState && epState.position > 5 && !epState.isPlayed) {
      startPositionSec = epState.position;
    }
  } else {
    const bitrate = resolveCurrentBitrate();
    const session = getSession();
    streamUrl = getAudioStreamUrl(track.Id, {
      maxStreamingBitrate: bitrate,
      forceTranscode: session.forceTranscode
    });
  }

  if (audio.src === streamUrl) {
    if (startPositionSec > 0) {
      audio.currentTime = startPositionSec;
    } else {
      audio.currentTime = 0;
    }
  } else {
    audio.src = streamUrl;
    if (startPositionSec > 0) {
      audio.currentTime = startPositionSec;
    }
  }

  audio.playbackRate = currentPlaybackSpeed;

  audio.play().then(() => {
    if (track.Id) reportPlaybackStart(track.Id, Math.floor(startPositionSec * 10000000));
    setupMediaSessionMetadata(track);
    savePlayerState();
    notifyUI();
  }).catch((err) => {
    console.warn('[Audio Engine] Autoplay interrupted:', err);
  });
}

export function setPlaybackSpeed(speed) {
  const num = parseFloat(speed);
  if (isNaN(num) || num <= 0) return currentPlaybackSpeed;
  currentPlaybackSpeed = num;
  audio.playbackRate = currentPlaybackSpeed;
  savePlaybackSpeed(currentPlaybackSpeed);
  notifyUI();
  return currentPlaybackSpeed;
}

export function getPlaybackSpeed() {
  return currentPlaybackSpeed;
}

export function skipSeconds(secs) {
  const realCurrent = seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
  seekTo(realCurrent + secs);
}

export function togglePlayPause() {
  if (!audio.src || !getCurrentTrack()) {
    playNextTrack();
    return;
  }

  if (audio.paused) {
    audio.play();
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

export function seekTo(seconds) {
  if (!isFinite(seconds) || seconds < 0) return;

  const track = getCurrentTrack();
  if (!track) return;

  let totalDuration = 0;
  if (track.RunTimeTicks) {
    totalDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(audio.duration) && audio.duration > 0) {
    totalDuration = audio.duration + seekOffset;
  }

  if (totalDuration > 0 && seconds > totalDuration) {
    seconds = Math.max(0, totalDuration - 0.5);
  }

  // Check if native seeking within currently playing stream is possible
  const relativeTarget = seconds - seekOffset;
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
  seekOffset = seconds;
  const bitrate = resolveCurrentBitrate();
  const session = getSession();

  const streamUrl = getAudioStreamUrl(track.Id, {
    maxStreamingBitrate: bitrate,
    forceTranscode: session.forceTranscode,
    startTimeTicks: startTicks
  });

  audio.src = streamUrl;
  if (!wasPaused) {
    audio.play().catch((err) => {
      console.warn('[Audio Engine] Seek autoplay interrupted:', err);
    });
  }
  reportPlaybackProgress(track.Id, startTicks, wasPaused);
  notifyUI();
  savePlayerState();
}

function savePlayerStateThrottled() {
  const now = Date.now();
  if (now - lastSaveTimestamp > 2000) {
    lastSaveTimestamp = now;
    savePlayerState();
  }
}

export function savePlayerState() {
  const track = getCurrentTrack();
  if (!track) return;

  const realPosition = seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
  const queueState = getQueueState();

  const state = {
    queue: queueState.queue,
    originalQueue: queueState.originalQueue,
    currentIndex: queueState.currentIndex,
    shuffle: queueState.shuffle,
    repeat: queueState.repeat,
    position: isFinite(realPosition) ? realPosition : 0,
    volume: audio.volume
  };

  try {
    localStorage.setItem('melo_player_state', JSON.stringify(state));
  } catch (e) {
    console.warn('[Audio Engine] Failed to save player state:', e);
  }
}

export function restorePlayerState() {
  try {
    const raw = localStorage.getItem('melo_player_state');
    if (!raw) return null;
    const state = JSON.parse(raw);

    if (state.queue && Array.isArray(state.queue) && state.queue.length > 0 && typeof state.currentIndex === 'number' && state.currentIndex >= 0) {
      restoreQueueState(state);

      if (typeof state.volume === 'number' && isFinite(state.volume)) {
        audio.volume = Math.max(0, Math.min(1, state.volume));
        if (audio.volume > 0) {
          previousVolume = audio.volume;
        }
      }

      const track = getCurrentTrack();
      if (track) {
        const savedPos = state.position || 0;
        seekOffset = savedPos;
        const bitrate = resolveCurrentBitrate();
        const session = getSession();
        const startTicks = Math.floor(savedPos * 10000000);

        const streamUrl = getAudioStreamUrl(track.Id, {
          maxStreamingBitrate: bitrate,
          forceTranscode: session.forceTranscode,
          startTimeTicks: startTicks
        });

        audio.src = streamUrl;
        setupMediaSessionMetadata(track);
        notifyUI();
        return state;
      }
    }
  } catch (err) {
    console.warn('[Audio Engine] Failed to restore player state:', err);
  }
  return null;
}

export function setVolume(value) {
  const clamped = Math.max(0, Math.min(1, value));
  audio.volume = clamped;
  if (clamped > 0) {
    previousVolume = clamped;
  }
  savePlayerState();
  notifyUI();
}

export function toggleMute() {
  if (audio.volume > 0) {
    previousVolume = audio.volume;
    setVolume(0);
  } else {
    setVolume(previousVolume > 0 ? previousVolume : 0.8);
  }
}

function startProgressReporting() {
  stopProgressReporting();
  updateProgressTimer = setInterval(() => {
    const track = getCurrentTrack();
    if (track && !audio.paused && isFinite(audio.currentTime)) {
      const realPosition = seekOffset + audio.currentTime;
      reportPlaybackProgress(track.Id, Math.floor(realPosition * 10000000), false);
    }
  }, 10000);
}

function stopProgressReporting() {
  if (updateProgressTimer) {
    clearInterval(updateProgressTimer);
    updateProgressTimer = null;
  }
}

// MediaSession API Integration
function setupMediaSessionMetadata(track) {
  if ('mediaSession' in navigator) {
    const artworkUrl = getArtworkUrl(track, 'Primary', 512);
    const artistName = track.Artists && track.Artists.length > 0 ? track.Artists.join(', ') : (track.AlbumArtist || 'Unknown Artist');

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.Name || 'Unknown Title',
      artist: artistName,
      album: track.Album || 'Melo',
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
      ]
    });
    updateMediaSessionPositionState();
  }
}

function updateMediaSessionState() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    updateMediaSessionPositionState();
  }
}

function updateMediaSessionPositionState() {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    const track = getCurrentTrack();
    let effectiveDuration = 0;
    if (track && track.RunTimeTicks) {
      effectiveDuration = track.RunTimeTicks / 10000000;
    } else if (isFinite(audio.duration) && audio.duration > 0) {
      effectiveDuration = audio.duration + seekOffset;
    }

    const realCurrentTime = seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);

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

function setupMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;

  const handlers = {
    play: () => togglePlayPause(),
    pause: () => togglePlayPause(),
    previoustrack: () => playPrevTrack(),
    nexttrack: () => playNextTrack(),
    seekbackward: (details) => {
      const skipTime = (details && details.seekOffset) || 10;
      const realPosition = seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
      seekTo(Math.max(0, realPosition - skipTime));
    },
    seekforward: (details) => {
      const skipTime = (details && details.seekOffset) || 10;
      const realPosition = seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
      seekTo(realPosition + skipTime);
    },
    seekto: (details) => {
      if (details && details.seekTime !== undefined && details.seekTime !== null) {
        seekTo(details.seekTime);
      }
    },
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      isPlaying = false;
      notifyUI();
    }
  };

  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      console.warn(`[Audio Engine] MediaSession action '${action}' not supported:`, err);
    }
  }
}

export function notifyUI() {
  const track = getCurrentTrack();
  let effectiveDuration = 0;
  if (track && track.RunTimeTicks) {
    // Always prefer track metadata for total duration since audio.duration
    // only reflects the remaining stream length after a server-side seek
    effectiveDuration = track.RunTimeTicks / 10000000;
  } else if (isFinite(audio.duration) && audio.duration > 0) {
    effectiveDuration = audio.duration + seekOffset;
  }

  const realCurrentTime = seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);

  updateMediaSessionPositionState();

  if (onStateChangeCallback) {
    onStateChangeCallback({
      track,
      isPlaying,
      currentTime: realCurrentTime,
      duration: isFinite(effectiveDuration) ? effectiveDuration : 0,
      volume: audio.volume,
      playbackSpeed: currentPlaybackSpeed,
      bitrateMode: currentBitrateMode,
      queueState: getQueueState()
    });
  }
}
