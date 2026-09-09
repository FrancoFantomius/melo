import { initAudioPlayer, togglePlayPause, playNextTrack, playPrevTrack, seekTo, setVolume, toggleMute, playTrack, savePlayerState, notifyUI, setPlaybackSpeed, getPlaybackSpeed, skipSeconds } from '../player/audio.js';
import { audio, state as audioState } from '../player/state.js';
import { toggleShuffle, toggleRepeat } from '../player/queue.js';
import { toggleQueueDrawer, closeQueueDrawer, renderQueueDrawerList, toggleLyricsModal, closeLyricsModalInternal, updateLyricsSync, saveSettingsFromModal, openSelectPlaylistModal, isQueueOpen } from './modals.js';
import { getArtworkUrl, getLyrics } from '../jellyfin/client.js';
import { getSession, saveSession } from '../jellyfin/session.js';
import { isTrackLiked, toggleTrackLiked } from '../player/likes.js';
import { toggleTrackDownload, refreshDownloadButton } from './downloads.js';
import { getTranslation } from '../i18n.js';
import { getPlaceholder } from './placeholders.js';

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

  // Expanded full-screen player
  const empContainer = $('expanded-mobile-player');
  const empBtnClose = $('emp-btn-close');
  const mainPlayerBar = document.querySelector('.main-player');
  const playerLeft = document.querySelector('.player-left');

  // Controls that exist in both the mini player and the expanded player
  const pairs = {
    cover: [$('player-track-cover'), $('emp-cover')],
    title: [$('player-track-title'), $('emp-title')],
    artist: [$('player-track-artist'), $('emp-artist')],
    current: [$('player-current-time'), $('emp-current-time')],
    total: [$('player-total-time'), $('emp-total-time')],
    play: [$('player-btn-play'), $('emp-btn-play')],
    prev: [btnPrev, $('emp-btn-prev')],
    next: [btnNext, $('emp-btn-next')],
    skipBack: [btnSkipBack, $('emp-btn-skip-back')],
    skipForward: [btnSkipForward, $('emp-btn-skip-forward')],
    speedBadge: [speedBadge, $('emp-speed-badge')],
    qualityBadge: [qualityBadge, $('emp-quality-badge')],
    like: [$('player-btn-like'), $('emp-btn-like')],
    addPlaylist: [$('player-btn-add-playlist'), $('emp-btn-add-playlist')],
    download: [$('player-btn-download'), $('emp-btn-download')],
    shuffle: [$('player-btn-shuffle'), $('emp-btn-shuffle')],
    repeat: [$('player-btn-repeat'), $('emp-btn-repeat')],
    lyrics: [$('player-btn-lyrics'), $('emp-btn-lyrics')],
    queue: [$('player-btn-queue'), $('emp-btn-queue')],
    progress: [$('player-progress'), $('emp-progress')],
    volumeSlider: [volumeSlider, $('emp-volume')],
    btnVolume: [btnVolume, $('emp-btn-volume')]
  };

  const each = (els, fn) => els.forEach((el, i) => el && fn(el, i));
  const setDisplay = (el, value) => { el.style.display = value; };
  const setIcon = (el, text) => {
    const icon = el.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = text;
  };
  const setButtonTooltip = (btn, textKey) => {
    if (!btn) return;
    const translated = getTranslation(textKey);
    btn.setAttribute('aria-label', translated);
    const tooltip = document.querySelector(`md-tooltip[for="${btn.id}"]`);
    if (tooltip) {
      tooltip.dataset.i18nValueEn = textKey;
      tooltip.value = translated;
      tooltip.setAttribute('value', translated);
    }
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
      const label = liked ? 'Unlike' : 'Like';
      setButtonTooltip(btn, label);
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

  const openExpandedPlayer = () => {
    if (window.location.hash !== '#player') {
      window.location.hash = 'player';
    } else {
      empContainer?.classList.add('open');
    }
    const empVol = $('emp-volume');
    if (empVol) updateSliderFill(empVol);
    const empProg = $('emp-progress');
    if (empProg) updateSliderFill(empProg);
  };

  // Open expanded player when mini-player bar is tapped on mobile
  mainPlayerBar?.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    if (window.innerWidth <= 768) {
      openExpandedPlayer();
    }
  });

  // Open expanded player on desktop when clicking track cover or info in player-left
  playerLeft?.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    openExpandedPlayer();
  });

  const closeExpandedPlayer = () => {
    closeQueueDrawer();
    closeLyricsModalInternal();
    empContainer?.classList.remove('open');

    if (window.location.hash === '#player' || window.location.hash === '#queue' || window.location.hash === '#lyrics') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  empBtnClose?.addEventListener('click', closeExpandedPlayer);

  // Collapse the full-player back when scrolling/pulling down
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

  let animFrameId = null;
  let lastFormattedSec = -1;

  const updateProgressContinuously = () => {
    if (!audioState.isPlaying || audio.paused) {
      animFrameId = null;
      return;
    }

    const isAnySeeking = pairs.progress.some((slider) => slider && slider.isSeeking);
    const realCurrentTime = audioState.seekOffset + (isFinite(audio.currentTime) ? audio.currentTime : 0);
    const track = currentPlayingTrack;
    let totalSec = 0;
    if (track && track.RunTimeTicks) {
      totalSec = track.RunTimeTicks / 10000000;
    } else if (isFinite(audio.duration) && audio.duration > 0) {
      totalSec = audio.duration + audioState.seekOffset;
    } else if (track && track.duration) {
      totalSec = track.duration;
    }

    if (!isAnySeeking && totalSec > 0) {
      const currentSecFloored = Math.floor(realCurrentTime);
      if (currentSecFloored !== lastFormattedSec) {
        lastFormattedSec = currentSecFloored;
        const formattedCurrent = formatTime(currentSecFloored);
        each(pairs.current, (el) => { el.textContent = formattedCurrent; });
      }

      each(pairs.progress, (slider) => {
        slider.max = totalSec;
        slider.step = 'any';
        slider.value = realCurrentTime;
        updateSliderFill(slider);
      });
    }

    updateLyricsSync(realCurrentTime);

    animFrameId = requestAnimationFrame(updateProgressContinuously);
  };

  const startProgressAnim = () => {
    if (!animFrameId && audioState.isPlaying && !audio.paused) {
      animFrameId = requestAnimationFrame(updateProgressContinuously);
    }
  };

  const stopProgressAnim = () => {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  };

  initAudioPlayer((state) => {
    if (isQueueOpen()) renderQueueDrawerList();

    const track = state.track;
    currentPlayingTrack = track;
    updateActionButtons(track);
    updateDownloadButton(track);
    updateLyricsButton(track);

    if (track) {
      const isPodcast = !!(track.isPodcastEpisode || track.enclosureUrl);
      const placeholderType = isPodcast ? 'podcast' : 'song';
      const artUrl = track.image ? track.image : getArtworkUrl(track, 'Primary', 300, placeholderType);
      each(pairs.cover, (el) => {
        el.src = artUrl;
        el.setAttribute('data-placeholder-type', placeholderType);
        el.onerror = () => {
          el.onerror = null;
          el.src = getPlaceholder(placeholderType);
          el.setAttribute('data-placeholder-type', placeholderType);
        };
      });

      const titleStr = track.title || track.Name || 'Unknown Title';
      each(pairs.title, (el) => { el.textContent = titleStr; });

      const artistStr = track.showTitle || track.Artists?.join(', ') || track.AlbumArtist || 'Unknown Artist';
      each(pairs.artist, (el) => { el.textContent = artistStr; });

      each(pairs.skipBack, (el) => setDisplay(el, isPodcast ? 'flex' : 'none'));
      each(pairs.skipForward, (el) => setDisplay(el, isPodcast ? 'flex' : 'none'));
      each(pairs.speedBadge, (el) => {
        setDisplay(el, isPodcast ? 'flex' : 'none');
        el.textContent = `${state.playbackSpeed || 1.0}x`;
      });
      each(pairs.qualityBadge, (el) => {
        setDisplay(el, isPodcast ? 'none' : 'flex');
        el.textContent = state.bitrateMode === 'Direct' ? 'DIRECT' : `${Math.round(parseInt(state.bitrateMode) / 1000)}k`;
        const isEmp = el.id.includes('emp');
        el.className = `quality-badge ${isEmp ? 'emp-quality-badge' : ''} ${state.bitrateMode !== 'Direct' ? 'active' : ''}`;
      });

      const rawCurrent = state.currentTime || 0;
      const currentSec = Math.floor(rawCurrent);
      let totalSec = Math.floor(state.duration || 0);
      if (!isFinite(totalSec) || totalSec <= 0) {
        totalSec = track.duration || (track.RunTimeTicks ? Math.floor(track.RunTimeTicks / 10000000) : 0);
      }

      const formattedCurrent = formatTime(currentSec);
      const formattedTotal = formatTime(totalSec);

      const isAnySeeking = pairs.progress.some((slider) => slider && slider.isSeeking);
      if (!isAnySeeking) {
        lastFormattedSec = currentSec;
        each(pairs.current, (el) => { el.textContent = formattedCurrent; });
      }

      each(pairs.progress, (slider) => {
        slider.step = 'any';
        if (!slider.isSeeking) {
          slider.max = totalSec > 0 ? totalSec : 100;
          slider.value = isFinite(rawCurrent) ? rawCurrent : 0;
          updateSliderFill(slider);
        }
      });
      each(pairs.total, (el) => { el.textContent = formattedTotal; });
    }

    updateLyricsSync(state.currentTime);

    const isPlaying = !!state.isPlaying;
    document.querySelectorAll('.timeline-container').forEach((c) => c.classList.toggle('is-playing', isPlaying));

    if (isPlaying) {
      startProgressAnim();
    } else {
      stopProgressAnim();
    }

    each(pairs.play, (btn) => {
      setIcon(btn, isPlaying ? 'pause_circle' : 'play_circle');
      setButtonTooltip(btn, isPlaying ? 'Pause' : 'Play');
    });

    if (state.volume !== undefined) {
      each(pairs.volumeSlider, (slider) => {
        if (slider && !slider.isInteracting) {
          slider.value = state.volume;
          updateSliderFill(slider);
        }
      });

      const isMuted = state.volume === 0;
      each(pairs.btnVolume, (btn) => {
        setIcon(btn, isMuted ? 'volume_off' : state.volume < 0.5 ? 'volume_down' : 'volume_up');
        setButtonTooltip(btn, isMuted ? 'Unmute' : 'Mute');
      });
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
        let repeatKey = 'Repeat';
        if (mode === 'one') {
          btn.style.color = 'var(--accent)';
          repeatKey = 'Repeat Song Once (Auto-Disables)';
          setIcon(btn, 'repeat_one');
        } else if (mode === 'all') {
          btn.style.color = 'var(--accent)';
          repeatKey = 'Repeat Song (Continuous)';
          setIcon(btn, 'repeat');
        } else {
          btn.style.color = 'var(--text-secondary)';
          repeatKey = 'Repeat Off';
          setIcon(btn, 'repeat');
        }
        setButtonTooltip(btn, repeatKey);
      });
    }
  });

  // Mini & expanded playback controls
  each(pairs.play, (btn) => btn.addEventListener('click', () => togglePlayPause()));
  each(pairs.prev, (btn) => btn.addEventListener('click', () => playPrevTrack()));
  each(pairs.next, (btn) => btn.addEventListener('click', () => playNextTrack()));
  each(pairs.skipBack, (btn) => btn.addEventListener('click', () => skipSeconds(-15)));
  each(pairs.skipForward, (btn) => btn.addEventListener('click', () => skipSeconds(30)));

  const isInputTarget = (e) => {
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
    return path.some((el) => isInput(el)) || isInput(document.activeElement);
  };

  // Space bar keyboard shortcut to play/pause and F shortcut to toggle full-screen player
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isQueueOpen()) {
        toggleQueueDrawer();
        return;
      }
      const lyricsView = $('lyrics-view');
      if (lyricsView && lyricsView.style.display !== 'none') {
        toggleLyricsModal();
        return;
      }
      if (empContainer?.classList.contains('open')) {
        closeExpandedPlayer();
        return;
      }
    }

    if (isInputTarget(e)) return;

    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      togglePlayPause();
      return;
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (empContainer?.classList.contains('open')) {
        closeExpandedPlayer();
      } else {
        openExpandedPlayer();
      }
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

  const handleSpeedToggle = () => {
    const speeds = [0.8, 1.0, 1.25, 1.5, 2.0];
    const idx = speeds.indexOf(getPlaybackSpeed());
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
  };
  each(pairs.speedBadge, (badge) => badge.addEventListener('click', handleSpeedToggle));

  const handleQualityToggle = () => {
    const session = getSession();
    const isDirect = session.qualityWifi === 'Direct' && !session.forceTranscode;
    saveSession({
      forceTranscode: isDirect,
      qualityWifi: isDirect ? '320000' : 'Direct'
    });
    playTrack();
  };
  each(pairs.qualityBadge, (badge) => badge.addEventListener('click', handleQualityToggle));

  // Progress seek bars (mini & expanded)
  each(pairs.progress, (slider) => {
    const startSeeking = () => {
      slider.isSeeking = true;
      slider.classList.add('is-seeking');
    };
    const stopSeeking = () => {
      slider.isSeeking = false;
      slider.classList.remove('is-seeking');
    };
    slider.addEventListener('mousedown', startSeeking);
    slider.addEventListener('touchstart', startSeeking, { passive: true });
    slider.addEventListener('mouseup', stopSeeking);
    slider.addEventListener('touchend', stopSeeking);
    slider.addEventListener('input', (e) => {
      startSeeking();
      const val = parseFloat(e.target.value);
      each(pairs.current, (el) => { el.textContent = formatTime(val); });
      updateSliderFill(slider);
    });
    slider.addEventListener('change', (e) => {
      seekTo(parseFloat(e.target.value));
      setTimeout(stopSeeking, 300);
    });
  });

  // Volume button & slider (mini & expanded)
  each(pairs.btnVolume, (btn) => btn.addEventListener('click', () => toggleMute()));

  each(pairs.volumeSlider, (vSlider) => {
    updateSliderFill(vSlider);
    const startVolumeInteract = () => {
      vSlider.isInteracting = true;
      vSlider.classList.add('is-seeking');
    };
    const stopVolumeInteract = () => {
      vSlider.isInteracting = false;
      vSlider.classList.remove('is-seeking');
    };
    vSlider.addEventListener('mousedown', startVolumeInteract);
    vSlider.addEventListener('touchstart', startVolumeInteract, { passive: true });
    vSlider.addEventListener('mouseup', stopVolumeInteract);
    vSlider.addEventListener('touchend', stopVolumeInteract);
    const handleVolumeInput = (e) => {
      const val = parseFloat(e.target.value);
      each(pairs.volumeSlider, (s) => {
        if (s !== vSlider) s.value = val;
        updateSliderFill(s);
      });
      setVolume(val);
    };
    vSlider.addEventListener('input', handleVolumeInput);
    vSlider.addEventListener('change', (e) => {
      stopVolumeInteract();
      handleVolumeInput(e);
    });
  });

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
  slider.style.setProperty('--progress-pct', `${pct}%`);
  const container = slider.closest('.timeline-container');
  if (container) {
    container.style.setProperty('--progress-pct', `${pct}%`);
  } else {
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-tertiary) ${pct}%, var(--bg-tertiary) 100%)`;
  }
}