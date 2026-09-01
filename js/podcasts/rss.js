/**
 * Client-Side RSS Feed Parser for Podcasts
 */

import { getPlaceholder } from '../ui/placeholders.js';

function parseDuration(durationStr) {
  if (!durationStr) return 0;
  const str = String(durationStr).trim();
  if (!str) return 0;

  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

export function cleanAudioUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();

  // 1. Extract nested target URL if multiple http:// or https:// exist
  const lastHttpsIndex = clean.lastIndexOf('https://');
  const lastHttpIndex = clean.lastIndexOf('http://');
  const lastIndex = Math.max(lastHttpsIndex, lastHttpIndex);

  if (lastIndex > 0) {
    return clean.substring(lastIndex);
  }

  // 2. Extract direct host when wrapped by tracker prefixes (e.g. podscribe/vpixl/podtrac/chtbl)
  const matchDomain = clean.match(/(?:https?:\/\/)?([a-z0-9.-]+\.(?:megaphone|libsyn|simplecast|acast|podbean|buzzsprout|transistor|captivate|fireside|anchor|spotify|soundon|pantheon|prx|npr)\.(?:fm|com|org|net)\/.+)$/i);
  if (matchDomain && matchDomain[1]) {
    return `https://${matchDomain[1]}`;
  }

  return clean;
}

export function formatSeconds(secs) {
  if (!secs || isNaN(secs) || secs <= 0) return 'Unknown duration';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m ${s}s`;
}

function getDirectOrProxyUrl(feedUrl) {
  return feedUrl;
}

export async function fetchAndParseFeed(feedUrl) {
  if (!feedUrl || !feedUrl.trim()) {
    throw new Error('Invalid podcast RSS URL');
  }

  const url = feedUrl.trim();
  let xmlText = '';

  try {
    const response = await fetch(url, { headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    xmlText = await response.text();
  } catch (err) {
    console.warn(`[RSS Parser] Direct fetch failed for ${url}, trying CORS proxy fallback...`, err);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const proxyResp = await fetch(proxyUrl);
    if (!proxyResp.ok) throw new Error(`Failed to fetch RSS feed via proxy (${proxyResp.status})`);
    xmlText = await proxyResp.text();
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML Parsing error: ${parserError.textContent}`);
  }

  const channel = xmlDoc.querySelector('channel');
  if (!channel) {
    throw new Error('Invalid RSS feed: No <channel> element found');
  }

  // Get Channel Metadata
  const titleEl = channel.querySelector('title');
  const descEl = channel.querySelector('description');
  const authorEl = channel.querySelector('author, managingEditor') || xmlDoc.getElementsByTagNameNS('*', 'author')[0];
  const linkEl = channel.querySelector('link');

  let image = getPlaceholder('podcast');
  const itunesImage = xmlDoc.getElementsByTagNameNS('*', 'image')[0];
  if (itunesImage && itunesImage.getAttribute('href')) {
    image = itunesImage.getAttribute('href');
  } else {
    const channelImg = channel.querySelector('image > url');
    if (channelImg && channelImg.textContent.trim()) {
      image = channelImg.textContent.trim();
    }
  }

  const showTitle = titleEl ? titleEl.textContent.trim() : 'Untitled Podcast';
  const showAuthor = authorEl ? authorEl.textContent.trim() : 'Unknown Publisher';
  const showDesc = descEl ? descEl.textContent.trim() : '';

  // Get Episodes
  const items = Array.from(channel.querySelectorAll('item'));
  const episodes = items.map((item, index) => {
    const epTitleEl = item.querySelector('title');
    const epGuidEl = item.querySelector('guid');
    const epPubDateEl = item.querySelector('pubDate');
    const epDescEl = item.querySelector('description') || item.getElementsByTagNameNS('*', 'summary')[0];
    const epDurationEl = item.getElementsByTagNameNS('*', 'duration')[0];
    const enclosure = item.querySelector('enclosure');

    const epTitle = epTitleEl ? epTitleEl.textContent.trim() : `Episode ${index + 1}`;
    const epGuid = epGuidEl ? epGuidEl.textContent.trim() : (enclosure?.getAttribute('url') || `${url}_${index}`);
    const epPubDate = epPubDateEl ? epPubDateEl.textContent.trim() : '';
    const epDesc = epDescEl ? epDescEl.textContent.trim() : '';

    let epImage = image;
    const epItunesImg = item.getElementsByTagNameNS('*', 'image')[0];
    if (epItunesImg && epItunesImg.getAttribute('href')) {
      epImage = epItunesImg.getAttribute('href');
    }

    const durationSec = parseDuration(epDurationEl ? epDurationEl.textContent : '');
    const rawEnclosureUrl = enclosure ? enclosure.getAttribute('url') : '';
    const enclosureUrl = cleanAudioUrl(rawEnclosureUrl);

    return {
      id: epGuid,
      Id: epGuid,
      feedUrl: url,
      showTitle: showTitle,
      title: epTitle,
      Name: epTitle,
      pubDate: epPubDate ? new Date(epPubDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '',
      pubDateRaw: epPubDate ? new Date(epPubDate).getTime() : 0,
      duration: durationSec,
      durationFormatted: formatSeconds(durationSec),
      description: epDesc,
      enclosureUrl: enclosureUrl,
      image: epImage,
      isPodcastEpisode: true
    };
  }).filter(ep => ep.enclosureUrl !== ''); // Keep items with audio enclosure

  return {
    feedUrl: url,
    title: showTitle,
    author: showAuthor,
    description: showDesc,
    image: image,
    link: linkEl ? linkEl.textContent.trim() : '',
    episodeCount: episodes.length,
    episodes: episodes
  };
}
