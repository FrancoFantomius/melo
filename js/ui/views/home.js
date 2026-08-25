import { getAlbumsCached, getArtistsCached, getSongsCached, getPlaylistsCached, getPodcastFeedUrls, getArtworkUrl } from '../../jellyfin/client.js';
import { getSession } from '../../jellyfin/session.js';
import { fetchAndParseFeed } from '../../podcasts/rss.js';
import { getCachedFeeds, saveCachedFeed } from '../../podcasts/storage.js';
import { openPodcastShow } from './podcasts.js';
import { switchView } from '../views.js';
import { renderAlbumCardHTML, bindAlbumCards, bindArtistCards, renderTrackRowHTML, bindTrackRows } from './common.js';
import { registerTracksFavoriteStatus } from '../../player/likes.js';
import { getTranslation } from '../../i18n.js';
import { DISCOVER_DAILY_PLAYLIST, LIKED_SONGS_PLAYLIST, buildHomeRecommendations } from '../../recommendations.js';

export async function renderHomeView(container) {
  const session = getSession();
  const userOrder = session.homeSectionOrder || ['playlists', 'songs', 'artists', 'podcasts', 'albums'];

  const pillDefaultText = {
    playlists: 'Playlists',
    songs: 'Songs',
    artists: 'Artists',
    podcasts: 'Podcasts',
    albums: 'Albums'
  };

  const pillIcons = {
    all: 'widgets',
    playlists: 'queue_music',
    songs: 'music_note',
    artists: 'artist',
    podcasts: 'podcasts',
    albums: 'album'
  };

  const pillsHTML = `<md-chip variant="filter" selected icon="widgets" label="${getTranslation('All')}" data-category="all" data-i18n-label="All"></md-chip>` +
    userOrder.map(cat => {
      const defaultText = pillDefaultText[cat] || cat;
      const icon = pillIcons[cat];
      const iconAttr = icon ? `icon="${icon}"` : '';
      return `<md-chip variant="filter" ${iconAttr} label="${getTranslation(defaultText)}" data-category="${cat}" data-i18n-label="${defaultText}"></md-chip>`;
    }).join('');

  const sectionHTMLMap = {
    playlists: `
      <!-- Playlists Section -->
      <section id="home-playlists-section" class="home-section" data-category="playlists">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 16px;">
          <h3 style="font-size: 20px; font-weight: 700;" data-i18n>Playlists</h3>
          <div style="display: flex; gap: 8px;">
            <button id="carousel-prev-playlists" class="carousel-nav-btn" title="Previous">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_left</span>
            </button>
            <button id="carousel-next-playlists" class="carousel-nav-btn" title="Next">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_right</span>
            </button>
          </div>
        </div>
        <div id="home-playlists" class="cards-carousel">
          <div style="color: var(--text-muted);" data-i18n>Loading...</div>
        </div>
      </section>
    `,
    songs: `
      <!-- Recommended Songs / Tracks Section -->
      <section id="home-tracks-section" class="home-section" data-category="songs">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 16px;">
          <h3 style="font-size: 20px; font-weight: 700;" data-i18n>Recommended Songs</h3>
          <div style="display: flex; gap: 8px;">
            <button id="carousel-prev-songs" class="carousel-nav-btn" title="Previous">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_left</span>
            </button>
            <button id="carousel-next-songs" class="carousel-nav-btn" title="Next">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_right</span>
            </button>
          </div>
        </div>
        <div id="home-tracks" class="tracks-grid-2col">
          <div style="color: var(--text-muted); grid-column: 1/-1;" data-i18n>Loading...</div>
        </div>
      </section>
    `,
    artists: `
      <!-- Artists Section -->
      <section id="home-artists-section" class="home-section" data-category="artists">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 16px;">
          <h3 style="font-size: 20px; font-weight: 700;" data-i18n>Artists</h3>
          <div style="display: flex; gap: 8px;">
            <button id="carousel-prev-artists" class="carousel-nav-btn" title="Previous">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_left</span>
            </button>
            <button id="carousel-next-artists" class="carousel-nav-btn" title="Next">
              <span class="material-symbols-outlined" style="font-size: 20px;">chevron_right</span>
            </button>
          </div>
        </div>
        <div id="home-artists" class="cards-carousel">
          <div style="color: var(--text-muted);" data-i18n>Loading...</div>
        </div>
      </section>
    `,
    podcasts: `
      <!-- Podcasts Section -->
      <section id="home-podcasts-section" class="home-section" data-category="podcasts">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 16px;">
          <h3 style="font-size: 20px; font-weight: 700;" data-i18n>Podcasts</h3>
        </div>
        <div id="home-podcasts" class="cards-grid">
          <div style="color: var(--text-muted);" data-i18n>Loading...</div>
        </div>
      </section>
    `,
    albums: `
      <!-- Albums Section -->
      <section id="home-albums-section" class="home-section" data-category="albums">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 16px;">
          <h3 style="font-size: 20px; font-weight: 700;" data-i18n>Albums</h3>
        </div>
        <div id="home-albums" class="cards-grid">
          <div style="color: var(--text-muted);" data-i18n>Loading...</div>
        </div>
      </section>
    `
  };

  const sectionsHTML = userOrder.map(cat => sectionHTMLMap[cat] || '').join('');

  container.innerHTML = `
    <div class="view-section">
      <!-- Category Filter Chips -->
      <md-chip-set class="category-pills" id="home-category-pills">
        ${pillsHTML}
      </md-chip-set>

      ${sectionsHTML}
    </div>
  `;

  // Bind Carousel Buttons
  const playlistsContainer = document.getElementById('home-playlists');
  const btnPrevPlaylists = document.getElementById('carousel-prev-playlists');
  const btnNextPlaylists = document.getElementById('carousel-next-playlists');

  btnPrevPlaylists?.addEventListener('click', () => {
    if (playlistsContainer) {
      playlistsContainer.scrollBy({ left: -380, behavior: 'smooth' });
    }
  });

  btnNextPlaylists?.addEventListener('click', () => {
    if (playlistsContainer) {
      playlistsContainer.scrollBy({ left: 380, behavior: 'smooth' });
    }
  });

  const songsContainer = document.getElementById('home-tracks');
  const btnPrevSongs = document.getElementById('carousel-prev-songs');
  const btnNextSongs = document.getElementById('carousel-next-songs');

  btnPrevSongs?.addEventListener('click', () => {
    if (songsContainer) {
      songsContainer.scrollBy({ left: -290, behavior: 'smooth' });
    }
  });

  btnNextSongs?.addEventListener('click', () => {
    if (songsContainer) {
      songsContainer.scrollBy({ left: 290, behavior: 'smooth' });
    }
  });

  const artistsContainer = document.getElementById('home-artists');
  const btnPrevArtists = document.getElementById('carousel-prev-artists');
  const btnNextArtists = document.getElementById('carousel-next-artists');

  btnPrevArtists?.addEventListener('click', () => {
    if (artistsContainer) {
      artistsContainer.scrollBy({ left: -380, behavior: 'smooth' });
    }
  });

  btnNextArtists?.addEventListener('click', () => {
    if (artistsContainer) {
      artistsContainer.scrollBy({ left: 380, behavior: 'smooth' });
    }
  });

  // Bind Category Filter Chips
  const chipButtons = container.querySelectorAll('#home-category-pills md-chip');
  const sections = container.querySelectorAll('.home-section');

  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      chipButtons.forEach(c => { c.selected = false; });
      chip.selected = true;

      const selectedCategory = chip.getAttribute('data-category');

      sections.forEach(section => {
        const secCat = section.getAttribute('data-category');
        if (selectedCategory === 'all' || secCat === selectedCategory || (selectedCategory === 'all' && secCat === 'all')) {
          section.style.display = 'block';
        } else {
          section.style.display = 'none';
        }
      });
    });
  });

  // UI Updaters
  const updateAlbumsUI = (albumsRes) => {
    const albumsGrid = document.getElementById('home-albums');
    if (albumsGrid && albumsRes) {
      if (!albumsRes.Items || albumsRes.Items.length === 0) {
        albumsGrid.innerHTML = '<div style="color: var(--text-secondary);">No music albums found on your Jellyfin server.</div>';
      } else {
        albumsGrid.innerHTML = albumsRes.Items.map(album => renderAlbumCardHTML(album)).join('');
        bindAlbumCards(albumsGrid);
      }
    }
  };

  const updatePlaylistsUI = (playlistsRes) => {
    const playlistsGrid = document.getElementById('home-playlists');
    if (playlistsGrid && playlistsRes) {
      const likedCard = { ...LIKED_SONGS_PLAYLIST, Name: 'Liked Songs' };
      const items = [likedCard, DISCOVER_DAILY_PLAYLIST, ...(playlistsRes.Items || [])];
      playlistsGrid.innerHTML = items.map(playlist => renderAlbumCardHTML(playlist, 'Playlist')).join('');
      bindAlbumCards(playlistsGrid);
    }
  };

  const updatePodcastsUI = async () => {
    const podcastsGrid = document.getElementById('home-podcasts');
    if (!podcastsGrid) return;

    try {
      const feedUrls = await getPodcastFeedUrls();
      if (!feedUrls || feedUrls.length === 0) {
        podcastsGrid.innerHTML = `
          <div style="grid-column: 1/-1; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="font-weight: 600; color: var(--text-primary);" data-i18n>No podcasts subscribed yet. Search or browse the Discover section below to subscribe!</div>
            <button id="btn-home-discover-podcasts" class="btn-primary" style="margin-top: 8px;">
              <span class="material-symbols-outlined">explore</span>
              <span data-i18n>Discover Podcasts</span>
            </button>
          </div>
        `;
        document.getElementById('btn-home-discover-podcasts')?.addEventListener('click', () => {
          switchView('podcasts', 'discover');
        });
        return;
      }

      const cachedMap = getCachedFeeds();
      const feeds = [];
      for (const url of feedUrls) {
        if (cachedMap[url] && cachedMap[url].data) {
          feeds.push(cachedMap[url].data);
        }
      }

      const renderFeedsGrid = (items) => {
        if (!items || items.length === 0) {
          podcastsGrid.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No episodes found.</div>`;
          return;
        }
        podcastsGrid.innerHTML = items.map(feed => `
          <div class="media-card podcast-home-card" data-feed-url="${encodeURIComponent(feed.feedUrl)}">
            <img src="${feed.image || './img/icons/icon.svg'}" class="card-thumb" alt="${feed.title}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';">
            <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
              <div class="card-title" title="${feed.title}">${feed.title}</div>
              <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${feed.author || 'Podcast'}</div>
              <div style="font-size: 11px; color: var(--accent); margin-top: 2px;">${feed.episodeCount || 0} ${getTranslation('Episodes')}</div>
            </div>
          </div>
        `).join('');

        podcastsGrid.querySelectorAll('.podcast-home-card').forEach(card => {
          card.addEventListener('click', () => {
            const url = decodeURIComponent(card.getAttribute('data-feed-url'));
            openPodcastShow(url);
          });
        });
      };

      if (feeds.length > 0) {
        renderFeedsGrid(feeds);
      }

      // Refresh feeds in background
      Promise.all(feedUrls.map(async (url) => {
        try {
          const fresh = await fetchAndParseFeed(url);
          saveCachedFeed(url, fresh);
          return fresh;
        } catch (e) {
          return cachedMap[url]?.data || null;
        }
      })).then(freshFeeds => {
        const valid = freshFeeds.filter(Boolean);
        if (valid.length > 0) {
          renderFeedsGrid(valid);
        }
      });

    } catch (err) {
      console.warn('[Home] Failed to load podcasts:', err);
      if (podcastsGrid) {
        podcastsGrid.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>An error occurred</div>`;
      }
    }
  };

  const updateSongsUI = (songsRes) => {
    const tracksContainer = document.getElementById('home-tracks');
    if (tracksContainer && songsRes) {
      if (!songsRes.Items || songsRes.Items.length === 0) {
        tracksContainer.innerHTML = `<div style="color: var(--text-secondary); grid-column: 1/-1;" data-i18n>No results found</div>`;
      } else {
        registerTracksFavoriteStatus(songsRes.Items);
        const items = songsRes.Items;
        tracksContainer.innerHTML = items.map((track, idx) => renderTrackRowHTML(track, idx)).join('');
        bindTrackRows(tracksContainer, items);
      }
    }
  };

  const updateArtistsUI = (artistsRes) => {
    const artistsGrid = document.getElementById('home-artists');
    if (artistsGrid && artistsRes) {
      if (!artistsRes.Items || artistsRes.Items.length === 0) {
        artistsGrid.innerHTML = `<div style="color: var(--text-secondary);" data-i18n>No artists found.</div>`;
      } else {
        artistsGrid.innerHTML = artistsRes.Items.map(artist => `
          <div class="media-card" data-artist-id="${artist.Id}">
            <img src="${getArtworkUrl(artist, 'Primary', 300)}" onerror="this.onerror=null; this.src='./img/icons/icon.svg';" class="card-thumb" style="border-radius: 50%;" alt="${artist.Name}">
            <div class="card-title" style="text-align: center;">${artist.Name}</div>
            <div class="card-subtitle" style="text-align: center;" data-i18n>Artist</div>
          </div>
        `).join('');
        bindArtistCards(artistsGrid);
      }
    }
  };

  // Fetch all sections asynchronously
  try {
    const renderRecommendedSections = ({ albumsRes, artistsRes, playlistsRes, songsRes }) => {
      const recommendations = buildHomeRecommendations({ albumsRes, artistsRes, playlistsRes, songsRes });
      updateAlbumsUI(recommendations.albums);
      updatePlaylistsUI(recommendations.playlists);
      updateSongsUI(recommendations.songs);
      updateArtistsUI(recommendations.artists);
    };

    const [albumsRes, playlistsRes, songsRes, artistsRes] = await Promise.all([
      getAlbumsCached({ limit: 60, sortBy: 'DateCreated', sortOrder: 'Descending' }, res => updateAlbumsUI(buildHomeRecommendations({ albumsRes: res }).albums)),
      getPlaylistsCached(res => updatePlaylistsUI(buildHomeRecommendations({ playlistsRes: res }).playlists)),
      getSongsCached({ limit: 120, sortBy: 'DatePlayed,PlayCount,SortName', sortOrder: 'Descending' }, res => updateSongsUI(buildHomeRecommendations({ songsRes: res }).songs)),
      getArtistsCached({ limit: 100 }, res => updateArtistsUI(buildHomeRecommendations({ artistsRes: res }).artists))
    ]);

    renderRecommendedSections({ albumsRes, artistsRes, playlistsRes, songsRes });

    updatePodcastsUI();

  } catch (err) {
    const albumsGrid = document.getElementById('home-albums');
    if (!albumsGrid || albumsGrid.children.length === 0 || albumsGrid.textContent.includes('Loading')) {
      container.innerHTML = `<div style="color: var(--danger); padding: 20px;">Could not connect to Jellyfin server or fetch music library. Please click "Sign in" to connect.</div>`;
    }
  }
}
