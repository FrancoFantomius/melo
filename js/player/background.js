import { getCurrentTrack } from './queue.js';
import { reportPlaybackStart } from '../jellyfin/client.js';
import { setupMediaSessionMetadata } from './media-session.js';
import { savePlayerState } from './persistence.js';
import { audio, state } from './state.js';

/* If the browser rejected play() while the screen was off or backgrounded,
   retry as soon as the app returns to the foreground. */
export function armAutoAdvanceRetry(notifyUI) {
  if (state.pendingAutoRetry) return;
  state.pendingAutoRetry = true;

  const retryPlay = () => {
    state.pendingAutoRetry = false;
    const track = getCurrentTrack();
    if (!track || !audio.paused || !audio.src) return;

    audio.play().then(() => {
      state.isPlaying = true;
      if (track.Id) reportPlaybackStart(track.Id, Math.floor((state.seekOffset + Math.max(0, audio.currentTime)) * 10000000));
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

/* On unlock or tab refocus, resume playback if it was paused while hidden. */
export function initBackgroundKeepalive(notifyUI) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;

    if (state.pausedWhileHidden) {
      state.pausedWhileHidden = false;
      if (audio.src && getCurrentTrack()) {
        audio.play().then(() => {
          state.isPlaying = true;
          if (notifyUI) notifyUI();
        }).catch((err) => {
          console.warn('[Audio Engine] Resume playback interrupted:', err);
        });
      }
    }
  });
}