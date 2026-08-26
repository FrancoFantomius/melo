# Changelog

## [1.0.0] - 2026-08-26

### Added
- **Material Design 3 migration**: overhauled application layout, navigation, and components using `@francofantomius/material-components` and Material Design 3 tokens.
  - Rebuilt top app bar, navigation drawer, navigation rail, and bottom navigation bar with MD3 component standards.
  - Implemented responsive transitions between navigation rails on desktop/tablet and bottom navigation on mobile.
- **Material Symbols font subsetting**: introduced a custom build step (`scripts/subset-icons.js` and `npm run optimize`) that scans the codebase for used Material Symbols and subsets the font to only include referenced glyphs, drastically reducing font asset payload size.
- **PWA storage persistence**: integrated the Persistent Storage API (`navigator.storage.persist`) to protect downloaded audio tracks, podcast episodes, and IndexedDB caches from browser eviction.
- **Screen Wake Lock**: integrated the Screen Wake Lock API (`navigator.wakeLock`) to keep the display active during playback and lyrics display when desired.
- **Enhanced Web App Manifest**: expanded `manifest.json` with app shortcuts (Search, Downloads, Podcasts, Favorites), share target support, and high-resolution icons (192x192, 512x512, SVG).
- **Theme & asset placeholders**: added a complete suite of theme-aware (light/dark) SVG and PNG placeholder assets for albums, artists, explore, favorites, podcasts, radio, and songs (`js/ui/placeholders.js`).
- **Translation verification tool**: added `npm run check:i18n` (`scripts/check-translations.js`) to scan the codebase for translation keys and verify parity across all 8 supported languages.
- **Revamped legal pages**: redesigned Privacy Policy (`privacy.html`) and Terms of Service (`terms.html`) with dedicated Material styling (`css/legal.css`).
- **Typography update**: integrated `@fontsource-variable/roboto-flex` variable font for modern typography rendering across all views.

### Changed
- **Player & queue overhaul**:
  - Rebuilt mini-player and expanded player controls using Material Design 3 components, accessible button labels, and responsive sliders.
  - Queue drawer redesign with smooth reordering, clear/remove actions, active track indicators, and optimized memoized rendering.
  - Hardened background audio playback and state persistence against mobile suspension and lock-screen interruptions.
- **Podcast discovery & browsing**: refreshed podcast carousels, responsive episode lists, year filters, and discovery page layouts.
- **Service worker caching**: optimized `sw.js` cache strategies to pre-cache font subsets, multi-language bundles, and handle offline routing reliably.
- Version bumped to `1.0.0`.

## [0.8.0] - 2026-08-15

### Added
- **Track actions**: added dedicated "Add to Queue" and "Add to Playlist" buttons directly on track rows with temporary checkmark feedback when queued.
- **Batch playlist addition**: added an "Add to Playlist" button to the multi-track selection toolbar in album and playlist views.
- **Dynamic lyrics visibility**: the player dynamically checks track lyrics availability via the Jellyfin API and only shows the lyrics button when lyrics exist, caching results to minimize requests.
- **Keyboard shortcuts**: press the `Space` bar anywhere (outside input fields) to toggle play and pause.
- **Synchronous offline stream resolution**: added offline cache pre-warming (`warmOfflineCache`) and synchronous download checks (`isTrackDownloadedSync`, `getDownloadedBlobUrlSync`) to eliminate delay when initiating playback of downloaded tracks.
- **Offline lyrics persistence**: saved offline tracks now preserve the `hasLyrics` flag for offline lyrics handling.
- **Clean script**: added `npm run clean` (`git clean -fdX`) to wipe all `.gitignore`-matched build artifacts and dependencies.
- **i18n**: added translations for "Add to Queue" across all 8 supported languages.

### Changed
- **Audio engine simplifications**: removed the complex `AudioContext` destination bridge and forced cross-origin attribute on the `<audio>` element, preventing CORS-related playback failures with third-party podcast streams while retaining resilient visibility-change playback recovery.
- **Queue drawer performance**: added signature-based memoization to queue drawer rendering to eliminate unnecessary DOM rebuilds and UI stutter during progress updates.
- **SPA search navigation**: global search submissions and dropdown search result selections now utilize smooth client-side history routing (`pushState`) without triggering unnecessary full page reloads.
- **Seeking UI**: fixed progress timer display jitter while actively dragging playback sliders.
- **Track row responsive layout**: refined desktop and mobile grid definitions for track rows to cleanly accommodate queue and playlist actions.
- Version bumped to `0.8.0`.

## [0.7.0] - 2026-08-12

### Added
- **Long-press track selection**: long-press a track row on mobile to enter selection mode.
  Single taps toggle selection instead of playing, and a toolbar appears with select-all,
  clear, add-to-queue, and remove-from-playlist actions.
- **Add to queue**: selected tracks are appended to the end of the current playback queue.
- **Delete playlist from editor**: a "Delete Playlist" button is now available directly
  inside the playlist edit modal.
- **Refresh Discover Daily**: manually regenerate the day's picks with a refresh button
  (label hidden on mobile).
- **Background playback keepalive**: the audio element is attached to a persistent
  `AudioContext` so the tab isn't suspended when the screen locks and auto-advancing
  tracks can call `play()` without tripping autoplay restrictions.
- **i18n**: new strings for "Play" and "Refresh" across all 8 supported languages.

### Changed
- **Player refactor**: `js/player/audio.js` split into focused modules (`state`, `stream`,
  `progress`, `persistence`, `media-session`, `likes`, `background`, `queue`).
- **Modal refactor**: the monolithic `js/ui/modals.js` was split into dedicated modules
  under `js/ui/modals/`.
- **View refactors**: album and podcast views split into small focused modules under
  `js/ui/views/albums/` and `js/ui/views/podcasts/`.
- **Track rows**: removed the per-row "Add to playlist" button in favor of long-press
  selection; mobile layout simplified (fewer columns, check icon for selected rows,
  artist links play the song on touch devices).
- **Discover Daily**: recommendations now accept an optional seed so a refresh produces
  different picks; home page artist limit reduced from 30 to 10.
- **Cache**: added `deleteCachedApiData` and a `force` refresh option for the songs cache.
- **Jellyfin capabilities**: updated the reported supported commands
  (`PlayNext`, `SetRepeatMode`, `SetShuffleQueue`).
- Version bumped to `0.7.0`.

## [0.6.1] - 2026-08-10

### Added
- **Offline downloads**: download tracks and podcast episodes for offline playback.
  - New `Downloads` page (`downloads.html`) with content grouped by album/playlist.
  - Download buttons in the player and on podcast episodes.
  - Batch download of entire albums and playlists with progress reporting.
  - Audio stored in IndexedDB (`MeloOfflineAudio`) and played back from local blobs when offline.
  - The audio engine now resolves downloaded blobs first when a track is available locally.
- **Podcast year filters**: filter a podcast's episode list by publication year via year pills.
- **i18n**: new translations for download-related strings across all 8 supported languages.
- **CI**: build pipeline now runs on Node.js 24.

### Changed
- **Jellyfin client refactor**: the monolithic `js/jellyfin/client.js` was split into focused modules
  (`auth`, `cached`, `favorites`, `http`, `library`, `lyrics`, `media`, `offline`, `playback`,
  `playlists`, `podcasts`) with a thin re-exporting facade in `client.js`.
- **Service worker**: cross-origin requests (Jellyfin API, iTunes discovery, RSS feeds, remote
  artwork) are now bypassed entirely, preventing stale-cache mismatches on dynamic queries.
- **Player**: seeking and session restore now handle downloaded tracks natively; `play()` failures
  are handled gracefully instead of rejecting.
- **README**: fully rewritten with a table of contents, expanded feature list, and page index.
- Version bumped to `0.6.1`.

## [0.6.0] - 2026-08-10

### Added
- **Discover Daily** virtual playlist alongside **Liked Songs**.
- **Home recommendation algorithm** that ranks content by recency, favorites, play count,
  completion, and diversity.
- **Playlist creation and management**: create, rename, set cover art (upload), delete, and
  add/remove tracks directly from the UI.
- **Virtual playlist covers**: dedicated image assets (`discover-daily.svg`, `liked-songs.svg`).

### Changed
- **Internationalization rework**: `i18n.js` rewritten for automatic browser-language detection
  with manual override, a mutation-observer-based translation application, and expanded coverage.
- Refined page titles and descriptions.
- SVG cover artwork adjustments.

## [0.5.3] - 2026-08-09

### Changed
- SVG artwork and asset adjustments.
- Version bumped to `0.5.3`.

## [0.5.2] - 2026-08-09

### Changed
- Refined page titles and descriptions.

## [0.5.1] - 2026-08-09

### Added
- **Internationalization**: initial `i18n` engine with 8 languages and browser-language detection.

### Changed
- **PWA fixes**: manifest and service-worker hardening, version-synced cache naming.
- **Jellyfin API version sync** and Vite major version bump.

## [0.5.0] - 2026-08-09

### Added
- Initial release of Melo: a Jellyfin-powered music player PWA.
  - Jellyfin integration (auth, streaming, library browsing).
  - Audio playback engine with queue, shuffle/repeat, Media Session, synced lyrics, and likes.
  - Albums, Artists, Playlists, Podcasts, Search, and Login views.
  - Podcast & RSS reader with Apple Podcasts directory search and episode progress tracking.
  - Installable PWA with offline support for cached resources and theme switching.
