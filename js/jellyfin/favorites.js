import { getSession } from './session.js';
import { jellyfinFetch } from './http.js';

export async function markFavorite(itemId) {
  const session = getSession();
  if (!session.serverUrl || !session.userId || !itemId) return;
  await jellyfinFetch(`/Users/${session.userId}/FavoriteItems/${itemId}`, { method: 'POST' });
}

export async function unmarkFavorite(itemId) {
  const session = getSession();
  if (!session.serverUrl || !session.userId || !itemId) return;
  await jellyfinFetch(`/Users/${session.userId}/FavoriteItems/${itemId}`, { method: 'DELETE' });
}
