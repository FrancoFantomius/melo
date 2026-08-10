const CACHE_NAME = 'melo-v0.6.1';
const IMAGE_CACHE_NAME = 'jellyfin-images-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './albums.html',
  './artists.html',
  './playlists.html',
  './manifest.json',
  './img/icons/icon.svg',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/header.css',
  './css/sidebar.css',
  './css/views.css',
  './css/player.css',
  './css/modals.css',
  './css/queue.css',
  './css/lyrics.css',
  './css/responsive.css',
  './css/style.css',
  './js/app.js',
  './js/login.js',
  './js/auth-guard.js'
];

// Install Event: Safe pre-caching with Promise.allSettled
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn(`[SW] Failed to pre-cache ${url}:`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clear old/stale caches when version changes
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new Service Worker version:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== IMAGE_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate for Images & Static Assets, Bypass API & Audio Streaming
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Ignore non-GET requests and unsupported schemes (e.g., chrome-extension://, moz-extension://, blob:, data:)
  if (event.request.method !== 'GET') return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  // 1. Handle Jellyfin Artwork Images with Stale-While-Revalidate
  const isImageRequest = url.includes('/Images/') || url.includes('/Images');
  if (isImageRequest) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              cache.put(event.request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('[SW] Image background revalidation fetch failed:', err);
            return cachedResponse;
          });

          // Return cached image immediately if available; revalidate in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 2. Exclude Vite dev server HMR and Jellyfin REST / Audio media endpoints
  if (
    url.includes('/@vite/') ||
    url.includes('/@id/') ||
    url.includes('/@fs/') ||
    url.includes('.vite/deps') ||
    url.includes('/Users/') ||
    url.includes('/Items') ||
    url.includes('/Audio/') ||
    url.includes('/Sessions/') ||
    url.includes('/System/') ||
    url.includes('/Artists') ||
    url.includes('/Albums') ||
    url.includes('/Playlists')
  ) {
    return;
  }

  // 2b. Bypass all cross-origin requests (Jellyfin API, iTunes discovery directory, RSS feeds, remote artwork).
  //     These are dynamic API calls that differ by query string; caching them breaks them (e.g. ignoreSearch
  //     matches every iTunes search to the same cached response).
  if (new URL(url).origin !== self.location.origin) {
    return;
  }

  // 3. Stale-While-Revalidate for Static Application Assets
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately; update cache in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse).catch(() => {}));
            }
          })
          .catch(() => {/* Ignore network errors during background update */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache).catch(() => {}));
        return networkResponse;
      }).catch(async () => {
        // Offline HTML navigation fallback
        const acceptHeader = event.request.headers.get('accept') || '';
        if (acceptHeader.includes('text/html') || event.request.mode === 'navigate') {
          return (await caches.match('./index.html'));
        }
      });
    })
  );
});

