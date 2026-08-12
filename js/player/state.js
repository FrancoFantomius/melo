// Shared state for the playback engine. Kept in a tiny module so the feature
// modules (stream, persistence, media-session, background) can reference the
// single <audio> element and live flags without introducing import cycles.
export const audio = new Audio();

// Load media with CORS enabled so the WebAudio keepalive graph (which captures
// this element's output) receives real samples instead of zeroes. Jellyfin
// answers with Access-Control-Allow-Origin when the element sends an Origin
// header, so music/streams become CORS-clean.
audio.crossOrigin = 'anonymous';

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
  // Keeps the OS/browser aware of active media playback so tracks keep
  // auto-advancing while the phone screen is off (background audio keepalive).
  backgroundAudioContext: null,
  mediaElementConnected: false,
  pendingAutoRetry: false,
  pausedWhileHidden: false,
  // Podcast enclosures served by hosts that don't send CORS headers fail to load
  // once the element/crossOrigin combo requires a CORS-safe fetch. In that case
  // we re-fetch through the CORS proxy and play a same-origin blob URL instead.
  podcastProxyTrackKey: null,
  podcastProxyBlobUrl: null,
  onStateChangeCallback: null
};