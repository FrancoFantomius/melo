import { getSession } from './session.js';
import { jellyfinFetch } from './http.js';

export async function reportPlaybackStart(itemId, positionTicks = 0) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;
  try {
    await jellyfinFetch('/Sessions/Playing', {
      method: 'POST',
      body: { ItemId: itemId, PositionTicks: positionTicks, CanSeek: true, IsPaused: false }
    });
  } catch (e) {
    console.warn('[Jellyfin] Start playback report error:', e);
  }
}

export async function reportPlaybackProgress(itemId, positionTicks = 0, isPaused = false) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;
  try {
    await jellyfinFetch('/Sessions/Playing/Progress', {
      method: 'POST',
      body: { ItemId: itemId, PositionTicks: positionTicks, CanSeek: true, IsPaused: isPaused }
    });
  } catch (e) {
    console.warn('[Jellyfin] Progress playback report error:', e);
  }
}

export async function reportPlaybackStopped(itemId, positionTicks = 0) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;
  try {
    await jellyfinFetch('/Sessions/Playing/Stopped', {
      method: 'POST',
      body: { ItemId: itemId, PositionTicks: positionTicks }
    });
  } catch (e) {
    console.warn('[Jellyfin] Stop playback report error:', e);
  }
}
