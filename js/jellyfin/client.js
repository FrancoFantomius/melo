import { getSession, saveSession } from './session.js';
import { fetchWithCache, clearApiCache } from './cache.js';

function getAuthHeader() {
  const session = getSession();
  const tokenStr = session.accessToken ? `, Token="${session.accessToken}"` : '';
  return `MediaBrowser Client="Melo PWA", Device="Web Browser", DeviceId="${session.deviceId}", Version="1.0.0"${tokenStr}`;
}

export function cleanUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
}

export async function authenticateServer(serverUrl, username, password) {
  const cleanServer = cleanUrl(serverUrl);
  const authUrl = `${cleanServer}/Users/AuthenticateByName`;

  const session = getSession();
  const authHeader = `MediaBrowser Client="Melo PWA", Device="Web Browser", DeviceId="${session.deviceId}", Version="1.0.0"`;

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader
    },
    body: JSON.stringify({ Username: username, Pw: password || '' })
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid username or password (403 Forbidden). Please check your Jellyfin user credentials.');
  }

  if (!response.ok) {
    throw new Error(`Authentication failed (HTTP ${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  const accessToken = data.AccessToken;
  const userId = data.User.Id;
  const userPrimaryImageTag = data.User?.PrimaryImageTag || data.User?.ImageTags?.Primary || '';

  await clearApiCache();

  saveSession({
    serverUrl: cleanServer,
    username: username,
    accessToken: accessToken,
    userId: userId,
    userPrimaryImageTag: userPrimaryImageTag,
    isLoggedIn: true
  });

  return data;
}

// User Image URL Construction
export function getUserImageUrl(userId = null, tag = null) {
  const session = getSession();
  const uid = userId || session.userId;
  if (!session.serverUrl || !uid) return '';

  const tagToUse = tag || session.userPrimaryImageTag;
  const tagParam = tagToUse ? `?tag=${tagToUse}` : '';
  return `${session.serverUrl}/Users/${uid}/Images/Primary${tagParam}`;
}

export async function jellyfinFetch(endpoint, params = {}) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) {
    throw new Error('Jellyfin server URL or access token missing');
  }

  const url = new URL(`${session.serverUrl}${endpoint}`);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  const authHeader = getAuthHeader();
  const response = await fetch(url.toString(), {
    headers: {
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Unauthorized (HTTP ${response.status}). Please re-authenticate.`);
  }

  if (!response.ok) {
    throw new Error(`Jellyfin API request failed (${endpoint}): ${response.statusText}`);
  }

  return await response.json();
}

// Data Loaders
export async function getMusicLibraries() {
  const session = getSession();
  const data = await jellyfinFetch(`/Users/${session.userId}/Views`);
  return (data.Items || []).filter(item => item.CollectionType === 'music');
}

export async function getAlbums({ limit = 50, startIndex = 0, parentId, artistId, sortBy = 'SortName' } = {}) {
  const session = getSession();
  const params = {
    IncludeItemTypes: 'MusicAlbum',
    Recursive: true,
    Limit: limit,
    StartIndex: startIndex,
    SortBy: sortBy,
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageAspectRatio,PrimaryImageTag,ImageTags,BasicSyncInfo,AlbumArtists,ArtistItems'
  };
  if (parentId) params.ParentId = parentId;
  if (artistId) params.ArtistIds = artistId;
  return await jellyfinFetch(`/Users/${session.userId}/Items`, params);
}

export async function getArtists({ limit = 50, startIndex = 0 } = {}) {
  const session = getSession();
  return await jellyfinFetch(`/Artists`, {
    UserId: session.userId,
    Limit: limit,
    StartIndex: startIndex,
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageTag,ImageTags'
  });
}

export async function getSongs({ limit = 100, startIndex = 0, albumId, artistId, isFavorite, sortBy = 'ParentIndexNumber,IndexNumber,SortName' } = {}) {
  const session = getSession();
  const params = {
    IncludeItemTypes: 'Audio',
    Recursive: true,
    Limit: limit,
    StartIndex: startIndex,
    SortBy: sortBy,
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageAspectRatio,PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,AudioInfo,MediaSources,Chapters,HasLyrics,UserData'
  };
  if (albumId) params.ParentId = albumId;
  if (artistId) params.ArtistIds = artistId;
  if (isFavorite) params.Filters = 'IsFavorite';
  return await jellyfinFetch(`/Users/${session.userId}/Items`, params);
}

export async function getPlaylists() {
  const session = getSession();
  return await jellyfinFetch(`/Users/${session.userId}/Items`, {
    IncludeItemTypes: 'Playlist',
    Recursive: true,
    Fields: 'PrimaryImageTag,ImageTags'
  });
}

export async function getPlaylistItems(playlistId) {
  const session = getSession();
  return await jellyfinFetch(`/Playlists/${playlistId}/Items`, {
    UserId: session.userId,
    Fields: 'PrimaryImageAspectRatio,PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,AudioInfo,MediaSources,HasLyrics,UserData'
  });
}

export async function searchJellyfin(query) {
  const session = getSession();
  if (!query || query.trim() === '') return { Items: [] };
  return await jellyfinFetch(`/Users/${session.userId}/Items`, {
    SearchTerm: query,
    IncludeItemTypes: 'Audio,MusicAlbum,MusicArtist,Playlist',
    Limit: 30,
    Recursive: true,
    Fields: 'PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,HasLyrics,UserData'
  });
}

export async function markFavorite(itemId) {
  const session = getSession();
  if (!session.serverUrl || !session.userId || !itemId) return;
  const url = `${session.serverUrl}/Users/${session.userId}/FavoriteItems/${itemId}`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'X-Emby-Authorization': getAuthHeader(),
      'Authorization': getAuthHeader()
    }
  });
}

export async function unmarkFavorite(itemId) {
  const session = getSession();
  if (!session.serverUrl || !session.userId || !itemId) return;
  const url = `${session.serverUrl}/Users/${session.userId}/FavoriteItems/${itemId}`;
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-Emby-Authorization': getAuthHeader(),
      'Authorization': getAuthHeader()
    }
  });
}

export async function getItem(itemId) {
  const session = getSession();
  if (!itemId) return null;
  return await jellyfinFetch(`/Users/${session.userId}/Items/${itemId}`);
}

export async function updatePlaylist(playlistId, { name }) {
  const session = getSession();
  if (!session.serverUrl || !playlistId) return;

  const itemData = await getItem(playlistId);
  const updatedItem = {
    ...itemData,
    Name: name || itemData?.Name
  };

  const url = `${session.serverUrl}/Items/${playlistId}`;
  const authHeader = getAuthHeader();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatedItem)
  });

  if (!response.ok) {
    throw new Error(`Failed to update playlist metadata (HTTP ${response.status})`);
  }

  await clearApiCache();
  return updatedItem;
}

export async function uploadPlaylistImage(playlistId, base64ImageString, mimeType = 'image/jpeg') {
  const session = getSession();
  if (!session.serverUrl || !playlistId || !base64ImageString) return;

  const base64Data = base64ImageString.includes(',') ? base64ImageString.split(',')[1] : base64ImageString;

  const url = `${session.serverUrl}/Items/${playlistId}/Images/Primary`;
  const authHeader = getAuthHeader();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader,
      'Content-Type': mimeType
    },
    body: base64Data
  });

  if (!response.ok) {
    throw new Error(`Failed to upload playlist image (HTTP ${response.status})`);
  }

  await clearApiCache();
}

export async function deletePlaylist(playlistId) {
  const session = getSession();
  if (!session.serverUrl || !playlistId) return;

  const url = `${session.serverUrl}/Items/${playlistId}`;
  const authHeader = getAuthHeader();

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete playlist (HTTP ${response.status})`);
  }

  await clearApiCache();
}

export async function addTracksToPlaylist(playlistId, trackIds) {
  const session = getSession();
  if (!session.serverUrl || !playlistId || !trackIds || trackIds.length === 0) return;

  const idsStr = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;
  const url = `${session.serverUrl}/Playlists/${playlistId}/Items?Ids=${encodeURIComponent(idsStr)}&UserId=${session.userId}`;
  const authHeader = getAuthHeader();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to add tracks to playlist (HTTP ${response.status})`);
  }

  await clearApiCache();
}

export async function removeTrackFromPlaylist(playlistId, entryIdOrTrackId) {
  const session = getSession();
  if (!session.serverUrl || !playlistId || !entryIdOrTrackId) return;

  const url = `${session.serverUrl}/Playlists/${playlistId}/Items?EntryIds=${encodeURIComponent(entryIdOrTrackId)}`;
  const authHeader = getAuthHeader();

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-Emby-Authorization': authHeader,
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    const fallbackUrl = `${session.serverUrl}/Playlists/${playlistId}/Items?ItemIds=${encodeURIComponent(entryIdOrTrackId)}`;
    await fetch(fallbackUrl, {
      method: 'DELETE',
      headers: {
        'X-Emby-Authorization': authHeader,
        'Authorization': authHeader
      }
    });
  }

  await clearApiCache();
}

export async function getLyrics(itemId) {
  if (!itemId) return null;
  try {
    return await jellyfinFetch(`/Audio/${itemId}/Lyrics`);
  } catch (err) {
    console.warn('[Jellyfin] Failed to fetch lyrics:', err);
    return null;
  }
}

// Cached API Loaders (Stale-While-Revalidate)
export async function getAlbumsCached(options = {}, onRevalidate = null) {
  const cacheKey = `albums_${JSON.stringify(options)}`;
  return fetchWithCache(cacheKey, () => getAlbums(options), onRevalidate);
}

export async function getArtistsCached(options = {}, onRevalidate = null) {
  const cacheKey = `artists_${JSON.stringify(options)}`;
  return fetchWithCache(cacheKey, () => getArtists(options), onRevalidate);
}

export async function getSongsCached(options = {}, onRevalidate = null) {
  const cacheKey = `songs_${JSON.stringify(options)}`;
  return fetchWithCache(cacheKey, () => getSongs(options), onRevalidate);
}

export async function getFavoriteSongs(options = {}) {
  return await getSongs({ ...options, isFavorite: true, limit: options.limit || 1000, sortBy: options.sortBy || 'SortName' });
}

export async function getFavoriteSongsCached(options = {}, onRevalidate = null) {
  const cacheKey = `favorite_songs_${JSON.stringify(options)}`;
  return fetchWithCache(cacheKey, () => getFavoriteSongs(options), onRevalidate);
}

export async function getPlaylistsCached(onRevalidate = null) {
  const cacheKey = `playlists`;
  return fetchWithCache(cacheKey, () => getPlaylists(), onRevalidate);
}

export async function getPlaylistItemsCached(playlistId, onRevalidate = null) {
  const cacheKey = `playlist_items_${playlistId}`;
  return fetchWithCache(cacheKey, () => getPlaylistItems(playlistId), onRevalidate);
}

export async function getItemCached(itemId, onRevalidate = null) {
  if (!itemId) return null;
  const cacheKey = `item_${itemId}`;
  return fetchWithCache(cacheKey, () => getItem(itemId), onRevalidate);
}

export async function searchJellyfinCached(query, onRevalidate = null) {
  if (!query || query.trim() === '') return { Items: [] };
  const cacheKey = `search_${query.trim().toLowerCase()}`;
  return fetchWithCache(cacheKey, () => searchJellyfin(query), onRevalidate);
}

// Artwork Helper with smart track->album fallback and 404 prevention
export function getArtworkUrl(itemOrId, imageType = 'Primary', maxWidth = 400) {
  const session = getSession();
  if (!session.serverUrl || !itemOrId) return './img/icons/icon.svg';

  // Handle object input
  if (typeof itemOrId === 'object' && itemOrId !== null) {
    const item = itemOrId;
    let targetId = null;
    let tag = null;

    if (item.ImageTags && item.ImageTags[imageType]) {
      targetId = item.Id;
      tag = item.ImageTags[imageType];
    } else if (imageType === 'Primary' && item.PrimaryImageTag) {
      targetId = item.Id;
      tag = item.PrimaryImageTag;
    } else if (imageType === 'Primary' && item.AlbumPrimaryImageTag && item.AlbumId) {
      targetId = item.AlbumId;
      tag = item.AlbumPrimaryImageTag;
    }

    // If item has no artwork tag, return default SVG icon immediately (prevents 404 requests)
    if (!targetId || !tag) {
      return './img/icons/icon.svg';
    }

    return `${session.serverUrl}/Items/${targetId}/Images/${imageType}?maxWidth=${maxWidth}&quality=90&tag=${tag}`;
  }

  // Handle string ID input
  if (typeof itemOrId === 'string' && itemOrId.trim() !== '') {
    return `${session.serverUrl}/Items/${itemOrId}/Images/${imageType}?maxWidth=${maxWidth}&quality=90`;
  }

  return './img/icons/icon.svg';
}

// Audio Stream URL Construction
export function getAudioStreamUrl(itemId, options = {}) {
  const session = getSession();
  if (!session.serverUrl || !itemId) return '';

  const { maxStreamingBitrate, forceTranscode, container = 'mp3', audioCodec = 'mp3', startTimeTicks = 0 } = options;

  // Determine if direct play or transcode
  const isDirect = !forceTranscode && (!maxStreamingBitrate || maxStreamingBitrate === 'Direct');

  if (isDirect && startTimeTicks === 0) {
    return `${session.serverUrl}/Audio/${itemId}/stream?static=true&api_key=${session.accessToken}`;
  }

  // When seeking, use the /universal endpoint which properly supports StartTimeTicks
  // This is the same endpoint the official Jellyfin web client uses
  if (startTimeTicks > 0) {
    const universalUrl = new URL(`${session.serverUrl}/Audio/${itemId}/universal`);
    universalUrl.searchParams.append('api_key', session.accessToken);
    universalUrl.searchParams.append('UserId', session.userId);
    universalUrl.searchParams.append('DeviceId', session.deviceId);
    universalUrl.searchParams.append('Container', 'opus,mp3|mp3,aac,m4a,m4b,flac,wav,ogg');
    universalUrl.searchParams.append('TranscodingContainer', 'mp3');
    universalUrl.searchParams.append('TranscodingProtocol', 'http');
    universalUrl.searchParams.append('AudioCodec', 'mp3');
    if (maxStreamingBitrate && maxStreamingBitrate !== 'Direct') {
      universalUrl.searchParams.append('MaxStreamingBitrate', maxStreamingBitrate);
    }
    universalUrl.searchParams.append('StartTimeTicks', startTimeTicks);
    universalUrl.searchParams.append('EnableRedirection', 'true');
    universalUrl.searchParams.append('EnableRemoteMedia', 'false');
    return universalUrl.toString();
  }

  // Transcode stream request (no seeking)
  const streamUrl = new URL(`${session.serverUrl}/Audio/${itemId}/stream.${container}`);
  streamUrl.searchParams.append('api_key', session.accessToken);
  streamUrl.searchParams.append('AudioCodec', audioCodec);
  if (maxStreamingBitrate && maxStreamingBitrate !== 'Direct') {
    streamUrl.searchParams.append('MaxStreamingBitrate', maxStreamingBitrate);
  }
  return streamUrl.toString();
}

// Playback Session Reporting
export async function reportPlaybackStart(itemId, positionTicks = 0) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;
  try {
    await fetch(`${session.serverUrl}/Sessions/Playing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
        CanSeek: true,
        IsPaused: false
      })
    });
  } catch (e) {
    console.warn('[Jellyfin] Start playback report error:', e);
  }
}

export async function reportPlaybackProgress(itemId, positionTicks = 0, isPaused = false) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;
  try {
    await fetch(`${session.serverUrl}/Sessions/Playing/Progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
        CanSeek: true,
        IsPaused: isPaused
      })
    });
  } catch (e) {
    console.warn('[Jellyfin] Progress playback report error:', e);
  }
}

export async function reportPlaybackStopped(itemId, positionTicks = 0) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;
  try {
    await fetch(`${session.serverUrl}/Sessions/Playing/Stopped`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks
      })
    });
  } catch (e) {
    console.warn('[Jellyfin] Stop playback report error:', e);
  }
}

// Podcast Feed URL Sync with Jellyfin Server (and local fallback)
const PODCAST_LOCAL_STORAGE_KEY = 'melo_podcast_feed_urls';

function getLocalPodcastFeedUrls() {
  try {
    const raw = localStorage.getItem(PODCAST_LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPodcastFeedUrls(urls) {
  try {
    localStorage.setItem(PODCAST_LOCAL_STORAGE_KEY, JSON.stringify(urls));
  } catch (e) {
    console.warn('[Podcast Sync] Local save error:', e);
  }
}

export async function getPodcastFeedUrls() {
  const session = getSession();
  let localUrls = getLocalPodcastFeedUrls();

  if (!session.serverUrl || !session.userId) {
    return localUrls;
  }

  try {
    const prefs = await jellyfinFetch(`/DisplayPreferences/melo_podcasts`, {
      userId: session.userId,
      client: 'Melo PWA'
    });

    if (prefs && prefs.CustomPrefs && prefs.CustomPrefs.podcastUrls) {
      const remoteUrls = JSON.parse(prefs.CustomPrefs.podcastUrls);
      if (Array.isArray(remoteUrls)) {
        const merged = Array.from(new Set([...localUrls, ...remoteUrls]));
        saveLocalPodcastFeedUrls(merged);
        return merged;
      }
    }
  } catch (e) {
    console.warn('[Podcast Sync] Remote sync fetch notice (using local):', e.message);
  }

  return localUrls;
}

export async function savePodcastFeedUrl(feedUrl) {
  if (!feedUrl || !feedUrl.trim()) return [];
  const clean = feedUrl.trim();
  const current = getLocalPodcastFeedUrls();
  if (!current.includes(clean)) {
    current.push(clean);
    saveLocalPodcastFeedUrls(current);
  }

  const session = getSession();
  if (session.serverUrl && session.userId) {
    try {
      const url = `${session.serverUrl}/DisplayPreferences/melo_podcasts?userId=${session.userId}&client=Melo%20PWA`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': getAuthHeader()
        },
        body: JSON.stringify({
          Id: 'melo_podcasts',
          CustomPrefs: {
            podcastUrls: JSON.stringify(current)
          }
        })
      });
    } catch (e) {
      console.warn('[Podcast Sync] Remote save error:', e);
    }
  }

  return current;
}

export async function removePodcastFeedUrl(feedUrl) {
  if (!feedUrl) return [];
  const clean = feedUrl.trim();
  let current = getLocalPodcastFeedUrls();
  current = current.filter(u => u !== clean);
  saveLocalPodcastFeedUrls(current);

  const session = getSession();
  if (session.serverUrl && session.userId) {
    try {
      const url = `${session.serverUrl}/DisplayPreferences/melo_podcasts?userId=${session.userId}&client=Melo%20PWA`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': getAuthHeader()
        },
        body: JSON.stringify({
          Id: 'melo_podcasts',
          CustomPrefs: {
            podcastUrls: JSON.stringify(current)
          }
        })
      });
    } catch (e) {
      console.warn('[Podcast Sync] Remote remove error:', e);
    }
  }

  return current;
}
