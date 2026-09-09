import { getSession, saveSession } from './session.js';
import { jellyfinFetch, cleanUrl, APP_VERSION } from './http.js';
import { clearApiCache } from './cache.js';

export async function reportCapabilities() {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) return;

  let iconUrl = '';
  let appUrl = '';
  try {
    const origin = window.location.origin;
    const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    iconUrl = `${origin}${path}img/icons/icon.svg`;
    appUrl = `${origin}${path}`;
  } catch (e) {
    iconUrl = './img/icons/icon.svg';
  }

  const capabilities = {
    PlayableMediaTypes: ['Audio'],
    SupportedCommands: [
      'Play',
      'PlayState',
      'PlayNext',
      'SetRepeatMode',
      'SetShuffleQueue'
    ],
    SupportsMediaControl: true,
    SupportsSync: false,
    SupportsPersistentIdentifier: true,
    IconUrl: iconUrl,
    AppStoreUrl: appUrl,
    MessageFormat: 'Json'
  };

  try {
    await jellyfinFetch('/Sessions/Capabilities/Full', { method: 'POST', body: capabilities });
  } catch (err) {
    try {
      await jellyfinFetch('/Sessions/Capabilities', { method: 'POST', body: capabilities });
    } catch (err2) {
      console.warn('[Jellyfin] Failed to report client capabilities:', err2);
    }
  }
}

export async function authenticateServer(serverUrl, username, password) {
  const cleanServer = cleanUrl(serverUrl);
  const authUrl = `${cleanServer}/Users/AuthenticateByName`;

  const session = getSession();
  const authHeader = `MediaBrowser Client="Melo PWA", Device="Web Browser", DeviceId="${session.deviceId}", Version="${APP_VERSION}"`;

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

  await reportCapabilities();

  return data;
}

export function getUserImageUrl(userId = null, tag = null) {
  const session = getSession();
  const uid = userId || session.userId;
  if (!session.serverUrl || !uid) return '';

  const tagToUse = tag || session.userPrimaryImageTag;
  const tagParam = tagToUse ? `?tag=${tagToUse}` : '';
  return `${session.serverUrl}/Users/${uid}/Images/Primary${tagParam}`;
}
