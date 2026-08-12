import { isTrackDownloaded, downloadTracks, removeDownloads } from '../../../jellyfin/offline.js';
import { getArtworkUrl } from '../../../jellyfin/client.js';
import { getTranslation } from '../../../i18n.js';
import { LIKED_SONGS_PLAYLIST, DISCOVER_DAILY_PLAYLIST } from '../../../recommendations.js';

export function setupDownloadAllButton({ button, label, getAlbum, isLikedSongs, isDiscoverDaily, isPlaylist }) {
  let currentTracks = [];

  const isAllDownloaded = async (tracks) => {
    for (const track of tracks || []) {
      const key = track && (track.Id || track.id);
      if (!key || !(await isTrackDownloaded(key))) return false;
    }
    return true;
  };

  const updateDownloadAllButton = async (tracks) => {
    currentTracks = tracks || [];
    if (!button || !button.isConnected) return;

    if (!currentTracks.length) {
      button.style.display = 'none';
      return;
    }
    button.style.display = 'inline-flex';

    const allDownloaded = await isAllDownloaded(currentTracks);
    const icon = button.querySelector('.material-symbols-outlined');
    if (allDownloaded) {
      button.classList.add('downloaded');
      button.title = 'Remove Download';
      if (icon) icon.textContent = 'download_done';
      if (label) label.textContent = getTranslation('Remove Download');
    } else {
      button.classList.remove('downloaded');
      button.title = 'Download';
      if (icon) icon.textContent = 'download';
      if (label) label.textContent = getTranslation('Download');
    }
  };

  if (button) {
    button.addEventListener('click', async () => {
      if (!currentTracks.length) return;

      const allDownloaded = await isAllDownloaded(currentTracks);

      if (allDownloaded) {
        await removeDownloads(currentTracks);
        await updateDownloadAllButton(currentTracks);
        return;
      }

      button.disabled = true;
      button.classList.add('downloading');
      const icon = button.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'downloading';
      if (label) label.textContent = getTranslation('Downloading...');

      const album = getAlbum();
      const group = {
        id: album.Id,
        name: album.Name || '',
        type: isPlaylist ? 'Playlist' : 'Album',
        artworkUrl: isLikedSongs ? LIKED_SONGS_PLAYLIST.CoverUrl
          : isDiscoverDaily ? DISCOVER_DAILY_PLAYLIST.CoverUrl
          : getArtworkUrl(album, 'Primary', 300),
        owner: (isLikedSongs || isDiscoverDaily) ? '' : (album.AlbumArtist || album.Artists?.join(', ') || ''),
        count: currentTracks.length
      };

      await downloadTracks(currentTracks, ({ completed, total }) => {
        if (label && total > 0) {
          label.textContent = `${getTranslation('Downloading...')} ${completed}/${total}`;
        }
      }, group);

      button.disabled = false;
      button.classList.remove('downloading');
      await updateDownloadAllButton(currentTracks);
    });
  }

  window.addEventListener('melo-download-changed', (e) => {
    if (!currentTracks.length) return;
    if (button && button.classList.contains('downloading')) return;
    const { trackId } = e.detail || {};
    if (trackId && currentTracks.some(t => String(t.Id || t.id) === String(trackId))) {
      updateDownloadAllButton(currentTracks);
    }
  });

  return { update: updateDownloadAllButton };
}