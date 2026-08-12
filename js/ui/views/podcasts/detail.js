import { fetchAndParseFeed } from '../../../podcasts/rss.js';
import { getCachedFeeds, saveCachedFeed } from '../../../podcasts/storage.js';
import { getPodcastFeedUrls, removePodcastFeedUrl, savePodcastFeedUrl } from '../../../jellyfin/client.js';
import { switchView } from '../../views.js';
import { getTranslation } from '../../../i18n.js';
import { renderEpisodeListHtml } from './episodes.js';

export async function renderPodcastDetailView(container, viewData) {
  const feedUrl = typeof viewData === 'string' ? viewData : viewData?.feedUrl;
  if (!feedUrl) {
    container.innerHTML = `<div style="padding: 20px; color: var(--danger);">Invalid Podcast URL</div>`;
    return;
  }

  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--text-secondary);" data-i18n>
      Loading podcast show...
    </div>
  `;

  try {
    const cachedMap = getCachedFeeds();
    let feed = cachedMap[feedUrl]?.data;
    if (!feed) {
      feed = await fetchAndParseFeed(feedUrl);
      saveCachedFeed(feedUrl, feed);
    } else {
      fetchAndParseFeed(feedUrl).then(fresh => {
        saveCachedFeed(feedUrl, fresh);
      }).catch(() => {});
    }

    const subscribedUrls = await getPodcastFeedUrls();
    let isSubscribed = subscribedUrls.includes(feedUrl);

    container.innerHTML = `
      <div class="view-section">
        <button id="btn-podcast-back" class="btn-secondary" style="align-self: flex-start; margin-bottom: 16px;">
          <span class="material-symbols-outlined">arrow_back</span>
          <span data-i18n>Back to Podcasts</span>
        </button>

        <div class="podcast-detail-banner">
          <img src="${feed.image || './img/icons/icon.svg'}" class="podcast-cover-lg" alt="${feed.title}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';">
          <div class="podcast-info-meta">
            <h1 class="podcast-title-lg">${feed.title}</h1>
            <div class="podcast-author">${feed.author}</div>
            <div class="podcast-description">${feed.description}</div>
            <div class="podcast-banner-actions">
              <span style="font-size: 13px; color: var(--text-secondary);">${feed.episodeCount || 0} ${getTranslation('Episodes')}</span>
              ${isSubscribed ? `
                <button id="btn-unsubscribe-show" class="btn-secondary" style="color: var(--danger); border-color: rgba(241,94,108,0.3);">
                  <span class="material-symbols-outlined">delete</span>
                  <span data-i18n>Unsubscribe</span>
                </button>
              ` : `
                <button id="btn-subscribe-show" class="btn-primary">
                  <span class="material-symbols-outlined">add</span>
                  <span data-i18n>Subscribe</span>
                </button>
              `}
            </div>
          </div>
        </div>

        <div class="podcast-episodes-header">
          <h2 class="section-title" data-i18n>Episodes</h2>
          <div class="podcast-episodes-actions">
            <input type="text" id="episode-search-input" class="episode-search-input" placeholder="Search episodes..." data-i18n-placeholder>
            <div class="sort-dropdown-container">
              <button id="btn-sort-episodes" class="btn-secondary btn-sort-episodes" aria-label="Sort episodes">
                <span class="material-symbols-outlined">swap_vert</span>
                <span id="current-sort-label" data-i18n>Newest First</span>
                <span class="material-symbols-outlined" style="font-size: 18px;">expand_more</span>
              </button>
              <div id="sort-episodes-menu" class="sort-dropdown-menu" style="display: none;">
                <div class="sort-dropdown-item active" data-sort="newest">
                  <span class="material-symbols-outlined">calendar_today</span>
                  <span data-i18n>Newest First</span>
                </div>
                <div class="sort-dropdown-item" data-sort="oldest">
                  <span class="material-symbols-outlined">history</span>
                  <span data-i18n>Oldest First</span>
                </div>
                <div class="sort-dropdown-item" data-sort="title-asc">
                  <span class="material-symbols-outlined">sort_by_alpha</span>
                  <span data-i18n>Title (A-Z)</span>
                </div>
                <div class="sort-dropdown-item" data-sort="title-desc">
                  <span class="material-symbols-outlined">sort_by_alpha</span>
                  <span data-i18n>Title (Z-A)</span>
                </div>
                <div class="sort-dropdown-item" data-sort="duration-desc">
                  <span class="material-symbols-outlined">schedule</span>
                  <span data-i18n>Longest First</span>
                </div>
                <div class="sort-dropdown-item" data-sort="duration-asc">
                  <span class="material-symbols-outlined">schedule</span>
                  <span data-i18n>Shortest First</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="podcast-year-pills" class="category-pills" style="margin-bottom: 16px;"></div>

        <div id="podcast-episodes-container"></div>
      </div>
    `;

    document.getElementById('btn-podcast-back')?.addEventListener('click', () => {
      window.history.pushState({ view: 'podcasts' }, '', 'podcasts.html');
      switchView('podcasts');
    });

    document.getElementById('btn-unsubscribe-show')?.addEventListener('click', async () => {
      if (confirm(getTranslation('Unsubscribe from this podcast?'))) {
        await removePodcastFeedUrl(feedUrl);
        renderPodcastDetailView(container, viewData);
      }
    });

    document.getElementById('btn-subscribe-show')?.addEventListener('click', async () => {
      await savePodcastFeedUrl(feedUrl);
      renderPodcastDetailView(container, viewData);
    });

    const epContainer = document.getElementById('podcast-episodes-container');
    if (epContainer && feed.episodes) {
      let currentSortMode = 'newest';
      let currentSearchQuery = '';
      let currentYearFilter = '';

      const sortLabels = {
        'newest': getTranslation('Newest First'),
        'oldest': getTranslation('Oldest First'),
        'title-asc': getTranslation('Title (A-Z)'),
        'title-desc': getTranslation('Title (Z-A)'),
        'duration-desc': getTranslation('Longest First'),
        'duration-asc': getTranslation('Shortest First')
      };

      const updateEpisodesList = () => {
        let list = feed.episodes;
        if (currentSearchQuery) {
          list = list.filter(ep => ep.title.toLowerCase().includes(currentSearchQuery) || ep.description.toLowerCase().includes(currentSearchQuery));
        }
        if (currentYearFilter) {
          list = list.filter(ep => ep.pubDateRaw && String(new Date(ep.pubDateRaw).getFullYear()) === currentYearFilter);
        }

        list = [...list];
        list.sort((a, b) => {
          if (currentSortMode === 'newest') {
            return (b.pubDateRaw || 0) - (a.pubDateRaw || 0);
          } else if (currentSortMode === 'oldest') {
            return (a.pubDateRaw || 0) - (b.pubDateRaw || 0);
          } else if (currentSortMode === 'title-asc') {
            return a.title.localeCompare(b.title);
          } else if (currentSortMode === 'title-desc') {
            return b.title.localeCompare(a.title);
          } else if (currentSortMode === 'duration-desc') {
            return (b.duration || 0) - (a.duration || 0);
          } else if (currentSortMode === 'duration-asc') {
            return (a.duration || 0) - (b.duration || 0);
          }
          return 0;
        });

        renderEpisodeListHtml(epContainer, list);
      };

      const yearPillsContainer = document.getElementById('podcast-year-pills');
      if (yearPillsContainer) {
        const years = [...new Set((feed.episodes || [])
          .map(ep => ep.pubDateRaw ? new Date(ep.pubDateRaw).getFullYear() : null)
          .filter(Boolean))]
          .sort((a, b) => b - a);

        yearPillsContainer.innerHTML = `
          <button class="category-pill ${!currentYearFilter ? 'active' : ''}" data-year="">${getTranslation('All')}</button>
          ${years.map(year => `
            <button class="category-pill ${currentYearFilter === String(year) ? 'active' : ''}" data-year="${year}">${year}</button>
          `).join('')}
        `;

        yearPillsContainer.querySelectorAll('.category-pill').forEach(pill => {
          pill.addEventListener('click', () => {
            const year = pill.getAttribute('data-year');
            currentYearFilter = currentYearFilter === year ? '' : year;
            yearPillsContainer.querySelectorAll('.category-pill').forEach(p => {
              p.classList.toggle('active', p.getAttribute('data-year') === currentYearFilter);
            });
            updateEpisodesList();
          });
        });
      }

      // Initial render
      updateEpisodesList();

      // Search Handler
      const searchInput = document.getElementById('episode-search-input');
      searchInput?.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        updateEpisodesList();
      });

      // Sort Menu Handler
      const btnSort = document.getElementById('btn-sort-episodes');
      const sortMenu = document.getElementById('sort-episodes-menu');
      const sortLabel = document.getElementById('current-sort-label');

      btnSort?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sortMenu) {
          const isVisible = sortMenu.style.display !== 'none';
          sortMenu.style.display = isVisible ? 'none' : 'flex';
        }
      });

      sortMenu?.querySelectorAll('.sort-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const sortVal = item.getAttribute('data-sort');
          if (sortVal) {
            currentSortMode = sortVal;
            sortMenu.querySelectorAll('.sort-dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (sortLabel && sortLabels[sortVal]) {
              sortLabel.textContent = sortLabels[sortVal];
            }
            sortMenu.style.display = 'none';
            updateEpisodesList();
          }
        });
      });

      const closeMenuOnClickOutside = (e) => {
        if (sortMenu && sortMenu.style.display !== 'none' && !sortMenu.contains(e.target) && !btnSort?.contains(e.target)) {
          sortMenu.style.display = 'none';
        }
      };

      document.addEventListener('click', closeMenuOnClickOutside);
    }

  } catch (err) {
    console.error('[Podcast Detail View] Error:', err);
    container.innerHTML = `<div style="padding: 20px; color: var(--danger);">Failed to load podcast: ${err.message}</div>`;
  }
}