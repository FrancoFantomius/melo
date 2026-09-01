import Hls from 'hls.js';

let hlsInstance = null;
let currentHlsUrl = null;
let networkRetryCount = 0;
const MAX_NETWORK_RETRIES = 3;

export function isHlsSupported() {
  return Hls.isSupported();
}

export function isNativeHlsSupported(audioEl) {
  if (!audioEl) return false;
  const canPlay = audioEl.canPlayType('application/vnd.apple.mpegurl');
  return canPlay === 'probably' || canPlay === 'maybe';
}

export function getHlsInstance() {
  return hlsInstance;
}

export function resumeOnVisible() {
  if (hlsInstance) {
    try {
      hlsInstance.startLoad();
    } catch (e) {
      console.warn('[HlsEngine] Error resuming HLS on visible:', e);
    }
  }
}

export function destroyHls() {
  networkRetryCount = 0;
  if (hlsInstance) {
    try {
      hlsInstance.stopLoad();
      hlsInstance.detachMedia();
      hlsInstance.destroy();
    } catch (e) {
      console.warn('[HlsEngine] Error destroying HLS instance:', e);
    }
    hlsInstance = null;
    currentHlsUrl = null;
  }
}

/**
 * Initializes and loads an HLS stream onto the provided audio element.
 * @param {HTMLAudioElement} audioEl - The persistent audio element
 * @param {string} hlsUrl - The Jellyfin master.m3u8 URL
 * @param {number} startTimeSec - Starting offset in seconds (if resuming or seeking)
 * @param {Object} callbacks - Optional callbacks { onParsed, onError, onFallback }
 * @returns {Promise<boolean>} Resolves to true if HLS attached successfully
 */
export function loadHlsStream(audioEl, hlsUrl, startTimeSec = 0, callbacks = {}) {
  return new Promise((resolve) => {
    destroyHls();
    currentHlsUrl = hlsUrl;
    networkRetryCount = 0;

    if (isHlsSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 30,
        enableWorker: true,
        lowLatencyMode: false,
        progressive: true,
        autoStartLoad: true
      });

      hlsInstance = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(hlsUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (startTimeSec > 0 && isFinite(startTimeSec)) {
          audioEl.currentTime = startTimeSec;
        }
        if (callbacks.onParsed) callbacks.onParsed(data);
        resolve(true);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('[HlsEngine] HLS error event:', data.type, data.details, data.fatal);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryCount < MAX_NETWORK_RETRIES) {
                networkRetryCount++;
                const delayMs = networkRetryCount * 1000;
                console.warn(`[HlsEngine] Fatal network error. Retrying in ${delayMs}ms (attempt ${networkRetryCount}/${MAX_NETWORK_RETRIES})...`);
                setTimeout(() => {
                  if (hlsInstance === hls) {
                    hls.startLoad();
                  }
                }, delayMs);
              } else {
                console.error('[HlsEngine] Fatal network error: Max retries exceeded. Falling back to direct stream.');
                destroyHls();
                if (callbacks.onFallback) callbacks.onFallback(data);
                resolve(false);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HlsEngine] Fatal media error encountered, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HlsEngine] Fatal unrecoverable HLS error. Destroying and falling back:', data.details);
              destroyHls();
              if (callbacks.onFallback) callbacks.onFallback(data);
              resolve(false);
              break;
          }
        }

        if (callbacks.onError) callbacks.onError(data);
      });

      hls.attachMedia(audioEl);
    } else if (isNativeHlsSupported(audioEl)) {
      // Native Apple Safari / WebKit HLS support: wait for loadedmetadata before setting currentTime
      audioEl.src = hlsUrl;
      let settled = false;

      const cleanup = () => {
        audioEl.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioEl.removeEventListener('error', onNativeError);
      };

      const onLoadedMetadata = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (startTimeSec > 0 && isFinite(startTimeSec)) {
          try {
            audioEl.currentTime = startTimeSec;
          } catch (err) {
            console.warn('[HlsEngine] Error setting currentTime on native HLS:', err);
          }
        }
        if (callbacks.onParsed) callbacks.onParsed({ native: true });
        resolve(true);
      };

      const onNativeError = (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        console.warn('[HlsEngine] Native HLS error event, falling back to direct stream:', e);
        if (callbacks.onFallback) callbacks.onFallback({ details: 'native_error', error: e });
        resolve(false);
      };

      audioEl.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      audioEl.addEventListener('error', onNativeError, { once: true });
      audioEl.load();
    } else {
      console.warn('[HlsEngine] Neither Hls.js nor native HLS is supported.');
      if (callbacks.onFallback) callbacks.onFallback({ details: 'unsupported' });
      resolve(false);
    }
  });
}
