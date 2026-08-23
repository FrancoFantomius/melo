import { getSession, clearSession } from '../jellyfin/session.js';
import { getUserImageUrl, searchJellyfinCached, getArtworkUrl, getFavoriteSongsCached, getSongsCached } from '../jellyfin/client.js';
import { setQueue } from '../player/queue.js';
import { playTrack } from '../player/audio.js';
import { registerTracksFavoriteStatus } from '../player/likes.js';
import { openLoginModal, openSettingsModal } from './modals.js';
import { searchPodcastDirectory } from '../podcasts/discovery.js';
import { openPodcastShow, switchView, openArtist, openAlbum, openPlaylist } from './views.js';
import { formatItemType } from './views/common.js';
import { toggleTheme, updateThemeUI } from './theme.js';
import { getRecentSearches, removeRecentSearch, clearRecentSearches, addRecentSearch } from './views/search.js';

export function initHeader() {
  const btnSyncLogin = document.getElementById('btn-sync-login');
  const accountMenu = document.getElementById('header-account-menu');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const searchBar = document.getElementById('global-search-bar');
  const searchDropdown = document.getElementById('search-dropdown-results');
  const btnAccountSignout = document.getElementById('btn-account-signout');

  // 1. Sidebar toggle logic
  if (localStorage.getItem('melo_sidebar_collapsed') === 'true') {
    document.getElementById('app-layout')?.classList.add('sidebar-collapsed');
  }

  btnToggleSidebar?.addEventListener('click', () => {
    const appLayout = document.getElementById('app-layout');
    if (appLayout) {
      const isCollapsed = appLayout.classList.toggle('sidebar-collapsed');
      localStorage.setItem('melo_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }
  });

  // 2. Search navigation handler
  function executeSearchRedirect(queryStr) {
    const query = (typeof queryStr === 'string' ? queryStr : (searchBar?.value || '')).trim();
    if (query) {
      addRecentSearch(query);
    }
    if (searchBar && typeof searchBar.close === 'function') {
      searchBar.close();
    }
    if (searchDropdown) {
      searchDropdown.style.display = 'none';
    }
    const searchUrl = query ? `search.html?q=${encodeURIComponent(query)}` : 'search.html';
    const currentSearch = window.location.search;
    if (currentSearch !== (query ? `?q=${encodeURIComponent(query)}` : '') || !window.location.pathname.endsWith('search.html')) {
      window.history.pushState({ view: 'search', q: query }, '', searchUrl);
    }
    switchView('search', query);
  }

  // 3. Render Empty Search Suggestions (Recent Searches OR Suggested Songs)
  async function renderEmptySearchSuggestions() {
    if (!searchDropdown) return;
    const currentVal = (searchBar?.value || '').trim();
    if (currentVal !== '') return;

    const recentSearches = getRecentSearches();

    if (recentSearches && recentSearches.length > 0) {
      let html = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 6px 16px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Recent Searches</span>
          <button id="btn-clear-header-recent" style="background: transparent; border: none; font-size: 11px; font-weight: 600; color: var(--accent); cursor: pointer; padding: 2px 4px; border-radius: 4px;">Clear All</button>
        </div>
      `;

      html += recentSearches.slice(0, 6).map(term => `
        <div class="search-dropdown-item search-dropdown-recent-item" data-query="${encodeURIComponent(term)}">
          <span class="material-symbols-outlined" style="font-size: 20px; color: var(--text-secondary); flex-shrink: 0;">history</span>
          <div class="search-dropdown-info">
            <div class="search-dropdown-title">${term.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
          <button class="btn-remove-header-recent" data-term="${encodeURIComponent(term)}" title="Remove" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%;">
            <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
          </button>
        </div>
      `).join('');

      searchDropdown.innerHTML = html;
      searchDropdown.style.display = 'flex';

      // Bind recent search clicks
      searchDropdown.querySelectorAll('.search-dropdown-recent-item').forEach(item => {
        item.addEventListener('click', (ev) => {
          if (ev.target.closest('.btn-remove-header-recent')) return;
          const q = decodeURIComponent(item.getAttribute('data-query') || '');
          if (searchBar) searchBar.value = q;
          executeSearchRedirect(q);
        });
      });

      // Bind remove single item
      searchDropdown.querySelectorAll('.btn-remove-header-recent').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const term = decodeURIComponent(btn.getAttribute('data-term') || '');
          removeRecentSearch(term);
          renderEmptySearchSuggestions();
        });
      });

      // Bind clear all
      searchDropdown.querySelector('#btn-clear-header-recent')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearRecentSearches();
        renderEmptySearchSuggestions();
      });
      return;
    }

    // If no recent searches: show suggested songs
    searchDropdown.innerHTML = `
      <div style="padding: 10px 16px 6px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">
        Suggested Songs
      </div>
      <div style="padding: 12px 16px; font-size: 13px; color: var(--text-secondary);">Loading suggested songs...</div>
    `;
    searchDropdown.style.display = 'flex';

    try {
      let tracks = [];
      const favsRes = await getFavoriteSongsCached().catch(() => ({ Items: [] }));
      if (favsRes?.Items && favsRes.Items.length > 0) {
        tracks = favsRes.Items.slice(0, 6);
      } else {
        const songsRes = await getSongsCached({ limit: 12, sortBy: 'PlayCount,DatePlayed,SortName', sortOrder: 'Descending' }).catch(() => ({ Items: [] }));
        tracks = (songsRes?.Items || []).slice(0, 6);
      }

      if ((searchBar?.value || '').trim() !== '') return;

      if (tracks.length === 0) {
        searchDropdown.innerHTML = `
          <div style="padding: 12px 16px; font-size: 13px; color: var(--text-secondary);">
            Type to search artists, albums, tracks, or podcasts.
          </div>
        `;
        return;
      }

      let html = `
        <div style="padding: 10px 16px 6px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">
          Suggested Songs
        </div>
      `;

      html += tracks.map((track, idx) => {
        const artwork = getArtworkUrl(track, 'Primary', 100);
        const artist = track.AlbumArtist || track.Artists?.join(', ') || track.Album || 'Unknown Artist';
        return `
          <div class="search-dropdown-item search-dropdown-suggested-track" data-track-index="${idx}">
            <img src="${artwork}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="search-dropdown-thumb" alt="${track.Name}">
            <div class="search-dropdown-info">
              <div class="search-dropdown-title">${track.Name}</div>
              <div class="search-dropdown-subtitle">${artist}</div>
            </div>
            <span class="material-symbols-outlined" style="color: var(--accent); font-size: 20px; flex-shrink: 0; margin-left: auto;">play_circle</span>
          </div>
        `;
      }).join('');

      searchDropdown.innerHTML = html;

      // Bind suggested track clicks
      searchDropdown.querySelectorAll('.search-dropdown-suggested-track').forEach(el => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const idx = parseInt(el.getAttribute('data-track-index'), 10);
          const track = tracks[idx];
          if (track) {
            registerTracksFavoriteStatus(tracks);
            setQueue(tracks, idx);
            playTrack(track);
          }
          if (searchBar && typeof searchBar.close === 'function') searchBar.close();
          searchDropdown.style.display = 'none';
        });
      });
    } catch (err) {
      console.warn('[Header] Failed to load suggested songs for search dropdown', err);
      if ((searchBar?.value || '').trim() === '') {
        searchDropdown.innerHTML = `
          <div style="padding: 12px 16px; font-size: 13px; color: var(--text-secondary);">
            Type to search artists, albums, tracks, or podcasts.
          </div>
        `;
      }
    }
  }

  searchBar?.addEventListener('search', (e) => {
    const query = e.detail?.value ?? searchBar.value;
    executeSearchRedirect(query);
  });

  searchBar?.addEventListener('clear', () => {
    renderEmptySearchSuggestions();
  });

  searchBar?.addEventListener('active-change', (e) => {
    if (e.detail?.active) {
      const query = (searchBar?.value || '').trim();
      if (query === '') {
        renderEmptySearchSuggestions();
      }
    } else {
      if (searchDropdown) searchDropdown.style.display = 'none';
    }
  });

  searchBar?.addEventListener('click', () => {
    const query = (searchBar?.value || '').trim();
    if (query === '' && searchDropdown && searchDropdown.style.display !== 'flex') {
      renderEmptySearchSuggestions();
    }
  });

  // 4. Live search suggestions underneath the search bar
  let headerSearchDebounce = null;
  searchBar?.addEventListener('input', (e) => {
    const query = (e.detail?.value ?? searchBar.value ?? '').trim();
    if (headerSearchDebounce) clearTimeout(headerSearchDebounce);

    if (query.length === 0) {
      renderEmptySearchSuggestions();
      return;
    }

    headerSearchDebounce = setTimeout(async () => {
      try {
        const session = getSession();
        const promises = [searchJellyfinCached(query)];

        if (session.searchPodcasts !== false) {
          promises.push(searchPodcastDirectory(query, 3).catch(() => []));
        }

        const [res, podcastsRes] = await Promise.all(promises);
        if (!searchDropdown) return;

        const jellyfinItems = res?.Items || [];
        const podcastItems = podcastsRes || [];

        if (jellyfinItems.length === 0 && podcastItems.length === 0) {
          searchDropdown.innerHTML = `<div style="padding: 12px 16px; font-size: 13px; color: var(--text-secondary);">No results found for "${query}"</div>`;
          searchDropdown.style.display = 'flex';
          return;
        }

        const topItems = jellyfinItems.slice(0, 5);
        let itemsHTML = topItems.map(item => {
          const typeStr = item.Type || 'Media';
          const isArtist = typeStr === 'MusicArtist' || typeStr === 'Artist';
          const thumbClass = isArtist ? 'search-dropdown-thumb artist' : 'search-dropdown-thumb';
          const artwork = getArtworkUrl(item, 'Primary', 100);
          const subtitle = isArtist ? 'Artist' : (item.AlbumArtist || item.Artists?.join(', ') || item.Album || '');

          return `
            <div class="search-dropdown-item" data-item-id="${item.Id}" data-item-type="${typeStr}">
              <img src="${artwork}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="${thumbClass}" alt="${item.Name}">
              <div class="search-dropdown-info">
                <div class="search-dropdown-title">${item.Name}</div>
                <div class="search-dropdown-subtitle">${subtitle}</div>
              </div>
              <span class="search-dropdown-type">${formatItemType(typeStr)}</span>
            </div>
          `;
        }).join('');

        if (podcastItems.length > 0) {
          itemsHTML += podcastItems.slice(0, 2).map(pod => `
            <div class="search-dropdown-item" data-feed-url="${encodeURIComponent(pod.feedUrl)}" data-item-type="Podcast">
              <img src="${pod.image || './img/icons/icon.svg'}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="search-dropdown-thumb" alt="${pod.title}">
              <div class="search-dropdown-info">
                <div class="search-dropdown-title">${pod.title}</div>
                <div class="search-dropdown-subtitle">${pod.author || 'Podcast'}</div>
              </div>
              <span class="search-dropdown-type" style="color: var(--accent);">Podcast</span>
            </div>
          `).join('');
        }

        itemsHTML += `
          <div class="search-dropdown-view-all" id="btn-search-dropdown-all">
            View all results for "${query}"
          </div>
        `;

        searchDropdown.innerHTML = itemsHTML;
        searchDropdown.style.display = 'flex';

        // Bind dropdown item clicks
        searchDropdown.querySelectorAll('.search-dropdown-item').forEach(el => {
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const itemId = el.getAttribute('data-item-id');
            const itemType = el.getAttribute('data-item-type');
            const feedUrl = el.getAttribute('data-feed-url');
            if (searchBar && typeof searchBar.close === 'function') searchBar.close();
            searchDropdown.style.display = 'none';

            if (itemType === 'Podcast' && feedUrl) {
              openPodcastShow(decodeURIComponent(feedUrl));
            } else if (itemType === 'MusicArtist' || itemType === 'Artist') {
              openArtist(itemId);
            } else if (itemType === 'MusicAlbum' || itemType === 'Album') {
              openAlbum(itemId);
            } else if (itemType === 'Playlist') {
              openPlaylist(itemId);
            } else {
              executeSearchRedirect(query);
            }
          });
        });

        document.getElementById('btn-search-dropdown-all')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          executeSearchRedirect(query);
        });
      } catch (err) {
        console.warn('[Header] Quick search error:', err);
      }
    }, 250);
  });

  const handleOutsideSearchClick = (e) => {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    const isInsideSearch = path.some(el => el === searchBar || el === searchDropdown);
    if (!isInsideSearch) {
      if (searchBar) {
        if (typeof searchBar.close === 'function') searchBar.close();
        searchBar.active = false;
        searchBar.removeAttribute('active');
        searchBar.inputElement?.blur();
        if (document.activeElement === searchBar || searchBar.shadowRoot?.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }
      if (searchDropdown) {
        searchDropdown.style.display = 'none';
      }
    }
  };

  document.addEventListener('click', handleOutsideSearchClick);

  // 4. Trigger login modal
  btnSyncLogin?.addEventListener('click', () => openLoginModal());

  // 5. Account menu actions
  accountMenu?.addEventListener('open', () => accountMenu.shadowRoot?.querySelector('.manage-btn md-icon')?.setAttribute('name', 'settings'));

  accountMenu?.addEventListener('manage-click', (e) => {
    e.preventDefault();
    if (typeof accountMenu.close === 'function') accountMenu.close();
    openSettingsModal();
  });

  accountMenu?.addEventListener('edit-avatar', () => {
    const session = getSession();
    if (session?.serverUrl) {
      const serverUrl = session.serverUrl.replace(/\/+$/, '');
      if (typeof accountMenu.close === 'function') accountMenu.close();
      window.open(`${serverUrl}/web/index.html#/mypreferencesmenu`, '_blank');
    }
  });

  accountMenu?.addEventListener('sign-out', () => {
    clearSession();
    if (typeof accountMenu.close === 'function') accountMenu.close();
    updateHeaderUI();
    window.location.reload();
  });

  btnAccountSignout?.addEventListener('click', () => {
    clearSession();
    if (accountMenu && typeof accountMenu.close === 'function') accountMenu.close();
    updateHeaderUI();
    window.location.reload();
  });

  // 6. Theme trigger
  btnThemeToggle?.addEventListener('click', () => toggleTheme());

  updateHeaderUI();
}

export function updateHeaderUI() {
  updateThemeUI();
  const session = getSession();
  const btnSyncLogin = document.getElementById('btn-sync-login');
  const accountMenu = document.getElementById('header-account-menu');

  if (session.isLoggedIn && session.serverUrl && session.accessToken) {
    if (btnSyncLogin) btnSyncLogin.style.display = 'none';
    if (accountMenu) {
      accountMenu.style.display = 'inline-block';
      accountMenu.name = session.username || 'Jellyfin User';
      accountMenu.email = session.serverUrl || '';
      accountMenu.initials = (session.username || 'J')[0].toUpperCase();

      const avatarUrl = getUserImageUrl();
      accountMenu.avatar = avatarUrl || '';
      accountMenu.showTabs = false;
      accountMenu.manageText = 'Settings';
    }
  } else {
    if (btnSyncLogin) btnSyncLogin.style.display = 'inline-flex';
    if (accountMenu) accountMenu.style.display = 'none';
  }
}

