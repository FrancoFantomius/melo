# Melo

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.5.0--beta-orange.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Vite](https://img.shields.io/badge/vite-v5.4-646CFF.svg)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8.svg)

Melo is a lightweight Progressive Web App (PWA) music player built with Vanilla JavaScript and Vite, powered by a Jellyfin media server backend. It supports music streaming, playlist management, album and artist browsing, and podcast subscription via RSS feeds.

---

## Features

- **Jellyfin Integration**: Connect directly to your Jellyfin server instance for high-fidelity audio streaming.
- **Audio Playback Engine**: Built-in music player with queue management, track progress, volume control, and shuffle/repeat modes.
- **Media Browsing**: Dedicated views for Albums, Artists, Playlists, Podcasts, and Instant Search.
- **Podcast & RSS Reader**: Add, search, and stream RSS podcast feeds directly within the application.
- **Progressive Web App**: Fully installable as a web app on desktop and mobile devices with service worker caching.
- **Dark / Light Theme**: Built-in dynamic theme toggling.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Jellyfin Server**: A running Jellyfin instance (v10.8.0+ recommended) with active user credentials.

---

## Installation & Setup

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

## How to Run & Access

### 1. Development Mode

To start the Vite development server with Hot Module Reloading:

```bash
npm run dev
```

Access the application in your browser at `http://localhost:5173`.

### 2. Production Build

To build an optimized production bundle:

```bash
npm run build
```

The compiled static assets and updated service worker will be output to the `dist/` directory.

### 3. Preview Production Build

To preview the output locally before deployment:

```bash
npm run preview
```

Access the preview server at `http://localhost:4173`.

---

## Connecting to Your Jellyfin Server

1. Open Melo in your browser (e.g., `http://localhost:5173`).
2. You will be prompted to sign in on `login.html`.
3. Enter your server connection credentials:
   - **Server Address**: Full URL of your Jellyfin server (e.g., `https://jellyfin.example.com` or `http://192.168.1.100:8096`).
   - **Username**: Your Jellyfin username.
   - **Password**: Your Jellyfin password.
4. Click **Sign In**. Once authenticated, session tokens are securely saved in your browser's local storage.

---

## Deployment to GitHub Pages

This repository includes a GitHub Action workflow to automatically build and deploy Melo to GitHub Pages whenever changes are pushed to the `main` branch.

To enable GitHub Pages in your GitHub repository:
1. Go to repository **Settings** -> **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push changes to `main`, and GitHub Actions will automatically deploy the site.

---

## Project Structure

```
├── albums.html        # Albums view entry point
├── artists.html       # Artists view entry point
├── css/               # Modular CSS stylesheet design system
├── img/               # Icons and application graphic assets
├── index.html         # Main dashboard view entry point
├── js/                # Client-side JavaScript modules
│   ├── jellyfin/      # Jellyfin API client and session storage
│   ├── player/        # Audio engine, playback controller & queue
│   ├── podcasts/      # Podcast RSS parser & discovery
│   └── ui/            # Dynamic renderers, modals, & view controllers
├── login.html         # Jellyfin server login view
├── manifest.json      # Web App Manifest for PWA support
├── package.json       # Node.js dependencies & scripts
├── playlists.html     # Playlists view entry point
├── podcasts.html      # Podcasts view entry point
├── search.html        # Search interface entry point
├── sw.js              # Service Worker offline caching script
├── templates/         # Handlebars partial HTML layouts
└── vite.config.js     # Vite bundler configuration
```

---

## Contributing

Contributions, bug reports, and feature requests are welcome!  
Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting Pull Requests.

---

## License

This project is licensed under the [MIT License](LICENSE).
