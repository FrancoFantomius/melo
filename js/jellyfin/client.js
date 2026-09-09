import {
  JellyfinClient,
  IndexedDBCacheAdapter,
  LocalStorageAdapter,
  OfflineStorageManager,
  fetchWithCache as sdkFetchWithCache,
  cleanUrl,
  JellyfinApiError,
  JellyfinAuthError,
  JellyfinError
} from '@francofantomius/jellyfin';
import { getSession, clearSession, saveSession, onSessionChange } from './session.js';
import { getPlaceholder } from '../ui/placeholders.js';

export const APP_VERSION = '1.0.2';
export { cleanUrl, JellyfinApiError, JellyfinAuthError, JellyfinError };

export function buildApiError(message, status) {
  return new JellyfinApiError(message, status);
}

// 1. Initialize persistent storage and cache adapters
const storageAdapter = new LocalStorageAdapter();
const cacheAdapter = new IndexedDBCacheAdapter('JellyfinMusicCache', 1, 'api_cache');

// 2. Initialize JellyfinClient singleton
const initialSession = getSession();

export const client = new JellyfinClient({
  serverUrl: initialSession.serverUrl || undefined,
  accessToken: initialSession.accessToken || undefined,
  userId: initialSession.userId || undefined,
  clientInfo: {
    name: 'Melo PWA',
    version: APP_VERSION,
    device: 'Web Browser',
    deviceId: initialSession.deviceId
  },
  storage: storageAdapter,
  cache: cacheAdapter
});

onSessionChange((session) => {
  client.setCredentials({
    serverUrl: session.serverUrl || '',
    accessToken: session.accessToken || '',
    userId: session.userId || ''
  });
});

// Configure offline storage manager to maintain Melo's offline audio store
client.offline = new OfflineStorageManager(client.media, 'MeloOfflineAudio', 1, 'tracks');

export function getClient() {
  return client;
}

// 3. Handle session expiration / 401 Unauthorized
let isHandlingUnauthorized = false;

export function handleUnauthorized() {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;

  console.warn('[Jellyfin] Session expired or unauthorized (HTTP 401). Clearing session and redirecting to login...');
  clearSession(true);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('melo-auth-unauthorized'));

    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.endsWith('/login.html') || currentPath.endsWith('/login');
    if (!isLoginPage) {
      window.location.href = './login.html?expired=1';
    }
  }
}

client.on('unauthorized', () => {
  handleUnauthorized();
});

// 4. Authentication & Capabilities
export async function authenticateServer(serverUrl, username, password) {
  const cleanServer = cleanUrl(serverUrl);
  client.setCredentials({ serverUrl: cleanServer });

  const data = await client.authenticate(username, password);
  const accessToken = data.AccessToken;
  const userId = data.User.Id;
  const userPrimaryImageTag = data.User?.PrimaryImageTag || data.User?.ImageTags?.Primary || '';

  await clearApiCache();

  saveSession({
    serverUrl: cleanServer,
    username: username,
    accessToken: accessToken,
    userId: userId,
    userPrimaryImageTag: userPrimaryImageTag,
    isLoggedIn: true
  });

  await reportCapabilities();

  return data;
}

export async function reportCapabilities() {
  let iconUrl = '';
  let appUrl = '';
  try {
    const origin = window.location.origin;
    const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    iconUrl = `${origin}${path}img/icons/icon.svg`;
    appUrl = `${origin}${path}`;
  } catch (e) {
    iconUrl = './img/icons/icon.svg';
  }

  return await client.auth.reportCapabilities({
    PlayableMediaTypes: ['Audio'],
    SupportedCommands: [
      'Play',
      'PlayState',
      'PlayNext',
      'SetRepeatMode',
      'SetShuffleQueue'
    ],
    SupportsMediaControl: true,
    SupportsSync: false,
    SupportsPersistentIdentifier: true,
    IconUrl: iconUrl,
    AppStoreUrl: appUrl,
    MessageFormat: 'Json'
  });
}

export function getUserImageUrl(userId = null, tag = null) {
  const session = getSession();
  const uid = userId || session.userId;
  if (!uid || !client.serverUrl) return '';
  const tagToUse = tag || session.userPrimaryImageTag;
  return client.auth.getUserImageUrl(uid, tagToUse);
}

// 5. Raw HTTP Request compatibility
export function getAuthHeader() {
  return client.http.getAuthHeader();
}

export async function jellyfinFetch(endpoint, options = {}) {
  return await client.http.request(endpoint, options);
}

// 6. Media Library Queries
export async function getMusicLibraries() {
  return await client.library.getMusicLibraries();
}

export async function getAlbums(options = {}) {
  return await client.library.getAlbums(options);
}

export async function getArtists(options = {}) {
  return await client.library.getArtists(options);
}

export async function getSongs(options = {}) {
  return await client.library.getSongs(options);
}

export async function getFavoriteSongs(options = {}) {
  return await client.library.getFavoriteSongs(options);
}

export async function getItem(itemId) {
  if (!itemId) return null;
  return await client.library.getItem(itemId);
}

export async function searchJellyfin(query) {
  if (!query || query.trim() === '') return { Items: [] };
  return await client.search.search(query, {
    includeItemTypes: 'Audio,MusicAlbum,MusicArtist,Playlist',
    limit: 30,
    recursive: true,
    fields: 'PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,HasLyrics,UserData'
  });
}

// 7. Caching Layer & Stale-While-Revalidate
export function initCacheDB() {
  return cacheAdapter.getDB();
}

export async function clearApiCache() {
  await cacheAdapter.clear();
}

export async function deleteCachedApiData(key) {
  await cacheAdapter.delete(key);
}

export async function getCachedApiData(key) {
  return await cacheAdapter.get(key);
}

export async function setCachedApiData(key, data) {
  await cacheAdapter.set(key, data);
}

export async function fetchWithCache(cacheKey, fetchFn, onFreshData = null) {
  return await sdkFetchWithCache(cacheAdapter, cacheKey, fetchFn, onFreshData);
}

export async function getAlbumsCached(options = {}, onRevalidate = null) {
  return fetchWithCache(`albums_${JSON.stringify(options)}`, () => getAlbums(options), onRevalidate);
}

export async function getArtistsCached(options = {}, onRevalidate = null) {
  return fetchWithCache(`artists_${JSON.stringify(options)}`, () => getArtists(options), onRevalidate);
}

export async function getSongsCached(options = {}, onRevalidate = null, force = false) {
  const key = `songs_${JSON.stringify(options)}`;
  if (force) await deleteCachedApiData(key);
  return fetchWithCache(key, () => getSongs(options), onRevalidate);
}

export async function getFavoriteSongsCached(options = {}, onRevalidate = null) {
  return fetchWithCache(`favorite_songs_${JSON.stringify(options)}`, () => getFavoriteSongs(options), onRevalidate);
}

export async function getPlaylistsCached(onRevalidate = null) {
  return fetchWithCache('playlists', () => getPlaylists(), onRevalidate);
}

export async function getPlaylistItemsCached(playlistId, onRevalidate = null) {
  return fetchWithCache(`playlist_items_${playlistId}`, () => getPlaylistItems(playlistId), onRevalidate);
}

export async function getItemCached(itemId, onRevalidate = null) {
  if (!itemId) return null;
  return fetchWithCache(`item_${itemId}`, () => getItem(itemId), onRevalidate);
}

export async function searchJellyfinCached(query, onRevalidate = null) {
  if (!query || query.trim() === '') return { Items: [] };
  return fetchWithCache(`search_${query.trim().toLowerCase()}`, () => searchJellyfin(query), onRevalidate);
}

// 8. Playlists
export async function getPlaylists() {
  return await client.playlists.getPlaylists();
}

export async function getPlaylistItems(playlistId) {
  return await client.playlists.getPlaylistItems(playlistId);
}

export async function createPlaylist({ name, isPublic = false, trackIds = [] }) {
  const id = await client.playlists.createPlaylist({ name, isPublic, trackIds });
  await clearApiCache();
  return id;
}

export async function updatePlaylist(playlistId, { name }) {
  await client.playlists.updatePlaylist(playlistId, { name });
  await clearApiCache();
}

export async function uploadPlaylistImage(playlistId, base64ImageString, mimeType = 'image/jpeg') {
  await client.playlists.uploadPlaylistImage(playlistId, base64ImageString, mimeType);
  await clearApiCache();
}

export async function deletePlaylist(playlistId) {
  await client.playlists.deletePlaylist(playlistId);
  await clearApiCache();
}

export async function addTracksToPlaylist(playlistId, trackIds) {
  await client.playlists.addTracks(playlistId, trackIds);
  await clearApiCache();
}

export async function removeTrackFromPlaylist(playlistId, entryIdOrTrackId) {
  await client.playlists.removeTrack(playlistId, entryIdOrTrackId);
  await clearApiCache();
}

// 9. Favorites
export async function markFavorite(itemId) {
  if (!itemId) return;
  await client.favorites.markFavorite(itemId);
}

export async function unmarkFavorite(itemId) {
  if (!itemId) return;
  await client.favorites.unmarkFavorite(itemId);
}

// 10. Playback Reporting
export async function reportPlaybackStart(itemId, positionTicks = 0) {
  try {
    await client.playback.reportStart(itemId, positionTicks);
  } catch (e) {
    console.warn('[Jellyfin] Start playback report error:', e);
  }
}

export async function reportPlaybackProgress(itemId, positionTicks = 0, isPaused = false) {
  try {
    await client.playback.reportProgress(itemId, positionTicks, isPaused);
  } catch (e) {
    console.warn('[Jellyfin] Progress playback report error:', e);
  }
}

export async function reportPlaybackStopped(itemId, positionTicks = 0) {
  try {
    await client.playback.reportStopped(itemId, positionTicks);
  } catch (e) {
    console.warn('[Jellyfin] Stop playback report error:', e);
  }
}

// 11. Media, Streaming & Artwork
export function getArtworkUrl(itemOrId, imageType = 'Primary', maxWidth = 400, fallbackType = null) {
  const determinedType = fallbackType || (typeof itemOrId === 'object' && itemOrId !== null
    ? (itemOrId.Type || (itemOrId.isPodcastEpisode || itemOrId.enclosureUrl ? 'podcast' : 'song'))
    : 'song');
  const fallbackUrl = getPlaceholder(determinedType);
  const url = client.media.getArtworkUrl(itemOrId, { imageType, maxWidth, fallbackUrl });
  return url || fallbackUrl;
}

export function getAudioStreamUrl(itemId, options = {}) {
  return client.media.getAudioStreamUrl(itemId, options);
}

export function getAudioHlsStreamUrl(itemId, options = {}) {
  return client.media.getAudioHlsStreamUrl(itemId, options);
}

// 12. Lyrics
export async function getLyrics(itemId) {
  if (!itemId) return null;
  try {
    return await fetchWithCache(`lyrics_${itemId}`, () => client.lyrics.getLyrics(itemId));
  } catch (err) {
    console.warn('[Jellyfin] Failed to fetch lyrics:', err);
    return null;
  }
}
