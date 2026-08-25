import { searchPodcastDirectory, getPopularPodcasts } from '../../../podcasts/discovery.js';
import { savePodcastFeedUrl } from '../../../jellyfin/client.js';
import { fetchAndParseFeed } from '../../../podcasts/rss.js';
import { saveCachedFeed } from '../../../podcasts/storage.js';
import { openPodcastShow } from './list.js';
import { getTranslation } from '../../../i18n.js';

export async function renderDiscoverTabContent(container, subscribedFeedUrls = []) {
  container.innerHTML = `
    <div class="discovery-container">
      <div class="discovery-search-box">
        <span class="material-symbols-outlined" style="color: var(--text-muted);">search</span>
        <input type="text" id="discovery-search-input" placeholder="Search millions of podcasts (e.g. Science, Tech, Daily, Huberman)..." data-i18n-placeholder>
      </div>

      <md-chip-set class="discovery-pills" id="discovery-chips">
        <md-chip variant="filter" selected label="${getTranslation('Top Charts')}" data-term="podcast" data-i18n-label="Top Charts"></md-chip>
        <md-chip variant="filter" label="${getTranslation('Technology')}" data-term="technology" data-i18n-label="Technology"></md-chip>
        <md-chip variant="filter" label="${getTranslation('News')}" data-term="news" data-i18n-label="News"></md-chip>
        <md-chip variant="filter" label="${getTranslation('Science')}" data-term="science" data-i18n-label="Science"></md-chip>
        <md-chip variant="filter" label="${getTranslation('Business')}" data-term="business" data-i18n-label="Business"></md-chip>
        <md-chip variant="filter" label="${getTranslation('Comedy')}" data-term="comedy" data-i18n-label="Comedy"></md-chip>
        <md-chip variant="filter" label="${getTranslation('Society')}" data-term="society" data-i18n-label="Society"></md-chip>
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

  // Search input handler
  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    chips.forEach(c => { c.selected = false; });

    debounceTimer = setTimeout(async () => {
      if (q.length > 0) {
        if (!resultsGrid) return;
        resultsGrid.innerHTML = `<div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);"><span data-i18n>Searching directory...</span> "${q}"...</div>`;
        const results = await searchPodcastDirectory(q, 24);
        renderDiscoveryGrid(resultsGrid, results, subscribedFeedUrls);
      } else {
        loadTerm('podcast');
      }
    }, 400);
  });

  // Genre chips handler
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => { c.selected = false; });
      chip.selected = true;
      if (searchInput) searchInput.value = '';
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
      <div class="media-card discovery-show-card" data-feed-url="${encodeURIComponent(item.feedUrl)}" style="position: relative;">
        <img src="${item.image}" class="card-thumb" alt="${item.title}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';">
        <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
          <div class="card-title" title="${item.title}">${item.title}</div>
          <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.author}</div>
          <div style="font-size: 11px; color: var(--accent); margin-top: 2px;">${item.genre || 'Podcast'}</div>
        </div>
        <div style="margin-top: 8px;">
          <button class="btn-subscribe ${isSubscribed ? 'subscribed' : ''}" data-feed-url="${encodeURIComponent(item.feedUrl)}" data-idx="${idx}" ${isSubscribed ? 'disabled' : ''}>
            <span class="material-symbols-outlined" style="font-size: 16px;">${isSubscribed ? 'check' : 'add'}</span>
            <span data-i18n>${isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  gridEl.querySelectorAll('.discovery-show-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-subscribe')) return;
      const feedUrl = decodeURIComponent(card.getAttribute('data-feed-url'));
      openPodcastShow(feedUrl);
    });
  });

  gridEl.querySelectorAll('.btn-subscribe:not(.subscribed)').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const feedUrl = decodeURIComponent(btn.getAttribute('data-feed-url'));
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">hourglass_empty</span><span data-i18n>Subscribing...</span>`;

      try {
        await savePodcastFeedUrl(feedUrl);
        fetchAndParseFeed(feedUrl).then(parsed => saveCachedFeed(feedUrl, parsed)).catch(() => {});
        subscribedUrls.push(feedUrl);

        btn.classList.add('subscribed');
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">check</span><span data-i18n>Subscribed</span>`;
      } catch (err) {
        console.error('[Discovery] Subscribe failed:', err);
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">add</span><span data-i18n>Subscribe</span>`;
      }
    });
  });
}