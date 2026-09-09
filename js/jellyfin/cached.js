import { fetchWithCache, deleteCachedApiData } from './cache.js';
import {
  getAlbums,
  getArtists,
  getSongs,
  getFavoriteSongs,
  getPlaylists,
  getPlaylistItems,
  getItem,
  searchJellyfin
} from './library.js';

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
