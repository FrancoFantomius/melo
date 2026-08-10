import { getSession } from './session.js';

export function getArtworkUrl(itemOrId, imageType = 'Primary', maxWidth = 400) {
  const session = getSession();
  if (!session.serverUrl || !itemOrId) return './img/icons/icon.svg';

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

    if (!targetId || !tag) {
      return './img/icons/icon.svg';
    }

    return `${session.serverUrl}/Items/${targetId}/Images/${imageType}?maxWidth=${maxWidth}&quality=90&tag=${tag}`;
  }

  if (typeof itemOrId === 'string' && itemOrId.trim() !== '') {
    return `${session.serverUrl}/Items/${itemOrId}/Images/${imageType}?maxWidth=${maxWidth}&quality=90`;
  }

  return './img/icons/icon.svg';
}

export function getAudioStreamUrl(itemId, options = {}) {
  const session = getSession();
  if (!session.serverUrl || !itemId) return '';

  const { maxStreamingBitrate, startTimeTicks = 0 } = options;

  // Always use the /universal endpoint, like the official Jellyfin web client.
  // It negotiates a container/codec the browser can actually play and
  // transparently transcodes to MP3 when the source format is unsupported,
  // instead of blindly serving the raw file (which caused
  // "The element has no supported sources" for formats like FLAC/WAV/WMA).
  const url = new URL(`${session.serverUrl}/Audio/${itemId}/universal`);
  url.searchParams.append('api_key', session.accessToken);
  url.searchParams.append('UserId', session.userId);
  url.searchParams.append('DeviceId', session.deviceId);
  url.searchParams.append('Container', 'opus,mp3|mp3,aac,m4a,m4b,flac,wav,ogg');
  url.searchParams.append('TranscodingContainer', 'mp3');
  url.searchParams.append('TranscodingProtocol', 'http');
  url.searchParams.append('AudioCodec', 'mp3');
  if (maxStreamingBitrate && maxStreamingBitrate !== 'Direct') {
    url.searchParams.append('MaxStreamingBitrate', maxStreamingBitrate);
  }
  if (startTimeTicks > 0) {
    url.searchParams.append('StartTimeTicks', startTimeTicks);
  }
  url.searchParams.append('EnableRedirection', 'true');
  url.searchParams.append('EnableRemoteMedia', 'false');
  return url.toString();
}
