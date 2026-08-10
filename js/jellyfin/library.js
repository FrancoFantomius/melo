import { getSession } from './session.js';
import { jellyfinFetch } from './http.js';

export async function getMusicLibraries() {
  const session = getSession();
  const data = await jellyfinFetch(`/Users/${session.userId}/Views`);
  return (data.Items || []).filter(item => item.CollectionType === 'music');
}

export async function getAlbums({ limit = 50, startIndex = 0, parentId, artistId, sortBy = 'SortName', sortOrder = 'Ascending' } = {}) {
  const session = getSession();
  const params = {
    IncludeItemTypes: 'MusicAlbum',
    Recursive: true,
    Limit: limit,
    StartIndex: startIndex,
    SortBy: sortBy,
    SortOrder: sortOrder,
    Fields: 'PrimaryImageAspectRatio,PrimaryImageTag,ImageTags,BasicSyncInfo,AlbumArtists,ArtistItems,DateCreated,DateLastMediaAdded,UserData'
  };
  if (parentId) params.ParentId = parentId;
  if (artistId) params.ArtistIds = artistId;
  return await jellyfinFetch(`/Users/${session.userId}/Items`, { params });
}

export async function getArtists({ limit = 50, startIndex = 0, sortBy = 'SortName', sortOrder = 'Ascending' } = {}) {
  const session = getSession();
  return await jellyfinFetch(`/Artists`, {
    params: {
      UserId: session.userId,
      Limit: limit,
      StartIndex: startIndex,
      SortBy: sortBy,
      SortOrder: sortOrder,
      Fields: 'PrimaryImageTag,ImageTags,DateCreated,UserData'
    }
  });
}

export async function getSongs({ limit = 100, startIndex = 0, albumId, artistId, isFavorite, sortBy = 'ParentIndexNumber,IndexNumber,SortName', sortOrder = 'Ascending' } = {}) {
  const session = getSession();
  const params = {
    IncludeItemTypes: 'Audio',
    Recursive: true,
    Limit: limit,
    StartIndex: startIndex,
    SortBy: sortBy,
    SortOrder: sortOrder,
    Fields: 'PrimaryImageAspectRatio,PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,AudioInfo,MediaSources,Chapters,HasLyrics,UserData'
  };
  if (albumId) params.ParentId = albumId;
  if (artistId) params.ArtistIds = artistId;
  if (isFavorite) params.Filters = 'IsFavorite';
  return await jellyfinFetch(`/Users/${session.userId}/Items`, { params });
}

export async function getFavoriteSongs(options = {}) {
  return await getSongs({ ...options, isFavorite: true, limit: options.limit || 1000, sortBy: options.sortBy || 'SortName' });
}

export async function getPlaylists() {
  const session = getSession();
  return await jellyfinFetch(`/Users/${session.userId}/Items`, {
    params: {
      IncludeItemTypes: 'Playlist',
      Recursive: true,
      Fields: 'PrimaryImageTag,ImageTags,DateCreated,DateLastMediaAdded,UserData'
    }
  });
}

export async function getPlaylistItems(playlistId) {
  const session = getSession();
  return await jellyfinFetch(`/Playlists/${playlistId}/Items`, {
    params: {
      UserId: session.userId,
      Fields: 'PrimaryImageAspectRatio,PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,AudioInfo,MediaSources,HasLyrics,UserData'
    }
  });
}

export async function getItem(itemId) {
  const session = getSession();
  if (!itemId) return null;
  return await jellyfinFetch(`/Users/${session.userId}/Items/${itemId}`);
}

export async function searchJellyfin(query) {
  const session = getSession();
  if (!query || query.trim() === '') return { Items: [] };
  return await jellyfinFetch(`/Users/${session.userId}/Items`, {
    params: {
      SearchTerm: query,
      IncludeItemTypes: 'Audio,MusicAlbum,MusicArtist,Playlist',
      Limit: 30,
      Recursive: true,
      Fields: 'PrimaryImageTag,ImageTags,AlbumPrimaryImageTag,AlbumId,HasLyrics,UserData'
    }
  });
}
