import { client, getArtworkUrl } from './client.js';
import { cleanAudioUrl } from '../podcasts/rss.js';

export function initOfflineDB() {
  return client.offline.initDB();
}

export function warmOfflineCache() {
  return client.offline.warmOfflineCache();
}

export function isTrackDownloadedSync(id) {
  return client.offline.isTrackDownloadedSync(id);
}

export function getDownloadedBlobUrlSync(id) {
  return client.offline.getDownloadedBlobUrlSync(id);
}

export function isTrackDownloaded(id) {
  return client.offline.isTrackDownloaded(id);
}

export function getDownloadedBlobUrl(id) {
  return client.offline.getDownloadedBlobUrl(id);
}

export function getAllDownloads() {
  return client.offline.getAllDownloads();
}

export function getDownloadedRecord(id) {
  return client.offline.getDownloadedRecord(id);
}

export function removeDownload(id) {
  return client.offline.removeDownload(id);
}

export function removeDownloads(tracks) {
  return client.offline.removeDownloads(tracks);
}

export async function removeDownloadGroup(parentId) {
  if (!parentId) return { ok: false, removed: 0 };
  const downloads = await client.offline.getAllDownloads();
  const toRemove = downloads.filter(r => r.parentId && String(r.parentId) === String(parentId));
  let removed = 0;
  for (const rec of toRemove) {
    if (await client.offline.removeDownload(rec.id)) removed++;
  }
  return { ok: removed > 0, removed };
}

export async function downloadTrack(track, onProgress = null, group = null, index = undefined) {
  if (!track) return { ok: false, error: 'no-track' };

  const key = String(track.Id || track.id || '');
  if (!key) return { ok: false, error: 'no-id' };

  const isPodcast = !!(track.isPodcastEpisode || track.enclosureUrl);

  if (isPodcast) {
    // If already downloaded, toggle off (remove)
    if (await client.offline.isTrackDownloaded(key)) {
      await client.offline.removeDownload(key);
      return { ok: true, removed: true };
    }

    const sourceUrl = cleanAudioUrl(track.enclosureUrl);
    if (!sourceUrl) return { ok: false, error: 'no-url' };

    let response;
    try {
      response = await fetch(sourceUrl);
    } catch (err) {
      console.warn('[Offline] Download fetch error:', err);
      return { ok: false, error: 'network' };
    }

    if (!response.ok) {
      return { ok: false, error: `http-${response.status}` };
    }

    const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10) || 0;

    try {
      const reader = response.body ? response.body.getReader() : null;
      let blob;
      if (reader) {
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (onProgress && typeof onProgress === 'function') {
            onProgress(contentLength > 0 ? received / contentLength : 0);
          }
        }
        blob = new Blob(chunks, { type: response.headers.get('Content-Type') || 'audio/mpeg' });
      } else {
        blob = await response.blob();
        if (onProgress && typeof onProgress === 'function') onProgress(1);
      }

      const record = {
        id: key,
        name: track.Name || track.title || 'Unknown',
        artists: track.Artists ? track.Artists.join(', ') : (track.Artist || track.AlbumArtist || track.showTitle || ''),
        album: track.Album || '',
        albumId: track.AlbumId || '',
        artworkUrl: track.image || getArtworkUrl(track, 'Primary', 300),
        size: blob.size,
        savedAt: Date.now(),
        isPodcast: true,
        hasLyrics: !!(track.HasLyrics || track.hasLyrics)
      };

      if (group && group.id) {
        record.parentId = String(group.id);
        record.parentName = group.name || '';
        record.parentType = group.type || '';
        record.parentArtworkUrl = group.artworkUrl || '';
        record.parentOwner = group.owner || '';
        record.parentCount = group.count || 0;
      }
      if (typeof index === 'number' && !Number.isNaN(index)) {
        record.index = index;
      } else if (typeof track.IndexNumber === 'number') {
        record.index = track.IndexNumber;
      }

      const saved = await client.offline.saveDownloadRecord(record, blob);
      if (!saved) return { ok: false, error: 'storage' };

      client.offline.revokeObjectUrl(key);
      client.offline.downloadStatusCache.set(key, true);
      client.offline.dispatchDownloadChanged(key, true);
      return { ok: true, size: blob.size };
    } catch (err) {
      console.warn('[Offline] Podcast download failed:', err);
      return { ok: false, error: 'unknown' };
    }
  }

  // Jellyfin track download handled directly by SDK
  return await client.offline.downloadTrack(track, onProgress, group, index);
}

export function downloadTracks(tracks, onProgress = null, group = null) {
  return client.offline.downloadTracks(tracks, onProgress, group);
}

export function formatBytes(bytes) {
  return client.offline.formatBytes(bytes);
}
