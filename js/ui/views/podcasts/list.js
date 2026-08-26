import { fetchAndParseFeed } from '../../../podcasts/rss.js';
import { getCachedFeeds, saveCachedFeed } from '../../../podcasts/storage.js';
import { getPodcastFeedUrls, savePodcastFeedUrl } from '../../../jellyfin/client.js';
import { openAddPodcastModal, closeAddPodcastModal } from '../../modals.js';
import { switchView } from '../../views.js';
import { renderSubscribedCarousel, renderContinuePlayingCarousel, renderLatestEpisodesGrid } from './carousels.js';
import { renderDiscoverTabContent } from './discovery.js';
import { getTranslation } from '../../../i18n.js';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/icon';

let podcastFormListenerBound = false;

export function openPodcastShow(feedUrl, showObj = null) {
  if (!feedUrl) return;
  const targetUrl = `podcasts.html?podcast=${encodeURIComponent(feedUrl)}`;
  const currentSearch = window.location.search;
  if (currentSearch !== `?podcast=${encodeURIComponent(feedUrl)}` || !window.location.pathname.endsWith('podcasts.html')) {
    window.history.pushState({ view: 'podcast-detail', feedUrl }, '', targetUrl);
  }
  switchView('podcast-detail', showObj || { feedUrl });
}

export function bindAddPodcastForm() {
  if (podcastFormListenerBound) return;
  const form = document.getElementById('add-podcast-form');
  if (!form) return;
  podcastFormListenerBound = true;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('podcast-rss-url');
    const errEl = document.getElementById('podcast-add-error');
    const btn = document.getElementById('btn-submit-add-podcast');
    if (!input) return;

    const url = input.value.trim();
    if (!url) return;

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (btn) btn.disabled = true;

    try {
      const feedData = await fetchAndParseFeed(url);
      saveCachedFeed(url, feedData);
      await savePodcastFeedUrl(url);

      closeAddPodcastModal();
      const contentArea = document.getElementById('view-container');
      if (contentArea) {
        renderPodcastsView(contentArea, 'all');
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = `Failed to add podcast: ${err.message || 'Invalid RSS feed'}`;
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

export async function renderPodcastsView(container, viewData = 'all') {
  bindAddPodcastForm();
  let activeCategory = typeof viewData === 'string' ? viewData : (viewData?.tab || 'all');
  if (activeCategory === 'in-progress') activeCategory = 'continue';

  container.innerHTML = `
    <div class="view-section">
      <div class="podcast-header-actions">
        <div>
          <h1 class="section-title" data-i18n>Podcasts</h1>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;" data-i18n>Stream and discover client-side podcast RSS feeds</p>
        </div>
        <md-button id="btn-open-add-podcast" variant="filled" icon="add">
          <span data-i18n>Add Podcast</span>
        </md-button>
      </div>

      <!-- Category Filter Chips -->
      <md-chip-set class="category-pills" id="podcast-category-pills">
        <md-chip variant="filter" ${activeCategory === 'all' ? 'selected' : ''} icon="grid_view" label="${getTranslation('All')}" data-category="all" data-i18n-label="All"></md-chip>
        <md-chip variant="filter" ${activeCategory === 'subscribed' ? 'selected' : ''} icon="subscriptions" label="${getTranslation('Subscribed Podcasts')}" data-category="subscribed" data-i18n-label="Subscribed Podcasts"></md-chip>
        <md-chip variant="filter" ${activeCategory === 'continue' ? 'selected' : ''} icon="history" label="${getTranslation('Continue Playing')}" data-category="continue" data-i18n-label="Continue Playing"></md-chip>
        <md-chip variant="filter" ${activeCategory === 'latest' ? 'selected' : ''} icon="new_releases" label="${getTranslation('Latest Episodes')}" data-category="latest" data-i18n-label="Latest Episodes"></md-chip>
        <md-chip variant="filter" ${activeCategory === 'discover' ? 'selected' : ''} icon="explore" label="${getTranslation('Discover Podcasts')}" data-category="discover" data-i18n-label="Discover Podcasts"></md-chip>
      </md-chip-set>

      <!-- Section 1: Subscribed Podcasts Carousel -->
      <section id="podcast-subscribed-section" class="podcast-view-section" data-category="subscribed">
        <div class="podcast-section-header">
          <h2 class="podcast-section-title" data-i18n>Subscribed Podcasts</h2>
          <div style="display: flex; gap: 8px;">
            <md-icon-button id="carousel-prev-subscribed" variant="standard" icon="chevron_left" aria-label="Previous"></md-icon-button>
            <md-icon-button id="carousel-next-subscribed" variant="standard" icon="chevron_right" aria-label="Next"></md-icon-button>
          </div>
        </div>
        <div id="podcast-subscribed-carousel" class="cards-carousel">
          <div style="color: var(--text-muted);" data-i18n>Loading subscribed podcasts...</div>
        </div>
      </section>

      <!-- Section 2: Continue Playing Carousel -->
      <section id="podcast-continue-section" class="podcast-view-section" data-category="continue">
        <div class="podcast-section-header">
          <h2 class="podcast-section-title" data-i18n>Continue Playing</h2>
          <div style="display: flex; gap: 8px;">
            <md-icon-button id="carousel-prev-continue" variant="standard" icon="chevron_left" aria-label="Previous"></md-icon-button>
            <md-icon-button id="carousel-next-continue" variant="standard" icon="chevron_right" aria-label="Next"></md-icon-button>
          </div>
        </div>
        <div id="podcast-continue-carousel" class="episodes-carousel">
          <div style="color: var(--text-muted);" data-i18n>Loading episodes in progress...</div>
        </div>
      </section>

      <!-- Section 3: Latest Episodes 2 Columns -->
      <section id="podcast-latest-section" class="podcast-view-section" data-category="latest">
        <div class="podcast-section-header">
          <h2 class="podcast-section-title" data-i18n>Latest Episodes</h2>
        </div>
        <div id="podcast-latest-grid" class="podcast-tracks-grid-2col">
          <div style="color: var(--text-muted); grid-column: 1/-1;" data-i18n>Loading latest episodes...</div>
        </div>
      </section>

      <!-- Section 4: Discover Podcasts Grid -->
      <section id="podcast-discover-section" class="podcast-view-section" data-category="discover">
        <div class="podcast-section-header">
          <h2 class="podcast-section-title" data-i18n>Discover Podcasts</h2>
        </div>
        <div id="podcast-discover-container"></div>
      </section>
    </div>
  `;

  // Bind Add Podcast Modal Button
  document.getElementById('btn-open-add-podcast')?.addEventListener('click', () => {
    openAddPodcastModal();
  });

  // Bind Category Filter Chips
  const chipButtons = container.querySelectorAll('#podcast-category-pills md-chip');
  const sections = container.querySelectorAll('.podcast-view-section');

  const updateSectionVisibility = (cat) => {
    sections.forEach(section => {
      const secCat = section.getAttribute('data-category');
      if (cat === 'all' || secCat === cat) {
        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    });
  };

  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      chipButtons.forEach(c => { c.selected = false; });
      chip.selected = true;
      const cat = chip.getAttribute('data-category');
      updateSectionVisibility(cat);
    });
  });

  // Set initial section visibility based on activeCategory
  updateSectionVisibility(activeCategory);

  // Bind Carousel navigation scroll buttons
  const subscribedCarousel = document.getElementById('podcast-subscribed-carousel');
  document.getElementById('carousel-prev-subscribed')?.addEventListener('click', () => {
    subscribedCarousel?.scrollBy({ left: -380, behavior: 'smooth' });
  });
  document.getElementById('carousel-next-subscribed')?.addEventListener('click', () => {
    subscribedCarousel?.scrollBy({ left: 380, behavior: 'smooth' });
  });

  const continueCarousel = document.getElementById('podcast-continue-carousel');
  document.getElementById('carousel-prev-continue')?.addEventListener('click', () => {
    continueCarousel?.scrollBy({ left: -380, behavior: 'smooth' });
  });
  document.getElementById('carousel-next-continue')?.addEventListener('click', () => {
    continueCarousel?.scrollBy({ left: 380, behavior: 'smooth' });
  });

  // Render Discover section grid
  const feedUrls = await getPodcastFeedUrls();
  const discoverContainer = document.getElementById('podcast-discover-container');
  if (discoverContainer) {
    renderDiscoverTabContent(discoverContainer, feedUrls);
  }

  // Helper to update all podcast sections
  const renderAllPodcastSections = (feeds) => {
    renderSubscribedCarousel(subscribedCarousel, feeds);
    renderContinuePlayingCarousel(continueCarousel, feeds);
    const latestGrid = document.getElementById('podcast-latest-grid');
    if (latestGrid) {
      renderLatestEpisodesGrid(latestGrid, feeds);
    }
  };

  // 1. Render immediately with cached feed data if available
  const cachedMap = getCachedFeeds();
  const cachedFeeds = [];
  for (const url of feedUrls) {
    if (cachedMap[url] && cachedMap[url].data) {
      cachedFeeds.push(cachedMap[url].data);
    }
  }

  if (cachedFeeds.length > 0) {
    renderAllPodcastSections(cachedFeeds);
  } else if (feedUrls.length === 0) {
    renderAllPodcastSections([]);
  }

  // 2. Fetch fresh feeds in background and re-render
  if (feedUrls.length > 0) {
    Promise.all(
      feedUrls.map(async (url) => {
        try {
          const parsed = await fetchAndParseFeed(url);
          saveCachedFeed(url, parsed);
          return parsed;
        } catch (e) {
          console.warn('[Podcast View] Feed parse error for:', url, e);
          return cachedMap[url]?.data || null;
        }
      })
    ).then(freshFeeds => {
      const valid = freshFeeds.filter(Boolean);
      renderAllPodcastSections(valid);
    });
  }
}