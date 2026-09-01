import { getCurrentTrack } from './queue.js';
import { reportPlaybackStart } from '../jellyfin/client.js';
import { setupMediaSessionMetadata } from './media-session.js';
import { savePlayerState } from './persistence.js';
import { audio, state } from './state.js';
import { resumeOnVisible } from './hls-engine.js';

// Minimal 44-byte silent WAV data URI to keep the mobile OS audio session open
// during network buffering and track transitions without audible sound.
// Volume is set to 0.0001 (inaudible compromise): setting volume to 0 (muted) often triggers
// browser background power-management suspensions, while > 0 keeps the OS audio pipeline open.
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
let keepaliveAudio = null;

function getKeepaliveAudio() {
  if (!keepaliveAudio) {
    keepaliveAudio = new Audio(SILENT_WAV);
    keepaliveAudio.loop = true;
    keepaliveAudio.volume = 0.0001;
    // Prevent keepalive audio from requesting media controls / remote routes
    if ('disableRemotePlayback' in keepaliveAudio) {
      keepaliveAudio.disableRemotePlayback = true;
    }
  }
  return keepaliveAudio;
}

export function startKeepaliveAnchor() {
  try {
    const el = getKeepaliveAudio();
    if (el && el.paused) {
      el.play().catch(() => {});
    }
  } catch (e) {
    // Ignored in restricted environments
  }
}

export function stopKeepaliveAnchor() {
  try {
    // Do not stop keepalive if the screen/app is currently hidden to prevent OS suspension
    if (document.visibilityState === 'hidden') return;
    if (keepaliveAudio && !keepaliveAudio.paused) {
      keepaliveAudio.pause();
    }
  } catch (e) {
    // Ignored
  }
}

/* If the browser rejected play() while the screen was off or backgrounded,
   retry as soon as the app returns to the foreground. */
export function armAutoAdvanceRetry(notifyUI) {
  if (state.pendingAutoRetry) return;
  state.pendingAutoRetry = true;

  const retryPlay = () => {
    state.pendingAutoRetry = false;
    const track = getCurrentTrack();
    if (!track || !audio.paused) return;

    audio.play().then(() => {
      state.isPlaying = true;
      startKeepaliveAnchor();
      if (track.Id && !track.isPodcastEpisode && !track.enclosureUrl) reportPlaybackStart(track.Id, Math.floor((state.seekOffset + Math.max(0, audio.currentTime)) * 10000000));
      setupMediaSessionMetadata(track);
      savePlayerState();
      if (notifyUI) notifyUI();
    }).catch((err) => {
      console.warn('[Audio Engine] Autoplay retry interrupted:', err);
    });
  };

  if (document.visibilityState === 'visible') {
    setTimeout(retryPlay, 500);
  } else {
    document.addEventListener('visibilitychange', function onVisible() {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible);
        retryPlay();
      }
    });
  }
}

/* On unlock or tab refocus, resume playback and HLS loading if needed. */
export function initBackgroundKeepalive(notifyUI) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;

    // Resume HLS segment loading if it stalled while the tab was hidden
    resumeOnVisible();

    if (state.pausedWhileHidden) {
      state.pausedWhileHidden = false;
      if (getCurrentTrack()) {
        audio.play().then(() => {
          state.isPlaying = true;
          startKeepaliveAnchor();
          if (notifyUI) notifyUI();
        }).catch((err) => {
          console.warn('[Audio Engine] Resume playback interrupted:', err);
        });
      }
    }
  });
}