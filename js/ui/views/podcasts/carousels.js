import { getEpisodeState, markEpisodePlayed } from '../../../podcasts/storage.js';
import { formatSeconds } from '../../../podcasts/rss.js';
import { removePodcastFeedUrl } from '../../../jellyfin/client.js';
import { setQueue, addToQueue } from '../../../player/queue.js';
import { playTrack } from '../../../player/audio.js';
import { getTranslation } from '../../../i18n.js';
import { toggleTrackDownload, refreshDownloadButton } from '../../downloads.js';
import { openPodcastShow, renderPodcastsView } from './list.js';
import { getPlaceholder } from '../../placeholders.js';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/tooltip';
import '@francofantomius/material-components/icon';

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
      <img src="${feed.image || getPlaceholder('podcast')}" class="card-thumb" alt="${feed.title}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('podcast') : '${getPlaceholder('podcast')}';" data-placeholder-type="podcast">
      <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; padding-right: 36px;">
        <div class="card-title" title="${feed.title}">${feed.title}</div>
        <div class="card-subtitle" title="${feed.author}">${feed.author || 'Podcast'}</div>
        <div style="font-size: 11px; color: var(--accent); margin-top: 4px;">${feed.episodeCount || 0} ${getTranslation('Episodes')}</div>
      </div>
      <div style="position: absolute; top: 12px; right: 12px; display: inline-flex;">
        <md-icon-button class="btn-delete-podcast" data-feed-url="${encodeURIComponent(feed.feedUrl)}" variant="standard" icon="delete" aria-label="${getTranslation('Unsubscribe')}"></md-icon-button>
        <md-tooltip position="top" data-i18n-value="Unsubscribe" value="${getTranslation('Unsubscribe')}"></md-tooltip>
      </div>
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
    const coverImg = ep.image || feedImage || getPlaceholder('podcast');

    return `
      <div class="continue-playing-card" data-episode-id="${ep.id}">
        <div class="continue-playing-thumb-wrapper">
          <img src="${coverImg}" class="continue-playing-thumb" alt="${ep.title}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('podcast') : '${getPlaceholder('podcast')}';" data-placeholder-type="podcast">
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
    const coverImg = ep.image || ep.feedImage || getPlaceholder('podcast');
    const state = getEpisodeState(ep.id);
    const progressPct = (state.duration > 0 && state.position > 0) ? Math.min(100, Math.round((state.position / state.duration) * 100)) : 0;
    
    let badgeHtml = '';
    if (state.isPlayed) {
      badgeHtml = `<span class="episode-badge played" data-i18n>Played</span>`;
    } else if (state.position > 5) {
      badgeHtml = `<span class="episode-badge in-progress"><span data-i18n>In Progress</span> (${progressPct}%)</span>`;
    }

    const playLabel = getTranslation('Play');
    const downloadLabel = getTranslation('Download');
    const queueLabel = getTranslation('Add to Queue');

    return `
      <div class="podcast-episode-row podcast-track-row ${state.isPlayed ? 'is-played' : ''}" data-index="${idx}" data-episode-id="${ep.id}">
        <div class="podcast-episode-thumb-container">
          <img src="${coverImg}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('podcast') : '${getPlaceholder('podcast')}';" data-placeholder-type="podcast" class="podcast-episode-thumb" alt="${ep.title}">
        </div>

        <div class="podcast-episode-main">
          <div class="podcast-episode-header">
            <div class="podcast-episode-title" title="${ep.title}">${ep.title}</div>
            <div class="podcast-episode-show" title="${ep.showTitle}">${ep.showTitle || 'Podcast'}</div>
          </div>

          <div class="podcast-episode-meta-row">
            ${ep.pubDate ? `<span class="podcast-episode-date">${ep.pubDate}</span>` : ''}
            ${ep.durationFormatted ? `<span class="podcast-episode-duration">• ${ep.durationFormatted}</span>` : ''}
            ${badgeHtml}
          </div>

          ${progressPct > 0 && !state.isPlayed ? `
            <div class="episode-progress-wrapper" style="margin-top: 6px;">
              <div class="episode-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
          ` : ''}
        </div>

        <div class="podcast-episode-actions">
          <div class="action-btn-wrapper">
            <md-icon-button class="btn-episode-play" data-index="${idx}" variant="standard" icon="play_arrow" aria-label="${playLabel}"></md-icon-button>
            <md-tooltip position="top" data-i18n-value="Play" value="${playLabel}"></md-tooltip>
          </div>
          <div class="action-btn-wrapper">
            <md-icon-button class="btn-track-add-queue" data-index="${idx}" variant="standard" icon="queue_music" aria-label="${queueLabel}"></md-icon-button>
            <md-tooltip position="top" data-i18n-value="Add to Queue" value="${queueLabel}"></md-tooltip>
          </div>
          <div class="action-btn-wrapper">
            <md-icon-button class="btn-track-download" data-track-id="${ep.id}" variant="standard" icon="download" aria-label="${downloadLabel}"></md-icon-button>
            <md-tooltip position="top" data-i18n-value="Download" value="${downloadLabel}"></md-tooltip>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.podcast-episode-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-track-download') || e.target.closest('.btn-track-add-queue') || e.target.closest('.btn-episode-play') || e.target.closest('md-tooltip')) return;
      const idx = parseInt(row.getAttribute('data-index'), 10);
      const ep = latestTop[idx];
      if (ep) {
        setQueue(latestTop, idx);
        playTrack(ep);
      }
    });
  });

  container.querySelectorAll('.btn-episode-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const ep = latestTop[idx];
      if (ep) {
        setQueue(latestTop, idx);
        playTrack(ep);
      }
    });
  });

  container.querySelectorAll('.btn-track-add-queue').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const ep = latestTop[idx];
      if (ep) {
        addToQueue([ep]);
        btn.setAttribute('icon', 'check');
        setTimeout(() => {
          btn.setAttribute('icon', 'queue_music');
        }, 1200);
      }
    });
  });

  container.querySelectorAll('.btn-toggle-played').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const state = getEpisodeState(id);
      markEpisodePlayed(id, !state.isPlayed);
      renderLatestEpisodesGrid(container, feeds);
    });
  });

  container.querySelectorAll('.podcast-episode-row .btn-track-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-track-id');
      const ep = latestTop.find(x => String(x.id) === String(id)) || { id };
      toggleTrackDownload(ep, btn);
    });
    refreshDownloadButton(btn);
  });
}