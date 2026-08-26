import { getEffectiveTheme } from './theme.js';

const PLACEHOLDERS = {
  artist: {
    light: './img/artist.svg',
    dark: './img/artist_dark.svg'
  },
  song: {
    light: './img/song.svg',
    dark: './img/song_dark.svg'
  },
  playlist: {
    light: './img/album.svg',
    dark: './img/album_dark.svg'
  },
  album: {
    light: './img/album-1.svg',
    dark: './img/album_dark-1.svg'
  },
  podcast: {
    light: './img/podcast.svg',
    dark: './img/podcast_dark.svg'
  },
  favorite: {
    light: './img/favorite.svg',
    dark: './img/favorite_dark.svg'
  },
  explore: {
    light: './img/explore.svg',
    dark: './img/explore_dark.svg'
  },
  radio: {
    light: './img/radio.svg',
    dark: './img/radio_dark.svg'
  }
};

/**
 * Get the appropriate placeholder image URL based on type and current/given theme.
 * @param {string} type - 'artist', 'song', 'playlist', 'album', 'podcast', 'favorite', etc.
 * @param {string} [theme] - 'light' or 'dark'. Defaults to current effective theme.
 * @returns {string} - Relative path to the placeholder SVG.
 */
export function getPlaceholder(type = 'song', theme = null) {
  const effectiveTheme = theme || getEffectiveTheme();
  const isDark = effectiveTheme === 'dark';
  const norm = String(type || '').toLowerCase();

  let category = 'song';
  if (norm.includes('artist')) {
    category = 'artist';
  } else if (norm.includes('podcast')) {
    category = 'podcast';
  } else if (norm.includes('playlist')) {
    category = 'playlist';
  } else if (norm.includes('album')) {
    category = 'album';
  } else if (norm.includes('favorite') || norm.includes('liked')) {
    category = 'favorite';
  } else if (norm.includes('explore') || norm.includes('discover')) {
    category = 'explore';
  } else if (norm.includes('radio')) {
    category = 'radio';
  }

  const map = PLACEHOLDERS[category] || PLACEHOLDERS.song;
  return isDark ? map.dark : map.light;
}

/**
 * Detect placeholder type from an image source URL.
 * @param {string} src
 * @returns {string|null}
 */
export function detectPlaceholderTypeFromSrc(src) {
  if (!src || typeof src !== 'string') return null;
  const cleanUrl = src.split('?')[0].split('#')[0];
  if (cleanUrl.endsWith('artist_dark.svg') || cleanUrl.endsWith('artist.svg')) return 'artist';
  if (cleanUrl.endsWith('podcast_dark.svg') || cleanUrl.endsWith('podcast.svg')) return 'podcast';
  if (cleanUrl.endsWith('album_dark-1.svg') || cleanUrl.endsWith('album-1.svg')) return 'album';
  if (cleanUrl.endsWith('album_dark.svg') || cleanUrl.endsWith('album.svg')) return 'playlist';
  if (cleanUrl.endsWith('song_dark.svg') || cleanUrl.endsWith('song.svg')) return 'song';
  if (cleanUrl.endsWith('favorite_dark.svg') || cleanUrl.endsWith('favorite.svg')) return 'favorite';
  if (cleanUrl.endsWith('explore_dark.svg') || cleanUrl.endsWith('explore.svg')) return 'explore';
  if (cleanUrl.endsWith('radio_dark.svg') || cleanUrl.endsWith('radio.svg')) return 'radio';
  return null;
}

/**
 * Update all <img> elements currently displaying a placeholder to match the effective theme.
 * Real media images will NOT be affected.
 * @param {string} [effectiveTheme]
 */
export function updateAllPlaceholders(effectiveTheme = null) {
  const theme = effectiveTheme || getEffectiveTheme();
  const images = document.querySelectorAll('img');

  images.forEach((img) => {
    const currentSrc = img.getAttribute('src') || img.src || '';
    const detectedType = detectPlaceholderTypeFromSrc(currentSrc);
    if (detectedType) {
      img.src = getPlaceholder(detectedType, theme);
    }
  });
}

// Attach globally for inline onerror handlers
if (typeof window !== 'undefined') {
  window.getPlaceholder = getPlaceholder;
  window.updateAllPlaceholders = updateAllPlaceholders;

  window.addEventListener('melo_theme_changed', (e) => {
    const effectiveTheme = e.detail?.effectiveTheme || getEffectiveTheme();
    updateAllPlaceholders(effectiveTheme);
  });
}

