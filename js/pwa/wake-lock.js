/**
 * Screen Wake Lock API Manager
 * Keeps the screen awake during active lyrics reading / karaoke mode.
 */

let wakeLockSentinel = null;
let isWakeLockRequested = false;

export async function requestScreenWakeLock() {
  isWakeLockRequested = true;
  if ('wakeLock' in navigator) {
    try {
      if (!wakeLockSentinel || wakeLockSentinel.released) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          console.log('[Wake Lock] Screen Wake Lock was released');
        });
        console.log('[Wake Lock] Screen Wake Lock active');
      }
      return true;
    } catch (err) {
      console.warn('[Wake Lock] Failed to acquire Screen Wake Lock:', err.message);
    }
  }
  return false;
}

export async function releaseScreenWakeLock() {
  isWakeLockRequested = false;
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
      console.log('[Wake Lock] Screen Wake Lock released manually');
    } catch (err) {
      console.warn('[Wake Lock] Error releasing Screen Wake Lock:', err);
    }
  }
}

// Re-acquire wake lock if page visibility changes back to visible
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isWakeLockRequested) {
      await requestScreenWakeLock();
    }
  });
}
