import { getSession } from '../jellyfin/session.js';
import { getAudioStreamUrl } from '../jellyfin/client.js';
import { isTrackDownloadedSync, getDownloadedBlobUrlSync } from '../jellyfin/offline.js';
import { cleanAudioUrl } from '../podcasts/rss.js';
import { state } from './state.js';

export function resolveCurrentBitrate() {
  const session = getSession();
  let isMobile = false;

  if (navigator.connection) {
    const type = navigator.connection.type || navigator.connection.effectiveType || '';
    if (type.includes('cellular') || type.includes('2g') || type.includes('3g') || type.includes('4g')) {
      isMobile = true;
    }
  }

  const selected = isMobile ? session.qualityMobile : session.qualityWifi;
  state.currentBitrateMode = session.forceTranscode && selected === 'Direct' ? '320000' : selected;
  return state.currentBitrateMode;
}

export function resolveStreamUrl(track, startTimeTicks = 0) {
  if (!track) return '';
  const key = track.Id || track.id;
  if (key && isTrackDownloadedSync(key)) {
    const blobUrl = getDownloadedBlobUrlSync(key);
    if (blobUrl) return blobUrl;
  }
  if (track.isPodcastEpisode || track.enclosureUrl) {
    return cleanAudioUrl(track.enclosureUrl);
  }
  const bitrate = resolveCurrentBitrate();
  const session = getSession();
  return getAudioStreamUrl(track.Id, {
    maxStreamingBitrate: bitrate,
    forceTranscode: session.forceTranscode,
    startTimeTicks
  });
}

// URL for a server-side seek: Jellyfin transcodes from the requested offset.
export function buildSeekStreamUrl(track, startTimeTicks) {
  const bitrate = resolveCurrentBitrate();
  const session = getSession();
  return getAudioStreamUrl(track.Id, {
    maxStreamingBitrate: bitrate,
    forceTranscode: session.forceTranscode,
    startTimeTicks
  });
}

// Fetch a podcast enclosure through the CORS proxy and return a same-origin
// blob URL so it stays playable/WebAudio-readable on hosts without CORS headers.
export async function resolvePodcastProxyBlobUrl(enclosureUrl) {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(enclosureUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[Audio Engine] Podcast proxy fetch failed:', err);
    return null;
  }
}