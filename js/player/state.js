// Shared state for the playback engine. Kept in a tiny module so the feature
// modules (stream, persistence, media-session, background) can reference the
// single <audio> element and live flags without introducing import cycles.
export const audio = new Audio();

export const state = {
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