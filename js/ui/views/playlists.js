import { getPlaylistsCached } from '../../jellyfin/client.js';
import { renderAlbumCardHTML, bindAlbumCards } from './common.js';
import { switchView } from '../views.js';
import { renderAlbumDetailView } from './albums.js';
import { getTranslation } from '../../i18n.js';
import { openCreatePlaylistModal } from '../modals.js';

export function openPlaylist(playlistId, playlistObj = null) {
  if (!playlistId) return;
  const isLikedSongs = playlistId === 'liked-songs' || playlistObj?.Type === 'LikedSongs';
  const targetUrl = isLikedSongs
    ? 'playlists.html?playlist=liked-songs'
    : `playlists.html?playlist=${encodeURIComponent(playlistId)}`;
  const currentSearch = window.location.search;
  if (currentSearch !== `?playlist=liked-songs` && currentSearch !== `?playlist=${encodeURIComponent(playlistId)}`) {
    window.history.pushState({ view: 'playlist-detail', playlistId }, '', targetUrl);
  }
  switchView('playlist-detail', playlistObj || { Id: playlistId, Type: isLikedSongs ? 'LikedSongs' : 'Playlist' });
}

export async function renderPlaylistDetailView(container, playlistOrId) {
  let playlistObj = typeof playlistOrId === 'string'
    ? { Id: playlistOrId, Type: 'Playlist' }
    : { Type: 'Playlist', ...playlistOrId };
  return renderAlbumDetailView(container, playlistObj);
}

export async function renderPlaylistsView(container) {
  container.innerHTML = `
    <div class="view-section">
      <div class="playlists-header">
        <h2 class="section-title" data-i18n>Playlists</h2>
        <button id="btn-create-playlist" class="btn btn-primary">
          <span class="material-symbols-outlined" style="font-size: 20px;">add</span>
          <span data-i18n>Create Playlist</span>
        </button>
      </div>
      <div id="playlists-grid" class="cards-grid">
        <div style="color: var(--text-muted);" data-i18n>Loading...</div>
      </div>
    </div>
  `;

  const btnCreate = document.getElementById('btn-create-playlist');
  btnCreate?.addEventListener('click', () => {
    openCreatePlaylistModal(async () => {
      try {
        const res = await getPlaylistsCached(updatePlaylistsGrid);
        updatePlaylistsGrid(res);
      } catch (e) {
        console.error('[Playlists] Refresh error after creation:', e);
      }
    });
  });

  const updatePlaylistsGrid = (res) => {
    const grid = document.getElementById('playlists-grid');
    if (grid && res) {
      const likedCard = { Id: 'liked-songs', Name: getTranslation('Liked Songs'), Type: 'LikedSongs' };
      const items = [likedCard, ...(res.Items || [])];
      grid.innerHTML = items.map(playlist => renderAlbumCardHTML(playlist, 'Playlist')).join('');
      bindAlbumCards(grid);
    }
  };

  try {
    const res = await getPlaylistsCached(updatePlaylistsGrid);
    updatePlaylistsGrid(res);
  } catch (err) {
    const grid = document.getElementById('playlists-grid');
    const likedCard = { Id: 'liked-songs', Name: getTranslation('Liked Songs'), Type: 'LikedSongs' };
    if (grid) {
      grid.innerHTML = renderAlbumCardHTML(likedCard, 'Playlist');
      bindAlbumCards(grid);
    } else {
      container.innerHTML = `<div style="color: var(--danger);">${getTranslation('An error occurred')}: ${err.message}</div>`;
    }
  }
}

