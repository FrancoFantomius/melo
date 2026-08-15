import { getAllDownloads, removeDownload, formatBytes } from '../../jellyfin/offline.js';
import { setQueue } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { getTranslation } from '../../i18n.js';

let renderedContainer = null;

export function renderDownloadsView(container) {
  container.innerHTML = `
    <div class="view-section">
      <h2 class="section-title" data-i18n>Downloads</h2>
      <div id="downloads-list" class="tracks-list">
        <div style="color: var(--text-muted);" data-i18n>Loading...</div>
      </div>
    </div>
  `;
  renderedContainer = container;
  loadDownloads(container);
}

function renderTrackRowHTML(rec) {
  return `
    <div class="track-row downloads-row" data-track-id="${rec.id}">
      <span class="track-num">
        <span class="material-symbols-outlined" style="font-size: 18px;">${rec.isPodcast ? 'podcasts' : 'music_note'}</span>
      </span>
      <div class="track-info">
        <img src="${rec.artworkUrl || './img/icons/icon.svg'}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="track-cover" alt="Cover">
      </div>
      <div style="overflow: hidden;">
        <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rec.name || 'Unknown'}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${rec.artists || (rec.isPodcast ? 'Podcast' : '')}</div>
      </div>
      <div style="color: var(--text-secondary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rec.album || ''}</div>
      <div style="color: var(--text-muted); font-size: 12px; white-space: nowrap;">${formatBytes(rec.size)}</div>
      <div style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-download downloaded" data-track-id="${rec.id}" title="Remove Download">
          <span class="material-symbols-outlined" style="font-size: 18px;">download_done</span>
        </button>
      </div>
    </div>
  `;
}

function renderGroupHTML(group) {
  const typeLabel = group.type === 'Playlist' ? 'Playlist' : 'Album';
  const count = group.tracks.length;
  return `
    <div class="downloads-group" data-parent-id="${group.id}">
      <div class="downloads-group-header" role="button" aria-expanded="false">
        <div class="downloads-group-cover-wrap">
          <img src="${group.artworkUrl}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="track-cover" alt="${group.name}">
          <button class="downloads-group-play" title="Play All" aria-label="Play All">
            <span class="material-symbols-outlined" style="font-size: 18px;">play_arrow</span>
          </button>
        </div>
        <div style="overflow: hidden;">
          <div class="downloads-group-title">${group.name}</div>
          <div class="downloads-group-subtitle">${typeLabel}${group.owner ? ' • ' + group.owner : ''} • ${count} ${getTranslation(count === 1 ? 'track' : 'tracks')} • ${formatBytes(group.size)}</div>
        </div>
        <div style="flex: 1; min-width: 8px;"></div>
        <button class="btn-track-download downloaded" data-remove-group="${group.id}" title="Remove Download">
          <span class="material-symbols-outlined" style="font-size: 18px;">download_done</span>
        </button>
        <span class="material-symbols-outlined downloads-group-chevron" style="font-size: 20px;">expand_more</span>
      </div>
      <div class="downloads-group-tracks">
        ${group.tracks.map(renderTrackRowHTML).join('')}
      </div>
    </div>
  `;
}

async function loadDownloads(container) {
  const listEl = document.getElementById('downloads-list');
  if (!listEl) return;

  const downloads = await getAllDownloads();

  if (downloads.length === 0) {
    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 16px; text-align: center; color: var(--text-secondary);">
        <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.4;">download</span>
        <div>${getTranslation('No downloads yet.')}</div>
        <div style="font-size: 13px; color: var(--text-muted);">${getTranslation('Tap the download icon on any track to save it for offline listening.')}</div>
      </div>
    `;
    return;
  }

  const totalSize = downloads.reduce((sum, d) => sum + (d.size || 0), 0);
  const recMap = new Map(downloads.map(d => [String(d.id), d]));

  const groups = [];
  const groupMap = new Map();
  const standalone = [];

  for (const rec of downloads) {
    // Group under the album/playlist they belong to. Batch downloads carry an
    // explicit parentId (album or playlist id). Individually downloaded tracks
    // carry an albumId, and legacy records fall back to the album name.
    const groupId = rec.parentId || rec.albumId || '';
    const key = groupId ? `g:${groupId}` : (rec.album ? `n:${rec.album}|${rec.artists}` : '');
    if (!key) {
      standalone.push(rec);
      continue;
    }

    let group = groupMap.get(key);
    if (!group) {
      group = {
        id: groupId || `n:${rec.album}`,
        name: rec.parentName || rec.album || 'Unknown',
        type: rec.parentType || 'Album',
        artworkUrl: rec.parentArtworkUrl || rec.artworkUrl || './img/icons/icon.svg',
        owner: rec.parentOwner || (rec.parentType ? '' : (rec.artists || '')),
        hasParent: !!rec.parentId,
        tracks: [],
        size: 0
      };
      groupMap.set(key, group);
      groups.push(group);
    }
    group.hasParent = group.hasParent || !!rec.parentId;
    group.tracks.push(rec);
  }

  const albumGroups = [];
  for (const group of groups) {
    group.tracks.sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));
    group.size = group.tracks.reduce((sum, t) => sum + (t.size || 0), 0);
    // Explicit album/playlist downloads always show as a group. Otherwise only
    // group when the album clearly represents a full (or near-full) download.
    if (group.hasParent || group.tracks.length >= 2) {
      albumGroups.push(group);
    } else {
      standalone.push(...group.tracks);
    }
  }

  listEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 4px 10px; font-size: 12px; color: var(--text-muted);">
      <span>${downloads.length} ${getTranslation(downloads.length === 1 ? 'track' : 'tracks')}</span>
      <span>${formatBytes(totalSize)}</span>
    </div>
    ${albumGroups.map(g => renderGroupHTML(g)).join('')}
    ${standalone.map(rec => renderTrackRowHTML(rec)).join('')}
  `;

  bindGroupHandlers(listEl, recMap);
  bindTrackRowHandlers(listEl, recMap);
}

function playRecord(rec) {
  const track = {
    Id: rec.isPodcast ? undefined : rec.id,
    id: rec.isPodcast ? rec.id : undefined,
    Name: rec.name,
    Artists: rec.artists ? rec.artists.split(', ') : [],
    Album: rec.album,
    HasLyrics: rec.hasLyrics,
    isPodcastEpisode: !!rec.isPodcast
  };
  setQueue([track], 0);
  playTrack(track);
}

function bindTrackRowHandlers(listEl, recMap) {
  listEl.querySelectorAll('.downloads-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-track-download')) return;
      const trackId = row.getAttribute('data-track-id');
      const rec = recMap.get(String(trackId));
      if (!rec) return;
      playRecord(rec);
    });

    const removeBtn = row.querySelector('.btn-track-download');
    if (removeBtn) {
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await removeDownload(removeBtn.getAttribute('data-track-id'));
        if (renderedContainer) {
          loadDownloads(renderedContainer);
        }
      });
    }
  });
}

function bindGroupHandlers(listEl, recMap) {
  listEl.querySelectorAll('.downloads-group').forEach(groupEl => {
    const header = groupEl.querySelector('.downloads-group-header');
    const tracksEl = groupEl.querySelector('.downloads-group-tracks');
    const records = groupEl.querySelectorAll('.downloads-row');

    if (header && tracksEl) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.btn-track-download') || e.target.closest('.downloads-group-play')) return;
        const isOpen = groupEl.classList.toggle('open');
        header.setAttribute('aria-expanded', String(isOpen));
      });
    }

    const playBtn = groupEl.querySelector('.downloads-group-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const recs = [];
        records.forEach(row => {
          const rec = recMap.get(String(row.getAttribute('data-track-id')));
          if (rec) recs.push(rec);
        });
        if (!recs.length) return;
        const tracks = recs.map(rec => ({
          Id: rec.isPodcast ? undefined : rec.id,
          id: rec.isPodcast ? rec.id : undefined,
          Name: rec.name,
          Artists: rec.artists ? rec.artists.split(', ') : [],
          Album: rec.album,
          HasLyrics: rec.hasLyrics,
          isPodcastEpisode: !!rec.isPodcast
        }));
        setQueue(tracks, 0);
        playTrack(tracks[0]);
      });
    }

    const removeGroupBtn = groupEl.querySelector('[data-remove-group]');
    if (removeGroupBtn) {
      removeGroupBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const ids = [];
        groupEl.querySelectorAll('.downloads-row').forEach(row => {
          const id = row.getAttribute('data-track-id');
          if (id) ids.push(id);
        });
        for (const id of ids) {
          await removeDownload(id);
        }
        if (renderedContainer) {
          loadDownloads(renderedContainer);
        }
      });
    }
  });
}

// Re-render the downloads list whenever the download state changes
if (typeof window !== 'undefined' && !window.__melo_downloads_view_bound) {
  window.__melo_downloads_view_bound = true;
  window.addEventListener('melo-download-changed', () => {
    if (renderedContainer && document.body.getAttribute('data-page') === 'downloads') {
      loadDownloads(renderedContainer);
    }
  });
}
