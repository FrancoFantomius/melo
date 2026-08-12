# Changelog

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
