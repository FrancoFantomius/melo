const SESSION_STORAGE_KEY = 'jellyfin_session_settings';

function generateDeviceId() {
  return 'pwa-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return {
      serverUrl: '',
      username: '',
      accessToken: '',
      userId: '',
      deviceId: generateDeviceId(),
      qualityWifi: 'Direct',     // Options: 'Direct', '320000', '256000', '128000', '64000'
      qualityMobile: '128000',  // Options: 'Direct', '320000', '256000', '128000', '64000'
      forceTranscode: false,
      searchPodcasts: true,
      homeSectionOrder: ['playlists', 'songs', 'artists', 'podcasts', 'albums'],
      isLoggedIn: false
    };
  }

  try {
    const data = JSON.parse(raw);
    if (!data.deviceId) data.deviceId = generateDeviceId();
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
      deviceId: generateDeviceId(),
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

export function clearSession() {
  const current = getSession();
  const cleared = {
    ...current,
    username: '',
    accessToken: '',
    userId: '',
    isLoggedIn: false
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cleared));
  return cleared;
}
