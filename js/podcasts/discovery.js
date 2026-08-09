/**
 * Client-Side Podcast Discovery & Search Engine
 * Powered by Apple Podcasts Public Directory API
 */

export async function searchPodcastDirectory(query, limit = 24) {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=podcast&limit=${limit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter(item => item.feedUrl && item.feedUrl.trim() !== '')
      .map(item => ({
        title: item.collectionName || item.trackName || 'Untitled Podcast',
        author: item.artistName || 'Unknown Host',
        image: item.artworkUrl600 || item.artworkUrl100 || './img/icons/icon.svg',
        feedUrl: item.feedUrl,
        genre: item.primaryGenreName || 'Podcast',
        trackCount: item.trackCount || 0
      }));
  } catch (err) {
    console.warn('[Podcast Discovery] Directory search error:', err);
    return [];
  }
}

export async function getPopularPodcasts(term = 'podcast', limit = 24) {
  return searchPodcastDirectory(term, limit);
}
