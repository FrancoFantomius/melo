import { initAudioPlayer, togglePlayPause, playNextTrack, playPrevTrack, seekTo, setVolume, toggleMute, playTrack, savePlayerState, notifyUI, setPlaybackSpeed, getPlaybackSpeed, skipSeconds } from '../player/audio.js';
import { toggleShuffle, toggleRepeat } from '../player/queue.js';
import { toggleQueueDrawer, renderQueueDrawerList, toggleLyricsModal, updateLyricsSync, saveSettingsFromModal, openSelectPlaylistModal } from './modals.js';
import { getArtworkUrl, getLyrics } from '../jellyfin/client.js';
import { getSession, saveSession } from '../jellyfin/session.js';
import { isTrackLiked, toggleTrackLiked } from '../player/likes.js';
import { toggleTrackDownload, refreshDownloadButton } from './downloads.js';

const $ = (id) => document.getElementById(id);

export function initPlayerUI() {
  // Singleton controls (mini player)
  const btnPrev = $('player-btn-prev');
  const btnNext = $('player-btn-next');
  const btnSkipBack = $('player-btn-skip-back');
  const btnSkipForward = $('player-btn-skip-forward');
  const speedBadge = $('player-speed-badge');
  const qualityBadge = $('player-quality-badge');
  const volumeSlider = $('player-volume');
  const btnVolume = $('player-btn-volume');

  // Expanded mobile player
  const empContainer = $('expanded-mobile-player');
  const empBtnClose = $('emp-btn-close');
  const mainPlayerBar = document.querySelector('.main-player');

  // Controls that exist in both the mini player and the expanded mobile player
  const pairs = {
    cover: [$('player-track-cover'), $('emp-cover')],
    title: [$('player-track-title'), $('emp-title')],
    artist: [$('player-track-artist'), $('emp-artist')],
    current: [$('player-current-time'), $('emp-current-time')],
    total: [$('player-total-time'), $('emp-total-time')],
    play: [$('player-btn-play'), $('emp-btn-play')],
    prev: [btnPrev, $('emp-btn-prev')],
    next: [btnNext, $('emp-btn-next')],
    like: [$('player-btn-like'), $('emp-btn-like')],
    addPlaylist: [$('player-btn-add-playlist'), $('emp-btn-add-playlist')],
    download: [$('player-btn-download'), $('emp-btn-download')],
    shuffle: [$('player-btn-shuffle'), $('emp-btn-shuffle')],
    repeat: [$('player-btn-repeat'), $('emp-btn-repeat')],
    lyrics: [$('player-btn-lyrics'), $('emp-btn-lyrics')],
    queue: [$('player-btn-queue'), $('emp-btn-queue')],
    progress: [$('player-progress'), $('emp-progress')]
  };

  const each = (els, fn) => els.forEach((el, i) => el && fn(el, i));
  const setDisplay = (el, value) => { el.style.display = value; };
  const setIcon = (el, text) => {
    const icon = el.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = text;
  };
  const isMusic = (track) => !!(track && track.Id && !track.isPodcastEpisode && !track.enclosureUrl);

  let currentPlayingTrack = null;
  const lyricsCache = new Map();

  const updateActionButtons = (track) => {
    const music = isMusic(track);
    const liked = music && isTrackLiked(track.Id);
    each(pairs.like, (btn) => {
      if (!music) return setDisplay(btn, 'none');
      setDisplay(btn, 'flex');
      btn.classList.toggle('liked', liked);
      btn.title = liked ? 'Unlike' : 'Like';
      setIcon(btn, liked ? 'favorite' : 'favorite_border');
    });
    each(pairs.addPlaylist, (btn) => setDisplay(btn, music ? 'flex' : 'none'));
  };

  const updateLyricsButton = async (track) => {
    if (!track || track.isPodcastEpisode || track.enclosureUrl) {
      each(pairs.lyrics, (btn) => setDisplay(btn, 'none'));
      return;
    }

    const trackId = track.Id || track.id;
    if (!trackId) {
      each(pairs.lyrics, (btn) => setDisplay(btn, 'none'));
      return;
    }

    if (typeof track.HasLyrics === 'boolean') {
      lyricsCache.set(trackId, track.HasLyrics);
      each(pairs.lyrics, (btn) => setDisplay(btn, track.HasLyrics ? 'flex' : 'none'));
      return;
    }

    if (typeof track.hasLyrics === 'boolean') {
      lyricsCache.set(trackId, track.hasLyrics);
      each(pairs.lyrics, (btn) => setDisplay(btn, track.hasLyrics ? 'flex' : 'none'));
      return;
    }

    if (lyricsCache.has(trackId)) {
      const has = lyricsCache.get(trackId);
      each(pairs.lyrics, (btn) => setDisplay(btn, has ? 'flex' : 'none'));
      return;
    }

    each(pairs.lyrics, (btn) => setDisplay(btn, 'none'));

    try {
      const data = await getLyrics(trackId);
      const hasLyrics = !!(data && (
        (Array.isArray(data.Lyrics) && data.Lyrics.length > 0) ||
        (typeof data === 'string' && data.trim().length > 0)
      ));
      lyricsCache.set(trackId, hasLyrics);
      track.HasLyrics = hasLyrics;
      const curId = currentPlayingTrack && (currentPlayingTrack.Id || currentPlayingTrack.id);
      if (curId === trackId) {
        each(pairs.lyrics, (btn) => setDisplay(btn, hasLyrics ? 'flex' : 'none'));
      }
    } catch {
      lyricsCache.set(trackId, false);
      const curId = currentPlayingTrack && (currentPlayingTrack.Id || currentPlayingTrack.id);
      if (curId === trackId) {
        each(pairs.lyrics, (btn) => setDisplay(btn, 'none'));
      }
    }
  };

  const updateDownloadButton = async (track) => {
    const trackId = track && (track.Id || track.id);
    each(pairs.download, (btn) => {
      if (trackId) {
        setDisplay(btn, 'flex');
        btn.setAttribute('data-track-id', trackId);
      } else {
        setDisplay(btn, 'none');
        btn.removeAttribute('data-track-id');
      }
    });
    if (trackId) {
      await Promise.all(pairs.download.filter(Boolean).map((btn) => refreshDownloadButton(btn)));
    }
  };

  const handleDownloadClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (currentPlayingTrack) await toggleTrackDownload(currentPlayingTrack, e.currentTarget);
  };

  each(pairs.download, (btn) => btn.addEventListener('click', handleDownloadClick));

  window.addEventListener('melo-download-changed', (e) => {
    const { trackId } = e.detail || {};
    const currentId = currentPlayingTrack && (currentPlayingTrack.Id || currentPlayingTrack.id);
    if (trackId && currentId && String(trackId) === String(currentId)) {
      updateDownloadButton(currentPlayingTrack);
    }
  });

  each(pairs.addPlaylist, (btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (currentPlayingTrack && currentPlayingTrack.Id && !currentPlayingTrack.isPodcastEpisode) {
        openSelectPlaylistModal(currentPlayingTrack);
      }
    });
  });

  // Open expanded mobile player when mini-player bar is tapped on mobile
  mainPlayerBar?.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    if (window.location.hash !== '#player') {
      window.location.hash = 'player';
    } else {
      empContainer?.classList.add('open');
    }
  });

  const closeExpandedPlayer = () => {
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
  };

  empBtnClose?.addEventListener('click', closeExpandedPlayer);

  // Collapse the full-player back to the mini bar when scrolling/pulling down
  let empTouchStartY = null;
  let empTouchAccum = 0;
  let empWheelAccum = 0;
  const resetEmpGesture = () => {
    empTouchStartY = null;
    empTouchAccum = 0;
    empWheelAccum = 0;
  };

  empContainer?.addEventListener('touchstart', (e) => {
    if (!empContainer.classList.contains('open')) return;
    if (e.target.closest('button, input')) return;
    empTouchStartY = e.touches[0].clientY;
    empTouchAccum = 0;
  }, { passive: true });

  empContainer?.addEventListener('touchmove', (e) => {
    if (empTouchStartY === null) return;
    const y = e.touches[0].clientY;
    const deltaY = y - empTouchStartY;
    empTouchStartY = y;
    empTouchAccum = deltaY > 0 ? Math.max(0, empTouchAccum + deltaY) : 0;
    if (empTouchAccum > 60) {
      empTouchStartY = null;
      empTouchAccum = 0;
      closeExpandedPlayer();
    }
  }, { passive: true });

  empContainer?.addEventListener('touchend', resetEmpGesture);
  empContainer?.addEventListener('touchcancel', resetEmpGesture);

  empContainer?.addEventListener('wheel', (e) => {
    if (!empContainer.classList.contains('open') || e.target.closest('input')) return;
    if (e.deltaY > 0) {
      empWheelAccum += e.deltaY;
      if (empWheelAccum > 60) {
        empWheelAccum = 0;
        closeExpandedPlayer();
      }
    } else {
      empWheelAccum = 0;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) empContainer?.classList.remove('open');
  });

  initAudioPlayer((state) => {
    const queueDrawer = $('queue-drawer');
    if (queueDrawer && queueDrawer.classList.contains('open')) renderQueueDrawerList();

    const track = state.track;
    currentPlayingTrack = track;
    updateActionButtons(track);
    updateDownloadButton(track);
    updateLyricsButton(track);

    if (track) {
      const artUrl = track.image ? track.image : getArtworkUrl(track, 'Primary', 300);
      each(pairs.cover, (el) => { el.src = artUrl; });

      const titleStr = track.title || track.Name || 'Unknown Title';
      each(pairs.title, (el) => { el.textContent = titleStr; });

      const artistStr = track.showTitle || track.Artists?.join(', ') || track.AlbumArtist || 'Unknown Artist';
      each(pairs.artist, (el) => { el.textContent = artistStr; });

      const isPodcast = !!(track.isPodcastEpisode || track.enclosureUrl);
      if (btnSkipBack) btnSkipBack.style.display = isPodcast ? 'flex' : 'none';
      if (btnSkipForward) btnSkipForward.style.display = isPodcast ? 'flex' : 'none';
      if (speedBadge) {
        speedBadge.style.display = isPodcast ? 'flex' : 'none';
        speedBadge.textContent = `${state.playbackSpeed || 1.0}x`;
      }
      if (qualityBadge) qualityBadge.style.display = isPodcast ? 'none' : 'flex';

      const currentSec = Math.floor(state.currentTime || 0);
      let totalSec = Math.floor(state.duration || 0);
      if (!isFinite(totalSec) || totalSec <= 0) {
        totalSec = track.duration || (track.RunTimeTicks ? Math.floor(track.RunTimeTicks / 10000000) : 0);
      }

      const formattedCurrent = formatTime(currentSec);
      const formattedTotal = formatTime(totalSec);

      const isAnySeeking = pairs.progress.some((slider) => slider && slider.isSeeking);
      if (!isAnySeeking) {
        each(pairs.current, (el) => { el.textContent = formattedCurrent; });
      }

      each(pairs.progress, (slider) => {
        if (!slider.isSeeking) {
          slider.max = totalSec > 0 ? totalSec : 100;
          slider.value = isFinite(currentSec) ? currentSec : 0;
          updateSliderFill(slider);
        }
      });
      each(pairs.total, (el) => { el.textContent = formattedTotal; });
    }

    updateLyricsSync(state.currentTime);

    each(pairs.play, (btn) => setIcon(btn, state.isPlaying ? 'pause_circle' : 'play_circle'));

    if (volumeSlider && state.volume !== undefined && !volumeSlider.isInteracting) {
      volumeSlider.value = state.volume;
      updateSliderFill(volumeSlider);
    }

    if (btnVolume && state.volume !== undefined) {
      setIcon(btnVolume, state.volume === 0 ? 'volume_off' : state.volume < 0.5 ? 'volume_down' : 'volume_up');
    }

    if (state.queueState) {
      const isShuffled = state.queueState.shuffle;
      each(pairs.shuffle, (btn) => {
        btn.style.color = isShuffled ? 'var(--accent)' : 'var(--text-secondary)';
        btn.classList.toggle('active', isShuffled);
      });

      const mode = state.queueState.repeat;
      each(pairs.repeat, (btn) => {
        btn.classList.toggle('active', mode !== 'none' && mode !== false);
        if (mode === 'one') {
          btn.style.color = 'var(--accent)';
          btn.title = 'Repeat Song Once (Auto-Disables)';
          setIcon(btn, 'repeat_one');
        } else if (mode === 'all') {
          btn.style.color = 'var(--accent)';
          btn.title = 'Repeat Song (Continuous)';
          setIcon(btn, 'repeat');
        } else {
          btn.style.color = 'var(--text-secondary)';
          btn.title = 'Repeat Off';
          setIcon(btn, 'repeat');
        }
      });
    }

    if (qualityBadge) {
      qualityBadge.textContent = state.bitrateMode === 'Direct' ? 'DIRECT' : `${Math.round(parseInt(state.bitrateMode) / 1000)}k`;
      qualityBadge.className = `quality-badge ${state.bitrateMode !== 'Direct' ? 'active' : ''}`;
    }
  });

  // Mini & expanded playback controls
  each(pairs.play, (btn) => btn.addEventListener('click', () => togglePlayPause()));
  each(pairs.prev, (btn) => btn.addEventListener('click', () => playPrevTrack()));
  each(pairs.next, (btn) => btn.addEventListener('click', () => playNextTrack()));
  btnSkipBack?.addEventListener('click', () => skipSeconds(-15));
  btnSkipForward?.addEventListener('click', () => skipSeconds(30));

  // Space bar keyboard shortcut to play/pause when not focused on an input/searchbar
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      const isInput = (elem) => {
        if (!elem || typeof elem !== 'object') return false;
        const tag = elem.tagName?.toUpperCase();
        if (tag === 'TEXTAREA' || elem.isContentEditable) return true;
        if (tag === 'INPUT') {
          const type = (elem.type || 'text').toLowerCase();
          return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
        }
        if (tag === 'MD-SEARCH-BAR' || tag === 'MD-SEARCH' || tag === 'MD-TEXT-FIELD' || tag === 'MD-CODE') {
          return true;
        }
        return false;
      };

      const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
      const isTyping = path.some((el) => isInput(el)) || isInput(document.activeElement);

      if (isTyping) return;

      e.preventDefault();
      togglePlayPause();
    }
  });

  const runShuffle = () => { toggleShuffle(); savePlayerState(); notifyUI(); };
  const runRepeat = () => { toggleRepeat(); savePlayerState(); notifyUI(); };
  each(pairs.shuffle, (btn) => btn.addEventListener('click', runShuffle));
  each(pairs.repeat, (btn) => btn.addEventListener('click', runRepeat));

  const toggleLike = () => { if (currentPlayingTrack) toggleTrackLiked(currentPlayingTrack); };
  each(pairs.like, (btn) => btn.addEventListener('click', toggleLike));
  window.addEventListener('melo-likes-changed', () => updateActionButtons(currentPlayingTrack));

  each(pairs.lyrics, (btn) => btn.addEventListener('click', () => toggleLyricsModal()));
  each(pairs.queue, (btn) => btn.addEventListener('click', () => toggleQueueDrawer()));

  speedBadge?.addEventListener('click', () => {
    const speeds = [0.8, 1.0, 1.25, 1.5, 2.0];
    const idx = speeds.indexOf(getPlaybackSpeed());
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
  });

  qualityBadge?.addEventListener('click', () => {
    const session = getSession();
    const isDirect = session.qualityWifi === 'Direct' && !session.forceTranscode;
    saveSession({
      forceTranscode: isDirect,
      qualityWifi: isDirect ? '320000' : 'Direct'
    });
    playTrack();
  });

  // Progress seek bars (mini & expanded)
  each(pairs.progress, (slider) => {
    const startSeeking = () => { slider.isSeeking = true; };
    slider.addEventListener('mousedown', startSeeking);
    slider.addEventListener('touchstart', startSeeking, { passive: true });
    slider.addEventListener('input', (e) => {
      slider.isSeeking = true;
      const val = parseFloat(e.target.value);
      each(pairs.current, (el) => { el.textContent = formatTime(val); });
      updateSliderFill(slider);
    });
    slider.addEventListener('change', (e) => {
      seekTo(parseFloat(e.target.value));
      setTimeout(() => { slider.isSeeking = false; }, 300);
    });
  });

  // Volume button & slider
  btnVolume?.addEventListener('click', () => toggleMute());

  if (volumeSlider) {
    updateSliderFill(volumeSlider);
    const startVolumeInteract = () => { volumeSlider.isInteracting = true; };
    const stopVolumeInteract = () => { volumeSlider.isInteracting = false; };
    volumeSlider.addEventListener('mousedown', startVolumeInteract);
    volumeSlider.addEventListener('touchstart', startVolumeInteract, { passive: true });
    volumeSlider.addEventListener('mouseup', stopVolumeInteract);
    volumeSlider.addEventListener('touchend', stopVolumeInteract);
    const handleVolumeInput = (e) => setVolume(parseFloat(e.target.value));
    volumeSlider.addEventListener('input', handleVolumeInput);
    volumeSlider.addEventListener('change', (e) => {
      stopVolumeInteract();
      handleVolumeInput(e);
    });
  }

  // Settings modal save button
  $('btn-save-settings')?.addEventListener('click', () => saveSettingsFromModal());
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateSliderFill(slider) {
  if (!slider) return;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value) || 0;
  const pct = max > 0 ? Math.min(100, Math.max(0, (val / max) * 100)) : 0;
  slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-tertiary) ${pct}%, var(--bg-tertiary) 100%)`;
}