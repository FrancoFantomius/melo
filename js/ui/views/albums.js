import { getAlbumsCached, getItemCached, getSongsCached, getPlaylistItemsCached, getFavoriteSongsCached, getArtworkUrl } from '../../jellyfin/client.js';
import { setQueue } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { switchView } from '../views.js';
import { getAlbumArtistsInfo, renderArtistLinksHTML, bindArtistLinks, renderAlbumCardHTML, bindAlbumCards, renderTrackRowHTML, bindTrackRows } from './common.js';
import { registerTracksFavoriteStatus } from '../../player/likes.js';
import { openPlaylist } from './playlists.js';
import { openEditPlaylistModal, openAddTracksModal, openDeletePlaylistModal } from '../modals.js';

export function openAlbum(albumId, albumObj = null) {
  if (!albumId) return;
  if (albumId === 'liked-songs' || albumObj?.Type === 'LikedSongs' || albumObj?.Type === 'Playlist') {
    openPlaylist(albumId, albumObj);
    return;
  }
  const targetUrl = `albums.html?album=${encodeURIComponent(albumId)}`;
  const currentSearch = window.location.search;
  if (currentSearch !== `?album=${encodeURIComponent(albumId)}`) {
    window.history.pushState({ view: 'album-detail', albumId }, '', targetUrl);
  }
  switchView('album-detail', albumObj || { Id: albumId, Type: 'MusicAlbum' });
}

export async function renderAlbumsView(container) {
  container.innerHTML = `
    <div class="view-section">
      <h2 class="section-title">Music Albums</h2>
      <div id="albums-grid" class="cards-grid">
        <div style="color: var(--text-muted);">Loading albums...</div>
      </div>
    </div>
  `;

  const updateAlbumsGrid = (res) => {
    const grid = document.getElementById('albums-grid');
    if (grid && res) {
      if (!res.Items || res.Items.length === 0) {
        grid.innerHTML = '<div style="color: var(--text-secondary);">No albums found.</div>';
      } else {
        grid.innerHTML = res.Items.map(album => renderAlbumCardHTML(album)).join('');
        bindAlbumCards(grid);
      }
    }
  };

  try {
    const res = await getAlbumsCached({ limit: 100 }, updateAlbumsGrid);
    updateAlbumsGrid(res);
  } catch (err) {
    const grid = document.getElementById('albums-grid');
    if (!grid || !grid.querySelector('.media-card')) {
      container.innerHTML = `<div style="color: var(--danger);">Failed to load albums: ${err.message}</div>`;
    }
  }
}

export async function renderAlbumDetailView(container, albumOrId) {
  if (!albumOrId) return;

  let album = typeof albumOrId === 'string' ? { Id: albumOrId } : albumOrId;
  const isLikedSongs = album.Id === 'liked-songs' || album.Type === 'LikedSongs';
  const isPlaylist = isLikedSongs || album.Type === 'Playlist';

  if (isLikedSongs) {
    album = {
      Id: 'liked-songs',
      Name: 'Liked Songs',
      Type: 'Playlist',
      IsLikedSongs: true
    };
  } else if (isPlaylist) {
    album = {
      Type: 'Playlist',
      ...album
    };
  }

  const initialArtistsInfo = isLikedSongs ? [] : getAlbumArtistsInfo(album);
  const initialArtistHTML = isLikedSongs
    ? 'Your favorite tracks'
    : (initialArtistsInfo.length > 0 ? renderArtistLinksHTML(initialArtistsInfo) : (isPlaylist ? '' : 'Unknown Artist'));

  const coverHTML = isLikedSongs
    ? `<div id="album-detail-cover" class="album-cover-lg" style="background: linear-gradient(135deg, #ff7e5f, #feb47b); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3);">
         <span class="material-symbols-outlined" style="font-size: 80px; color: #ffffff; font-variation-settings: 'FILL' 1;">favorite</span>
       </div>`
    : `<img id="album-detail-cover" src="${getArtworkUrl(album, 'Primary', 400)}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="album-cover-lg" alt="${album.Name || (isPlaylist ? 'Playlist' : 'Album')}">`;

  container.innerHTML = `
    <div class="view-section">
      <div class="album-detail-banner">
        ${coverHTML}
        <div class="album-info-meta">
          <span id="album-detail-type" class="album-detail-type">${isPlaylist ? 'Playlist' : (album.Type || 'Album')}</span>
          <h1 id="album-detail-title" class="album-detail-title">${album.Name || (isLikedSongs ? 'Liked Songs' : (isPlaylist ? 'Playlist' : 'Album'))}</h1>
          <span id="album-detail-artist" class="album-detail-artist">${initialArtistHTML}</span>
          <div class="album-detail-actions">
            <button id="btn-play-album-all" class="btn btn-primary" title="Play All">
              <span class="material-symbols-outlined">play_arrow</span>
              <span>Play All</span>
            </button>
            <button id="btn-shuffle-album-all" class="btn btn-secondary" title="Random Play" aria-label="Random Play">
              <span class="material-symbols-outlined">shuffle</span>
            </button>
          </div>
          ${isPlaylist ? `
            <div class="playlist-manage-actions">
              <button id="btn-add-playlist-tracks" class="btn btn-secondary" title="Add Tracks">
                <span class="material-symbols-outlined">playlist_add</span>
                <span>Add Tracks</span>
              </button>
              ${!isLikedSongs ? `
                <button id="btn-edit-playlist" class="btn btn-secondary" title="Edit Playlist">
                  <span class="material-symbols-outlined">edit</span>
                  <span>Edit</span>
                </button>
                <button id="btn-delete-playlist" class="btn btn-secondary" title="Delete Playlist">
                  <span class="material-symbols-outlined">delete</span>
                  <span>Delete</span>
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <h2 class="section-title" style="margin-top: 24px;">Tracks</h2>

      <div id="album-songs-list" class="tracks-list" style="margin-top: 16px;">
        <div style="color: var(--text-muted);">Loading tracks...</div>
      </div>
    </div>
  `;

  if (!isLikedSongs && initialArtistsInfo.length > 0) {
    bindArtistLinks(container);
  }

  const btnEdit = container.querySelector('#btn-edit-playlist');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      openEditPlaylistModal(album.Id, album.Name, () => {
        renderAlbumDetailView(container, album.Id);
      });
    });
  }

  const btnAddTracks = container.querySelector('#btn-add-playlist-tracks');
  if (btnAddTracks) {
    btnAddTracks.addEventListener('click', () => {
      openAddTracksModal(album.Id, () => {
        renderAlbumDetailView(container, album.Id);
      });
    });
  }

  const btnDelete = container.querySelector('#btn-delete-playlist');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      openDeletePlaylistModal(album.Id, album.Name, () => {
        window.history.pushState({ view: 'playlists' }, '', 'playlists.html');
        switchView('playlists');
      });
    });
  }

  const renderHeader = (data) => {
    if (isLikedSongs) return;
    const titleEl = document.getElementById('album-detail-title');
    const artistEl = document.getElementById('album-detail-artist');
    const typeEl = document.getElementById('album-detail-type');
    const coverEl = document.getElementById('album-detail-cover');

    if (titleEl && data.Name) titleEl.textContent = data.Name;
    if (artistEl) {
      const artistsInfo = getAlbumArtistsInfo(data);
      if (artistsInfo && artistsInfo.length > 0) {
        artistEl.innerHTML = renderArtistLinksHTML(artistsInfo);
        bindArtistLinks(artistEl);
      } else if (isPlaylist || data.Type === 'Playlist') {
        artistEl.textContent = '';
      } else {
        artistEl.innerHTML = renderArtistLinksHTML(artistsInfo);
        bindArtistLinks(artistEl);
      }
    }
    if (typeEl) typeEl.textContent = data.Type || (isPlaylist ? 'Playlist' : 'Album');
    if (coverEl && coverEl.tagName === 'IMG') coverEl.src = getArtworkUrl(data, 'Primary', 400);
  };

  // If album metadata is incomplete or loaded from URL, fetch via getItemCached (skip for liked-songs)
  if (!isLikedSongs) {
    try {
      const fetchedItem = await getItemCached(album.Id, (revalidated) => {
        if (revalidated) {
          album = { ...album, ...revalidated };
          renderHeader(album);
        }
      });
      if (fetchedItem) {
        album = { ...album, ...fetchedItem };
        renderHeader(album);
      }
    } catch (err) {
      console.warn('[Views] getItemCached failed:', err);
    }
  }

  const updateSongsList = (songsRes) => {
    const songsList = document.getElementById('album-songs-list');
    const btnPlayAll = document.getElementById('btn-play-album-all');

    if (songsList && songsRes && songsRes.Items) {
      if (songsRes.Items.length === 0) {
        songsList.innerHTML = `<div style="color: var(--text-secondary);">${isLikedSongs ? 'No liked songs yet. Click the heart icon on any track to add it to your Liked Songs!' : (isPlaylist ? 'No tracks found in this playlist.' : 'No tracks found in this album.')}</div>`;
      } else {
        registerTracksFavoriteStatus(songsRes.Items);
        songsList.innerHTML = songsRes.Items.map((track, idx) => renderTrackRowHTML(track, idx)).join('');
        bindTrackRows(songsList, songsRes.Items);
        bindArtistLinks(songsList);

        if (btnPlayAll) {
          btnPlayAll.onclick = () => {
            setQueue(songsRes.Items, 0);
            playTrack(songsRes.Items[0]);
          };
        }

        const btnShuffleAll = document.getElementById('btn-shuffle-album-all');
        if (btnShuffleAll) {
          btnShuffleAll.onclick = () => {
            const shuffled = [...songsRes.Items].sort(() => Math.random() - 0.5);
            setQueue(shuffled, 0);
            playTrack(shuffled[0]);
          };
        }
      }
    }
  };

  try {
    let songsRes;
    if (isLikedSongs) {
      songsRes = await getFavoriteSongsCached({}, updateSongsList);
    } else {
      songsRes = (album.Type === 'Playlist' || isPlaylist)
        ? await getPlaylistItemsCached(album.Id, updateSongsList)
        : await getSongsCached({ albumId: album.Id }, updateSongsList);
    }

    updateSongsList(songsRes);
  } catch (err) {
    console.error('[Views] Failed to fetch tracks:', err);
    const songsList = document.getElementById('album-songs-list');
    if (songsList) {
      songsList.innerHTML = `<div style="color: var(--danger);">Failed to load tracks: ${err.message}</div>`;
    }
  }
}

