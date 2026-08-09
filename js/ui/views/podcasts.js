import { fetchAndParseFeed, formatSeconds } from '../../podcasts/rss.js';
import { getEpisodeState, markEpisodePlayed, getCachedFeeds, saveCachedFeed } from '../../podcasts/storage.js';
import { getPodcastFeedUrls, savePodcastFeedUrl, removePodcastFeedUrl } from '../../jellyfin/client.js';
import { openAddPodcastModal, closeAddPodcastModal } from '../modals.js';
import { searchPodcastDirectory, getPopularPodcasts } from '../../podcasts/discovery.js';
import { setQueue } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { switchView } from '../views.js';
import { getTranslation } from '../../i18n.js';

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

export function renderSubscribedCarousel(container, feeds) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px 24px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 13px; width: 100%;" data-i18n>
        No podcasts subscribed yet. Search or browse the Discover section below to subscribe!
      </div>
    `;
    return;
  }

  container.innerHTML = feeds.map(feed => `
    <div class="media-card podcast-show-card" data-feed-url="${encodeURIComponent(feed.feedUrl)}">
      <img src="${feed.image || './img/icons/icon.svg'}" class="card-thumb" alt="${feed.title}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';">
      <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
        <div class="card-title" title="${feed.title}">${feed.title}</div>
        <div class="card-subtitle" title="${feed.author}">${feed.author || 'Podcast'}</div>
        <div style="font-size: 11px; color: var(--accent); margin-top: 4px;">${feed.episodeCount || 0} ${getTranslation('Episodes')}</div>
      </div>
      <button class="btn-icon btn-delete-podcast" data-feed-url="${encodeURIComponent(feed.feedUrl)}" title="Unsubscribe" data-i18n-title style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;">
        <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.podcast-show-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-podcast')) return;
      const url = decodeURIComponent(card.getAttribute('data-feed-url'));
      openPodcastShow(url);
    });
  });

  container.querySelectorAll('.btn-delete-podcast').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = decodeURIComponent(btn.getAttribute('data-feed-url'));
      if (confirm(getTranslation('Unsubscribe from this podcast?'))) {
        await removePodcastFeedUrl(url);
        const viewContainer = document.getElementById('view-container');
        if (viewContainer) renderPodcastsView(viewContainer, 'all');
      }
    });
  });
}

export function renderContinuePlayingCarousel(container, feeds) {
  if (!container) return;

  const inProgressEpisodes = [];
  if (feeds) {
    feeds.forEach(feed => {
      if (feed.episodes) {
        feed.episodes.forEach(ep => {
          const state = getEpisodeState(ep.id);
          if (state.position > 5 && !state.isPlayed) {
            inProgressEpisodes.push({ ep, state, feedImage: feed.image });
          }
        });
      }
    });
  }

  inProgressEpisodes.sort((a, b) => (b.state.lastUpdated || 0) - (a.state.lastUpdated || 0));

  if (inProgressEpisodes.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px 24px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 13px; width: 100%;" data-i18n>
        No episodes in progress. Play any podcast episode to resume listening here anytime!
      </div>
    `;
    return;
  }

  container.innerHTML = inProgressEpisodes.map(({ ep, state, feedImage }) => {
    const duration = state.duration || ep.duration || 1;
    const progressPct = Math.min(100, Math.round((state.position / duration) * 100));
    const remainingSec = Math.max(0, duration - state.position);
    const remainingFormatted = formatSeconds(remainingSec);
    const coverImg = ep.image || feedImage || './img/icons/icon.svg';

    return `
      <div class="continue-playing-card" data-episode-id="${ep.id}">
        <div class="continue-playing-thumb-wrapper">
          <img src="${coverImg}" class="continue-playing-thumb" alt="${ep.title}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';">
          <div class="continue-playing-play-btn" title="Resume Episode">
            <span class="material-symbols-outlined" style="font-size: 24px;">play_arrow</span>
          </div>
        </div>
        <div class="continue-playing-info">
          <div class="continue-playing-title" title="${ep.title}">${ep.title}</div>
          <div class="continue-playing-show" title="${ep.showTitle}">${ep.showTitle}</div>
          <div class="episode-progress-wrapper" style="margin-top: 4px;">
            <div class="episode-progress-fill" style="width: ${progressPct}%;"></div>
          </div>
          <div class="continue-playing-meta">
            <span>${progressPct}% ${getTranslation('listened')}</span>
            <span>${remainingFormatted} ${getTranslation('left')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.continue-playing-card').forEach((card, idx) => {
    card.addEventListener('click', () => {
      const item = inProgressEpisodes[idx];
      if (item && item.ep) {
        setQueue([item.ep], 0);
        playTrack(item.ep);
      }
    });
  });
}

export function renderLatestEpisodesGrid(container, feeds) {
  if (!container) return;

  const allEpisodes = [];
  if (feeds) {
    feeds.forEach(feed => {
      if (feed.episodes) {
        feed.episodes.forEach(ep => {
          allEpisodes.push({ ...ep, feedImage: feed.image });
        });
      }
    });
  }

  allEpisodes.sort((a, b) => (b.pubDateRaw || 0) - (a.pubDateRaw || 0));
  const latestTop = allEpisodes.slice(0, 10);

  if (latestTop.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px 24px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 13px; grid-column: 1/-1;" data-i18n>
        No podcast episodes found. Subscribe to podcast feeds to see the latest episodes here!
      </div>
    `;
    return;
  }

  container.innerHTML = latestTop.map((ep, idx) => {
    const coverImg = ep.image || ep.feedImage || './img/icons/icon.svg';
    return `
      <div class="track-row podcast-track-row" data-index="${idx}">
        <span class="track-num">${idx + 1}</span>
        <div class="track-info">
          <img src="${coverImg}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="track-cover" alt="Cover">
        </div>
        <div style="overflow: hidden;">
          <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ep.title}">${ep.title}</div>
          <div style="font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ep.showTitle}">${ep.showTitle || 'Podcast'}</div>
        </div>
        <div style="color: var(--text-secondary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ep.pubDate || ''}</div>
        <div style="color: var(--text-muted); font-size: 12px; text-align: right;">${ep.durationFormatted || ''}</div>
        <div style="text-align: right; color: var(--text-muted); display: flex; align-items: center; justify-content: flex-end;">
          <span class="material-symbols-outlined" style="font-size: 20px;">play_circle</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.podcast-track-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.getAttribute('data-index'), 10);
      const ep = latestTop[idx];
      if (ep) {
        setQueue(latestTop, idx);
        playTrack(ep);
      }
    });
  });
}

export function renderEpisodeListHtml(container, episodes, is2Col = false) {
  if (!episodes || episodes.length === 0) {
    container.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-secondary); grid-column: 1/-1;" data-i18n>No episodes found.</div>`;
    return;
  }

  const itemsHtml = episodes.map((ep, idx) => {
    const state = getEpisodeState(ep.id);
    const progressPct = (state.duration > 0 && state.position > 0) ? Math.min(100, Math.round((state.position / state.duration) * 100)) : 0;
    let badgeHtml = '';

    if (state.isPlayed) {
      badgeHtml = `<span class="episode-badge played" title="Completed" data-i18n>Played</span>`;
    } else if (state.position > 5) {
      badgeHtml = `<span class="episode-badge in-progress" title="${Math.floor(state.position/60)}m listened"><span data-i18n>In Progress</span> (${progressPct}%)</span>`;
    }

    const uniqueNoteId = `notes-${Math.random().toString(36).substr(2, 9)}-${idx}`;

    return `
      <div class="episode-item" data-episode-id="${ep.id}" data-index="${idx}">
        <div class="episode-main-row">
          <button class="episode-play-btn" data-index="${idx}" title="Play Episode">
            <span class="material-symbols-outlined">play_arrow</span>
          </button>
          <div class="episode-details">
            <div class="episode-title" title="${ep.title}">${ep.title}</div>
            <div class="episode-meta-bar">
              <span title="${ep.showTitle || ''}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${ep.showTitle || ''}</span>
              ${ep.pubDate ? `<span>• ${ep.pubDate}</span>` : ''}
              ${ep.durationFormatted ? `<span>• ${ep.durationFormatted}</span>` : ''}
              ${badgeHtml}
              <button class="btn-toggle-notes" data-note-target="${uniqueNoteId}" style="background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer; margin-left: auto; flex-shrink: 0;" data-i18n>Show Notes</button>
              <button class="btn-toggle-played" data-id="${ep.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; flex-shrink: 0;" title="Toggle Played State">
                <span class="material-symbols-outlined" style="font-size: 18px;">${state.isPlayed ? 'check_circle' : 'radio_button_unchecked'}</span>
              </button>
            </div>
          </div>
        </div>

        ${progressPct > 0 && !state.isPlayed ? `
          <div class="episode-progress-wrapper">
            <div class="episode-progress-fill" style="width: ${progressPct}%;"></div>
          </div>
        ` : ''}

        <div class="episode-show-notes" id="${uniqueNoteId}">
          ${ep.description || 'No show notes available for this episode.'}
        </div>
      </div>
    `;
  }).join('');

  if (is2Col) {
    container.innerHTML = itemsHtml;
  } else {
    container.innerHTML = `<div class="episode-list">${itemsHtml}</div>`;
  }

  container.querySelectorAll('.episode-play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'), 10);
      const ep = episodes[index];
      if (ep) {
        setQueue(episodes, index);
        playTrack(ep);
      }
    });
  });

  container.querySelectorAll('.btn-toggle-notes').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteTarget = btn.getAttribute('data-note-target');
      const notesEl = document.getElementById(noteTarget);
      if (notesEl) {
        const isExpanded = notesEl.classList.contains('expanded');
        notesEl.classList.toggle('expanded');
        btn.textContent = isExpanded ? getTranslation('Show Notes') : getTranslation('Hide Notes');
      }
    });
  });

  container.querySelectorAll('.btn-toggle-played').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const state = getEpisodeState(id);
      markEpisodePlayed(id, !state.isPlayed);
      renderEpisodeListHtml(container, episodes, is2Col);
    });
  });
}

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

export async function renderDiscoverTabContent(container, subscribedFeedUrls = []) {
  container.innerHTML = `
    <div class="discovery-container">
      <div class="discovery-search-box">
        <span class="material-symbols-outlined" style="color: var(--text-muted);">search</span>
        <input type="text" id="discovery-search-input" placeholder="Search millions of podcasts (e.g. Science, Tech, Daily, Huberman)..." data-i18n-placeholder>
      </div>

      <div class="discovery-pills">
        <button class="discovery-pill active" data-term="podcast" data-i18n>Top Charts</button>
        <button class="discovery-pill" data-term="technology" data-i18n>Technology</button>
        <button class="discovery-pill" data-term="news" data-i18n>News</button>
        <button class="discovery-pill" data-term="science" data-i18n>Science</button>
        <button class="discovery-pill" data-term="business" data-i18n>Business</button>
        <button class="discovery-pill" data-term="comedy" data-i18n>Comedy</button>
        <button class="discovery-pill" data-term="society" data-i18n>Society</button>
      </div>

      <div id="discovery-results" class="cards-grid">
        <div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);" data-i18n>Loading popular podcasts...</div>
      </div>
    </div>
  `;

  const resultsGrid = document.getElementById('discovery-results');
  const searchInput = document.getElementById('discovery-search-input');
  const pills = container.querySelectorAll('.discovery-pill');

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
    pills.forEach(p => p.classList.remove('active'));

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

  // Genre pills handler
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (searchInput) searchInput.value = '';
      const term = pill.getAttribute('data-term');
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
