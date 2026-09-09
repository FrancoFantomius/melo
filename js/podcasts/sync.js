import { getClient } from '../jellyfin/client.js';

const PODCAST_LOCAL_STORAGE_KEY = 'melo_podcast_feed_urls';

function getLocalPodcastFeedUrls() {
  try {
    const raw = localStorage.getItem(PODCAST_LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPodcastFeedUrls(urls) {
  try {
    localStorage.setItem(PODCAST_LOCAL_STORAGE_KEY, JSON.stringify(urls));
  } catch (e) {
    console.warn('[Podcast Sync] Local save error:', e);
  }
}

async function savePodcastPrefs(current) {
  const client = getClient();
  if (!client || !client.serverUrl || !client.userId) return;

  try {
    await client.displayPreferences.setCustomPreference(
      'melo_podcasts',
      'podcastUrls',
      JSON.stringify(current),
      { client: 'Melo PWA' }
    );
  } catch (e) {
    console.warn('[Podcast Sync] Remote save error:', e);
  }
}

export async function getPodcastFeedUrls() {
  const client = getClient();
  let localUrls = getLocalPodcastFeedUrls();

  if (!client || !client.serverUrl || !client.userId) {
    return localUrls;
  }

  try {
    const prefs = await client.displayPreferences.getDisplayPreferences('melo_podcasts', {
      client: 'Melo PWA'
    });

    if (prefs && prefs.CustomPrefs && prefs.CustomPrefs.podcastUrls) {
      const remoteUrls = JSON.parse(prefs.CustomPrefs.podcastUrls);
      if (Array.isArray(remoteUrls)) {
        const merged = Array.from(new Set([...localUrls, ...remoteUrls]));
        saveLocalPodcastFeedUrls(merged);
        return merged;
      }
    }
  } catch (e) {
    console.warn('[Podcast Sync] Remote sync fetch notice (using local):', e.message);
  }

  return localUrls;
}

export async function savePodcastFeedUrl(feedUrl) {
  if (!feedUrl || !feedUrl.trim()) return [];
  const clean = feedUrl.trim();
  const current = getLocalPodcastFeedUrls();
  if (!current.includes(clean)) {
    current.push(clean);
    saveLocalPodcastFeedUrls(current);
  }

  await savePodcastPrefs(current);

  return current;
}

export async function removePodcastFeedUrl(feedUrl) {
  if (!feedUrl) return [];
  const clean = feedUrl.trim();
  let current = getLocalPodcastFeedUrls();
  current = current.filter(u => u !== clean);
  saveLocalPodcastFeedUrls(current);

  await savePodcastPrefs(current);

  return current;
}

