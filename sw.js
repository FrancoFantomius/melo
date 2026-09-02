const CACHE_NAME = 'melo-v1.0.2';
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
  './css/legal.css',
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
  './img/icons/icon.svg',
  './img/icons/icon_192x.png',
  './img/icons/icon_512x.png',
  './img/album.png',
  './img/album.svg',
  './img/album_dark.png',
  './img/album_dark.svg',
  './img/album-1.png',
  './img/album-1.svg',
  './img/album_dark-1.png',
  './img/album_dark-1.svg',
  './img/artist.png',
  './img/artist.svg',
  './img/artist_dark.png',
  './img/artist_dark.svg',
  './img/download.png',
  './img/download.svg',
  './img/download_dark.png',
  './img/download_dark.svg',
  './img/explore.png',
  './img/explore.svg',
  './img/explore_dark.png',
  './img/explore_dark.svg',
  './img/favorite.png',
  './img/favorite.svg',
  './img/favorite_dark.png',
  './img/favorite_dark.svg',
  './img/podcast.png',
  './img/podcast.svg',
  './img/podcast_dark.png',
  './img/podcast_dark.svg',
  './img/radio.png',
  './img/radio.svg',
  './img/radio_dark.png',
  './img/radio_dark.svg',
  './img/search.png',
  './img/search.svg',
  './img/search_dark.png',
  './img/search_dark.svg',
  './img/song.png',
  './img/song.svg',
  './img/song_dark.png',
  './img/song_dark.svg',
  './js/app.js',
  './js/login.js',
  './js/auth-guard.js',
  './js/i18n.js',
  './js/pwa.js',
  './js/privacy.js',
  './js/terms.js',
  './js/recommendations.js',
  './js/jellyfin/auth.js',
  './js/jellyfin/cache.js',
  './js/jellyfin/cached.js',
  './js/jellyfin/client.js',
  './js/jellyfin/favorites.js',
  './js/jellyfin/http.js',
  './js/jellyfin/library.js',
  './js/jellyfin/lyrics.js',
  './js/jellyfin/media.js',
  './js/jellyfin/offline.js',
  './js/jellyfin/playback.js',
  './js/jellyfin/playlists.js',
  './js/jellyfin/podcasts.js',
  './js/jellyfin/session.js',
  './js/player/audio.js',
  './js/player/background.js',
  './js/player/likes.js',
  './js/player/media-session.js',
  './js/player/persistence.js',
  './js/player/progress.js',
  './js/player/queue.js',
  './js/player/state.js',
  './js/player/stream.js',
  './js/podcasts/discovery.js',
  './js/podcasts/rss.js',
  './js/podcasts/storage.js',
  './js/pwa/storage.js',
  './js/pwa/wake-lock.js',
  './js/ui/downloads.js',
  './js/ui/header.js',
  './js/ui/modals.js',
  './js/ui/placeholders.js',
  './js/ui/player.js',
  './js/ui/theme.js',
  './js/ui/views.js',
  './js/ui/modals/index.js',
  './js/ui/modals/lyrics.js',
  './js/ui/modals/playlists.js',
  './js/ui/modals/podcasts.js',
  './js/ui/modals/queue.js',
  './js/ui/modals/settings.js',
  './js/ui/modals/shared.js',
  './js/ui/views/albums.js',
  './js/ui/views/artists.js',
  './js/ui/views/common.js',
  './js/ui/views/downloads.js',
  './js/ui/views/home.js',
  './js/ui/views/playlists.js',
  './js/ui/views/podcasts.js',
  './js/ui/views/search.js',
  './js/ui/views/albums/detail-download.js',
  './js/ui/views/albums/detail-selection.js',
  './js/ui/views/albums/detail.js',
  './js/ui/views/albums/index.js',
  './js/ui/views/albums/list.js',
  './js/ui/views/podcasts/carousels.js',
  './js/ui/views/podcasts/detail.js',
  './js/ui/views/podcasts/discovery.js',
  './js/ui/views/podcasts/episodes.js',
  './js/ui/views/podcasts/index.js',
  './js/ui/views/podcasts/list.js'
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

  // 1. Handle Images with Stale-While-Revalidate (Jellyfin artwork, podcast covers, icons, placeholders)
  const isImageRequest =
    event.request.destination === 'image' ||
    url.includes('/Images/') ||
    url.includes('/Images') ||
    /\.(png|jpe?g|svg|webp|gif|ico)(\?.*)?$/i.test(url);

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
          const directMatch = await caches.match(event.request, { ignoreSearch: true });
          if (directMatch) return directMatch;
          const downloadsMatch = await caches.match('./downloads.html');
          if (downloadsMatch) return downloadsMatch;
          return (await caches.match('./index.html')) || (await caches.match('index.html')) || (await caches.match('./'));
        }
      });
    })
  );
});

