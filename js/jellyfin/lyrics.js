import { jellyfinFetch } from './http.js';
import { fetchWithCache } from './cache.js';

export async function getLyrics(itemId) {
  if (!itemId) return null;
  try {
    return await fetchWithCache(`lyrics_${itemId}`, () => jellyfinFetch(`/Audio/${itemId}/Lyrics`));
  } catch (err) {
    console.warn('[Jellyfin] Failed to fetch lyrics:', err);
    return null;
  }
}

