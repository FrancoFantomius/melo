import { getArtworkUrl, getSongsCached, getPlaylistItemsCached, getFavoriteSongsCached } from '../../jellyfin/client.js';
import { addToQueue, setQueue } from '../../player/queue.js';
import { playTrack, notifyUI } from '../../player/audio.js';
import { openArtist } from './artists.js';
import { openAlbum } from './albums.js';
import { openPlaylist } from './playlists.js';
import { openSelectPlaylistModal } from '../modals.js';
import { isTrackLiked, toggleTrackLiked, registerTracksFavoriteStatus } from '../../player/likes.js';
import { refreshDownloadButton, toggleTrackDownload } from '../downloads.js';
import { getTranslation } from '../../i18n.js';
import { DISCOVER_DAILY_PLAYLIST, LIKED_SONGS_PLAYLIST, HOME_LIMITS, getRecommendedTracks } from '../../recommendations.js';
import { getPlaceholder } from '../placeholders.js';
import '@francofantomius/material-components/tooltip';

export function bindLongPress(el, onLongPress) {
  if (!el || typeof onLongPress !== 'function') return;
  let timer = null;
  let startX = 0;
  let startY = 0;
  let started = false;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    started = false;
  };

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    cancel();
    started = true;
    timer = setTimeout(() => {
      timer = null;
      if (started) {
        started = false;
        onLongPress(e);
      }
    }, 550);
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!started || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) cancel();
  }, { passive: true });

  el.addEventListener('touchend', cancel, { passive: true });
  el.addEventListener('touchcancel', cancel, { passive: true });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function formatItemType(type) {
  if (type === 'MusicAlbum' || type === 'Album') return 'Album';
  if (type === 'MusicArtist' || type === 'Artist') return 'Artist';
  if (type === 'Audio') return 'Track';
  return type || '';
}

export function getAlbumArtistsInfo(item) {
  if (!item) return [];
  if (item.AlbumArtists && item.AlbumArtists.length > 0) {
    return item.AlbumArtists.map(a => ({ id: a.Id, name: a.Name }));
  }
  if (item.ArtistItems && item.ArtistItems.length > 0) {
    return item.ArtistItems.map(a => ({ id: a.Id, name: a.Name }));
  }
  if (item.AlbumArtist) {
    return [{ id: item.AlbumArtistId || item.AlbumArtist, name: item.AlbumArtist }];
  }
  if (item.Artists && item.Artists.length > 0) {
    return item.Artists.map(name => ({ id: name, name: name }));
  }
  return [];
}

export function renderArtistLinksHTML(artistsInfo) {
  if (!artistsInfo || artistsInfo.length === 0) return getTranslation('Unknown Artist');
  return artistsInfo.map(artist => `
    <span class="artist-link" data-artist-id="${artist.id || ''}" data-artist-name="${artist.name || ''}" style="color: var(--text-secondary); text-decoration: none; cursor: pointer; font-weight: 500;" onmouseover="this.style.color='var(--accent)'; this.style.textDecoration='underline'" onmouseout="this.style.color='var(--text-secondary)'; this.style.textDecoration='none'">
      ${artist.name}
    </span>
  `).join(', ');
}

export function bindArtistLinks(container) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  container.querySelectorAll('.artist-link').forEach(link => {
    if (isMobile && link.closest('.track-row')) {
      return;
    }
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const artistId = link.getAttribute('data-artist-id');
      const artistName = link.getAttribute('data-artist-name') || link.textContent.trim();
      if (artistId || artistName) {
        openArtist(artistId || artistName, { Id: artistId, Name: artistName });
      }
    });
  });
}

export function bindArtistCards(container) {
  container.querySelectorAll('.media-card[data-artist-id], [data-artist-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const artistId = card.getAttribute('data-artist-id');
      const name = card.querySelector('.card-title')?.textContent || card.textContent?.trim();
      if (artistId) {
        openArtist(artistId, { Id: artistId, Name: name });
      }
    });
  });
}

export function renderAlbumCardHTML(item, typeLabel = 'Album') {

  if (item.Id === DISCOVER_DAILY_PLAYLIST.Id || item.Type === DISCOVER_DAILY_PLAYLIST.Type) {
    return `
      <div class="media-card discover-daily-card" data-album-id="discover-daily" data-type="DiscoverDaily">
        <img src="${DISCOVER_DAILY_PLAYLIST.CoverUrl}" data-placeholder-type="explore" class="card-thumb discover-daily-thumb" alt="Discover Daily">
        <div class="card-title" data-i18n>Discover Daily</div>
        <div class="card-subtitle" data-i18n>Playlist • 20 fresh picks</div>
        <div class="card-play-btn" aria-label="Play">
          <span class="material-symbols-outlined">play_arrow</span>
        </div>
        <md-tooltip position="top" data-i18n-value="Play" value="Play"></md-tooltip>
      </div>
    `;
  }
  if (item.Id === 'liked-songs' || item.Type === 'LikedSongs') {
    return `
      <div class="media-card liked-songs-card" data-album-id="liked-songs" data-type="LikedSongs">
        <img src="${LIKED_SONGS_PLAYLIST.CoverUrl}" data-placeholder-type="favorite" class="card-thumb liked-songs-thumb" alt="Liked Songs">
        <div class="card-title" data-i18n>Liked Songs</div>
        <div class="card-subtitle" data-i18n>Playlist • Favorite Songs</div>
        <div class="card-play-btn" aria-label="Play">
          <span class="material-symbols-outlined">play_arrow</span>
        </div>
        <md-tooltip position="top" data-i18n-value="Play" value="Play"></md-tooltip>
      </div>
    `;
  }
  const isPlaylist = typeLabel === 'Playlist' || item.Type === 'Playlist';
  const placeholderType = isPlaylist ? 'playlist' : 'album';
  const subtitle = item.AlbumArtist || item.Artists?.join(', ') || (isPlaylist ? '' : formatItemType(typeLabel));
  return `
    <div class="media-card" data-album-id="${item.Id}" data-type="${item.Type || typeLabel}">
      <img src="${getArtworkUrl(item, 'Primary', 300, placeholderType)}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('${placeholderType}') : '${getPlaceholder(placeholderType)}';" data-placeholder-type="${placeholderType}" class="card-thumb" alt="${item.Name}">
      <div class="card-title">${item.Name}</div>
      <div class="card-subtitle">${subtitle}</div>
      <div class="card-play-btn" aria-label="Play">
        <span class="material-symbols-outlined">play_arrow</span>
      </div>
      <md-tooltip position="top" data-i18n-value="Play" value="Play"></md-tooltip>
    </div>
  `;
}

export function renderTrackRowHTML(track, index) {
  const artistsInfo = getAlbumArtistsInfo(track);
  const artistHTML = renderArtistLinksHTML(artistsInfo);
  const durationSec = Math.floor((track.RunTimeTicks || 0) / 10000000);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const isLiked = isTrackLiked(track.Id);
  const trackKey = track.Id || track.id;

  return `
    <div class="track-row" data-track-id="${trackKey}" data-index="${index}">
      <span class="track-num">${index + 1}</span>
      <div class="track-info">
        <img src="${getArtworkUrl(track, 'Primary', 100, 'song')}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('song') : '${getPlaceholder('song')}';" data-placeholder-type="song" class="track-cover" alt="Cover">
      </div>
      <div class="track-main" style="overflow: hidden;">
        <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.Name}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${artistHTML}</div>
      </div>
      <div class="track-album" style="color: var(--text-secondary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.Album || ''}</div>
      <div class="track-action-like" style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-like ${isLiked ? 'liked' : ''}" data-track-id="${trackKey}" aria-label="${isLiked ? 'Unlike' : 'Like'}">
          <span class="material-symbols-outlined" style="font-size: 18px;">${isLiked ? 'favorite' : 'favorite_border'}</span>
        </button>
        <md-tooltip position="top" data-i18n-value="${isLiked ? 'Unlike' : 'Like'}" value="${isLiked ? 'Unlike' : 'Like'}"></md-tooltip>
      </div>
      <div class="track-action-download" style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-download" data-track-id="${trackKey}" aria-label="Download">
          <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
        </button>
        <md-tooltip position="top" data-i18n-value="Download" value="Download"></md-tooltip>
      </div>
      <div class="track-action-queue" style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-add-queue" data-track-id="${trackKey}" aria-label="Add to Queue">
          <span class="material-symbols-outlined" style="font-size: 18px;">queue_music</span>
        </button>
        <md-tooltip position="top" data-i18n-value="Add to Queue" value="Add to Queue"></md-tooltip>
      </div>
      <div class="track-action-playlist" style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-add-playlist" data-track-id="${trackKey}" aria-label="Add to Playlist">
          <span class="material-symbols-outlined" style="font-size: 18px;">playlist_add</span>
        </button>
        <md-tooltip position="top" data-i18n-value="Add to Playlist" value="Add to Playlist"></md-tooltip>
      </div>
      <div class="track-duration" style="color: var(--text-muted); font-size: 12px; text-align: right;">${timeStr}</div>
      <div class="track-action-play" style="text-align: right; color: var(--text-muted);">
        <span class="material-symbols-outlined" style="font-size: 18px;">play_circle</span>
      </div>
    </div>
  `;
}

export function bindAlbumCards(container) {
  container.querySelectorAll('.media-card[data-album-id]').forEach(card => {
    const albumId = card.getAttribute('data-album-id');
    const type = card.getAttribute('data-type');
    const name = card.querySelector('.card-title')?.textContent;

    const playBtn = card.querySelector('.card-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!albumId) return;
        try {
          let tracks = [];
          if (type === 'LikedSongs' || albumId === 'liked-songs') {
            const songsRes = await getFavoriteSongsCached();
            tracks = songsRes?.Items || [];
          } else if (type === DISCOVER_DAILY_PLAYLIST.Type || albumId === DISCOVER_DAILY_PLAYLIST.Id) {
            const songsRes = await getSongsCached({ limit: 250, sortBy: 'DatePlayed,PlayCount,SortName', sortOrder: 'Descending' });
            tracks = getRecommendedTracks(songsRes?.Items || [], HOME_LIMITS.discoverDailyTracks, 'discoverTrack');
          } else if (type === 'Playlist') {
            const songsRes = await getPlaylistItemsCached(albumId);
            tracks = songsRes?.Items || [];
          } else {
            const songsRes = await getSongsCached({ albumId });
            tracks = songsRes?.Items || [];
          }

          if (tracks && tracks.length > 0) {
            registerTracksFavoriteStatus(tracks);
            setQueue(tracks, 0);
            playTrack(tracks[0]);
          }
        } catch (err) {
          console.error('[Views] Failed to play album/playlist:', err);
        }
      });
    }

    card.addEventListener('click', () => {
      if (albumId) {
        if (type === 'Playlist' || type === 'LikedSongs' || type === DISCOVER_DAILY_PLAYLIST.Type || albumId === 'liked-songs' || albumId === DISCOVER_DAILY_PLAYLIST.Id) {
          openPlaylist(albumId, { Id: albumId, Name: name, Type: type });
        } else {
          openAlbum(albumId, { Id: albumId, Name: name, Type: type });
        }
      }
    });
  });
}

export function bindTrackRows(container, tracks) {
  container.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Ignore click directly following a long press (selection gesture)
      if (row.dataset.suppressClick && Date.now() - Number(row.dataset.suppressClick) < 700) {
        return;
      }
      // Ignore click if user clicked directly on artist link, like button, download button, queue button, or playlist button
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      if (e.target.closest('.btn-track-like') || e.target.closest('.btn-track-download') || e.target.closest('.btn-track-add-queue') || e.target.closest('.btn-track-add-playlist')) {
        return;
      }
      // In selection mode, a single tap toggles selection instead of playing
      if (row.closest('.track-selection-active')) {
        row.dispatchEvent(new CustomEvent('melo-track-longpress', {
          bubbles: true,
          detail: { trackId: row.getAttribute('data-track-id') }
        }));
        return;
      }
      // On desktop, clicking the artist name navigates to the artist; on mobile it plays the song
      if (!isMobile && e.target.closest('.artist-link')) {
        return;
      }
      const index = parseInt(row.getAttribute('data-index'), 10);
      setQueue(tracks, index);
      playTrack(tracks[index]);
    });

    const likeBtn = row.querySelector('.btn-track-like');
    if (likeBtn) {
      likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const trackId = likeBtn.getAttribute('data-track-id');
        const trackObj = tracks.find(t => String(t.Id || t.id) === String(trackId)) || { Id: trackId };
        await toggleTrackLiked(trackObj);
      });
    }

    const downloadBtn = row.querySelector('.btn-track-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const trackId = downloadBtn.getAttribute('data-track-id');
        const trackObj = tracks.find(t => String(t.Id || t.id) === String(trackId)) || { Id: trackId };
        await toggleTrackDownload(trackObj, downloadBtn);
      });
    }

    const addQueueBtn = row.querySelector('.btn-track-add-queue');
    if (addQueueBtn) {
      addQueueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const trackId = addQueueBtn.getAttribute('data-track-id');
        const trackObj = tracks.find(t => String(t.Id || t.id) === String(trackId)) || { Id: trackId };
        addToQueue([trackObj]);
        notifyUI();
        const icon = addQueueBtn.querySelector('.material-symbols-outlined');
        if (icon && icon.textContent !== 'check') {
          const originalIcon = icon.textContent;
          icon.textContent = 'check';
          setTimeout(() => {
            icon.textContent = originalIcon;
          }, 1000);
        }
      });
    }

    const addPlaylistBtn = row.querySelector('.btn-track-add-playlist');
    if (addPlaylistBtn) {
      addPlaylistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const trackId = addPlaylistBtn.getAttribute('data-track-id');
        const trackObj = tracks.find(t => String(t.Id || t.id) === String(trackId)) || { Id: trackId };
        openSelectPlaylistModal(trackObj);
      });
    }

    const trackInfo = row.querySelector('.track-info');
    if (trackInfo) {
      bindLongPress(trackInfo, () => {
        row.dataset.suppressClick = String(Date.now());
        row.dispatchEvent(new CustomEvent('melo-track-longpress', {
          bubbles: true,
          detail: { trackId: row.getAttribute('data-track-id') }
        }));
      });
    }
  });

  // Refresh download button states after rows are rendered
  container.querySelectorAll('.btn-track-download').forEach(btn => {
    refreshDownloadButton(btn);
  });
}

// Global listener to update all track-row like buttons when liked state changes
if (typeof window !== 'undefined' && !window.__melo_likes_row_listener_bound) {
  window.__melo_likes_row_listener_bound = true;
  window.addEventListener('melo-likes-changed', (e) => {
    const { trackId, isLiked } = e.detail || {};
    if (!trackId) return;
    document.querySelectorAll(`.btn-track-like[data-track-id="${trackId}"]`).forEach(btn => {
      btn.classList.toggle('liked', isLiked);
      const label = isLiked ? 'Unlike' : 'Like';
      const translated = getTranslation(label);
      btn.setAttribute('aria-label', translated);
      const tooltip = btn.nextElementSibling && btn.nextElementSibling.tagName === 'MD-TOOLTIP' ? btn.nextElementSibling : null;
      if (tooltip) {
        tooltip.dataset.i18nValueEn = label;
        tooltip.value = translated;
        tooltip.setAttribute('value', translated);
      } else {
        btn.title = translated;
      }
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isLiked ? 'favorite' : 'favorite_border';
    });
  });
}

// Global listener to keep all download buttons in sync when download state changes
if (typeof window !== 'undefined' && !window.__melo_download_row_listener_bound) {
  window.__melo_download_row_listener_bound = true;
  window.addEventListener('melo-download-changed', (e) => {
    const { trackId, downloaded } = e.detail || {};
    if (!trackId) return;
    document.querySelectorAll(`.btn-track-download[data-track-id="${trackId}"]`).forEach(btn => {
      if (btn.classList.contains('downloading')) return;
      const label = downloaded ? 'Remove Download' : 'Download';
      const translated = getTranslation(label);
      btn.setAttribute('aria-label', translated);
      const tooltip = btn.nextElementSibling && btn.nextElementSibling.tagName === 'MD-TOOLTIP' ? btn.nextElementSibling : null;
      if (tooltip) {
        tooltip.dataset.i18nValueEn = label;
        tooltip.value = translated;
        tooltip.setAttribute('value', translated);
      } else {
        btn.title = translated;
      }
      if (downloaded) {
        btn.classList.add('downloaded');
        btn.classList.remove('downloading');
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'download_done';
        btn.style.setProperty('--download-progress', '100%');
      } else {
        btn.classList.remove('downloaded', 'downloading');
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'download';
        btn.style.setProperty('--download-progress', '0%');
      }
    });
  });
}
