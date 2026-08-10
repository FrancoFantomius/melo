import { getArtworkUrl, getSongsCached, getPlaylistItemsCached, getFavoriteSongsCached } from '../../jellyfin/client.js';
import { setQueue } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { openArtist } from './artists.js';
import { openAlbum } from './albums.js';
import { openPlaylist } from './playlists.js';
import { isTrackLiked, toggleTrackLiked, registerTracksFavoriteStatus } from '../../player/likes.js';
import { getTranslation } from '../../i18n.js';
import { DISCOVER_DAILY_PLAYLIST, HOME_LIMITS, getRecommendedTracks } from '../../recommendations.js';
import { openSelectPlaylistModal } from '../modals.js';

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
  container.querySelectorAll('.artist-link').forEach(link => {
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
        <div class="card-thumb discover-daily-thumb" style="background: radial-gradient(circle at 28% 25%, #fef3c7 0, #f59e0b 25%, #8b5cf6 64%, #1d4ed8 100%); display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1/1; border-radius: var(--radius-sm); box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);">
          <span class="material-symbols-outlined" style="font-size: 56px; color: #ffffff; font-variation-settings: 'FILL' 1;">explore</span>
        </div>
        <div class="card-title" data-i18n>Discover Daily</div>
        <div class="card-subtitle" data-i18n>Playlist • 20 fresh picks</div>
        <div class="card-play-btn" title="Play">
          <span class="material-symbols-outlined">play_arrow</span>
        </div>
      </div>
    `;
  }
  if (item.Id === 'liked-songs' || item.Type === 'LikedSongs') {
    return `
      <div class="media-card liked-songs-card" data-album-id="liked-songs" data-type="LikedSongs">
        <div class="card-thumb liked-songs-thumb" style="background: linear-gradient(135deg, #ff7e5f, #feb47b); display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1/1; border-radius: var(--radius-sm); box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);">
          <span class="material-symbols-outlined" style="font-size: 56px; color: #ffffff; font-variation-settings: 'FILL' 1;">favorite</span>
        </div>
        <div class="card-title" data-i18n>Liked Songs</div>
        <div class="card-subtitle" data-i18n>Playlist • Favorite Songs</div>
        <div class="card-play-btn" title="Play">
          <span class="material-symbols-outlined">play_arrow</span>
        </div>
      </div>
    `;
  }
  const subtitle = item.AlbumArtist || item.Artists?.join(', ') || ((typeLabel === 'Playlist' || item.Type === 'Playlist') ? '' : typeLabel);
  return `
    <div class="media-card" data-album-id="${item.Id}" data-type="${item.Type || typeLabel}">
      <img src="${getArtworkUrl(item, 'Primary', 300)}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="card-thumb" alt="${item.Name}">
      <div class="card-title">${item.Name}</div>
      <div class="card-subtitle">${subtitle}</div>
      <div class="card-play-btn" title="Play">
        <span class="material-symbols-outlined">play_arrow</span>
      </div>
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

  return `
    <div class="track-row" data-track-id="${track.Id}" data-index="${index}">
      <span class="track-num">${index + 1}</span>
      <div class="track-info">
        <img src="${getArtworkUrl(track, 'Primary', 100)}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="track-cover" alt="Cover">
      </div>
      <div style="overflow: hidden;">
        <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.Name}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${artistHTML}</div>
      </div>
      <div style="color: var(--text-secondary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.Album || ''}</div>
      <div style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-like ${isLiked ? 'liked' : ''}" data-track-id="${track.Id}" title="${isLiked ? 'Unlike' : 'Like'}">
          <span class="material-symbols-outlined" style="font-size: 18px;">${isLiked ? 'favorite' : 'favorite_border'}</span>
        </button>
      </div>
      <div style="display: flex; justify-content: center; align-items: center;">
        <button class="btn-track-add-playlist" data-track-id="${track.Id}" title="Add to Playlist">
          <span class="material-symbols-outlined" style="font-size: 18px;">playlist_add</span>
        </button>
      </div>
      <div style="color: var(--text-muted); font-size: 12px; text-align: right;">${timeStr}</div>
      <div style="text-align: right; color: var(--text-muted);">
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
      // Ignore click if user clicked directly on artist link, like button, or add playlist button
      if (e.target.closest('.artist-link') || e.target.closest('.btn-track-like') || e.target.closest('.btn-track-add-playlist')) {
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
        const trackObj = tracks.find(t => String(t.Id) === String(trackId)) || { Id: trackId };
        await toggleTrackLiked(trackObj);
      });
    }

    const addPlaylistBtn = row.querySelector('.btn-track-add-playlist');
    if (addPlaylistBtn) {
      addPlaylistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const trackId = addPlaylistBtn.getAttribute('data-track-id');
        const trackObj = tracks.find(t => String(t.Id) === String(trackId)) || { Id: trackId };
        openSelectPlaylistModal(trackObj);
      });
    }
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
      btn.title = isLiked ? 'Unlike' : 'Like';
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isLiked ? 'favorite' : 'favorite_border';
    });
  });
}
