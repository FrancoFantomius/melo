import { getEpisodeState, markEpisodePlayed } from '../../../podcasts/storage.js';
import { setQueue, addToQueue } from '../../../player/queue.js';
import { playTrack } from '../../../player/audio.js';
import { getTranslation } from '../../../i18n.js';
import { toggleTrackDownload, refreshDownloadButton } from '../../downloads.js';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/tooltip';
import '@francofantomius/material-components/icon';

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
      badgeHtml = `<span class="episode-badge played" data-i18n>Played</span>`;
    } else if (state.position > 5) {
      badgeHtml = `<span class="episode-badge in-progress"><span data-i18n>In Progress</span> (${progressPct}%)</span>`;
    }

    const uniqueNoteId = `notes-${Math.random().toString(36).substr(2, 9)}-${idx}`;
    const playLabel = getTranslation('Play Episode');
    const downloadLabel = getTranslation('Download');
    const queueLabel = getTranslation('Add to Queue');
    const togglePlayedLabel = state.isPlayed ? getTranslation('Mark as Unplayed') : getTranslation('Mark as Played');

    return `
      <div class="episode-item" data-episode-id="${ep.id}" data-index="${idx}">
        <div class="episode-main-row">
          <div class="action-btn-wrapper">
            <md-icon-button class="episode-play-btn" data-index="${idx}" variant="filled" aria-label="${playLabel}">
              <md-icon name="play_arrow" filled></md-icon>
            </md-icon-button>
            <md-tooltip position="top" data-i18n-value="Play Episode" value="${playLabel}"></md-tooltip>
          </div>
          <div class="episode-details">
            <div class="episode-title" title="${ep.title}">${ep.title}</div>
            <div class="episode-meta-bar">
              <span title="${ep.showTitle || ''}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${ep.showTitle || ''}</span>
              ${ep.pubDate ? `<span>• ${ep.pubDate}</span>` : ''}
              ${ep.durationFormatted ? `<span>• ${ep.durationFormatted}</span>` : ''}
              ${badgeHtml}
              <md-button class="btn-toggle-notes" data-note-target="${uniqueNoteId}" variant="text" style="font-size: 12px; height: 28px; --md-button-padding-horizontal: 8px;"><span data-i18n>Show Notes</span></md-button>
              <div class="action-btn-wrapper" style="margin-left: auto;">
                <md-icon-button class="btn-track-add-queue" data-index="${idx}" variant="standard" icon="queue_music" aria-label="${queueLabel}"></md-icon-button>
                <md-tooltip position="top" data-i18n-value="Add to Queue" value="${queueLabel}"></md-tooltip>
              </div>
              <div class="action-btn-wrapper">
                <md-icon-button class="btn-track-download" data-track-id="${ep.id}" variant="standard" icon="download" aria-label="${downloadLabel}"></md-icon-button>
                <md-tooltip position="top" data-i18n-value="Download" value="${downloadLabel}"></md-tooltip>
              </div>
              <div class="action-btn-wrapper">
                <md-icon-button class="btn-toggle-played" data-id="${ep.id}" variant="standard" icon="${state.isPlayed ? 'check_circle' : 'radio_button_unchecked'}" aria-label="${togglePlayedLabel}"></md-icon-button>
                <md-tooltip position="top" data-i18n-value="${state.isPlayed ? 'Mark as Unplayed' : 'Mark as Played'}" value="${togglePlayedLabel}"></md-tooltip>
              </div>
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

  container.querySelectorAll('.btn-track-add-queue').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const ep = episodes[idx];
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
      renderEpisodeListHtml(container, episodes, is2Col);
    });
  });

  container.querySelectorAll('.btn-track-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-track-id');
      const ep = episodes.find(x => String(x.id) === String(id)) || { id };
      toggleTrackDownload(ep, btn);
    });
    refreshDownloadButton(btn);
  });
}