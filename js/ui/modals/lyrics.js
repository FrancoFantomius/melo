import { getArtworkUrl, getLyrics } from '../../jellyfin/client.js';
import { getCurrentTrack } from '../../player/queue.js';
import { seekTo } from '../../player/audio.js';
import { escapeHtml } from './shared.js';

let currentLyricsTrackId = null;
let currentLyricsLines = [];
let activeLineIndex = -1;

export function initLyricsModal() {
  const btnLyricsClose = document.getElementById('btn-lyrics-close');
  btnLyricsClose?.addEventListener('click', () => closeLyricsModal());
}

export async function openLyricsModal(track = null) {
  if (window.location.hash !== '#lyrics') {
    window.location.hash = 'lyrics';
  }
  return openLyricsModalInternal(track);
}

export async function openLyricsModalInternal(track = null) {
  const currentTrack = track || getCurrentTrack();
  if (!currentTrack) return;

  const lyricsView = document.getElementById('lyrics-view');
  const bgArtEl = document.getElementById('lyrics-bg-art');
  const titleEl = document.getElementById('lyrics-track-title');
  const artistEl = document.getElementById('lyrics-track-artist');
  const bodyEl = document.getElementById('lyrics-view-body');
  const btnLyrics = document.getElementById('player-btn-lyrics');
  const empBtnLyrics = document.getElementById('emp-btn-lyrics');

  if (!lyricsView || !bodyEl) return;

  btnLyrics?.classList.add('active');
  empBtnLyrics?.classList.add('active');
  lyricsView.style.display = 'flex';

  if (bgArtEl) {
    bgArtEl.src = getArtworkUrl(currentTrack, 'Primary', 600);
  }
  if (titleEl) {
    titleEl.textContent = currentTrack.Name || 'Track';
  }
  if (artistEl) {
    artistEl.textContent = currentTrack.Artists?.join(', ') || currentTrack.AlbumArtist || '';
  }

  if (currentLyricsTrackId === currentTrack.Id && bodyEl.children.length > 0 && !bodyEl.querySelector('.lyrics-loading')) {
    return;
  }

  currentLyricsTrackId = currentTrack.Id;
  currentLyricsLines = [];
  activeLineIndex = -1;

  bodyEl.innerHTML = '<div class="lyrics-loading" style="color: rgba(255,255,255,0.7); text-align: center; padding: 20px;">Loading lyrics...</div>';

  const data = await getLyrics(currentTrack.Id);

  if (currentLyricsTrackId !== currentTrack.Id) return;

  if (data && data.Lyrics && Array.isArray(data.Lyrics) && data.Lyrics.length > 0) {
    currentLyricsLines = data.Lyrics.map((item, idx) => ({
      index: idx,
      text: item.Text || '',
      startSec: item.Start !== undefined && item.Start !== null ? item.Start / 10000000 : null
    }));

    bodyEl.innerHTML = currentLyricsLines.map((line) => {
      const isSynced = line.startSec !== null && isFinite(line.startSec);
      return `<div class="lyric-line ${isSynced ? 'synced' : ''}" data-index="${line.index}" ${isSynced ? `data-start="${line.startSec}"` : ''}>${escapeHtml(line.text || '♪')}</div>`;
    }).join('');

    bodyEl.querySelectorAll('.lyric-line.synced').forEach(el => {
      el.addEventListener('click', () => {
        const startSec = parseFloat(el.getAttribute('data-start'));
        if (isFinite(startSec)) {
          seekTo(startSec);
        }
      });
    });
  } else if (data && typeof data === 'string' && data.trim()) {
    const lines = data.split('\n');
    currentLyricsLines = lines.map((line, idx) => ({
      index: idx,
      text: line,
      startSec: null
    }));
    bodyEl.innerHTML = lines.map(line => `<div class="lyric-line">${escapeHtml(line || '♪')}</div>`).join('');
  } else {
    bodyEl.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 20px;">No lyrics available for this track</div>';
  }
}

export function closeLyricsModal() {
  if (window.location.hash === '#lyrics') {
    window.history.back();
    setTimeout(() => {
      if (window.location.hash === '#lyrics') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        closeLyricsModalInternal();
      }
    }, 50);
  } else {
    closeLyricsModalInternal();
  }
}

export function closeLyricsModalInternal() {
  const lyricsView = document.getElementById('lyrics-view');
  if (lyricsView) lyricsView.style.display = 'none';
  document.getElementById('player-btn-lyrics')?.classList.remove('active');
  document.getElementById('emp-btn-lyrics')?.classList.remove('active');
}

export function toggleLyricsModal(track = null) {
  const lyricsView = document.getElementById('lyrics-view');
  if (!lyricsView) return;

  const isOpen = (lyricsView.style.display === 'flex') || window.location.hash === '#lyrics';
  if (isOpen) {
    closeLyricsModal();
  } else {
    openLyricsModal(track);
  }
}

export function updateLyricsSync(currentTime) {
  const lyricsView = document.getElementById('lyrics-view');
  if (!lyricsView || lyricsView.style.display === 'none') return;

  const currentTrack = getCurrentTrack();
  if (currentTrack && currentLyricsTrackId !== currentTrack.Id) {
    openLyricsModalInternal(currentTrack);
    return;
  }

  if (!currentLyricsLines || currentLyricsLines.length === 0) return;

  let nextActiveIndex = -1;
  for (let i = 0; i < currentLyricsLines.length; i++) {
    const line = currentLyricsLines[i];
    if (line.startSec !== null && isFinite(line.startSec) && currentTime >= line.startSec - 0.2) {
      nextActiveIndex = i;
    } else if (line.startSec !== null && isFinite(line.startSec) && currentTime < line.startSec - 0.2) {
      break;
    }
  }

  if (nextActiveIndex !== activeLineIndex) {
    activeLineIndex = nextActiveIndex;
    const bodyEl = document.getElementById('lyrics-view-body');
    if (!bodyEl) return;

    const lineEls = bodyEl.querySelectorAll('.lyric-line');
    lineEls.forEach((el) => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (idx === activeLineIndex) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('active');
      }
    });
  }
}