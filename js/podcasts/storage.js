/**
 * Local Storage & Cache Manager for Podcasts
 */

const LOCAL_STORAGE_KEY_EPISODES = 'melo_podcast_episode_states';
const LOCAL_STORAGE_KEY_FEEDS = 'melo_podcast_cached_feeds';
const LOCAL_STORAGE_KEY_SPEED = 'melo_podcast_playback_speed';

function getEpisodeStatesMap() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EPISODES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveEpisodeStatesMap(map) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_EPISODES, JSON.stringify(map));
  } catch (e) {
    console.warn('[Podcast Storage] Error saving episode states:', e);
  }
}

export function getEpisodeState(guid) {
  if (!guid) return { position: 0, isPlayed: false };
  const map = getEpisodeStatesMap();
  return map[guid] || { position: 0, isPlayed: false };
}

export function saveEpisodeProgress(guid, position, duration) {
  if (!guid) return;
  const map = getEpisodeStatesMap();
  const existing = map[guid] || { position: 0, isPlayed: false };

  const remainingSeconds = duration - position;
  const isPlayed = existing.isPlayed || (duration > 0 && (position / duration >= 0.9) && remainingSeconds <= 300);
  map[guid] = {
    position: position,
    duration: duration,
    isPlayed: isPlayed,
    lastUpdated: Date.now()
  };
  saveEpisodeStatesMap(map);
}

export function markEpisodePlayed(guid, isPlayed = true) {
  if (!guid) return;
  const map = getEpisodeStatesMap();
  const existing = map[guid] || { position: 0 };
  map[guid] = {
    ...existing,
    isPlayed: isPlayed,
    lastUpdated: Date.now()
  };
  saveEpisodeStatesMap(map);
}

export function getCachedFeeds() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_FEEDS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveCachedFeed(feedUrl, feedData) {
  if (!feedUrl || !feedData) return;
  try {
    const feeds = getCachedFeeds();
    feeds[feedUrl] = {
      data: feedData,
      timestamp: Date.now()
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_FEEDS, JSON.stringify(feeds));
  } catch (e) {
    console.warn('[Podcast Storage] Error caching feed:', e);
  }
}

export function getSavedPlaybackSpeed() {
  try {
    const speed = localStorage.getItem(LOCAL_STORAGE_KEY_SPEED);
    return speed ? parseFloat(speed) : 1.0;
  } catch (e) {
    return 1.0;
  }
}

export function savePlaybackSpeed(speed) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_SPEED, String(speed));
  } catch (e) {
    console.warn('[Podcast Storage] Error saving speed:', e);
  }
}
