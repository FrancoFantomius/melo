const DB_NAME = 'JellyfinMusicCache';
const DB_VERSION = 1;
const STORE_NAME = 'api_cache';

let dbPromise = null;

export function initCacheDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      console.warn('[Cache] IndexedDB is not supported in this environment.');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.warn('[Cache] IndexedDB open error:', event.target.error);
      resolve(null);
    };
  });

  return dbPromise;
}

export async function getCachedApiData(key) {
  try {
    const db = await initCacheDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? record.data : null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn(`[Cache] getCachedApiData error for ${key}:`, err);
    return null;
  }
}

export async function setCachedApiData(key, data) {
  if (!data) return;
  try {
    const db = await initCacheDB();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = { key, data, timestamp: Date.now() };
      const request = store.put(record);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn(`[Cache] setCachedApiData error for ${key}:`, err);
  }
}

export async function clearApiCache() {
  try {
    const db = await initCacheDB();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[Cache] clearApiCache error:', err);
  }
}

export async function deleteCachedApiData(key) {
  try {
    const db = await initCacheDB();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn(`[Cache] deleteCachedApiData error for ${key}:`, err);
  }
}

/**
 * Executes Stale-While-Revalidate pattern:
 * 1. Immediately returns cached data if available.
 * 2. Runs fetchFn() in background.
 * 3. Saves fresh data to cache.
 * 4. Triggers onFreshData(freshData) callback when background fetch completes.
 */
export async function fetchWithCache(cacheKey, fetchFn, onFreshData = null) {
  const cached = await getCachedApiData(cacheKey);

  const backgroundFetch = fetchFn().then(async (freshData) => {
    if (freshData) {
      await setCachedApiData(cacheKey, freshData);
      if (onFreshData && typeof onFreshData === 'function') {
        try {
          onFreshData(freshData);
        } catch (e) {
          console.warn(`[Cache] Error in onFreshData callback for ${cacheKey}:`, e);
        }
      }
    }
    return freshData;
  }).catch((err) => {
    console.warn(`[Cache] Background fetch failed for ${cacheKey}:`, err);
    if (!cached) throw err;
    return cached;
  });

  if (cached) {
    return cached;
  }

  return await backgroundFetch;
}
