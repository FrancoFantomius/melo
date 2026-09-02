const SESSION_STORAGE_KEY = 'jellyfin_session_settings';
const DEVICE_ID_KEY = 'melo_device_id';

function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const array = new Uint8Array(16);
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      cryptoObj.getRandomValues(array);
    }
    deviceId = 'pwa-' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getSession() {
  const stableDeviceId = getOrCreateDeviceId();
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    const defaultSession = {
      serverUrl: '',
      username: '',
      accessToken: '',
      userId: '',
      deviceId: stableDeviceId,
      qualityWifi: 'Direct',     // Options: 'Direct', '320000', '256000', '128000', '64000'
      qualityMobile: '128000',  // Options: 'Direct', '320000', '256000', '128000', '64000'
      forceTranscode: false,
      searchPodcasts: true,
      homeSectionOrder: ['playlists', 'songs', 'artists', 'podcasts', 'albums'],
      isLoggedIn: false
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(defaultSession));
    return defaultSession;
  }

  try {
    const data = JSON.parse(raw);
    if (!data.deviceId) data.deviceId = stableDeviceId;
    if (typeof data.searchPodcasts === 'undefined') data.searchPodcasts = true;
    if (!data.homeSectionOrder || !Array.isArray(data.homeSectionOrder)) {
      data.homeSectionOrder = ['playlists', 'songs', 'artists', 'podcasts', 'albums'];
    }
    return data;
  } catch (e) {
    return {
      serverUrl: '',
      username: '',
      accessToken: '',
      userId: '',
      deviceId: stableDeviceId,
      qualityWifi: 'Direct',
      qualityMobile: '128000',
      forceTranscode: false,
      searchPodcasts: true,
      homeSectionOrder: ['playlists', 'songs', 'artists', 'podcasts', 'albums'],
      isLoggedIn: false
    };
  }
}

export function saveSession(sessionData) {
  const current = getSession();
  const updated = { ...current, ...sessionData };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearSession(preserveCredentials = true) {
  const current = getSession();
  const cleared = {
    ...current,
    username: preserveCredentials ? (current.username || '') : '',
    accessToken: '',
    userId: '',
    userPrimaryImageTag: '',
    isLoggedIn: false
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cleared));
  return cleared;
}
