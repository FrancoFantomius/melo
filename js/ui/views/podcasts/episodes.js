import { getEpisodeState, markEpisodePlayed } from '../../../podcasts/storage.js';
import { setQueue } from '../../../player/queue.js';
import { playTrack } from '../../../player/audio.js';
import { getTranslation } from '../../../i18n.js';
import { toggleTrackDownload, refreshDownloadButton } from '../../downloads.js';

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
              <button class="btn-toggle-notes" data-note-target="${uniqueNoteId}" style="background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0;" data-i18n>Show Notes</button>
              <button class="btn-track-download" data-track-id="${ep.id}" title="Download" aria-label="Download" style="gap: 4px; margin-left: auto;">
                <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
                <span data-i18n>Download</span>
              </button>
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