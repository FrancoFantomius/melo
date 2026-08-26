import { getSession } from '../jellyfin/session.js';
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

  const searchInput = document.getElementById('global-search-bar') || document.getElementById('global-search-input');
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
  const handleNavClick = (e, item) => {
    e.preventDefault();
    const targetView = item.getAttribute('data-view') || item.value;
    const href = item.getAttribute('href') || (targetView === 'home' ? 'index.html' : `${targetView}.html`);
    if (targetView) {
      const cleanHref = href.replace('./', '');
      if (window.location.search !== '' || !window.location.pathname.endsWith(cleanHref)) {
        window.history.pushState({ view: targetView }, '', href);
      }
      switchView(targetView);
    }
  };

  const navItems = document.querySelectorAll('md-navigation-drawer-item, md-navigation-rail-item, md-navigation-bar-item, [data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => handleNavClick(e, item));
    item.addEventListener('item-click', (e) => handleNavClick(e, item));
  });

  const rail = document.getElementById('main-sidebar-rail');
  rail?.addEventListener('change', (e) => {
    if (e.detail?.item) {
      handleNavClick(e, e.detail.item);
    }
  });

  const bottomNav = document.getElementById('mobile-bottom-nav');
  bottomNav?.addEventListener('change', (e) => {
    if (e.detail?.item) {
      handleNavClick(e, e.detail.item);
    }
  });

  window.addEventListener('popstate', () => {
    handleUrlRouting();
  });

  // Handle initial URL route
  handleUrlRouting();
}

export function switchView(viewName, viewData = null) {
  const session = getSession();

  // If user is not logged in, redirect to login page
  if (!session.isLoggedIn) {
    window.location.href = './login.html';
    return;
  }

  currentView = viewName;
  document.body.setAttribute('data-page', viewName);

  // Update nav highlight for desktop sidebar drawer, retracted railbar & mobile bottom bar
  const allNavItems = document.querySelectorAll('md-navigation-drawer-item, md-navigation-rail-item, md-navigation-bar-item, .nav-item, .mobile-nav-item');
  allNavItems.forEach(item => {
    const navView = item.getAttribute('data-view') || item.value || item.querySelector('a')?.getAttribute('data-view');
    const isActive = (
      navView === viewName ||
      (viewName === 'album-detail' && navView === 'albums') ||
      (viewName === 'playlist-detail' && navView === 'playlists') ||
      (viewName === 'artist-detail' && navView === 'artists') ||
      (viewName === 'podcast-detail' && navView === 'podcasts')
    );

    if (isActive) {
      item.active = true;
      item.selected = true;
      item.setAttribute('active', '');
      item.setAttribute('selected', '');
      item.classList.add('active');

      // Fill the selected/active icon in light DOM and shadow DOM
      const lightIcon = item.querySelector('md-icon');
      if (lightIcon) {
        lightIcon.filled = true;
        lightIcon.setAttribute('filled', '');
      }
      const shadowIcon = item.shadowRoot?.querySelector('md-icon');
      if (shadowIcon) {
        shadowIcon.filled = true;
        shadowIcon.setAttribute('filled', '');
      }
    } else {
      item.active = false;
      item.selected = false;
      item.removeAttribute('active');
      item.removeAttribute('selected');
      item.classList.remove('active');

      // Unfill inactive icon in light DOM and shadow DOM
      const lightIcon = item.querySelector('md-icon');
      if (lightIcon) {
        lightIcon.filled = false;
        lightIcon.removeAttribute('filled');
      }
      const shadowIcon = item.shadowRoot?.querySelector('md-icon');
      if (shadowIcon) {
        shadowIcon.filled = false;
        shadowIcon.removeAttribute('filled');
      }
    }
  });

  // Synchronize active index for Navigation Rail and Navigation Bar
  const rail = document.getElementById('main-sidebar-rail');
  if (rail) {
    const railItems = Array.from(rail.querySelectorAll('md-navigation-rail-item, md-nav-rail-item'));
    const activeRailIndex = railItems.findIndex(i => i.active);
    if (activeRailIndex !== -1) {
      rail.activeIndex = activeRailIndex;
    }
  }

  const bottomNav = document.getElementById('mobile-bottom-nav');
  if (bottomNav && bottomNav.tagName.toLowerCase() === 'md-navigation-bar') {
    const barItems = Array.from(bottomNav.querySelectorAll('md-navigation-bar-item, md-nav-bar-item'));
    const activeBarIndex = barItems.findIndex(i => i.active);
    if (activeBarIndex !== -1) {
      bottomNav.activeIndex = activeBarIndex;
    }
  }

  const contentArea = document.getElementById('view-container');
  if (!contentArea) return;

  switch (viewName) {
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

