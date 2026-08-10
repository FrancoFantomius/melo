import { jellyfinFetch } from './http.js';

export async function getLyrics(itemId) {
  if (!itemId) return null;
  try {
    return await jellyfinFetch(`/Audio/${itemId}/Lyrics`);
  } catch (err) {
    console.warn('[Jellyfin] Failed to fetch lyrics:', err);
    return null;
  }
}
