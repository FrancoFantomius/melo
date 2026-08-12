import { getAlbumsCached } from '../../../jellyfin/client.js';
import { renderAlbumCardHTML, bindAlbumCards } from '../common.js';
import { getTranslation } from '../../../i18n.js';

export async function renderAlbumsView(container) {
  container.innerHTML = `
    <div class="view-section">
      <h2 class="section-title" data-i18n>Albums</h2>
      <div id="albums-grid" class="cards-grid">
        <div style="color: var(--text-muted);" data-i18n>Loading...</div>
      </div>
    </div>
  `;

  const updateAlbumsGrid = (res) => {
    const grid = document.getElementById('albums-grid');
    if (grid && res) {
      if (!res.Items || res.Items.length === 0) {
        grid.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No results found</div>`;
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
      container.innerHTML = `<div style="color: var(--danger);">${getTranslation('An error occurred')}: ${err.message}</div>`;
    }
  }
}