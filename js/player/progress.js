import { getCurrentTrack } from './queue.js';
import { reportPlaybackProgress } from '../jellyfin/client.js';
import { audio, state } from './state.js';

export function startProgressReporting() {
  stopProgressReporting();
  state.updateProgressTimer = setInterval(() => {
    const track = getCurrentTrack();
    if (track && !audio.paused && isFinite(audio.currentTime)) {
      const realPosition = state.seekOffset + audio.currentTime;
      reportPlaybackProgress(track.Id, Math.floor(realPosition * 10000000), false);
    }
  }, 10000);
}

export function stopProgressReporting() {
  if (state.updateProgressTimer) {
    clearInterval(state.updateProgressTimer);
    state.updateProgressTimer = null;
  }
}