# Melo

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.2-orange.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Vite](https://img.shields.io/badge/vite-v8.2-646CFF.svg)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8.svg)

Melo is a lightweight, installable Progressive Web App (PWA) music player built with Vanilla JavaScript and Vite, powered by a [Jellyfin](https://jellyfin.org/) media server backend. It combines a polished streaming experience with offline support, podcast subscription, and a personalized home screen — all without any heavy front-end framework.

---

## Table of Contents

- [Features](#features)
- [Pages & Views](#pages--views)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Connecting to Your Jellyfin Server](#connecting-to-your-jellyfin-server)
- [Internationalization](#internationalization)
- [PWA & Offline Support](#pwa--offline-support)
- [Deployment to GitHub Pages](#deployment-to-github-pages)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Features

### Jellyfin Integration
- Direct connection to any Jellyfin server instance (v10.8.0+ recommended).
- Name/password authentication via the official `Users/AuthenticateByName` API.
- Session tokens stored securely in `localStorage`.
- Client capabilities and device icon reported back to the server.
- Optional in-browser caching layer to speed up repeated API requests.

### Audio Playback Engine
- Full-featured audio player with play, pause, seek, and volume controls.
- Keyboard shortcuts: `Space` bar anywhere to toggle play/pause.
- Queue management with next/previous track navigation and memoized drawer rendering.
- Shuffle and repeat modes (`none` / `all` / `one`).
- Track progress, elapsed time, and Media Session integration.
- Synced lyrics support with dynamic availability checks via the Jellyfin lyrics API.
- Like/favorite tracks directly from the player.

### Media Browsing & Playlist Management
- Dedicated views for Albums, Artists, Playlists, Podcasts, and Downloads.
- Instant search across artists, albums, and tracks with recent search history and client-side SPA navigation.
- Virtual playlists out of the box: **Liked Songs** and **Discover Daily** (with refresh button).
- Playlist management: create, edit, delete playlists, and add/remove songs.
- Inline track row actions (Add to Queue, Add to Playlist, Like, Download).
- Multi-track long-press selection on mobile and batch actions (Add to Playlist, Add to Queue, Remove).
- Home screen with a recommendation algorithm that ranks content by recency, favorites, play count, completion, and diversity.

### Podcasts & RSS Reader
- Subscribe to any podcast by RSS feed URL.
- Built-in podcast directory search powered by the Apple Podcasts public API.
- RSS feed parsing with episode lists, artwork, and playback progress tracking.
- Episode states (played / partial progress) persisted across sessions.

### Offline Downloads
- Download tracks and podcast episodes for offline playback.
- Synchronous blob resolution with cache pre-warming for instant offline playback.
- Downloads stored in IndexedDB with group-by album/playlist organization.
- Batch download for entire albums and playlists, with progress reporting.
- Dedicated Downloads view to manage and remove stored content.

### Progressive Web App
- Fully installable on desktop and mobile via web app manifest.
- Service worker with automatic version-based cache invalidation.
- Static assets precached at build time; build outputs mirrored into the service worker.
- Works offline for cached resources.

### Theme & Language
- Dark, light, and system-following themes with live switching.
- Internationalization (i18n) with automatic browser-language detection and 8 supported languages (see [Internationalization](#internationalization)).

---

## Pages & Views

| Page            | Route            | Description |
| --------------- | ---------------- | ----------- |
| Home            | `index.html`     | Personalized dashboard with recommended playlists, tracks, artists, podcasts, and albums. |
| Search          | `search.html`    | Global search across artists, albums, and tracks, plus podcast directory search. |
| Albums          | `albums.html`    | Browse the Jellyfin music library by album. |
| Artists         | `artists.html`   | Browse artists and their discographies. |
| Playlists       | `playlists.html` | Manage and play Jellyfin playlists, plus virtual playlists. |
| Podcasts        | `podcasts.html`  | Subscribed feeds, episode details, and the discover directory. |
| Downloads       | `downloads.html` | Manage offline-downloaded tracks grouped by album/playlist. |
| Login           | `login.html`     | Sign in to your Jellyfin server. |
| Terms           | `terms.html`     | Terms of Service. |
| Privacy         | `privacy.html`   | Privacy Policy. |

---

## Technology Stack

- **Language**: Vanilla JavaScript (ES6 Modules)
- **Build Tool**: Vite (`vite ^8.2`)
- **Templating**: Handlebars partials via `vite-plugin-handlebars`
- **Styling**: Custom CSS (design-system variables, responsive layouts)
- **Storage**: `localStorage` (session, settings) and IndexedDB (API cache, offline audio)
- **Backend**: Jellyfin media server (REST API)
- **Fonts**: Roboto Flex (variable font) and Material Symbols Outlined (subsetted variable font, self-hosted)

---

## Prerequisites

- **Node.js**: `v20.19.0` or later, or `v22.12.0` or later (Node 24 is used in the CI pipeline).
- **npm**: `v9.0.0` or higher.
- **Jellyfin Server**: A running Jellyfin instance (v10.8.0+ recommended) with active user credentials.

---

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/melo.git
   cd melo
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

---

## Running the App

### 1. Development Mode

Start the Vite development server with Hot Module Reloading:

```bash
npm run dev
```

Access the application at `http://localhost:5173`.

### 2. Production Build

Build an optimized production bundle:

```bash
npm run build
```

The compiled static assets are written to `dist/`. During the build, the plugin automatically:

- Syncs the `package.json` version into the web app manifest(s) and `sw.js` cache name.
- Copies the `languages/` directory into `dist/languages/`.
- Collects the generated assets and embeds them in the service worker precache list.
- Emits the final service worker to `dist/sw.js`.

### 3. Preview the Production Build

Preview the output locally before deploying:

```bash
npm run preview
```

Access the preview server at `http://localhost:4173`.

---

## Connecting to Your Jellyfin Server

1. Open Melo in your browser (e.g., `http://localhost:5173`).
2. You will be redirected to `login.html`.
3. Enter your connection details:
   - **Server Address**: The full URL of your Jellyfin server (e.g., `https://jellyfin.example.com` or `http://192.168.1.100:8096`).
   - **Username**: Your Jellyfin username.
   - **Password**: Your Jellyfin password.
4. Click **Sign In**. On success, the session token is saved in your browser's `localStorage` and you are taken to the Home view.
5. Unauthenticated visits to any protected page are automatically redirected to the login page.

> Note: Jellyfin user passwords are only sent to the Jellyfin server you specify and are never stored by Melo.

---

## Internationalization

Melo ships with translations for the following languages:

| Code | Language |
| ---- | -------- |
| `en` | English (fallback) |
| `it` | Italiano |
| `es` | Español |
| `fr` | Français |
| `de` | Deutsch |
| `pt` | Português |
| `zh` | 中文 |
| `ja` | 日本語 |

The language mode defaults to **auto**, resolving the active language from the browser settings, and can be overridden manually. The choice is persisted in `localStorage`. Translations are loaded from JSON files in `languages/` and applied to both static pages and dynamically rendered views via a mutation observer.

---

## PWA & Offline Support

- **Installability**: Web app manifest (`public/manifest.json`) with standalone display and an SVG icon.
- **Service worker**: `sw.js` precaches all built static assets and uses a versioned cache name (`melo-v<version>`) so new releases invalidate stale caches automatically.
- **Offline audio**: Download tracks or podcast episodes through the UI; audio blobs are stored in an IndexedDB database (`MeloOfflineAudio`) and played back from object URLs when offline.
- **Caching**: Jellyfin API responses are cached in IndexedDB to speed up repeated loads and reduce server load.

---

## Deployment to GitHub Pages

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys Melo to GitHub Pages whenever changes are pushed to the `main` branch. The workflow can also be triggered manually via **Actions** > **Deploy to GitHub Pages** > **Run workflow**.

To enable GitHub Pages:

1. Go to your repository **Settings** -> **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push changes to `main` (or run the workflow manually), and GitHub Actions will build and deploy the site.

---

## Project Structure

```
.
├── .github/
│   └── workflows/deploy.yml   # GitHub Pages deployment workflow
├── css/                       # Styling (base, layout, player, queue, themes, ...)
├── js/
│   ├── jellyfin/              # Jellyfin API client, auth, cache, library, playback, podcasts, ...
│   ├── player/                # Audio engine, queue, likes
│   ├── podcasts/              # RSS parsing, discovery, feed storage
│   ├── ui/                    # Views, modals, theme, header, player UI, downloads
│   ├── app.js                 # Application entry point
│   ├── auth-guard.js          # Route protection / login redirect
│   ├── i18n.js                # Internationalization engine
│   └── pwa.js                 # Service worker registration
├── languages/                 # Translation JSON files (en, it, es, fr, de, pt, zh, ja)
├── public/                    # Static assets (manifest, icons, cover art)
├── templates/                 # Handlebars partials (sidebar, header, player, modals, ...)
├── index.html                 # Home page
├── login.html                 # Authentication page
├── albums.html                # Albums view
├── artists.html               # Artists view
├── playlists.html             # Playlists view
├── podcasts.html              # Podcasts view
├── downloads.html             # Downloads view
├── search.html                # Search view
├── terms.html                 # Terms of Service
├── privacy.html               # Privacy Policy
├── sw.js                      # Service worker (version-synced at build time)
└── vite.config.js             # Vite configuration with custom build plugin
```

---

## Contributing

Contributions, bug reports, and feature requests are welcome.

- Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting Pull Requests.
- Use the issue templates under `.github/ISSUE_TEMPLATE/` for bug reports and feature requests.
- See [SECURITY.md](SECURITY.md) for information on reporting vulnerabilities.

---

## Security

Please review [SECURITY.md](SECURITY.md). Do **not** create a public GitHub issue for security vulnerabilities; report them privately through GitHub Security Advisories or via the contact channels listed there.

---

## License

This project is licensed under the [MIT License](LICENSE).
