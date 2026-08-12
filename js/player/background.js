import { getCurrentTrack } from './queue.js';
import { reportPlaybackStart } from '../jellyfin/client.js';
import { setupMediaSessionMetadata } from './media-session.js';
import { savePlayerState } from './persistence.js';
import { audio, state } from './state.js';

/* Background playback keepalive: attaching the <audio> element to a persistent
   AudioContext tells the browser/OS that the app is actively playing media. This
   stops the tab from being frozen/suspended when the phone screen locks and lets
   auto-advancing tracks call play() from the 'ended' handler without tripping
   autoplay restrictions. */
export function ensureBackgroundContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  if (!state.backgroundAudioContext) {
    try {
      state.backgroundAudioContext = new Ctx();
    } catch (err) {
      console.warn('[Audio Engine] Failed to create AudioContext:', err);
      return null;
    }
  }

  if (state.backgroundAudioContext.state === 'suspended') {
    state.backgroundAudioContext.resume().catch(() => {});
  }

  if (!state.mediaElementConnected) {
    try {
      const sourceNode = state.backgroundAudioContext.createMediaElementSource(audio);
      sourceNode.connect(state.backgroundAudioContext.destination);
      state.mediaElementConnected = true;
    } catch (err) {
      console.warn('[Audio Engine] Failed to attach audio element to AudioContext:', err);
    }
  }

  return state.backgroundAudioContext;
}

/* If the browser rejected the auto-advance play() (e.g. while the screen was
   off), retry once the app is back in the foreground. The next track is already
   loaded in audio.src, so retrying resumes from where auto-advance stopped. */
export function armAutoAdvanceRetry(notifyUI) {
  if (state.pendingAutoRetry) return;
  state.pendingAutoRetry = true;

  const retryPlay = () => {
    state.pendingAutoRetry = false;
    const track = getCurrentTrack();
    if (!track || !audio.paused || !audio.src) return;

    ensureBackgroundContext();
    audio.play().then(() => {
      if (track.Id) reportPlaybackStart(track.Id, Math.floor((state.seekOffset + Math.max(0, audio.currentTime)) * 10000000));
      setupMediaSessionMetadata(track);
      savePlayerState();
      notifyUI();
    }).catch((err) => {
      console.warn('[Audio Engine] Autoplay retry interrupted:', err);
    });
  };

  if (document.visibilityState === 'visible') {
    setTimeout(retryPlay, 1000);
  } else {
    document.addEventListener('visibilitychange', function onVisible() {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible);
        retryPlay();
      }
    });
  }
}

/* On unlock, resume playback that the OS/browser interrupted while the app was
   hidden (e.g. paused due to the screen being off), and refresh the keepalive. */
export function initBackgroundKeepalive() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;

    ensureBackgroundContext();

    if (state.pausedWhileHidden) {
      state.pausedWhileHidden = false;
      if (audio.src && getCurrentTrack()) {
        audio.play().catch((err) => {
          console.warn('[Audio Engine] Resume playback interrupted:', err);
        });
      }
    }
  });
}