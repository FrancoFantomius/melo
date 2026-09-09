/**
 * Client-Side Podcast Discovery & Search Engine
 * Powered by Apple Podcasts Public Directory API
 */

import { getPlaceholder } from '../ui/placeholders.js';

/**
 * Detects the user's country code (ISO 3166-1 alpha-2) from browser locale settings.
 * Defaults to 'us' if no region can be determined.
 */
export function getBrowserCountry() {
  try {
    if (typeof Intl !== 'undefined' && Intl.Locale) {
      const locale = new Intl.Locale(navigator.language || 'en-US');
      if (locale.region) {
        return locale.region.toLowerCase();
      }
    }
  } catch {
    // Ignore and proceed to fallback
  }

  const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en-US';
  const parts = lang.split('-');
  if (parts.length > 1 && parts[1]) {
    return parts[1].toLowerCase();
  }

  const languageOnly = parts[0].toLowerCase();
  const LANG_TO_COUNTRY = {
    it: 'it',
    es: 'es',
    fr: 'fr',
    de: 'de',
    ja: 'jp',
    zh: 'cn',
    pt: 'br',
    ru: 'ru',
    ko: 'kr',
    nl: 'nl',
    pl: 'pl',
    sv: 'se',
    da: 'dk',
    fi: 'fi',
    no: 'no',
    el: 'gr',
    tr: 'tr',
    en: 'us'
  };

  return LANG_TO_COUNTRY[languageOnly] || 'us';
}

export async function searchPodcastDirectory(term, limit = 12, country = null) {
  if (!term || !term.trim()) return [];
  try {
    const countryCode = country || getBrowserCountry();
    const encoded = encodeURIComponent(term.trim());
    const response = await fetch(`https://itunes.apple.com/search?term=${encoded}&media=podcast&entity=podcast&country=${countryCode}&limit=${limit}`);
    if (!response.ok) return [];

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter(item => item.feedUrl && item.feedUrl.trim() !== '')
      .map(item => ({
        title: item.collectionName || item.trackName || 'Untitled Podcast',
        author: item.artistName || 'Unknown Host',
        image: item.artworkUrl600 || item.artworkUrl100 || getPlaceholder('podcast'),
        feedUrl: item.feedUrl,
        genre: item.primaryGenreName || 'Podcast',
        trackCount: item.trackCount || 0
      }));
  } catch (err) {
    console.warn('[Podcast Discovery] Directory search error:', err);
    return [];
  }
}

export async function getPopularPodcasts(term = 'podcast', limit = 24, country = null) {
  return searchPodcastDirectory(term, limit, country);
}
