import { getSession } from '../jellyfin/session.js';
import { renderLoginView } from './views/login.js';
import { renderHomeView } from './views/home.js';
import { renderAlbumsView, renderAlbumDetailView, openAlbum } from './views/albums.js';
import { renderArtistsView, renderArtistDetailView, openArtist } from './views/artists.js';
import { renderPlaylistsView, renderPlaylistDetailView, openPlaylist } from './views/playlists.js';
import { renderPodcastsView, renderPodcastDetailView, openPodcastShow } from './views/podcasts.js';
import { renderSearchView } from './views/search.js';
import { renderDownloadsView } from './views/downloads.js';
import { DISCOVER_DAILY_PLAYLIST } from '../recommendations.js';
import { applyTranslations } from '../i18n.js';

let currentView = 'home';

export function getPageFromPath() {
  const path = window.location.pathname;
  if (path.endsWith('search.html')) return 'search';
  if (path.endsWith('albums.html')) return 'albums';
  if (path.endsWith('artists.html')) return 'artists';
  if (path.endsWith('playlists.html')) return 'playlists';
  if (path.endsWith('podcasts.html')) return 'podcasts';
  if (path.endsWith('downloads.html')) return 'downloads';
  if (path.endsWith('login.html')) return 'login';

  const currentScript = document.querySelector('script[data-page]');
  if (currentScript) {
    return currentScript.getAttribute('data-page') || 'home';
  }
  return 'home';
}

export function handleUrlRouting() {
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('q');
  const playlistParam = urlParams.get('playlist');
  const albumId = urlParams.get('album') || urlParams.get('albumId');
  const artistParam = urlParams.get('artist') || urlParams.get('artistId');
  const podcastParam = urlParams.get('podcast') || urlParams.get('show');

  const searchInput = document.getElementById('global-search-input');
  if (searchQuery !== null && searchInput) {
    searchInput.value = searchQuery;
  }

  const pageFromPath = getPageFromPath();
  if (pageFromPath === 'search' || searchQuery !== null) {
    switchView('search', searchQuery !== null ? searchQuery : (searchInput?.value || ''));
  } else if (podcastParam) {
    switchView('podcast-detail', { feedUrl: podcastParam });
  } else if (playlistParam) {
    switchView('playlist-detail', { Id: playlistParam, Type: playlistParam === 'liked-songs' ? 'LikedSongs' : (playlistParam === DISCOVER_DAILY_PLAYLIST.Id ? DISCOVER_DAILY_PLAYLIST.Type : 'Playlist') });
  } else if (albumId) {
    switchView('album-detail', { Id: albumId, Type: 'MusicAlbum' });
  } else if (artistParam) {
    switchView('artist-detail', { Id: artistParam, Name: artistParam });
  } else {
    switchView(pageFromPath);
  }
}

export function initViews() {
  const navItems = document.querySelectorAll('[data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      const href = item.getAttribute('href') || (targetView === 'home' ? 'index.html' : `${targetView}.html`);
      if (targetView) {
        const cleanHref = href.replace('./', '');
        if (window.location.search !== '' || !window.location.pathname.endsWith(cleanHref)) {
          window.history.pushState({ view: targetView }, '', href);
        }
        switchView(targetView);
      }
    });
  });

  window.addEventListener('popstate', () => {
    handleUrlRouting();
  });

  // Handle initial URL route
  handleUrlRouting();
}

export function switchView(viewName, viewData = null) {
  const session = getSession();

  // If user is not logged in, redirect to login page view
  if (!session.isLoggedIn && viewName !== 'login') {
    viewName = 'login';
  }

  currentView = viewName;
  document.body.setAttribute('data-page', viewName);

  // Update nav highlight for desktop sidebar & mobile bottom bar
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    const navView = item.getAttribute('data-view') || item.querySelector('a')?.getAttribute('data-view');
    if (navView === viewName ||
        (viewName === 'album-detail' && navView === 'albums') ||
        (viewName === 'playlist-detail' && navView === 'playlists') ||
        (viewName === 'artist-detail' && navView === 'artists') ||
        (viewName === 'podcast-detail' && navView === 'podcasts')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const contentArea = document.getElementById('view-container');
  if (!contentArea) return;

  switch (viewName) {
    case 'login':
      renderLoginView(contentArea);
      break;
    case 'home':
      renderHomeView(contentArea);
      break;
    case 'albums':
      renderAlbumsView(contentArea);
      break;
    case 'artists':
      renderArtistsView(contentArea);
      break;
    case 'playlists':
      renderPlaylistsView(contentArea);
      break;
    case 'podcasts':
      renderPodcastsView(contentArea, viewData);
      break;
    case 'downloads':
      renderDownloadsView(contentArea);
      break;
    case 'podcast-detail':
      renderPodcastDetailView(contentArea, viewData);
      break;
    case 'album-detail':
      renderAlbumDetailView(contentArea, viewData);
      break;
    case 'playlist-detail':
      renderPlaylistDetailView(contentArea, viewData);
      break;
    case 'artist-detail':
      renderArtistDetailView(contentArea, viewData);
      break;
    case 'search':
      renderSearchView(contentArea, viewData);
      break;
    default:
      renderHomeView(contentArea);
  }

  applyTranslations(contentArea);
}

// Re-export all view functions and helpers for backward compatibility
export { openPodcastShow, renderPodcastsView, renderPodcastDetailView } from './views/podcasts.js';
export { openAlbum, renderAlbumsView, renderAlbumDetailView } from './views/albums.js';
export { openArtist, renderArtistsView, renderArtistDetailView } from './views/artists.js';
export { openPlaylist, renderPlaylistsView, renderPlaylistDetailView } from './views/playlists.js';
export { renderSearchView } from './views/search.js';
export { renderHomeView } from './views/home.js';
export { renderLoginView } from './views/login.js';

