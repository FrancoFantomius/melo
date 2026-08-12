import { fetchAndParseFeed } from '../../../podcasts/rss.js';
import { getCachedFeeds, saveCachedFeed } from '../../../podcasts/storage.js';
import { getPodcastFeedUrls, savePodcastFeedUrl } from '../../../jellyfin/client.js';
import { openAddPodcastModal, closeAddPodcastModal } from '../../modals.js';
import { switchView } from '../../views.js';
import { renderSubscribedCarousel, renderContinuePlayingCarousel, renderLatestEpisodesGrid } from './carousels.js';
import { renderDiscoverTabContent } from './discovery.js';

let podcastFormListenerBound = false;

export function openPodcastShow(feedUrl, showObj = null) {
  if (!feedUrl) return;
  const targetUrl = `podcasts.html?podcast=${encodeURIComponent(feedUrl)}`;
  if (!window.location.pathname.endsWith('podcasts.html')) {
    window.location.href = targetUrl;
    return;
  }
  const currentSearch = window.location.search;
  if (currentSearch !== `?podcast=${encodeURIComponent(feedUrl)}`) {
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
        <button id="btn-open-add-podcast" class="btn-primary">
          <span class="material-symbols-outlined">add</span>
          <span data-i18n>Add Podcast</span>
        </button>
      </div>

      <!-- Category Filter Pills -->
      <div class="category-pills" id="podcast-category-pills">
        <button class="category-pill ${activeCategory === 'all' ? 'active' : ''}" data-category="all" data-i18n>All</button>
        <button class="category-pill ${activeCategory === 'subscribed' ? 'active' : ''}" data-category="subscribed" data-i18n>Subscribed Podcasts</button>
        <button class="category-pill ${activeCategory === 'continue' ? 'active' : ''}" data-category="continue" data-i18n>Continue Playing</button>
        <button class="category-pill ${activeCategory === 'latest' ? 'active' : ''}" data-category="latest" data-i18n>Latest Episodes</button>
        <button class="category-pill ${activeCategory === 'discover' ? 'active' : ''}" data-category="discover" data-i18n>Discover Podcasts</button>
      </div>

      <!-- Section 1: Subscribed Podcasts Carousel -->
      <section id="podcast-subscribed-section" class="podcast-view-section" data-category="subscribed">
        <div class="podcast-section-header">
          <h2 class="podcast-section-title" data-i18n>Subscribed Podcasts</h2>
          <div style="display: flex; gap: 8px;">
            <button id="carousel-prev-subscribed" class="carousel-nav-btn" title="Previous">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_left</span>
            </button>
            <button id="carousel-next-subscribed" class="carousel-nav-btn" title="Next">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_right</span>
            </button>
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
            <button id="carousel-prev-continue" class="carousel-nav-btn" title="Previous">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_left</span>
            </button>
            <button id="carousel-next-continue" class="carousel-nav-btn" title="Next">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_right</span>
            </button>
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

  // Bind Category Filter Pills
  const pillButtons = container.querySelectorAll('#podcast-category-pills .category-pill');
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

  pillButtons.forEach(pill => {
    pill.addEventListener('click', () => {
      pillButtons.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.getAttribute('data-category');
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