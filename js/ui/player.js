import { initAudioPlayer, togglePlayPause, playNextTrack, playPrevTrack, seekTo, setVolume, toggleMute, playTrack, savePlayerState, notifyUI, setPlaybackSpeed, getPlaybackSpeed, skipSeconds } from '../player/audio.js';
import { toggleShuffle, toggleRepeat } from '../player/queue.js';
import { toggleQueueDrawer, renderQueueDrawerList, toggleLyricsModal, updateLyricsSync, saveSettingsFromModal, openSelectPlaylistModal } from './modals.js';
import { getArtworkUrl, getItemCached } from '../jellyfin/client.js';
import { getSession, saveSession } from '../jellyfin/session.js';
import { isTrackLiked, toggleTrackLiked } from '../player/likes.js';
import { toggleTrackDownload, refreshDownloadButton } from './downloads.js';

export function initPlayerUI() {
  const btnPlay = document.getElementById('player-btn-play');
  const btnPrev = document.getElementById('player-btn-prev');
  const btnNext = document.getElementById('player-btn-next');
  const btnSkipBack = document.getElementById('player-btn-skip-back');
  const btnSkipForward = document.getElementById('player-btn-skip-forward');
  const speedBadge = document.getElementById('player-speed-badge');
  const btnShuffle = document.getElementById('player-btn-shuffle');
  const btnRepeat = document.getElementById('player-btn-repeat');
  const btnQueue = document.getElementById('player-btn-queue');
  const btnLyrics = document.getElementById('player-btn-lyrics');
  const btnLike = document.getElementById('player-btn-like');
  const btnAddPlaylist = document.getElementById('player-btn-add-playlist');
  const btnDownload = document.getElementById('player-btn-download');
  const btnVolume = document.getElementById('player-btn-volume');
  const qualityBadge = document.getElementById('player-quality-badge');
  const progressSlider = document.getElementById('player-progress');
  const volumeSlider = document.getElementById('player-volume');

  // Expanded Mobile Player Elements
  const empContainer = document.getElementById('expanded-mobile-player');
  const empBtnClose = document.getElementById('emp-btn-close');
  const empCoverEl = document.getElementById('emp-cover');
  const empTitleEl = document.getElementById('emp-title');
  const empArtistEl = document.getElementById('emp-artist');
  const empBtnPlay = document.getElementById('emp-btn-play');
  const empBtnPrev = document.getElementById('emp-btn-prev');
  const empBtnNext = document.getElementById('emp-btn-next');
  const empBtnShuffle = document.getElementById('emp-btn-shuffle');
  const empBtnRepeat = document.getElementById('emp-btn-repeat');
  const empBtnLike = document.getElementById('emp-btn-like');
  const empBtnAddPlaylist = document.getElementById('emp-btn-add-playlist');
  const empBtnDownload = document.getElementById('emp-btn-download');
  const empBtnLyrics = document.getElementById('emp-btn-lyrics');
  const empBtnQueue = document.getElementById('emp-btn-queue');
  const empProgressSlider = document.getElementById('emp-progress');
  const empCurrentTimeEl = document.getElementById('emp-current-time');
  const empTotalTimeEl = document.getElementById('emp-total-time');

  let currentPlayingTrack = null;

  const updateLikeButton = (track) => {
    const isLiked = track && track.Id && !track.isPodcastEpisode && !track.enclosureUrl && isTrackLiked(track.Id);
    const showLike = track && track.Id && !track.isPodcastEpisode && !track.enclosureUrl;

    [btnLike, empBtnLike].forEach(btn => {
      if (!btn) return;
      if (showLike) {
        btn.style.display = 'flex';
        btn.classList.toggle('liked', !!isLiked);
        btn.title = isLiked ? 'Unlike' : 'Like';
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = isLiked ? 'favorite' : 'favorite_border';
      } else {
        btn.style.display = 'none';
      }
    });
  };

  const updateAddPlaylistButton = (track) => {
    const showBtn = track && track.Id && !track.isPodcastEpisode && !track.enclosureUrl;
    [btnAddPlaylist, empBtnAddPlaylist].forEach(btn => {
      if (!btn) return;
      btn.style.display = showBtn ? 'flex' : 'none';
    });
  };

  const updateDownloadButton = async (track) => {
    const trackId = track && (track.Id || track.id);
    [btnDownload, empBtnDownload].forEach(btn => {
      if (!btn) return;
      if (trackId) {
        btn.style.display = 'flex';
        btn.setAttribute('data-track-id', trackId);
      } else {
        btn.style.display = 'none';
        btn.removeAttribute('data-track-id');
      }
    });
    if (trackId) {
      await refreshDownloadButton(btnDownload);
      await refreshDownloadButton(empBtnDownload);
    }
  };

  const handleDownloadClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (currentPlayingTrack) {
      await toggleTrackDownload(currentPlayingTrack, e.currentTarget);
    }
  };

  btnDownload?.addEventListener('click', handleDownloadClick);
  empBtnDownload?.addEventListener('click', handleDownloadClick);

  window.addEventListener('melo-download-changed', (e) => {
    const { trackId } = e.detail || {};
    const currentId = currentPlayingTrack && (currentPlayingTrack.Id || currentPlayingTrack.id);
    if (trackId && currentId && String(trackId) === String(currentId)) {
      updateDownloadButton(currentPlayingTrack);
    }
  });

  [btnAddPlaylist, empBtnAddPlaylist].forEach(btn => {
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (currentPlayingTrack && currentPlayingTrack.Id && !currentPlayingTrack.isPodcastEpisode) {
        openSelectPlaylistModal(currentPlayingTrack);
      }
    });
  });

  // Open expanded mobile player when mini-player bar is tapped on mobile
  const mainPlayerBar = document.querySelector('.main-player');
  mainPlayerBar?.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    if (window.location.hash !== '#player') {
      window.location.hash = 'player';
    } else {
      empContainer?.classList.add('open');
    }
  });

  empBtnClose?.addEventListener('click', () => {
    if (window.location.hash === '#player') {
      window.history.back();
      setTimeout(() => {
        if (window.location.hash === '#player') {
          history.replaceState(null, '', window.location.pathname + window.location.search);
          empContainer?.classList.remove('open');
        }
      }, 50);
    } else {
      empContainer?.classList.remove('open');
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      empContainer?.classList.remove('open');
    }
  });

  initAudioPlayer((state) => {
    // Update queue drawer list if open
    const queueDrawer = document.getElementById('queue-drawer');
    if (queueDrawer && queueDrawer.classList.contains('open')) {
      renderQueueDrawerList();
    }

    // Update player bars with state
    const track = state.track;
    currentPlayingTrack = track;
    updateLikeButton(track);
    updateAddPlaylistButton(track);
    updateDownloadButton(track);

    const coverEl = document.getElementById('player-track-cover');
    const titleEl = document.getElementById('player-track-title');
    const artistEl = document.getElementById('player-track-artist');
    const currentTimeEl = document.getElementById('player-current-time');
    const totalTimeEl = document.getElementById('player-total-time');

    if (track) {
      const artUrl = track.image ? track.image : getArtworkUrl(track, 'Primary', 300);
      if (coverEl) coverEl.src = artUrl;
      if (empCoverEl) empCoverEl.src = artUrl;

      const titleStr = track.title || track.Name || 'Unknown Title';
      if (titleEl) titleEl.textContent = titleStr;
      if (empTitleEl) empTitleEl.textContent = titleStr;

      const artistStr = track.showTitle || track.Artists?.join(', ') || track.AlbumArtist || 'Unknown Artist';
      if (artistEl) artistEl.textContent = artistStr;
      if (empArtistEl) empArtistEl.textContent = artistStr;

      const isPodcast = !!(track.isPodcastEpisode || track.enclosureUrl);
      if (btnSkipBack) btnSkipBack.style.display = isPodcast ? 'flex' : 'none';
      if (btnSkipForward) btnSkipForward.style.display = isPodcast ? 'flex' : 'none';
      if (speedBadge) {
        speedBadge.style.display = isPodcast ? 'flex' : 'none';
        speedBadge.textContent = `${state.playbackSpeed || 1.0}x`;
      }
      if (qualityBadge) {
        qualityBadge.style.display = isPodcast ? 'none' : 'flex';
      }

      const currentSec = Math.floor(state.currentTime || 0);
      let totalSec = Math.floor(state.duration || 0);
      if (!isFinite(totalSec) || totalSec <= 0) {
        if (track.duration) {
          totalSec = track.duration;
        } else if (track.RunTimeTicks) {
          totalSec = Math.floor(track.RunTimeTicks / 10000000);
        } else {
          totalSec = 0;
        }
      }

      const formattedCurrent = formatTime(currentSec);
      const formattedTotal = formatTime(totalSec);

      if (currentTimeEl && !progressSlider?.isSeeking) currentTimeEl.textContent = formattedCurrent;
      if (empCurrentTimeEl && !empProgressSlider?.isSeeking) empCurrentTimeEl.textContent = formattedCurrent;

      if (totalTimeEl) totalTimeEl.textContent = formattedTotal;
      if (empTotalTimeEl) empTotalTimeEl.textContent = formattedTotal;

      [progressSlider, empProgressSlider].forEach(slider => {
        if (slider && !slider.isSeeking) {
          slider.max = totalSec > 0 ? totalSec : 100;
          slider.value = isFinite(currentSec) ? currentSec : 0;
          updateSliderFill(slider);
        }
      });

      // Check lyrics button availability for current track
      [btnLyrics, empBtnLyrics].forEach(btn => {
        if (!btn) return;
        if (isPodcast) {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'flex';
        }
      });
    } else {
      [btnLyrics, empBtnLyrics].forEach(btn => { if (btn) btn.style.display = 'none'; });
    }

    updateLyricsSync(state.currentTime);

    const playIconText = state.isPlaying ? 'pause_circle' : 'play_circle';
    if (btnPlay) {
      const icon = btnPlay.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = playIconText;
    }
    if (empBtnPlay) {
      const icon = empBtnPlay.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = playIconText;
    }

    if (volumeSlider && state.volume !== undefined && !volumeSlider.isInteracting) {
      volumeSlider.value = state.volume;
      updateSliderFill(volumeSlider);
    }

    if (btnVolume) {
      const icon = btnVolume.querySelector('.material-symbols-outlined');
      if (icon && state.volume !== undefined) {
        if (state.volume === 0) {
          icon.textContent = 'volume_off';
        } else if (state.volume < 0.5) {
          icon.textContent = 'volume_down';
        } else {
          icon.textContent = 'volume_up';
        }
      }
    }

    if (state.queueState) {
      const isShuffled = state.queueState.shuffle;
      [btnShuffle, empBtnShuffle].forEach(btn => {
        if (btn) {
          btn.style.color = isShuffled ? 'var(--accent)' : 'var(--text-secondary)';
          btn.classList.toggle('active', isShuffled);
        }
      });

      const mode = state.queueState.repeat;
      const isActive = mode !== 'none' && mode !== false;

      [btnRepeat, empBtnRepeat].forEach(btn => {
        if (!btn) return;
        btn.classList.toggle('active', isActive);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (mode === 'one') {
          btn.style.color = 'var(--accent)';
          btn.title = 'Repeat Song Once (Auto-Disables)';
          if (icon) icon.textContent = 'repeat_one';
        } else if (mode === 'all') {
          btn.style.color = 'var(--accent)';
          btn.title = 'Repeat Song (Continuous)';
          if (icon) icon.textContent = 'repeat';
        } else {
          btn.style.color = 'var(--text-secondary)';
          btn.title = 'Repeat Off';
          if (icon) icon.textContent = 'repeat';
        }
      });
    }

    if (qualityBadge) {
      qualityBadge.textContent = state.bitrateMode === 'Direct' ? 'DIRECT' : `${Math.round(parseInt(state.bitrateMode) / 1000)}k`;
      qualityBadge.className = `quality-badge ${state.bitrateMode !== 'Direct' ? 'active' : ''}`;
    }
  });

  // Mini Player Controls Event Listeners
  btnPlay?.addEventListener('click', () => togglePlayPause());
  btnPrev?.addEventListener('click', () => playPrevTrack());
  btnNext?.addEventListener('click', () => playNextTrack());
  btnSkipBack?.addEventListener('click', () => skipSeconds(-15));
  btnSkipForward?.addEventListener('click', () => skipSeconds(30));

  // Expanded Mobile Player Controls Event Listeners
  empBtnPlay?.addEventListener('click', () => togglePlayPause());
  empBtnPrev?.addEventListener('click', () => playPrevTrack());
  empBtnNext?.addEventListener('click', () => playNextTrack());

  empBtnShuffle?.addEventListener('click', () => {
    toggleShuffle();
    savePlayerState();
    notifyUI();
  });

  empBtnRepeat?.addEventListener('click', () => {
    toggleRepeat();
    savePlayerState();
    notifyUI();
  });

  empBtnLike?.addEventListener('click', () => {
    if (currentPlayingTrack) {
      toggleTrackLiked(currentPlayingTrack);
    }
  });

  empBtnLyrics?.addEventListener('click', () => toggleLyricsModal());
  empBtnQueue?.addEventListener('click', () => toggleQueueDrawer());

  btnLike?.addEventListener('click', () => {
    if (currentPlayingTrack) {
      toggleTrackLiked(currentPlayingTrack);
    }
  });

  window.addEventListener('melo-likes-changed', () => {
    updateLikeButton(currentPlayingTrack);
  });

  speedBadge?.addEventListener('click', () => {
    const speeds = [0.8, 1.0, 1.25, 1.5, 2.0];
    const current = getPlaybackSpeed();
    const idx = speeds.indexOf(current);
    const nextSpeed = speeds[(idx + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
  });

  btnShuffle?.addEventListener('click', () => {
    toggleShuffle();
    savePlayerState();
    notifyUI();
  });

  btnRepeat?.addEventListener('click', () => {
    toggleRepeat();
    savePlayerState();
    notifyUI();
  });

  btnQueue?.addEventListener('click', () => toggleQueueDrawer());
  btnLyrics?.addEventListener('click', () => toggleLyricsModal());

  qualityBadge?.addEventListener('click', () => {
    const session = getSession();
    const isDirect = session.qualityWifi === 'Direct' && !session.forceTranscode;
    saveSession({
      forceTranscode: isDirect,
      qualityWifi: isDirect ? '320000' : 'Direct'
    });
    playTrack();
  });

  // Progress Seek Bars (Mini & Expanded)
  [progressSlider, empProgressSlider].forEach(slider => {
    if (!slider) return;
    const startSeeking = () => { slider.isSeeking = true; };

    slider.addEventListener('mousedown', startSeeking);
    slider.addEventListener('touchstart', startSeeking, { passive: true });

    slider.addEventListener('input', (e) => {
      slider.isSeeking = true;
      const val = parseFloat(e.target.value);
      const currentTimeEl = document.getElementById('player-current-time');
      if (currentTimeEl) currentTimeEl.textContent = formatTime(val);
      if (empCurrentTimeEl) empCurrentTimeEl.textContent = formatTime(val);
      updateSliderFill(slider);
    });

    slider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      seekTo(val);
      setTimeout(() => { slider.isSeeking = false; }, 300);
    });
  });

  // Volume Button & Slider
  btnVolume?.addEventListener('click', () => toggleMute());

  if (volumeSlider) {
    updateSliderFill(volumeSlider);
    const startVolumeInteract = () => { volumeSlider.isInteracting = true; };
    const stopVolumeInteract = () => { volumeSlider.isInteracting = false; };

    volumeSlider.addEventListener('mousedown', startVolumeInteract);
    volumeSlider.addEventListener('touchstart', startVolumeInteract, { passive: true });
    volumeSlider.addEventListener('mouseup', stopVolumeInteract);
    volumeSlider.addEventListener('touchend', stopVolumeInteract);

    volumeSlider.addEventListener('input', (e) => {
      setVolume(parseFloat(e.target.value));
    });
    volumeSlider.addEventListener('change', (e) => {
      stopVolumeInteract();
      setVolume(parseFloat(e.target.value));
    });
  }

  // Settings Modal Save Button
  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    saveSettingsFromModal();
  });
}

function formatTime(seconds) {
  if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSec = Math.floor(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateSliderFill(slider) {
  if (!slider) return;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value) || 0;
  const percent = max > 0 ? Math.min(100, Math.max(0, (val / max) * 100)) : 0;
  slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, var(--bg-tertiary) ${percent}%, var(--bg-tertiary) 100%)`;
}
