import { getPlaceholder } from './ui/placeholders.js';

const RECENCY_HALF_LIFE_DAYS = 45;
const MIN_DATE_MS = Date.parse('1970-01-01T00:00:00Z');

export const HOME_LIMITS = {
  albums: 12,
  artists: 10,
  playlists: 12,
  tracks: 10,
  discoverDailyTracks: 20
};

export const LIKED_SONGS_PLAYLIST = {
  Id: 'liked-songs',
  Name: 'Liked Songs',
  Type: 'LikedSongs',
  IsLikedSongs: true,
  get CoverUrl() {
    return getPlaceholder('favorite');
  }
};

export const DISCOVER_DAILY_PLAYLIST = {
  Id: 'discover-daily',
  Name: 'Discover Daily',
  Type: 'DiscoverDaily',
  IsDiscoverDaily: true,
  get CoverUrl() {
    return getPlaceholder('explore');
  }
};

function getItemDateMs(item, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((obj, part) => obj?.[part], item);
    const ms = Date.parse(value || '');
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

function getRecencyScore(item, now = Date.now()) {
  const lastActivityMs = getItemDateMs(item, ['UserData.LastPlayedDate', 'DateLastMediaAdded', 'DateCreated', 'PremiereDate']);
  if (!lastActivityMs || lastActivityMs <= MIN_DATE_MS) return 0;

  const ageDays = Math.max(0, (now - lastActivityMs) / 86400000);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

function getFavoriteScore(item) {
  return item?.UserData?.IsFavorite ? 1 : 0;
}

function getPlayScore(item) {
  const playCount = Number(item?.UserData?.PlayCount || 0);
  return Math.min(1, Math.log1p(playCount) / Math.log1p(25));
}

function getCompletionScore(item) {
  const playedPct = Number(item?.UserData?.PlayedPercentage || 0);
  if (!Number.isFinite(playedPct) || playedPct <= 0) return 0;
  return Math.min(1, playedPct / 100);
}

function stableHash(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getHomeScore(item, type, now = Date.now(), seed = null) {
  const weights = {
    album: { favorite: 0.25, recency: 0.45, plays: 0.2, completion: 0, discovery: 0.1 },
    artist: { favorite: 0.3, recency: 0.3, plays: 0.25, completion: 0, discovery: 0.15 },
    playlist: { favorite: 0.15, recency: 0.5, plays: 0.2, completion: 0, discovery: 0.15 },
    track: { favorite: 0.3, recency: 0.25, plays: 0.2, completion: 0.15, discovery: 0.1 },
    discoverTrack: { favorite: 0.12, recency: 0.15, plays: -0.15, completion: -0.08, discovery: 0.96 }
  }[type];

  const seedKey = seed !== null && seed !== undefined ? seed : new Date(now).toISOString().slice(0, 10);
  const hashInput = `${item?.Id || item?.Name || ''}:${seedKey}`;
  return (
    weights.favorite * getFavoriteScore(item) +
    weights.recency * getRecencyScore(item, now) +
    weights.plays * getPlayScore(item) +
    weights.completion * getCompletionScore(item) +
    weights.discovery * stableHash(hashInput)
  );
}

export function pickDiverseItems(items = [], { type, limit, groupBy, seed } = {}) {
  const now = Date.now();
  const ranked = [...items]
    .map(item => ({ item, score: getHomeScore(item, type, now, seed) }))
    .sort((a, b) => b.score - a.score || String(a.item.Name || '').localeCompare(String(b.item.Name || '')));

  const selected = [];
  const groupCounts = new Map();
  const maxPerGroup = type === 'track' || type === 'discoverTrack' ? 2 : 1;

  for (const entry of ranked) {
    const group = groupBy ? groupBy(entry.item) : entry.item.Id;
    const count = groupCounts.get(group) || 0;
    if (group && count >= maxPerGroup) continue;

    selected.push(entry.item);
    if (group) groupCounts.set(group, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const entry of ranked) {
    if (!selected.includes(entry.item)) selected.push(entry.item);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function getRecommendedTracks(songs = [], limit = HOME_LIMITS.tracks, type = 'track', seed = null) {
  return pickDiverseItems(songs, {
    type,
    limit,
    seed,
    groupBy: song => song.AlbumArtist || song.Artists?.[0] || song.AlbumId || song.Id
  });
}

export function buildHomeRecommendations({ albumsRes, artistsRes, playlistsRes, songsRes }) {
  return {
    albums: { ...albumsRes, Items: pickDiverseItems(albumsRes?.Items, { type: 'album', limit: HOME_LIMITS.albums, groupBy: album => album.AlbumArtist || album.AlbumArtists?.[0]?.Name || album.ArtistItems?.[0]?.Name || album.Id }) },
    artists: { ...artistsRes, Items: pickDiverseItems(artistsRes?.Items, { type: 'artist', limit: HOME_LIMITS.artists }) },
    playlists: { ...playlistsRes, Items: pickDiverseItems(playlistsRes?.Items, { type: 'playlist', limit: HOME_LIMITS.playlists }) },
    songs: { ...songsRes, Items: getRecommendedTracks(songsRes?.Items, HOME_LIMITS.tracks) }
  };
}
