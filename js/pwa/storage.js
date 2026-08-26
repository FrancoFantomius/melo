/**
 * Persistent Storage & Quota Manager for PWA
 */

export async function isStoragePersisted() {
  if (navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch (err) {
      console.warn('[PWA Storage] Error checking persisted state:', err);
    }
  }
  return false;
}

export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) {
        console.log('[PWA Storage] Storage is already persisted.');
        return true;
      }
      const granted = await navigator.storage.persist();
      if (granted) {
        console.log('[PWA Storage] Storage persistence granted.');
      } else {
        console.debug('[PWA Storage] Storage persistence denied by browser (normal in dev or uninstalled state).');
      }
      return granted;
    } catch (err) {
      console.warn('[PWA Storage] Error requesting persistence:', err);
    }
  }
  return false;
}

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageMB = estimate.usage ? (estimate.usage / (1024 * 1024)).toFixed(1) : '0';
      const quotaMB = estimate.quota ? (estimate.quota / (1024 * 1024)).toFixed(1) : '0';
      const percentUsed = estimate.quota && estimate.usage ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : 0;
      return {
        usageBytes: estimate.usage || 0,
        quotaBytes: estimate.quota || 0,
        usageMB: parseFloat(usageMB),
        quotaMB: parseFloat(quotaMB),
        percentUsed: parseFloat(percentUsed)
      };
    } catch (err) {
      console.warn('[PWA Storage] Error getting storage estimate:', err);
    }
  }
  return null;
}
