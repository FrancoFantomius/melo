import Hls from 'hls.js';

let hlsInstance = null;
let currentHlsUrl = null;

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

export function destroyHls() {
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
              console.warn('[HlsEngine] Fatal network error encountered, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HlsEngine] Fatal media error encountered, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HlsEngine] Fatal unrecoverable HLS error. Destroying and falling back:', data.details);
              destroyHls();
              if (callbacks.onFallback) {
                callbacks.onFallback(data);
              }
              resolve(false);
              break;
          }
        }

        if (callbacks.onError) callbacks.onError(data);
      });

      hls.attachMedia(audioEl);
    } else if (isNativeHlsSupported(audioEl)) {
      // Native Apple Safari / WebKit HLS support
      audioEl.src = hlsUrl;
      if (startTimeSec > 0 && isFinite(startTimeSec)) {
        audioEl.currentTime = startTimeSec;
      }
      resolve(true);
    } else {
      console.warn('[HlsEngine] Neither Hls.js nor native HLS is supported.');
      if (callbacks.onFallback) callbacks.onFallback({ details: 'unsupported' });
      resolve(false);
    }
  });
}

