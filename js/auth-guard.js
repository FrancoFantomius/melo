import { getSession } from './jellyfin/session.js';

export function requireAuth() {
  const session = getSession();
  const currentPath = window.location.pathname.toLowerCase();
  const isLoginPage = currentPath.endsWith('/login.html') || currentPath.endsWith('/login');
  const isPublicPage = isLoginPage ||
    currentPath.endsWith('/terms.html') || currentPath.endsWith('/terms') ||
    currentPath.endsWith('/privacy.html') || currentPath.endsWith('/privacy');

  const hasValidAuth = Boolean(session.isLoggedIn && session.accessToken);

  if (!hasValidAuth && !isPublicPage) {
    console.log('[AuthGuard] User not logged in, redirecting to login.html');
    window.location.href = './login.html';
    return false;
  }

  if (hasValidAuth && isLoginPage) {
    console.log('[AuthGuard] User already logged in, redirecting to index.html');
    window.location.href = './index.html';
    return false;
  }

  return true;
}
