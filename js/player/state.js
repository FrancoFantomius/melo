// Unified persistent audio engine state. A single persistent <audio> element
// is maintained across the entire session to prevent mobile browsers (iOS/Android)
// from revoking background playback permissions during track transitions.
export const audio = new Audio();
audio.preload = 'auto';

export const state = {
  activeAudio: audio,
  isPlaying: false,
  isHls: false,
  streamType: 'direct', // 'hls' | 'direct' | 'blob'
  preloadedTrackId: null,
  preloadedStreamUrl: null,
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
  return audio;
}

export function getStandbyAudio() {
  return null;
}