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
import { getPlaceholder } from '../../placeholders.js';
import { setupTrackSelection } from './detail-selection.js';
import { setupDownloadAllButton } from './detail-download.js';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/tooltip';

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

  const placeholderType = isPlaylist ? 'playlist' : 'album';
  const coverHTML = isLikedSongs
    ? `<img id="album-detail-cover" src="${LIKED_SONGS_PLAYLIST.CoverUrl}" data-placeholder-type="favorite" class="album-cover-lg" alt="Liked Songs">`
    : (isDiscoverDaily
      ? `<img id="album-detail-cover" src="${DISCOVER_DAILY_PLAYLIST.CoverUrl}" data-placeholder-type="explore" class="album-cover-lg" alt="Discover Daily">`
      : `<img id="album-detail-cover" src="${getArtworkUrl(album, 'Primary', 400, placeholderType)}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('${placeholderType}') : '${getPlaceholder(placeholderType)}';" data-placeholder-type="${placeholderType}" class="album-cover-lg" alt="${album.Name || (isPlaylist ? 'Playlist' : 'Album')}">`);

  container.innerHTML = `
    <div class="view-section album-detail-section">
      <div class="album-detail-banner">
        ${coverHTML}
        <div class="album-info-meta">
          <span id="album-detail-type" class="album-detail-type">${isPlaylist ? 'Playlist' : formatItemType(album.Type) || 'Album'}</span>
          <h1 id="album-detail-title" class="album-detail-title">${album.Name || (isLikedSongs ? 'Liked Songs' : (isPlaylist ? 'Playlist' : 'Album'))}</h1>
          <span id="album-detail-artist" class="album-detail-artist">${initialArtistHTML}</span>
          <div class="album-detail-actions">
            <md-button id="btn-play-album-all" variant="filled">
              <md-icon slot="icon" name="play_arrow" filled></md-icon>
              <span class="btn-play-label-full" data-i18n>Play All</span>
              <span class="btn-play-label-short" data-i18n hidden>Play</span>
            </md-button>
            <md-icon-button id="btn-shuffle-album-all" variant="tonal" icon="shuffle" aria-label="Random Play"></md-icon-button>
            <md-tooltip for="btn-shuffle-album-all" position="top" data-i18n-value="Random Play" value="Random Play"></md-tooltip>
            ${isDiscoverDaily ? `
              <md-button id="btn-refresh-discover-daily" variant="tonal" aria-label="Refresh Discover Daily">
                <md-icon slot="icon" name="refresh"></md-icon>
                <span class="btn-refresh-label" data-i18n>Refresh</span>
              </md-button>
              <md-tooltip for="btn-refresh-discover-daily" position="top" data-i18n-value="Refresh Discover Daily" value="Refresh Discover Daily"></md-tooltip>
            ` : ''}
            ${isPlaylist ? '' : `
              <md-button id="btn-add-album-to-playlist" variant="tonal" aria-label="Add all to playlist">
                <md-icon slot="icon" name="playlist_add"></md-icon>
                <span data-i18n>Add to Playlist</span>
              </md-button>
              <md-tooltip for="btn-add-album-to-playlist" position="top" data-i18n-value="Add to Playlist" value="Add to Playlist"></md-tooltip>
            `}
            <md-button id="btn-download-album" variant="tonal" aria-label="Download">
              <md-icon slot="icon" name="download"></md-icon>
              <span id="btn-download-album-label" data-i18n>Download</span>
            </md-button>
            <md-tooltip id="tooltip-download-album" for="btn-download-album" position="top" data-i18n-value="Download" value="Download"></md-tooltip>
          </div>
          ${isPlaylist && !isDiscoverDaily ? `
            <div class="playlist-manage-actions">
              <md-button id="btn-add-playlist-tracks" variant="tonal">
                <md-icon slot="icon" name="playlist_add"></md-icon>
                <span data-i18n>Add Tracks to Playlist</span>
              </md-button>
              <md-tooltip for="btn-add-playlist-tracks" position="top" data-i18n-value="Add Tracks to Playlist" value="Add Tracks to Playlist"></md-tooltip>
              ${!isLikedSongs ? `
                <md-button id="btn-edit-playlist" variant="tonal">
                  <md-icon slot="icon" name="edit"></md-icon>
                  <span data-i18n>Edit</span>
                </md-button>
                <md-tooltip for="btn-edit-playlist" position="top" data-i18n-value="Edit" value="Edit"></md-tooltip>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <h2 class="section-title" data-i18n>Tracks</h2>

      <div id="album-tracks-toolbar" class="tracks-toolbar">
        <md-icon-button id="btn-tracks-select-all" variant="standard" icon="check_box_outline_blank" aria-label="Select All"></md-icon-button>
        <md-tooltip for="btn-tracks-select-all" position="top" data-i18n-value="Select All" value="Select All"></md-tooltip>
        <span id="album-tracks-selected-count" class="tracks-toolbar-count"></span>
        ${!isLikedSongs && !isDiscoverDaily && album.Type === 'Playlist' ? `
          <md-icon-button id="btn-tracks-remove-playlist" variant="standard" icon="playlist_remove" aria-label="Remove from Playlist"></md-icon-button>
          <md-tooltip for="btn-tracks-remove-playlist" position="top" data-i18n-value="Remove from Playlist" value="Remove from Playlist"></md-tooltip>
        ` : ''}
        <md-icon-button id="btn-tracks-add-playlist" variant="standard" icon="playlist_add" aria-label="Add to Playlist"></md-icon-button>
        <md-tooltip for="btn-tracks-add-playlist" position="top" data-i18n-value="Add to Playlist" value="Add to Playlist"></md-tooltip>
        <md-icon-button id="btn-tracks-add-queue" variant="standard" icon="queue_music" aria-label="Add to Queue"></md-icon-button>
        <md-tooltip for="btn-tracks-add-queue" position="top" data-i18n-value="Add to Queue" value="Add to Queue"></md-tooltip>
        <md-icon-button id="btn-tracks-clear-selection" variant="standard" icon="close" aria-label="Clear selection"></md-icon-button>
        <md-tooltip for="btn-tracks-clear-selection" position="top" data-i18n-value="Clear selection" value="Clear selection"></md-tooltip>
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
      const icon = btnRefreshDiscoverDaily.querySelector('md-icon') || btnRefreshDiscoverDaily.querySelector('.material-symbols-outlined');
      if (icon) icon.style.animation = 'spin 1s linear infinite';
      await renderAlbumDetailView(container, album);
      const freshBtn = container.querySelector('#btn-refresh-discover-daily');
      const freshIcon = freshBtn?.querySelector('md-icon') || freshBtn?.querySelector('.material-symbols-outlined');
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
    if (coverEl && coverEl.tagName === 'IMG') {
      const pType = isPlaylist || data.Type === 'Playlist' ? 'playlist' : 'album';
      coverEl.src = getArtworkUrl(data, 'Primary', 400, pType);
      coverEl.setAttribute('data-placeholder-type', pType);
    }
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