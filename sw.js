const CACHE_NAME = 'melo-v1.0.0';
const IMAGE_CACHE_NAME = 'jellyfin-images-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './albums.html',
  './artists.html',
  './playlists.html',
  './podcasts.html',
  './downloads.html',
  './search.html',
  './terms.html',
  './privacy.html',
  './manifest.json',
  './img/icons/icon.svg',
  './img/icons/icon_192x.png',
  './img/icons/icon_512x.png',
  './img/album.svg',
  './img/album_dark.svg',
  './img/album-1.svg',
  './img/album_dark-1.svg',
  './img/artist.svg',
  './img/artist_dark.svg',
  './img/podcast.svg',
  './img/podcast_dark.svg',
  './img/song.svg',
  './img/song_dark.svg',
  './img/favorite.svg',
  './img/favorite_dark.svg',
  './img/explore.svg',
  './img/explore_dark.svg',
  './img/radio.svg',
  './img/radio_dark.svg',
  './fonts/material-symbols-outlined-subset.woff2',
  './css/variables.css',
  './css/fonts.css',
  './css/base.css',
  './css/layout.css',
  './css/header.css',
  './css/sidebar.css',
  './css/views.css',
  './css/player.css',
  './css/modals.css',
  './css/queue.css',
  './css/lyrics.css',
  './css/podcast.css',
  './css/responsive.css',
  './css/style.css',
  './languages/de.json',
  './languages/en.json',
  './languages/es.json',
  './languages/fr.json',
  './languages/it.json',
  './languages/ja.json',
  './languages/pt.json',
  './languages/zh.json',
  './js/app.js',
  './js/login.js',
  './js/auth-guard.js',
  './js/i18n.js',
  './js/pwa.js',
  './js/privacy.js',
  './js/terms.js',
  './js/recommendations.js',
  './js/ui/placeholders.js'
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

  // Ignore media streaming range requests so byte-range audio playback is unaffected
  if (event.request.headers.has('range')) return;

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

          if (cachedResponse) {
            event.waitUntil(fetchPromise);
            return cachedResponse;
          }
          return fetchPromise;
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
  //     These are dynamic API calls that differ by query string; caching them breaks them.
  if (new URL(url).origin !== self.location.origin) {
    return;
  }

  // 3. Stale-While-Revalidate for Static Application Assets
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately; update cache in background
        const updatePromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              return caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse).catch(() => {}));
            }
          })
          .catch(() => {/* Ignore network errors during background update */});
        event.waitUntil(updatePromise);
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
          return (await caches.match('./index.html')) || (await caches.match('index.html')) || (await caches.match('./'));
        }
      });
    })
  );
});

