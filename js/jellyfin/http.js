import { getSession, clearSession } from './session.js';
import pkg from '../../package.json';

export const APP_VERSION = pkg.version || '0.5.1';

let isHandlingUnauthorized = false;

export function handleUnauthorized() {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;

  console.warn('[Jellyfin] Session expired or unauthorized (HTTP 401). Clearing session and redirecting to login...');
  clearSession(true);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('melo-auth-unauthorized'));

    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.endsWith('/login.html') || currentPath.endsWith('/login');
    if (!isLoginPage) {
      window.location.href = './login.html?expired=1';
    }
  }
}

export function getAuthHeader() {
  const session = getSession();
  const tokenStr = session.accessToken ? `, Token="${session.accessToken}"` : '';
  return `MediaBrowser Client="Melo PWA", Device="Web Browser", DeviceId="${session.deviceId}", Version="${APP_VERSION}"${tokenStr}`;
}

export function cleanUrl(url) {
  if (!url) return '';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

export function buildApiError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function jellyfinFetch(endpoint, { method = 'GET', params = {}, body = null, contentType = null } = {}) {
  const session = getSession();
  if (!session.serverUrl || !session.accessToken) {
    throw new Error('Jellyfin server URL or access token missing');
  }

  const url = new URL(`${session.serverUrl}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  const authHeader = getAuthHeader();
  const headers = {
    'X-Emby-Authorization': authHeader,
    'Authorization': authHeader,
    'Accept': 'application/json'
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  } else if (body !== null && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });

  if (response.status === 401 || response.status === 403) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    throw buildApiError(`Unauthorized (HTTP ${response.status}). Please re-authenticate.`, response.status);
  }

  if (!response.ok) {
    throw buildApiError(`Jellyfin API request failed (${endpoint}): ${response.statusText}`, response.status);
  }

  const contentTypeHeader = response.headers.get('Content-Type') || '';
  if (contentTypeHeader.includes('application/json')) {
    return await response.json();
  }
  return null;
}
