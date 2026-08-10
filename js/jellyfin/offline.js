import { getAudioStreamUrl, getArtworkUrl } from './client.js';
import { cleanAudioUrl } from '../podcasts/rss.js';

const DB_NAME = 'MeloOfflineAudio';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let dbPromise = null;
const objectUrlCache = new Map();
const downloadStatusCache = new Map();

export function initOfflineDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      console.warn('[Offline] IndexedDB is not supported in this environment.');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.warn('[Offline] IndexedDB open error:', event.target.error);
      resolve(null);
    };
  });

  return dbPromise;
}

function getTrackKey(track) {
  return track ? String(track.Id || track.id || '') : '';
}

function dispatchDownloadChanged(trackId, downloaded) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('melo-download-changed', {
    detail: { trackId, downloaded }
  }));
}

export async function getDownloadedRecord(id) {
  if (!id) return null;
  try {
    const db = await initOfflineDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(String(id));

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn(`[Offline] getDownloadedRecord error for ${id}:`, err);
    return null;
  }
}

export async function isTrackDownloaded(id) {
  if (!id) return false;
  const key = String(id);
  if (downloadStatusCache.has(key)) return downloadStatusCache.get(key);

  const record = await getDownloadedRecord(key);
  const exists = !!record;
  downloadStatusCache.set(key, exists);
  return exists;
}

export async function getDownloadedBlobUrl(id) {
  if (!id) return null;
  const key = String(id);
  if (objectUrlCache.has(key)) return objectUrlCache.get(key);

  const record = await getDownloadedRecord(key);
  if (!record || !record.blob) return null;

  const url = URL.createObjectURL(record.blob);
  objectUrlCache.set(key, url);
  return url;
}

export async function getAllDownloads() {
  try {
    const db = await initOfflineDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        resolve(records
          .map(r => ({ ...r }))
          .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)));
      };
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('[Offline] getAllDownloads error:', err);
    return [];
  }
}

function revokeObjectUrl(id) {
  const url = objectUrlCache.get(id);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
    objectUrlCache.delete(id);
  }
}

export async function downloadTrack(track, onProgress = null, group = null, index = undefined) {
  if (!track) return { ok: false, error: 'no-track' };

  const key = getTrackKey(track);
  if (!key) return { ok: false, error: 'no-id' };

  // If already downloaded, remove it (toggle behaviour).
  if (await isTrackDownloaded(key)) {
    await removeDownload(key);
    return { ok: true, removed: true };
  }

  let sourceUrl = '';
  if (track.isPodcastEpisode || track.enclosureUrl) {
    sourceUrl = cleanAudioUrl(track.enclosureUrl);
  } else {
    sourceUrl = getAudioStreamUrl(key, { maxStreamingBitrate: 'Direct', forceTranscode: false });
  }

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
      isPodcast: !!(track.isPodcastEpisode || track.enclosureUrl)
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

    const saved = await saveDownloadRecord(record, blob);
    if (!saved) return { ok: false, error: 'storage' };

    revokeObjectUrl(key);
    downloadStatusCache.set(key, true);
    dispatchDownloadChanged(key, true);
    return { ok: true, size: blob.size };
  } catch (err) {
    console.warn('[Offline] Download failed:', err);
    return { ok: false, error: 'unknown' };
  }
}

export async function downloadTracks(tracks, onProgress = null, group = null) {
  const targets = [];
  for (const track of tracks || []) {
    const key = track && (track.Id || track.id);
    if (key && !(await isTrackDownloaded(key))) {
      targets.push(track);
    }
  }

  const total = targets.length;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const res = await downloadTrack(targets[i], null, group, i);
    completed++;
    if (!res.ok) failed++;
    if (onProgress && typeof onProgress === 'function') {
      onProgress({ completed, total, track: targets[i], res });
    }
  }

  return { ok: failed === 0 && total > 0, downloaded: total - failed, failed, total };
}

export async function removeDownloads(tracks) {
  let removed = 0;
  for (const track of tracks || []) {
    const key = track && (track.Id || track.id);
    if (key && (await removeDownload(key))) removed++;
  }
  return { ok: removed > 0, removed };
}

export async function removeDownloadGroup(parentId) {
  if (!parentId) return { ok: false, removed: 0 };
  const downloads = await getAllDownloads();
  const toRemove = downloads.filter(r => r.parentId && String(r.parentId) === String(parentId));
  let removed = 0;
  for (const rec of toRemove) {
    if (await removeDownload(rec.id)) removed++;
  }
  return { ok: removed > 0, removed };
}

function saveDownloadRecord(record, blob) {
  return new Promise(async (resolve) => {
    try {
      const db = await initOfflineDB();
      if (!db) return resolve(false);

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry = { ...record, blob };
      const request = store.put(entry);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      console.warn('[Offline] saveDownloadRecord error:', err);
      resolve(false);
    }
  });
}

export async function removeDownload(id) {
  if (!id) return false;
  const key = String(id);
  try {
    const db = await initOfflineDB();
    if (!db) return false;

    const removed = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });

    if (removed) {
      revokeObjectUrl(key);
      downloadStatusCache.set(key, false);
      dispatchDownloadChanged(key, false);
    }
    return removed;
  } catch (err) {
    console.warn('[Offline] removeDownload error:', err);
    return false;
  }
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
