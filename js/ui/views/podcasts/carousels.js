import { getEpisodeState } from '../../../podcasts/storage.js';
import { formatSeconds } from '../../../podcasts/rss.js';
import { removePodcastFeedUrl } from '../../../jellyfin/client.js';
import { setQueue } from '../../../player/queue.js';
import { playTrack } from '../../../player/audio.js';
import { getTranslation } from '../../../i18n.js';
import { toggleTrackDownload, refreshDownloadButton } from '../../downloads.js';
import { openPodcastShow, renderPodcastsView } from './list.js';

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
        <div style="display: flex; justify-content: center; align-items: center;">
          <button class="btn-track-download" data-track-id="${ep.id}" title="Download" aria-label="Download">
            <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
          </button>
        </div>
        <div style="text-align: right; color: var(--text-muted); display: flex; align-items: center; justify-content: flex-end;">
          <span class="material-symbols-outlined" style="font-size: 20px;">play_circle</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.podcast-track-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-track-download')) return;
      const idx = parseInt(row.getAttribute('data-index'), 10);
      const ep = latestTop[idx];
      if (ep) {
        setQueue(latestTop, idx);
        playTrack(ep);
      }
    });
  });

  container.querySelectorAll('.podcast-track-row .btn-track-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-track-id');
      const ep = latestTop.find(x => String(x.id) === String(id)) || { id };
      toggleTrackDownload(ep, btn);
    });
    refreshDownloadButton(btn);
  });
}