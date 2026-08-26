import { fetchAndParseFeed } from '../../../podcasts/rss.js';
import { getCachedFeeds, saveCachedFeed } from '../../../podcasts/storage.js';
import { getPodcastFeedUrls, removePodcastFeedUrl, savePodcastFeedUrl } from '../../../jellyfin/client.js';
import { switchView } from '../../views.js';
import { getTranslation } from '../../../i18n.js';
import { renderEpisodeListHtml } from './episodes.js';
import { getPlaceholder } from '../../placeholders.js';
import { setQueue } from '../../../player/queue.js';
import { playTrack } from '../../../player/audio.js';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/menu';
import '@francofantomius/material-components/search-bar';

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
        <md-button id="btn-podcast-back" variant="text" icon="arrow_back" style="align-self: flex-start; margin-bottom: 16px;">
          <span data-i18n>Back to Podcasts</span>
        </md-button>

        <div class="podcast-detail-banner">
          <img src="${feed.image || getPlaceholder('podcast')}" class="podcast-cover-lg" alt="${feed.title}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('podcast') : '${getPlaceholder('podcast')}';" data-placeholder-type="podcast">
          <div class="podcast-info-meta">
            <h1 class="podcast-title-lg">${feed.title}</h1>
            <div class="podcast-author">${feed.author}</div>
            <div class="podcast-description">${feed.description}</div>
            <div class="podcast-banner-actions">
              <span style="font-size: 13px; color: var(--text-secondary);">${feed.episodeCount || 0} ${getTranslation('Episodes')}</span>
              ${isSubscribed ? `
                <md-button id="btn-unsubscribe-show" variant="outlined" icon="delete" style="color: var(--danger); --md-sys-color-outline: rgba(241,94,108,0.5);">
                  <span data-i18n>Unsubscribe</span>
                </md-button>
              ` : `
                <md-button id="btn-subscribe-show" variant="filled" icon="add">
                  <span data-i18n>Subscribe</span>
                </md-button>
              `}
            </div>
          </div>
        </div>

        <div class="podcast-episodes-header">
          <h2 class="section-title" data-i18n>Episodes</h2>
          <div class="podcast-episodes-actions">
            <div class="episode-search-wrapper">
              <md-search-bar id="episode-search-input" size="compact" compact placeholder="Search episodes..." data-i18n-placeholder class="episode-search-bar"></md-search-bar>
            </div>
            <div class="sort-dropdown-container">
              <md-menu id="sort-episodes-menu" placement="bottom-end">
                <md-button slot="trigger" id="btn-sort-episodes" variant="tonal" icon="swap_vert" trailing-icon="expand_more" class="btn-sort-episodes" aria-label="Sort episodes">
                  <span id="current-sort-label" data-i18n>Newest First</span>
                </md-button>
                <md-menu-item icon="calendar_today" headline="${getTranslation('Newest First')}" value="newest" selected></md-menu-item>
                <md-menu-item icon="history" headline="${getTranslation('Oldest First')}" value="oldest"></md-menu-item>
                <md-menu-item icon="sort_by_alpha" headline="${getTranslation('Title (A-Z)')}" value="title-asc"></md-menu-item>
                <md-menu-item icon="sort_by_alpha" headline="${getTranslation('Title (Z-A)')}" value="title-desc"></md-menu-item>
                <md-menu-item icon="schedule" headline="${getTranslation('Longest First')}" value="duration-desc"></md-menu-item>
                <md-menu-item icon="schedule" headline="${getTranslation('Shortest First')}" value="duration-asc"></md-menu-item>
              </md-menu>
            </div>
          </div>
        </div>

        <md-chip-set id="podcast-year-pills" class="category-pills" style="margin-bottom: 16px;"></md-chip-set>

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
        let list = feed.episodes || [];
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
          <md-chip variant="filter" ${!currentYearFilter ? 'selected' : ''} icon="calendar_month" label="${getTranslation('All')}" data-year="" data-i18n-label="All"></md-chip>
          ${years.map(year => `
            <md-chip variant="filter" ${currentYearFilter === String(year) ? 'selected' : ''} icon="event" label="${year}" data-year="${year}"></md-chip>
          `).join('')}
        `;

        yearPillsContainer.querySelectorAll('md-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const year = chip.getAttribute('data-year');
            currentYearFilter = currentYearFilter === year ? '' : year;
            yearPillsContainer.querySelectorAll('md-chip').forEach(p => {
              p.selected = p.getAttribute('data-year') === currentYearFilter;
            });
            updateEpisodesList();
          });
        });
      }

      // Initial render
      updateEpisodesList();

      // Search Handler - Results displayed in search bar suggestions dropdown
      const searchInput = document.getElementById('episode-search-input');
      const handleEpisodeSearch = (val) => {
        const query = (val || '').toLowerCase().trim();
        if (!query) {
          if (searchInput) searchInput.suggestions = [];
          return;
        }
        const matches = (feed.episodes || []).filter(ep =>
          (ep.title && ep.title.toLowerCase().includes(query)) ||
          (ep.description && ep.description.toLowerCase().includes(query))
        );
        if (searchInput) {
          searchInput.suggestions = matches.slice(0, 10).map(ep => ({
            id: String(ep.id),
            label: ep.title,
            supportingText: [ep.showTitle, ep.durationFormatted].filter(Boolean).join(' • '),
            trailingSupportingText: ep.pubDate || '',
            icon: 'play_circle',
            value: ep.title,
            ep
          }));
          searchInput.show();
        }
      };

      searchInput?.addEventListener('input', (e) => {
        const val = e.detail?.value !== undefined ? e.detail.value : (e.target?.value || '');
        handleEpisodeSearch(val);
      });
      searchInput?.addEventListener('clear', () => {
        handleEpisodeSearch('');
      });
      searchInput?.addEventListener('suggestion-select', (e) => {
        const ep = e.detail?.suggestion?.ep;
        if (ep) {
          // If the episode is from a year not currently shown, reset year filter so it appears in the list
          const epYear = ep.pubDateRaw ? String(new Date(ep.pubDateRaw).getFullYear()) : '';
          if (currentYearFilter && currentYearFilter !== epYear) {
            currentYearFilter = '';
            if (yearPillsContainer) {
              yearPillsContainer.querySelectorAll('md-chip').forEach(p => {
                p.selected = p.getAttribute('data-year') === '';
              });
            }
            updateEpisodesList();
          }

          if (typeof searchInput.close === 'function') searchInput.close();

          // Scroll browser to that episode and highlight it
          requestAnimationFrame(() => {
            const targetEl = epContainer.querySelector(`.episode-item[data-episode-id="${CSS.escape(String(ep.id))}"]`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.classList.remove('highlighted-jump');
              void targetEl.offsetWidth; // trigger reflow
              targetEl.classList.add('highlighted-jump');
              setTimeout(() => {
                targetEl.classList.remove('highlighted-jump');
              }, 2500);
            }
          });
        }
      });

      // Sort Menu Handler
      const sortMenu = document.getElementById('sort-episodes-menu');
      const sortLabel = document.getElementById('current-sort-label');

      sortMenu?.addEventListener('select', (e) => {
        const sortVal = e.detail?.value || e.detail?.item?.value;
        if (sortVal) {
          currentSortMode = sortVal;
          sortMenu.querySelectorAll('md-menu-item').forEach(item => {
            item.selected = (item.getAttribute('value') === sortVal || item.value === sortVal);
          });
          if (sortLabel && sortLabels[sortVal]) {
            sortLabel.textContent = sortLabels[sortVal];
          }
          updateEpisodesList();
        }
      });
    }

  } catch (err) {
    console.error('[Podcast Detail View] Error:', err);
    container.innerHTML = `<div style="padding: 20px; color: var(--danger);">Failed to load podcast: ${err.message}</div>`;
  }
}