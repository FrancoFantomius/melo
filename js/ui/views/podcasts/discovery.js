import { searchPodcastDirectory, getPopularPodcasts } from '../../../podcasts/discovery.js';
import { savePodcastFeedUrl } from '../../../jellyfin/client.js';
import { fetchAndParseFeed } from '../../../podcasts/rss.js';
import { saveCachedFeed } from '../../../podcasts/storage.js';
import { openPodcastShow } from './list.js';
import { getTranslation } from '../../../i18n.js';
import { getPlaceholder } from '../../placeholders.js';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/search-bar';

export async function renderDiscoverTabContent(container, subscribedFeedUrls = []) {
  container.innerHTML = `
    <div class="discovery-container">
      <div class="discovery-search-wrapper">
        <md-search-bar id="discovery-search-input" size="compact" compact placeholder="Search millions of podcasts (e.g. Science, Tech, Daily, Huberman)..." data-i18n-placeholder class="discovery-search-bar"></md-search-bar>
      </div>

      <md-chip-set class="discovery-pills" id="discovery-chips">
        <md-chip variant="filter" selected icon="trending_up" label="${getTranslation('Top Charts')}" data-term="podcast" data-i18n-label="Top Charts"></md-chip>
        <md-chip variant="filter" icon="devices" label="${getTranslation('Technology')}" data-term="technology" data-i18n-label="Technology"></md-chip>
        <md-chip variant="filter" icon="newspaper" label="${getTranslation('News')}" data-term="news" data-i18n-label="News"></md-chip>
        <md-chip variant="filter" icon="science" label="${getTranslation('Science')}" data-term="science" data-i18n-label="Science"></md-chip>
        <md-chip variant="filter" icon="business_center" label="${getTranslation('Business')}" data-term="business" data-i18n-label="Business"></md-chip>
        <md-chip variant="filter" icon="theater_comedy" label="${getTranslation('Comedy')}" data-term="comedy" data-i18n-label="Comedy"></md-chip>
        <md-chip variant="filter" icon="groups" label="${getTranslation('Society')}" data-term="society" data-i18n-label="Society"></md-chip>
      </md-chip-set>

      <div id="discovery-results" class="cards-grid">
        <div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);" data-i18n>Loading popular podcasts...</div>
      </div>
    </div>
  `;

  const resultsGrid = document.getElementById('discovery-results');
  const searchInput = document.getElementById('discovery-search-input');
  const chips = container.querySelectorAll('.discovery-pills md-chip');

  let debounceTimer = null;

  async function loadTerm(term) {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = `<div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);" data-i18n>Searching directory...</div>`;
    const results = await getPopularPodcasts(term, 24);
    renderDiscoveryGrid(resultsGrid, results, subscribedFeedUrls);
  }

  // Load initial top charts
  loadTerm('podcast');

  // Search input handler - Results displayed in search bar suggestions dropdown
  const handleDiscoverySearch = (queryVal) => {
    const q = (queryVal || '').trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q) {
      if (searchInput) searchInput.suggestions = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      const results = await searchPodcastDirectory(q, 10);
      if (searchInput && (searchInput.value || '').trim() === q) {
        searchInput.suggestions = results.map(item => ({
          id: item.feedUrl,
          label: item.title,
          supportingText: item.author || '',
          trailingSupportingText: item.genre || 'Podcast',
          icon: 'podcasts',
          value: item.title,
          podcastItem: item
        }));
        searchInput.show();
      }
    }, 300);
  };

  searchInput?.addEventListener('input', (e) => {
    const q = e.detail?.value !== undefined ? e.detail.value : (e.target?.value || '');
    handleDiscoverySearch(q);
  });
  searchInput?.addEventListener('clear', () => {
    handleDiscoverySearch('');
  });
  searchInput?.addEventListener('suggestion-select', (e) => {
    const feedUrl = e.detail?.suggestion?.podcastItem?.feedUrl || e.detail?.suggestion?.id;
    if (feedUrl) {
      openPodcastShow(feedUrl);
      if (typeof searchInput.close === 'function') searchInput.close();
    }
  });

  // Genre chips handler
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => { c.selected = false; });
      chip.selected = true;
      if (searchInput) {
        searchInput.value = '';
        searchInput.suggestions = [];
      }
      const term = chip.getAttribute('data-term');
      loadTerm(term);
    });
  });
}

export function renderDiscoveryGrid(gridEl, items, subscribedUrls = []) {
  if (!items || items.length === 0) {
    gridEl.innerHTML = `<div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);" data-i18n>No podcasts found. Try another search query.</div>`;
    return;
  }

  gridEl.innerHTML = items.map((item, idx) => {
    const isSubscribed = subscribedUrls.includes(item.feedUrl);
    return `
      <div class="media-card discovery-show-card" data-feed-url="${encodeURIComponent(item.feedUrl)}">
        <img src="${item.image || getPlaceholder('podcast')}" class="card-thumb" alt="${item.title}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('podcast') : '${getPlaceholder('podcast')}';" data-placeholder-type="podcast">
        <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; padding-right: 36px;">
          <div class="card-title" title="${item.title}">${item.title}</div>
          <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.author}</div>
          <div style="font-size: 11px; color: var(--accent); margin-top: 2px;">${item.genre || 'Podcast'}</div>
        </div>
        <md-icon-button class="btn-card-subscribe" data-feed-url="${encodeURIComponent(item.feedUrl)}" data-idx="${idx}" variant="${isSubscribed ? 'tonal' : 'filled'}" icon="${isSubscribed ? 'check' : 'add'}" aria-label="${isSubscribed ? getTranslation('Subscribed') : getTranslation('Subscribe')}" title="${isSubscribed ? getTranslation('Subscribed') : getTranslation('Subscribe')}" ${isSubscribed ? 'disabled' : ''}></md-icon-button>
      </div>
    `;
  }).join('');

  gridEl.querySelectorAll('.discovery-show-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-subscribe')) return;
      const feedUrl = decodeURIComponent(card.getAttribute('data-feed-url'));
      openPodcastShow(feedUrl);
    });
  });

  gridEl.querySelectorAll('.btn-card-subscribe:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const feedUrl = decodeURIComponent(btn.getAttribute('data-feed-url'));
      btn.disabled = true;
      btn.icon = 'hourglass_empty';

      try {
        await savePodcastFeedUrl(feedUrl);
        fetchAndParseFeed(feedUrl).then(parsed => saveCachedFeed(feedUrl, parsed)).catch(() => {});
        subscribedUrls.push(feedUrl);

        btn.variant = 'tonal';
        btn.icon = 'check';
        btn.setAttribute('aria-label', getTranslation('Subscribed'));
        btn.title = getTranslation('Subscribed');
      } catch (err) {
        console.error('[Discovery] Subscribe failed:', err);
        btn.disabled = false;
        btn.icon = 'add';
      }
    });
  });
}