import { getArtistsCached, getItemCached, getAlbumsCached, getSongsCached, getArtworkUrl } from '../../jellyfin/client.js';
import { setQueue } from '../../player/queue.js';
import { playTrack } from '../../player/audio.js';
import { switchView } from '../views.js';
import { renderAlbumCardHTML, bindAlbumCards, bindArtistCards, renderTrackRowHTML, bindTrackRows, bindArtistLinks } from './common.js';
import { registerTracksFavoriteStatus } from '../../player/likes.js';
import { getTranslation } from '../../i18n.js';
import { getPlaceholder } from '../placeholders.js';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/tooltip';

export function openArtist(artistIdOrName, artistObj = null) {
  if (!artistIdOrName) return;
  const targetUrl = `artists.html?artist=${encodeURIComponent(artistIdOrName)}`;
  const currentSearch = window.location.search;
  if (currentSearch !== `?artist=${encodeURIComponent(artistIdOrName)}`) {
    window.history.pushState({ view: 'artist-detail', artistIdOrName }, '', targetUrl);
  }
  switchView('artist-detail', artistObj || { Id: artistIdOrName, Name: artistIdOrName });
}

export async function renderArtistsView(container) {
  container.innerHTML = `
    <div class="view-section">
      <h2 class="section-title" data-i18n>Artists</h2>
      <div id="artists-grid" class="cards-grid">
        <div style="color: var(--text-muted);" data-i18n>Loading...</div>
      </div>
    </div>
  `;

  const updateArtistsGrid = (res) => {
    const grid = document.getElementById('artists-grid');
    if (grid && res) {
      if (!res.Items || res.Items.length === 0) {
        grid.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No artists found.</div>`;
      } else {
        grid.innerHTML = res.Items.map(artist => `
          <div class="media-card" data-artist-id="${artist.Id}">
            <img src="${getArtworkUrl(artist, 'Primary', 300, 'artist')}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('artist') : '${getPlaceholder('artist')}';" data-placeholder-type="artist" class="card-thumb" style="border-radius: 50%;" alt="${artist.Name}">
            <div class="card-title" style="text-align: center;">${artist.Name}</div>
            <div class="card-subtitle" style="text-align: center;" data-i18n>Artist</div>
          </div>
        `).join('');
        bindArtistCards(grid);
      }
    }
  };

  try {
    const res = await getArtistsCached({ limit: 100 }, updateArtistsGrid);
    updateArtistsGrid(res);
  } catch (err) {
    const grid = document.getElementById('artists-grid');
    if (!grid || !grid.querySelector('.media-card')) {
      container.innerHTML = `<div style="color: var(--danger);">${getTranslation('An error occurred')}: ${err.message}</div>`;
    }
  }
}

export async function renderArtistDetailView(container, artistOrId) {
  if (!artistOrId) return;

  let artist = typeof artistOrId === 'string' ? { Id: artistOrId, Name: artistOrId } : artistOrId;

  container.innerHTML = `
    <div class="view-section">
      <div class="album-detail-banner">
        <img id="artist-detail-cover" src="${getArtworkUrl(artist, 'Primary', 400, 'artist')}" onerror="this.onerror=null; this.src=window.getPlaceholder ? window.getPlaceholder('artist') : '${getPlaceholder('artist')}';" data-placeholder-type="artist" class="album-cover-lg" style="border-radius: 50%;" alt="${artist.Name || 'Artist'}">
        <div class="album-info-meta">
          <span class="album-detail-type" data-i18n>Artist</span>
          <h1 id="artist-detail-name" class="album-detail-title">${artist.Name || 'Loading...'}</h1>
          <div class="album-detail-actions">
            <md-button id="btn-play-artist-all" variant="filled">
              <md-icon slot="icon" name="play_arrow" filled></md-icon>
              <span data-i18n>Play All</span>
            </md-button>
            <md-icon-button id="btn-shuffle-artist-all" variant="tonal" icon="shuffle" aria-label="Random Play"></md-icon-button>
            <md-tooltip for="btn-shuffle-artist-all" position="top" data-i18n-value="Random Play" value="Random Play"></md-tooltip>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h2 class="section-title" style="font-size: 20px; font-weight: 700; margin-bottom: 16px;" data-i18n>Albums</h2>
        <div id="artist-albums-grid" class="cards-grid">
          <div style="color: var(--text-muted);" data-i18n>Loading...</div>
        </div>
        <div id="artist-albums-load-more" style="display: none; text-align: center; margin-top: 16px;">
          <md-button id="btn-artist-albums-load-more" variant="tonal">
            <span data-i18n>Load More</span>
          </md-button>
        </div>
      </div>

      <div style="margin-top: 32px;">
        <h2 class="section-title" style="font-size: 20px; font-weight: 700; margin-bottom: 16px;" data-i18n>Popular Tracks</h2>
        <div id="artist-songs-list" class="tracks-list">
          <div style="color: var(--text-muted);" data-i18n>Loading...</div>
        </div>
      </div>
    </div>
  `;

  // Fetch full artist item if needed
  try {
    const fetchedArtist = await getItemCached(artist.Id, (revalidated) => {
      if (revalidated) {
        artist = { ...artist, ...revalidated };
        const nameEl = document.getElementById('artist-detail-name');
        const coverEl = document.getElementById('artist-detail-cover');
        if (nameEl && artist.Name) nameEl.textContent = artist.Name;
        if (coverEl) coverEl.src = getArtworkUrl(artist, 'Primary', 400, 'artist');
      }
    });
    if (fetchedArtist) {
      artist = { ...artist, ...fetchedArtist };
      const nameEl = document.getElementById('artist-detail-name');
      const coverEl = document.getElementById('artist-detail-cover');
      if (nameEl && artist.Name) nameEl.textContent = artist.Name;
      if (coverEl) coverEl.src = getArtworkUrl(artist, 'Primary', 400, 'artist');
    }
  } catch (err) {
    console.warn('[Views] getItemCached for artist failed:', err);
  }

  // Load Artist Albums
  let albumsExpanded = false;

  const updateArtistAlbums = (res) => {
    const grid = document.getElementById('artist-albums-grid');
    const loadMoreContainer = document.getElementById('artist-albums-load-more');
    const btnLoadMore = document.getElementById('btn-artist-albums-load-more');

    if (grid && res) {
      if (!res.Items || res.Items.length === 0) {
        grid.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No albums found for this artist.</div>`;
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      } else {
        const isMobile = window.innerWidth <= 768;
        const totalItems = res.Items;

        if (isMobile && totalItems.length > 4 && !albumsExpanded) {
          grid.innerHTML = totalItems.slice(0, 4).map(album => renderAlbumCardHTML(album)).join('');
          bindAlbumCards(grid);

          if (loadMoreContainer) {
            loadMoreContainer.style.display = 'block';
            if (btnLoadMore) {
              btnLoadMore.onclick = () => {
                albumsExpanded = true;
                grid.innerHTML = totalItems.map(album => renderAlbumCardHTML(album)).join('');
                bindAlbumCards(grid);
                loadMoreContainer.style.display = 'none';
              };
            }
          }
        } else {
          grid.innerHTML = totalItems.map(album => renderAlbumCardHTML(album)).join('');
          bindAlbumCards(grid);
          if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        }
      }
    }
  };

  try {
    const albumsRes = await getAlbumsCached({ artistId: artist.Id }, updateArtistAlbums);
    updateArtistAlbums(albumsRes);
  } catch (err) {
    console.error('[Views] Failed to fetch artist albums:', err);
  }

  // Load Artist Songs
  const updateArtistSongs = (res) => {
    const songsList = document.getElementById('artist-songs-list');
    const btnPlayAll = document.getElementById('btn-play-artist-all');
    const btnShuffleAll = document.getElementById('btn-shuffle-artist-all');

    if (songsList && res) {
      if (!res.Items || res.Items.length === 0) {
        songsList.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No tracks found for this artist.</div>`;
        if (btnPlayAll) btnPlayAll.style.display = 'none';
        if (btnShuffleAll) btnShuffleAll.style.display = 'none';
      } else {
        registerTracksFavoriteStatus(res.Items);
        songsList.innerHTML = res.Items.map((track, idx) => renderTrackRowHTML(track, idx)).join('');
        bindTrackRows(songsList, res.Items);
        bindArtistLinks(songsList);

        if (btnPlayAll) {
          btnPlayAll.style.display = 'inline-flex';
          btnPlayAll.onclick = () => {
            setQueue(res.Items, 0);
            playTrack(res.Items[0]);
          };
        }

        if (btnShuffleAll) {
          btnShuffleAll.style.display = 'inline-flex';
          btnShuffleAll.onclick = () => {
            const shuffled = [...res.Items].sort(() => Math.random() - 0.5);
            setQueue(shuffled, 0);
            playTrack(shuffled[0]);
          };
        }
      }
    }
  };

  try {
    const songsRes = await getSongsCached({ artistId: artist.Id }, updateArtistSongs);
    updateArtistSongs(songsRes);
  } catch (err) {
    console.error('[Views] Failed to fetch artist songs:', err);
  }
}
