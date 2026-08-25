import { getItemCached, getSongsCached, getPlaylistItemsCached, getFavoriteSongsCached, getArtworkUrl } from '../../../jellyfin/client.js';
import { setQueue } from '../../../player/queue.js';
import { playTrack } from '../../../player/audio.js';
import { switchView } from '../../views.js';
import { getAlbumArtistsInfo, renderArtistLinksHTML, bindArtistLinks, renderTrackRowHTML, bindTrackRows, formatItemType } from '../common.js';
import { registerTracksFavoriteStatus } from '../../../player/likes.js';
import { openPlaylist } from '../playlists.js';
import { openEditPlaylistModal, openAddTracksModal, openSelectPlaylistModal } from '../../modals.js';
import { getTranslation } from '../../../i18n.js';
import { DISCOVER_DAILY_PLAYLIST, LIKED_SONGS_PLAYLIST, HOME_LIMITS, getRecommendedTracks } from '../../../recommendations.js';
import { setupTrackSelection } from './detail-selection.js';
import { setupDownloadAllButton } from './detail-download.js';

let discoverDailyRefreshCount = 0;

function getDiscoverDailySeed() {
  const day = new Date().toISOString().slice(0, 10);
  return discoverDailyRefreshCount > 0 ? `${day}#${discoverDailyRefreshCount}` : day;
}

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

export async function renderAlbumDetailView(container, albumOrId) {
  if (!albumOrId) return;

  let album = typeof albumOrId === 'string' ? { Id: albumOrId } : albumOrId;
  const isLikedSongs = album.Id === 'liked-songs' || album.Type === 'LikedSongs';
  const isDiscoverDaily = album.Id === DISCOVER_DAILY_PLAYLIST.Id || album.Type === DISCOVER_DAILY_PLAYLIST.Type;
  const isPlaylist = isLikedSongs || isDiscoverDaily || album.Type === 'Playlist';

  if (isLikedSongs) {
    album = {
      ...LIKED_SONGS_PLAYLIST,
      Name: getTranslation('Liked Songs'),
      Type: 'Playlist'
    };
  } else if (isDiscoverDaily) {
    album = {
      ...DISCOVER_DAILY_PLAYLIST,
      Name: getTranslation('Discover Daily')
    };
  } else if (isPlaylist) {
    album = {
      Type: 'Playlist',
      ...album
    };
  }

  const initialArtistsInfo = (isLikedSongs || isDiscoverDaily) ? [] : getAlbumArtistsInfo(album);
  const initialArtistHTML = isLikedSongs
    ? getTranslation('Your favorite tracks')
    : (isDiscoverDaily
      ? getTranslation('20 fresh picks updated every day')
      : (initialArtistsInfo.length > 0 ? renderArtistLinksHTML(initialArtistsInfo) : (isPlaylist ? '' : getTranslation('Unknown Artist'))));

  const coverHTML = isLikedSongs
    ? `<img id="album-detail-cover" src="${LIKED_SONGS_PLAYLIST.CoverUrl}" class="album-cover-lg" alt="Liked Songs">`
    : (isDiscoverDaily
      ? `<img id="album-detail-cover" src="${DISCOVER_DAILY_PLAYLIST.CoverUrl}" class="album-cover-lg" alt="Discover Daily">`
      : `<img id="album-detail-cover" src="${getArtworkUrl(album, 'Primary', 400)}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="album-cover-lg" alt="${album.Name || (isPlaylist ? 'Playlist' : 'Album')}">`);

  container.innerHTML = `
    <div class="view-section album-detail-section">
      <div class="album-detail-banner">
        ${coverHTML}
        <div class="album-info-meta">
          <span id="album-detail-type" class="album-detail-type">${isPlaylist ? 'Playlist' : formatItemType(album.Type) || 'Album'}</span>
          <h1 id="album-detail-title" class="album-detail-title">${album.Name || (isLikedSongs ? 'Liked Songs' : (isPlaylist ? 'Playlist' : 'Album'))}</h1>
          <span id="album-detail-artist" class="album-detail-artist">${initialArtistHTML}</span>
          <div class="album-detail-actions">
            <button id="btn-play-album-all" class="btn btn-primary" title="Play All">
              <span class="material-symbols-outlined">play_arrow</span>
              <span class="btn-play-label-full" data-i18n>Play All</span>
              <span class="btn-play-label-short" data-i18n hidden>Play</span>
            </button>
            <button id="btn-shuffle-album-all" class="btn btn-secondary" title="Random Play" aria-label="Random Play">
              <span class="material-symbols-outlined">shuffle</span>
            </button>
            ${isDiscoverDaily ? `
              <button id="btn-refresh-discover-daily" class="btn btn-secondary" title="Refresh Discover Daily" aria-label="Refresh Discover Daily">
                <span class="material-symbols-outlined">refresh</span>
                <span class="btn-refresh-label" data-i18n>Refresh</span>
              </button>
            ` : ''}
            ${isPlaylist ? '' : `
              <button id="btn-add-album-to-playlist" class="btn btn-secondary" title="Add all to playlist" aria-label="Add all to playlist">
                <span class="material-symbols-outlined">playlist_add</span>
                <span data-i18n>Add to Playlist</span>
              </button>
            `}
            <button id="btn-download-album" class="btn btn-secondary" title="Download" aria-label="Download">
              <span class="material-symbols-outlined">download</span>
              <span id="btn-download-album-label" data-i18n>Download</span>
            </button>
          </div>
          ${isPlaylist && !isDiscoverDaily ? `
            <div class="playlist-manage-actions">
              <button id="btn-add-playlist-tracks" class="btn btn-secondary" title="Add Tracks">
                <span class="material-symbols-outlined">playlist_add</span>
                <span data-i18n>Add Tracks to Playlist</span>
              </button>
              ${!isLikedSongs ? `
                <button id="btn-edit-playlist" class="btn btn-secondary" title="Edit Playlist">
                  <span class="material-symbols-outlined">edit</span>
                  <span data-i18n>Edit</span>
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <h2 class="section-title" data-i18n>Tracks</h2>

      <div id="album-tracks-toolbar" class="tracks-toolbar">
        <button id="btn-tracks-select-all" class="tracks-toolbar-icon-btn" title="Select All" aria-label="Select All" data-i18n-title="Select All">
          <span class="material-symbols-outlined">check_box_outline_blank</span>
        </button>
        <span id="album-tracks-selected-count" class="tracks-toolbar-count"></span>
        ${!isLikedSongs && !isDiscoverDaily && album.Type === 'Playlist' ? `
          <button id="btn-tracks-remove-playlist" class="tracks-toolbar-icon-btn" title="Remove from Playlist" aria-label="Remove from Playlist" data-i18n-title="Remove from Playlist">
            <span class="material-symbols-outlined">playlist_remove</span>
          </button>
        ` : ''}
        <button id="btn-tracks-add-playlist" class="tracks-toolbar-icon-btn" title="Add to Playlist" aria-label="Add to Playlist" data-i18n-title="Add to Playlist">
          <span class="material-symbols-outlined">playlist_add</span>
        </button>
        <button id="btn-tracks-add-queue" class="tracks-toolbar-icon-btn" title="Add to Queue" aria-label="Add to Queue" data-i18n-title="Add to Queue">
          <span class="material-symbols-outlined">queue_music</span>
        </button>
        <button id="btn-tracks-clear-selection" class="tracks-toolbar-icon-btn" title="Clear selection" aria-label="Clear selection" data-i18n-title="Clear selection">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div id="album-songs-list" class="tracks-list">
        <div style="color: var(--text-muted);" data-i18n>Loading...</div>
      </div>
    </div>
  `;

  if (!isLikedSongs && !isDiscoverDaily && initialArtistsInfo.length > 0) {
    bindArtistLinks(container);
  }

  const btnEdit = container.querySelector('#btn-edit-playlist');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      openEditPlaylistModal(album.Id, album.Name, () => {
        renderAlbumDetailView(container, album.Id);
      }, () => {
        window.history.pushState({ view: 'playlists' }, '', 'playlists.html');
        switchView('playlists');
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

  const btnRefreshDiscoverDaily = container.querySelector('#btn-refresh-discover-daily');
  if (btnRefreshDiscoverDaily) {
    btnRefreshDiscoverDaily.addEventListener('click', async () => {
      discoverDailyRefreshCount += 1;
      const icon = btnRefreshDiscoverDaily.querySelector('.material-symbols-outlined');
      if (icon) icon.style.animation = 'spin 1s linear infinite';
      await renderAlbumDetailView(container, album);
      const freshBtn = container.querySelector('#btn-refresh-discover-daily');
      const freshIcon = freshBtn?.querySelector('.material-symbols-outlined');
      if (freshIcon) freshIcon.style.animation = '';
    });
  }

  let currentSongs = [];

  const selection = setupTrackSelection({
    getSongs: () => currentSongs,
    getAlbumId: () => album.Id,
    onRemoveDone: () => renderAlbumDetailView(container, album)
  });

  const applySelectionUI = selection.applySelectionUI;

  const renderHeader = (data) => {
    if (isLikedSongs || isDiscoverDaily) return;
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
    if (typeEl) typeEl.textContent = formatItemType(data.Type) || (isPlaylist ? 'Playlist' : 'Album');
    if (coverEl && coverEl.tagName === 'IMG') coverEl.src = getArtworkUrl(data, 'Primary', 400);
  };

  // If album metadata is incomplete or loaded from URL, fetch via getItemCached (skip for virtual playlists)
  if (!isLikedSongs && !isDiscoverDaily) {
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
        songsList.innerHTML = `<div style="color: var(--text-secondary);">${isLikedSongs ? 'No liked songs yet. Click the heart icon on any track to add it to your Liked Songs!' : (isDiscoverDaily ? 'No songs found for Discover Daily.' : (isPlaylist ? 'No tracks found in this playlist.' : 'No tracks found in this album.'))}</div>`;
        updateDownloadAllButton([]);
        const toolbar = document.getElementById('album-tracks-toolbar');
        if (toolbar) toolbar.classList.remove('visible');
      } else {
        registerTracksFavoriteStatus(songsRes.Items);
        songsList.innerHTML = songsRes.Items.map((track, idx) => renderTrackRowHTML(track, idx)).join('');
        bindTrackRows(songsList, songsRes.Items);
        bindArtistLinks(songsList);

        currentSongs = songsRes.Items;
        selection.setTrackIds(songsRes.Items.map(t => String(t.Id || t.id)).filter(Boolean));

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

        const btnAddAlbumToPlaylist = document.getElementById('btn-add-album-to-playlist');
        if (btnAddAlbumToPlaylist) {
          btnAddAlbumToPlaylist.onclick = () => {
            if (songsRes.Items && songsRes.Items.length > 0) {
              openSelectPlaylistModal(songsRes.Items);
            }
          };
        }

        updateDownloadAllButton(songsRes.Items);
      }
    }
  };

  const btnDownloadAlbum = document.getElementById('btn-download-album');
  const btnDownloadAlbumLabel = document.getElementById('btn-download-album-label');
  const downloadAll = setupDownloadAllButton({
    button: btnDownloadAlbum,
    label: btnDownloadAlbumLabel,
    getAlbum: () => album,
    isLikedSongs,
    isDiscoverDaily,
    isPlaylist
  });
  const updateDownloadAllButton = downloadAll.update;

  try {
    let songsRes;
    if (isLikedSongs) {
      songsRes = await getFavoriteSongsCached({}, updateSongsList);
    } else if (isDiscoverDaily) {
      const seed = getDiscoverDailySeed();
      const discoverOptions = { limit: 250, sortBy: 'DatePlayed,PlayCount,SortName', sortOrder: 'Descending' };
      const updateDiscoverDaily = (res) => updateSongsList({ ...res, Items: getRecommendedTracks(res?.Items || [], HOME_LIMITS.discoverDailyTracks, 'discoverTrack', seed) });
      const res = await getSongsCached(discoverOptions, updateDiscoverDaily, discoverDailyRefreshCount > 0);
      songsRes = { ...res, Items: getRecommendedTracks(res?.Items || [], HOME_LIMITS.discoverDailyTracks, 'discoverTrack', seed) };
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