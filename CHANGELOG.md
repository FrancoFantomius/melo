# Changelog

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
