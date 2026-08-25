import { downloadTrack, isTrackDownloaded } from '../jellyfin/offline.js';
import { getTranslation } from '../i18n.js';

const ICONS = {
  idle: 'download',
  downloading: 'downloading',
  downloaded: 'download_done'
};

export function setDownloadButtonState(button, state, title = '') {
  if (!button) return;
  const icon = button.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = ICONS[state] || ICONS.idle;
  button.classList.toggle('downloading', state === 'downloading');
  button.classList.toggle('downloaded', state === 'downloaded');
  if (title) {
    const translated = getTranslation(title);
    button.setAttribute('aria-label', translated);
    if (button.id) {
      const tooltip = document.querySelector(`md-tooltip[for="${button.id}"]`);
      if (tooltip) {
        tooltip.dataset.i18nValueEn = title;
        tooltip.value = translated;
        tooltip.setAttribute('value', translated);
      } else {
        button.title = translated;
      }
    } else {
      button.title = translated;
    }
  }
}

export function setDownloadButtonProgress(button, progress) {
  if (!button || typeof progress !== 'number') return;
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  button.style.setProperty('--download-progress', `${pct}%`);
  if (button.classList.contains('downloading')) {
    const titleKey = pct >= 100 ? 'Downloading...' : `${pct}%`;
    const translated = pct >= 100 ? getTranslation('Downloading...') : `${pct}%`;
    button.setAttribute('aria-label', translated);
    if (button.id) {
      const tooltip = document.querySelector(`md-tooltip[for="${button.id}"]`);
      if (tooltip) {
        tooltip.dataset.i18nValueEn = titleKey;
        tooltip.value = translated;
        tooltip.setAttribute('value', translated);
      } else {
        button.title = translated;
      }
    } else {
      button.title = translated;
    }
  }
}

export async function refreshDownloadButton(button) {
  if (!button) return;
  // Don't override a button that is currently downloading
  if (button.classList.contains('downloading')) return;
  const trackId = button.getAttribute('data-track-id');
  if (!trackId) return;
  const downloaded = await isTrackDownloaded(trackId);
  setDownloadButtonState(button, downloaded ? 'downloaded' : 'idle', downloaded ? 'Remove Download' : 'Download');
  setDownloadButtonProgress(button, 0);
}

export async function toggleTrackDownload(track, button = null) {
  if (!track) return;

  const trackId = String(track.Id || track.id || '');
  if (!trackId) return;

  const wasDownloaded = await isTrackDownloaded(trackId);

  // If we don't have a button to update, keep the UI simple: toggle and let
  // the global 'melo-download-changed' listener refresh all buttons.
  if (button) {
    if (wasDownloaded) {
      setDownloadButtonState(button, 'idle', 'Download');
      setDownloadButtonProgress(button, 0);
    } else {
      setDownloadButtonState(button, 'downloading', 'Downloading...');
      setDownloadButtonProgress(button, 0);
      button.classList.add('downloading');
    }
  }

  const result = await downloadTrack(track, (progress) => {
    if (button && !wasDownloaded) {
      setDownloadButtonProgress(button, progress);
    }
  });

  if (button && !wasDownloaded) {
    if (result.ok) {
      setDownloadButtonState(button, 'downloaded', 'Remove Download');
      setDownloadButtonProgress(button, 1);
    } else {
      setDownloadButtonState(button, 'idle', 'Download');
      setDownloadButtonProgress(button, 0);
    }
  }

  return result;
}
