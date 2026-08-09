import { getSession, clearSession } from '../jellyfin/session.js';
import { getUserImageUrl, searchJellyfinCached, getArtworkUrl } from '../jellyfin/client.js';
import { openLoginModal, openSettingsModal } from './modals.js';
import { searchPodcastDirectory } from '../podcasts/discovery.js';
import { openPodcastShow, switchView } from './views.js';
import { toggleTheme, updateThemeUI } from './theme.js';
import { addRecentSearch } from './views/search.js';

export function initHeader() {
  const btnSyncLogin = document.getElementById('btn-sync-login');
  const btnSyncProfile = document.getElementById('btn-sync-profile');
  const accountDropdown = document.getElementById('account-dropdown');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnSettingsOpen = document.getElementById('btn-settings-open');
  const btnDropdownSettings = document.getElementById('btn-dropdown-settings');
  const btnDropdownSignout = document.getElementById('btn-dropdown-signout');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const searchInput = document.getElementById('global-search-input');
  const btnSearchSubmit = document.getElementById('btn-search-submit');
  const searchDropdown = document.getElementById('search-dropdown-results');

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
  function executeSearchRedirect() {
    const query = searchInput?.value?.trim();
    if (query) {
      addRecentSearch(query);
      if (searchDropdown) searchDropdown.style.display = 'none';
      const searchUrl = `search.html?q=${encodeURIComponent(query)}`;
      if (window.location.pathname.endsWith('search.html')) {
        window.history.pushState(null, '', searchUrl);
        const viewContainer = document.getElementById('view-container');
        if (viewContainer) {
          switchView('search', query);
        }
      } else {
        window.location.href = searchUrl;
      }
    }
  }

  btnSearchSubmit?.addEventListener('click', executeSearchRedirect);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearchRedirect();
    }
  });

  // 3. Live search dropdown results underneath the search bar
  let headerSearchDebounce = null;
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (headerSearchDebounce) clearTimeout(headerSearchDebounce);

    if (query.length === 0) {
      if (searchDropdown) searchDropdown.style.display = 'none';
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
              <span class="search-dropdown-type">${typeStr === 'Audio' ? 'Track' : typeStr}</span>
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
          el.addEventListener('click', () => {
            const itemId = el.getAttribute('data-item-id');
            const itemType = el.getAttribute('data-item-type');
            const feedUrl = el.getAttribute('data-feed-url');
            searchDropdown.style.display = 'none';

            if (itemType === 'Podcast' && feedUrl) {
              openPodcastShow(decodeURIComponent(feedUrl));
            } else if (itemType === 'MusicArtist' || itemType === 'Artist') {
              window.location.href = `artists.html?artist=${encodeURIComponent(itemId)}`;
            } else if (itemType === 'MusicAlbum' || itemType === 'Album' || itemType === 'Playlist') {
              window.location.href = `albums.html?album=${encodeURIComponent(itemId)}`;
            } else {
              window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            }
          });
        });

        document.getElementById('btn-search-dropdown-all')?.addEventListener('click', () => {
          executeSearchRedirect();
        });
      } catch (err) {
        console.warn('[Header] Quick search error:', err);
      }
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (searchDropdown && !searchDropdown.contains(e.target) && e.target !== searchInput && e.target !== btnSearchSubmit) {
      searchDropdown.style.display = 'none';
    }
  });

  // 4. Trigger login modal
  btnSyncLogin?.addEventListener('click', () => openLoginModal());

  // 5. Toggle account dropdown
  btnSyncProfile?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (accountDropdown) {
      accountDropdown.style.display = accountDropdown.style.display === 'none' ? 'flex' : 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (accountDropdown && !accountDropdown.contains(e.target) && e.target !== btnSyncProfile) {
      accountDropdown.style.display = 'none';
    }
  });

  // 6. Settings & Theme triggers
  btnThemeToggle?.addEventListener('click', () => toggleTheme());
  btnSettingsOpen?.addEventListener('click', () => openSettingsModal());
  btnDropdownSettings?.addEventListener('click', () => {
    if (accountDropdown) accountDropdown.style.display = 'none';
    openSettingsModal();
  });

  const btnDropdownTerms = document.getElementById('btn-dropdown-terms');
  const btnDropdownPrivacy = document.getElementById('btn-dropdown-privacy');
  btnDropdownTerms?.addEventListener('click', () => {
    if (accountDropdown) accountDropdown.style.display = 'none';
  });
  btnDropdownPrivacy?.addEventListener('click', () => {
    if (accountDropdown) accountDropdown.style.display = 'none';
  });

  // 7. Sign out action
  btnDropdownSignout?.addEventListener('click', () => {
    clearSession();
    if (accountDropdown) accountDropdown.style.display = 'none';
    updateHeaderUI();
    window.location.reload();
  });

  updateHeaderUI();
}

export function updateHeaderUI() {
  updateThemeUI();
  const session = getSession();
  const btnSyncLogin = document.getElementById('btn-sync-login');
  const btnSyncProfile = document.getElementById('btn-sync-profile');
  const dropdownEmail = document.getElementById('account-dropdown-email');
  const dropdownUsername = document.getElementById('dropdown-profile-username');
  const headerImg = document.getElementById('header-profile-img');
  const headerLetter = document.getElementById('header-profile-letter');
  const dropdownImg = document.getElementById('dropdown-profile-img');
  const dropdownIcon = document.getElementById('dropdown-profile-icon');

  if (session.isLoggedIn && session.serverUrl && session.accessToken) {
    if (btnSyncLogin) btnSyncLogin.style.display = 'none';
    if (btnSyncProfile) btnSyncProfile.style.display = 'flex';

    if (dropdownEmail) dropdownEmail.textContent = session.serverUrl;
    if (dropdownUsername) dropdownUsername.textContent = session.username || 'Jellyfin User';

    const avatarUrl = getUserImageUrl();
    if (avatarUrl) {
      if (headerImg) {
        headerImg.src = avatarUrl;
        headerImg.style.display = 'block';
      }
      if (headerLetter) {
        headerLetter.style.display = 'none';
        headerLetter.textContent = (session.username || 'J')[0].toUpperCase();
      }
      if (dropdownImg) {
        dropdownImg.src = avatarUrl;
        dropdownImg.style.display = 'block';
      }
      if (dropdownIcon) {
        dropdownIcon.style.display = 'none';
      }
    } else {
      if (headerImg) headerImg.style.display = 'none';
      if (headerLetter) {
        headerLetter.style.display = 'block';
        headerLetter.textContent = (session.username || 'J')[0].toUpperCase();
      }
      if (dropdownImg) dropdownImg.style.display = 'none';
      if (dropdownIcon) dropdownIcon.style.display = 'inline-block';
    }
  } else {
    if (btnSyncLogin) btnSyncLogin.style.display = 'inline-flex';
    if (btnSyncProfile) btnSyncProfile.style.display = 'none';
  }
}
