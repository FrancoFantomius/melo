// Shared state for the playback engine. Dual <audio> elements (audioA and audioB)
// allow seamless track transitions and background prebuffering so that the browser
// does not revoke background playback exemptions.
export const audioA = new Audio();
export const audioB = new Audio();

export const state = {
  activeAudio: audioA,
  standbyAudio: audioB,
  preloadedTrackId: null,
  preloadedStreamUrl: null,
  isPlaying: false,
  // Server-side seek offset: when we request a stream starting at e.g. 160s,
  // audio.currentTime starts at 0 but the real position is seekOffset + audio.currentTime.
  seekOffset: 0,
  currentBitrateMode: 'Direct',
  lastSaveTimestamp: 0,
  previousVolume: 0.8,
  currentPlaybackSpeed: 1.0,
  updateProgressTimer: null,
  pendingAutoRetry: false,
  pausedWhileHidden: false,
  // Podcast proxy blob caching if needed
  podcastProxyTrackKey: null,
  podcastProxyBlobUrl: null,
  onStateChangeCallback: null
};

export function getActiveAudio() {
  return state.activeAudio;
}

export function getStandbyAudio() {
  return state.standbyAudio;
}

// Transparent proxy to always target the currently active <audio> element.
export const audio = new Proxy({}, {
  get(_target, prop) {
    const active = state.activeAudio;
    const value = active[prop];
    if (typeof value === 'function') {
      return value.bind(active);
    }
    return value;
  },
  set(_target, prop, value) {
    state.activeAudio[prop] = value;
    return true;
  }
});