import { searchJellyfinCached, getArtworkUrl } from '../../jellyfin/client.js';
import { getSession } from '../../jellyfin/session.js';
import { searchPodcastDirectory } from '../../podcasts/discovery.js';
import { openPodcastShow } from './podcasts.js';
import { renderAlbumCardHTML, bindAlbumCards, bindArtistCards, renderTrackRowHTML, bindTrackRows, bindArtistLinks } from './common.js';
import { registerTracksFavoriteStatus } from '../../player/likes.js';
import { getTranslation } from '../../i18n.js';

export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem('melo_recent_searches') || '[]');
  } catch (e) {
    return [];
  }
}

export function addRecentSearch(query) {
  if (!query || !query.trim()) return;
  const trimmed = query.trim();
  let searches = getRecentSearches().filter(q => q.toLowerCase() !== trimmed.toLowerCase());
  searches.unshift(trimmed);
  if (searches.length > 10) searches = searches.slice(0, 10);
  localStorage.setItem('melo_recent_searches', JSON.stringify(searches));
}

export function removeRecentSearch(query) {
  let searches = getRecentSearches().filter(q => q !== query);
  localStorage.setItem('melo_recent_searches', JSON.stringify(searches));
}

export function clearRecentSearches() {
  localStorage.removeItem('melo_recent_searches');
}

let latestSearchQuery = '';

export async function renderSearchView(container, query) {
  if (typeof container === 'string') {
    query = container;
    container = document.getElementById('view-container');
  }
  if (!container) return;

  query = query || '';
  latestSearchQuery = query;

  if (query) {
    addRecentSearch(query);
  }

  let searchInput = container.querySelector('#search-page-input');
  let resultsContainer = container.querySelector('#search-page-results-container');
  let btnClear = container.querySelector('#btn-clear-search-input');

  if (!searchInput || !resultsContainer) {
    container.innerHTML = `
      <div class="view-section search-view-section">
        <div class="search-page-bar-container">
          <div class="search-page-bar">
            <span class="material-symbols-outlined search-page-icon">search</span>
            <input type="text" id="search-page-input" class="search-page-input" placeholder="Search artists, albums, tracks..." value="${query.replace(/"/g, '&quot;')}" autocomplete="off" data-i18n-placeholder>
            <button id="btn-clear-search-input" class="search-page-clear-btn" title="Clear search" style="${query ? 'display: flex;' : 'display: none;'}"><span class="material-symbols-outlined">close</span></button>
          </div>
        </div>
        <div id="search-page-results-container"></div>
      </div>
    `;
    bindSearchPageControls(container);
    searchInput = container.querySelector('#search-page-input');
    resultsContainer = container.querySelector('#search-page-results-container');
    btnClear = container.querySelector('#btn-clear-search-input');
  } else {
    if (document.activeElement !== searchInput && searchInput.value !== query) {
      searchInput.value = query;
    }
    if (btnClear) {
      btnClear.style.display = query ? 'flex' : 'none';
    }
  }

  if (!query) {
    renderRecentSearches(resultsContainer);
    return;
  }

  resultsContainer.innerHTML = `
    <h2 class="section-title"><span data-i18n>Search Results for</span> "${query.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</h2>

    <div id="search-artists-section" style="display: none; margin-bottom: 24px;">
      <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;" data-i18n>Artists & Albums</h3>
      <div id="search-media-grid" class="cards-grid"></div>
    </div>

    <div id="search-tracks-section" style="margin-bottom: 24px;">
      <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;" data-i18n>Tracks</h3>
      <div id="search-results-list" class="tracks-list">
        <div style="color: var(--text-muted);" data-i18n>Searching Jellyfin library...</div>
      </div>
    </div>

    <div id="search-podcasts-section" style="display: none; margin-bottom: 24px;">
      <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;" data-i18n>Podcasts</h3>
      <div id="search-podcasts-grid" class="cards-grid"></div>
    </div>
  `;

  const session = getSession();

  // Search Podcasts if enabled (default: true)
  if (session.searchPodcasts !== false) {
    searchPodcastDirectory(query, 6).then(podcasts => {
      if (latestSearchQuery !== query) return;
      const podcastsSection = document.getElementById('search-podcasts-section');
      const podcastsGrid = document.getElementById('search-podcasts-grid');
      if (podcastsSection && podcastsGrid && podcasts && podcasts.length > 0) {
        podcastsSection.style.display = 'block';
        podcastsGrid.innerHTML = podcasts.map(item => `
          <div class="media-card podcast-search-card" data-feed-url="${encodeURIComponent(item.feedUrl)}">
            <img src="${item.image || './img/icons/icon.svg'}" class="card-thumb" alt="${item.title}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';">
            <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
              <div class="card-title" title="${item.title}">${item.title}</div>
              <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.author || 'Podcast'}</div>
              <div style="font-size: 11px; color: var(--accent); margin-top: 2px;">${item.genre || 'Podcast'}</div>
            </div>
          </div>
        `).join('');

        podcastsGrid.querySelectorAll('.podcast-search-card').forEach(card => {
          card.addEventListener('click', () => {
            const feedUrl = decodeURIComponent(card.getAttribute('data-feed-url'));
            openPodcastShow(feedUrl);
          });
        });
      }
    }).catch(err => {
      console.warn('[Search] Podcast search error:', err);
    });
  }

  const updateSearchResults = (res) => {
    if (latestSearchQuery !== query) return;
    const searchResultsList = document.getElementById('search-results-list');
    const mediaGrid = document.getElementById('search-media-grid');
    const mediaSection = document.getElementById('search-artists-section');
    const tracksSection = document.getElementById('search-tracks-section');

    if (res && res.Items) {
      if (res.Items.length === 0) {
        if (searchResultsList) searchResultsList.innerHTML = `<div style="color: var(--text-secondary);">No items matched "${query}".</div>`;
        if (mediaSection) mediaSection.style.display = 'none';
        return;
      }

      const mediaItems = res.Items.filter(item => item.Type === 'MusicAlbum' || item.Type === 'Album' || item.Type === 'MusicArtist' || item.Type === 'Artist' || item.Type === 'Playlist');
      const tracks = res.Items.filter(item => item.Type === 'Audio');

      if (mediaGrid && mediaSection && mediaItems.length > 0) {
        mediaSection.style.display = 'block';
        mediaGrid.innerHTML = mediaItems.map(item => {
          if (item.Type === 'MusicArtist' || item.Type === 'Artist') {
            return `
              <div class="media-card" data-artist-id="${item.Id}">
                <img src="${getArtworkUrl(item, 'Primary', 300)}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="card-thumb" style="border-radius: 50%;" alt="${item.Name}">
                <div class="card-title" style="text-align: center;">${item.Name}</div>
                <div class="card-subtitle" style="text-align: center;">Artist</div>
              </div>
            `;
          }
          return renderAlbumCardHTML(item, item.Type || 'Album');
        }).join('');
        bindAlbumCards(mediaGrid);
        bindArtistCards(mediaGrid);
      } else if (mediaSection) {
        mediaSection.style.display = 'none';
      }

      if (searchResultsList) {
        if (tracks.length === 0) {
          if (mediaItems.length > 0 && tracksSection) {
            tracksSection.style.display = 'none';
          } else {
            searchResultsList.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No matching tracks found.</div>`;
          }
        } else {
          if (tracksSection) tracksSection.style.display = 'block';
          registerTracksFavoriteStatus(tracks);
          searchResultsList.innerHTML = tracks.map((track, idx) => renderTrackRowHTML(track, idx)).join('');
          bindTrackRows(searchResultsList, tracks);
          bindArtistLinks(searchResultsList);
        }
      }
    }
  };

  try {
    const res = await searchJellyfinCached(query, updateSearchResults);
    if (latestSearchQuery === query) {
      updateSearchResults(res);
    }
  } catch (err) {
    if (latestSearchQuery === query) {
      const searchResultsList = document.getElementById('search-results-list');
      if (searchResultsList) {
        searchResultsList.innerHTML = `<div style="color: var(--danger);">Search failed: ${err.message}</div>`;
      }
    }
  }
}

function renderRecentSearches(resultsContainer) {
  const recentSearches = getRecentSearches();
  const html = `
    <div class="recent-searches-section">
      <div class="recent-searches-header">
        <h2 class="section-title" style="font-size: 20px;" data-i18n>Recent Searches</h2>
        ${recentSearches.length > 0 ? `<button id="btn-clear-all-recent" style="font-size: 13px; color: var(--text-muted); cursor: pointer; background: none; border: none; font-weight: 600;" data-i18n>Clear all</button>` : ''}
      </div>
      ${recentSearches.length > 0 ? `
        <div class="recent-searches-list">
          ${recentSearches.map(term => `
            <div class="recent-search-item" data-query="${encodeURIComponent(term)}">
              <span class="material-symbols-outlined" style="font-size: 20px; color: var(--text-muted);">history</span>
              <span class="recent-search-text">${term}</span>
              <button class="btn-remove-recent" data-term="${encodeURIComponent(term)}" title="Remove from history">
                <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
              </button>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="color: var(--text-secondary); font-size: 14px; margin-top: 8px;" data-i18n>No recent searches. Search for artists, songs, or podcasts above!</div>
      `}
    </div>
  `;
  resultsContainer.innerHTML = html;
  bindRecentSearchesControls(resultsContainer);
}

function bindSearchPageControls(container) {
  const searchInput = container.querySelector('#search-page-input');
  const btnClear = container.querySelector('#btn-clear-search-input');

  let debounceTimer = null;

  searchInput?.addEventListener('input', (e) => {
    const newQuery = e.target.value;
    if (btnClear) btnClear.style.display = newQuery ? 'flex' : 'none';

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const globalSearchInput = document.getElementById('global-search-input');
      if (globalSearchInput && document.activeElement !== globalSearchInput) {
        globalSearchInput.value = newQuery;
      }

      const trimmed = newQuery.trim();
      if (trimmed.length > 0) {
        window.history.replaceState(null, '', `search.html?q=${encodeURIComponent(trimmed)}`);
        renderSearchView(container, trimmed);
      } else {
        window.history.replaceState(null, '', 'search.html');
        renderSearchView(container, '');
      }
    }, 300);
  });

  btnClear?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) globalSearchInput.value = '';
    if (btnClear) btnClear.style.display = 'none';

    window.history.replaceState(null, '', 'search.html');
    renderSearchView(container, '');
  });
}

function bindRecentSearchesControls(resultsContainer) {
  const btnClearAllRecent = resultsContainer.querySelector('#btn-clear-all-recent');

  btnClearAllRecent?.addEventListener('click', () => {
    clearRecentSearches();
    const container = document.getElementById('view-container');
    renderSearchView(container, '');
  });

  resultsContainer.querySelectorAll('.recent-search-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-recent')) return;
      const term = decodeURIComponent(item.getAttribute('data-query'));
      const container = document.getElementById('view-container');
      const searchInput = container?.querySelector('#search-page-input');
      if (searchInput) searchInput.value = term;
      const globalSearchInput = document.getElementById('global-search-input');
      if (globalSearchInput) globalSearchInput.value = term;
      window.history.replaceState(null, '', `search.html?q=${encodeURIComponent(term)}`);
      renderSearchView(container, term);
    });
  });

  resultsContainer.querySelectorAll('.btn-remove-recent').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const term = decodeURIComponent(btn.getAttribute('data-term'));
      removeRecentSearch(term);
      const container = document.getElementById('view-container');
      const searchInput = container?.querySelector('#search-page-input');
      const currentQuery = searchInput ? searchInput.value.trim() : '';
      renderSearchView(container, currentQuery);
    });
  });
}

