/* ============================================================
   Jeff's — music player
   Local-first: audio never leaves the browser.
   ============================================================ */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const audio = $('audio');
  const app = $('app');
  const fileInput = $('file-input');
  const addBtn = $('add-btn');
  const searchInput = $('search');
  const playlistEl = $('playlist');
  const libraryCountEl = $('library-count');
  const titleEl = $('track-title');
  const artistEl = $('track-artist');
  const discLetterEl = $('disc-letter');
  const seek = $('seek');
  const volume = $('volume');
  const currentTimeEl = $('current-time');
  const totalTimeEl = $('total-time');
  const playBtn = $('play-btn');
  const prevBtn = $('prev-btn');
  const nextBtn = $('next-btn');
  const shuffleBtn = $('shuffle-btn');
  const repeatBtn = $('repeat-btn');
  const repeatBadge = $('repeat-badge');
  const muteBtn = $('mute-btn');
  const dropOverlay = $('drop-overlay');
  const toastEl = $('toast');
  const canvas = $('viz');
  const themeBtn = $('theme-btn');
  const themePanel = $('theme-panel');

  const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|wma|aiff?|webm)$/i;
  const SETTINGS_KEY = 'aurora:settings';
  const THEMES = {
    aurora: { label: 'Aurora', hue: 265 },
    sunset: { label: 'Sunset', hue: 20 },
    ocean:  { label: 'Ocean',  hue: 199 },
    forest: { label: 'Forest', hue: 152 },
    rose:   { label: 'Rose',   hue: 330 },
  };
  const MODES = ['dark', 'light'];

  /* ------------------------------------------------------------
     State
     ------------------------------------------------------------ */

  const tracks = [];
  let currentIndex = -1;
  let isPlaying = false;
  let shuffle = false;
  let repeat = 'off'; // 'off' | 'all' | 'one'
  let searchQuery = '';
  let nextId = 1;
  let theme = 'aurora';
  let mode = 'dark';
  let themePanelOpen = false;

  /* ------------------------------------------------------------
     Small utilities
     ------------------------------------------------------------ */

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function hashHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash % 360;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setFill(input, percent) {
    input.style.setProperty('--fill', `${clamp(percent, 0, 100)}%`);
  }

  function isAudioFile(file) {
    return file.type.startsWith('audio/') || AUDIO_EXT.test(file.name);
  }

  function parseMeta(fileName) {
    let base = fileName
      .replace(/\.[^.]+$/, '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = base.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2 && !/^\d+$/.test(parts[0])) {
      return { artist: parts[0], title: parts.slice(1).join(' - ') };
    }

    base = base.replace(/^\d{1,3}[\s.\-–—]+/, '').trim() || base;
    return { artist: 'Unknown artist', title: base || fileName };
  }

  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  function setHue(hue) {
    document.documentElement.style.setProperty('--track-hue', String(hue));
  }

  /* ------------------------------------------------------------
     Playlist rendering
     ------------------------------------------------------------ */

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function makeIcon(id, className = 'icon') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', className);
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${id}`);
    svg.append(use);
    return svg;
  }

  function makeEmptyState({ icon, title, text, actionLabel, onAction }) {
    const li = document.createElement('li');
    li.className = 'empty-lib';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'empty-icon';
    iconWrap.append(makeIcon(icon));

    const heading = document.createElement('strong');
    heading.textContent = title;

    const copy = document.createElement('span');
    copy.textContent = text;

    li.append(iconWrap, heading, copy);

    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'empty-btn';
      btn.textContent = actionLabel;
      btn.addEventListener('click', onAction);
      li.append(btn);
    }

    return li;
  }

  function makeTrackRow(track, index) {
    const li = document.createElement('li');
    li.className = 'track';
    li.dataset.index = String(index);
    if (index === currentIndex) li.classList.add('active');
    if (index === currentIndex && isPlaying) li.classList.add('playing');

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'track-main';
    main.title = `${track.title} — ${track.artist}`;

    const indexEl = document.createElement('span');
    indexEl.className = 'track-index';

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(index + 1).padStart(2, '0');

    const eq = document.createElement('span');
    eq.className = 'eq';
    eq.setAttribute('aria-hidden', 'true');
    eq.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));

    indexEl.append(num, eq);

    const meta = document.createElement('span');
    meta.className = 'track-meta';

    const title = document.createElement('span');
    title.className = 'track-title';
    title.textContent = track.title;

    const artist = document.createElement('span');
    artist.className = 'track-artist';
    artist.textContent = track.artist;

    meta.append(title, artist);
    main.append(indexEl, meta);

    main.addEventListener('click', () => {
      if (index === currentIndex) {
        togglePlay();
      } else {
        loadTrack(index, true);
      }
    });

    const duration = document.createElement('span');
    duration.className = 'track-duration';
    duration.textContent = track.duration > 0 ? formatTime(track.duration) : '–';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'track-remove';
    remove.title = 'Remove from library';
    remove.setAttribute('aria-label', `Remove ${track.title}`);
    remove.append(makeIcon('i-close'));
    remove.addEventListener('click', () => removeTrack(index));

    li.append(main, duration, remove);
    return li;
  }

  function renderPlaylist() {
    const scrollTop = playlistEl.scrollTop;
    const query = searchQuery.trim().toLowerCase();

    const visible = [];
    tracks.forEach((track, index) => {
      if (
        !query ||
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.fileName.toLowerCase().includes(query)
      ) {
        visible.push({ track, index });
      }
    });

    playlistEl.replaceChildren();

    if (!tracks.length) {
      playlistEl.append(makeEmptyState({
        icon: 'i-music',
        title: 'Your library is empty',
        text: 'Add songs from your device, or drag and drop audio files anywhere.',
        actionLabel: 'Browse files',
        onAction: () => fileInput.click(),
      }));
    } else if (!visible.length) {
      playlistEl.append(makeEmptyState({
        icon: 'i-search',
        title: 'No matches',
        text: `Nothing in your library matches “${searchQuery.trim()}”.`,
      }));
    } else {
      visible.forEach(({ track, index }) => {
        playlistEl.append(makeTrackRow(track, index));
      });
    }

    libraryCountEl.textContent = `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`;
    playlistEl.scrollTop = scrollTop;
  }

  function updateActiveRows(scrollIntoView = false) {
    playlistEl.querySelectorAll('.track').forEach((row) => {
      const isActive = Number(row.dataset.index) === currentIndex;
      row.classList.toggle('active', isActive);
      row.classList.toggle('playing', isActive && isPlaying);
    });

    if (scrollIntoView) {
      const active = playlistEl.querySelector('.track.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ------------------------------------------------------------
     Adding / removing tracks
     ------------------------------------------------------------ */

  const probe = new Audio();
  probe.preload = 'metadata';
  const probeQueue = [];
  let probing = false;

  function enqueueDurations() {
    tracks.forEach((track) => {
      if (!track.duration && !track.probed && !track.queued) {
        track.queued = true;
        probeQueue.push(track);
      }
    });
    if (!probing) runProbe();
  }

  function runProbe() {
    let track = null;

    while (probeQueue.length) {
      const candidate = probeQueue.shift();
      candidate.queued = false;
      if (!tracks.includes(candidate)) continue;
      if (candidate.duration > 0) {
        candidate.probed = true;
        continue;
      }
      track = candidate;
      break;
    }

    if (!track) {
      probing = false;
      return;
    }

    probing = true;

    const finish = () => {
      track.probed = true;
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.removeAttribute('src');
      probe.load();
      probing = false;
      renderPlaylist();
      runProbe();
    };

    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        track.duration = probe.duration;
      }
      finish();
    };

    probe.onerror = finish;
    probe.src = track.url;
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    ensureAudioContext();

    const wasEmpty = tracks.length === 0;
    let added = 0;
    let skipped = 0;

    files.forEach((file) => {
      if (!isAudioFile(file)) {
        skipped++;
        return;
      }

      const meta = parseMeta(file.name);
      tracks.push({
        id: nextId++,
        title: meta.title,
        artist: meta.artist,
        fileName: file.name,
        url: URL.createObjectURL(file),
        duration: 0,
        hue: hashHue(file.name + meta.title),
      });
      added++;
    });

    if (!added) {
      showToast('No supported audio files found');
      return;
    }

    renderPlaylist();

    if (currentIndex === -1) {
      loadTrack(0, wasEmpty);
    }

    enqueueDurations();

    const label = `${added} ${added === 1 ? 'song' : 'songs'} added`;
    showToast(skipped ? `${label} · ${skipped} skipped` : label);
  }

  function removeTrack(index) {
    const track = tracks[index];
    if (!track) return;

    const wasPlaying = isPlaying;
    const removingCurrent = index === currentIndex;

    URL.revokeObjectURL(track.url);
    tracks.splice(index, 1);

    if (removingCurrent) {
      currentIndex = -1;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      if (tracks.length) {
        loadTrack(Math.min(index, tracks.length - 1), wasPlaying);
      } else {
        resetPlayer();
      }
    } else if (index < currentIndex) {
      currentIndex--;
    }

    renderPlaylist();
    updateActiveRows();
    showToast('Removed from library');
  }

  /* ------------------------------------------------------------
     Playback
     ------------------------------------------------------------ */

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: "Jeff's",
      });
    } catch {
      /* MediaMetadata unsupported — no problem. */
    }
  }

  function updateTrackDisplay(track) {
    if (track) {
      titleEl.textContent = track.title;
      artistEl.textContent = track.artist;
      const initial = track.title.match(/[a-z0-9]/i);
      discLetterEl.textContent = initial ? initial[0].toUpperCase() : '♪';
      document.title = `${track.title} · Jeff's Music Player`;
      setHue(track.hue);
    } else {
      titleEl.textContent = 'Nothing playing';
      artistEl.textContent = 'Add a few songs to get started';
      discLetterEl.textContent = '♪';
      document.title = "Jeff's Music Player";
      setHue(THEMES[theme].hue);
    }
  }

  function updatePlayState() {
    app.classList.toggle('playing', isPlaying);
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playBtn.title = isPlaying ? 'Pause (Space)' : 'Play (Space)';
    updateActiveRows();

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch {
        /* Playback state unsupported. */
      }
    }
  }

  function loadTrack(index, autoplay = false) {
    if (index < 0 || index >= tracks.length) return;

    currentIndex = index;
    const track = tracks[index];

    seek.value = '0';
    seek.max = track.duration > 0 ? String(track.duration) : '100';
    seek.disabled = true;
    setFill(seek, 0);
    currentTimeEl.textContent = '0:00';
    totalTimeEl.textContent = formatTime(track.duration);

    audio.src = track.url;
    updateTrackDisplay(track);
    updateMediaSession(track);
    updateActiveRows(true);

    if (autoplay) {
      playTrack();
    } else {
      isPlaying = false;
      updatePlayState();
    }
  }

  function playTrack() {
    if (currentIndex === -1) {
      if (!tracks.length) {
        fileInput.click();
        return;
      }
      loadTrack(0, false);
    }

    ensureAudioContext();

    if (audio.ended) audio.currentTime = 0;

    const promise = audio.play();
    if (promise) {
      promise.catch(() => {
        isPlaying = false;
        updatePlayState();
        showToast('Playback was blocked — press play again');
      });
    }
  }

  function togglePlay() {
    if (audio.paused) {
      playTrack();
    } else {
      audio.pause();
    }
  }

  function pickNextIndex(wrap) {
    if (!tracks.length) return null;
    if (tracks.length === 1) return wrap ? currentIndex : null;

    if (shuffle) {
      let index;
      do {
        index = Math.floor(Math.random() * tracks.length);
      } while (index === currentIndex);
      return index;
    }

    if (currentIndex + 1 < tracks.length) return currentIndex + 1;
    return wrap || repeat === 'all' ? 0 : null;
  }

  function pickPrevIndex() {
    if (!tracks.length) return null;
    if (tracks.length === 1) return currentIndex;

    if (shuffle) {
      let index;
      do {
        index = Math.floor(Math.random() * tracks.length);
      } while (index === currentIndex);
      return index;
    }

    return currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
  }

  function nextTrack(manual = true) {
    if (!tracks.length) return;

    const index = pickNextIndex(manual);
    if (index === null) {
      audio.pause();
      audio.currentTime = 0;
      updateProgressUI();
      return;
    }

    loadTrack(index, true);
  }

  function prevTrack() {
    if (!tracks.length) return;

    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      updateProgressUI();
      return;
    }

    const index = pickPrevIndex();
    if (index === null) {
      audio.currentTime = 0;
      updateProgressUI();
      return;
    }

    loadTrack(index, true);
  }

  function handleEnded() {
    if (repeat === 'one') {
      audio.currentTime = 0;
      playTrack();
      return;
    }

    const index = pickNextIndex(false);
    if (index === null) {
      isPlaying = false;
      updatePlayState();
      updateProgressUI();
      return;
    }

    loadTrack(index, true);
  }

  function resetPlayer() {
    currentIndex = -1;
    isPlaying = false;

    audio.pause();
    audio.removeAttribute('src');
    audio.load();

    updateTrackDisplay(null);
    seek.value = '0';
    seek.max = '100';
    seek.disabled = true;
    setFill(seek, 0);
    currentTimeEl.textContent = '0:00';
    totalTimeEl.textContent = '0:00';

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        /* Nothing to clear. */
      }
    }

    updatePlayState();
  }

  /* ------------------------------------------------------------
     Progress / volume
     ------------------------------------------------------------ */

  function updateProgressUI() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const fallbackDuration = currentIndex >= 0 ? tracks[currentIndex].duration : 0;

    seek.value = String(current);
    setFill(seek, duration > 0 ? (current / duration) * 100 : 0);
    currentTimeEl.textContent = formatTime(current);
    totalTimeEl.textContent = formatTime(duration || fallbackDuration);
  }

  function seekBy(seconds) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = clamp(audio.currentTime + seconds, 0, audio.duration);
    updateProgressUI();
  }

  function updateVolumeUI() {
    const muted = audio.muted || audio.volume === 0;
    app.classList.toggle('muted', muted);
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    muteBtn.title = muted ? 'Unmute (M)' : 'Mute (M)';

    volume.value = String(Math.round(audio.volume * 100));
    setFill(volume, audio.volume * 100);
  }

  function toggleMute() {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = 0.5;
    } else {
      audio.muted = true;
    }
    updateVolumeUI();
    persistSettings();
  }

  function adjustVolume(delta) {
    audio.volume = clamp(audio.volume + delta, 0, 1);
    if (audio.volume > 0) audio.muted = false;
    updateVolumeUI();
    persistSettings();
  }

  /* ------------------------------------------------------------
     Shuffle / repeat / settings
     ------------------------------------------------------------ */

  function updateShuffleUI() {
    shuffleBtn.setAttribute('aria-pressed', String(shuffle));
    shuffleBtn.title = shuffle ? 'Shuffle: on (S)' : 'Shuffle: off (S)';
  }

  function updateRepeatUI() {
    repeatBtn.setAttribute('aria-pressed', String(repeat !== 'off'));
    repeatBtn.classList.toggle('is-one', repeat === 'one');
    repeatBtn.setAttribute('aria-label', `Repeat ${repeat}`);
    repeatBtn.title = `Repeat: ${repeat} (R)`;
    repeatBadge.textContent = '1';
  }

  function setShuffle(value, persist = true) {
    shuffle = Boolean(value);
    updateShuffleUI();
    if (persist) persistSettings();
  }

  function setRepeat(mode, persist = true) {
    repeat = ['off', 'all', 'one'].includes(mode) ? mode : 'off';
    updateRepeatUI();
    if (persist) persistSettings();
  }

  function cycleRepeat() {
    setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off');
  }

  /* ------------------------------------------------------------
     Appearance
     ------------------------------------------------------------ */

  function updateMetaThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = mode === 'light' ? '#f3f1fa' : '#07080f';

    /* Keep iOS status-bar content readable in both modes. */
    const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (status) status.content = mode === 'light' ? 'default' : 'black-translucent';
  }

  function syncAppearanceUI() {
    themePanel.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === theme));
    });

    themePanel.querySelectorAll('[data-mode-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.modeChoice === mode));
    });

    const themeLabel = THEMES[theme].label;
    const modeLabel = mode === 'light' ? 'Light' : 'Dark';
    themeBtn.title = `Appearance: ${themeLabel} · ${modeLabel}`;
    themeBtn.setAttribute('aria-label', `Appearance: ${themeLabel}, ${modeLabel.toLowerCase()} mode`);
    updateMetaThemeColor();
  }

  function setTheme(value, persist = true) {
    theme = THEMES[value] ? value : 'aurora';
    document.documentElement.dataset.theme = theme;
    if (currentIndex < 0) setHue(THEMES[theme].hue);
    syncAppearanceUI();
    if (persist) persistSettings();
  }

  function setMode(value, persist = true) {
    mode = MODES.includes(value) ? value : 'dark';
    document.documentElement.dataset.mode = mode;
    syncAppearanceUI();
    if (persist) persistSettings();
  }

  function positionThemePanel() {
    if (!themePanelOpen) return;

    const rect = themeBtn.getBoundingClientRect();
    const panelRect = themePanel.getBoundingClientRect();
    const width = panelRect.width || 258;
    const height = panelRect.height || 260;
    const margin = 12;

    let left = rect.right - width;
    left = clamp(left, margin, Math.max(margin, window.innerWidth - width - margin));

    let top = rect.bottom + 10;
    if (top + height > window.innerHeight - margin) {
      top = rect.top - height - 10;
    }
    top = clamp(top, margin, Math.max(margin, window.innerHeight - height - margin));

    themePanel.style.left = `${Math.round(left)}px`;
    themePanel.style.top = `${Math.round(top)}px`;
  }

  function openThemePanel() {
    themePanelOpen = true;
    themePanel.classList.add('open');
    themePanel.setAttribute('aria-hidden', 'false');
    themeBtn.setAttribute('aria-expanded', 'true');
    positionThemePanel();
  }

  function closeThemePanel(focusButton = false) {
    if (!themePanelOpen) return;
    themePanelOpen = false;
    themePanel.classList.remove('open');
    themePanel.setAttribute('aria-hidden', 'true');
    themeBtn.setAttribute('aria-expanded', 'false');
    if (focusButton) themeBtn.focus();
  }

  function toggleThemePanel() {
    if (themePanelOpen) {
      closeThemePanel();
    } else {
      openThemePanel();
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        volume: audio.volume,
        muted: audio.muted,
        shuffle,
        repeat,
        theme,
        mode,
      }));
    } catch {
      /* Storage unavailable — settings simply won't persist. */
    }
  }

  function loadSettings() {
    const defaults = {
      volume: 0.8,
      muted: false,
      shuffle: false,
      repeat: 'off',
      theme: 'aurora',
      mode: 'dark',
    };
    let stored = {};

    try {
      stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
    } catch {
      stored = {};
    }

    const settings = { ...defaults };

    if (typeof stored.volume === 'number' && Number.isFinite(stored.volume)) {
      settings.volume = clamp(stored.volume, 0, 1);
    }
    settings.muted = Boolean(stored.muted);
    settings.shuffle = Boolean(stored.shuffle);
    if (['off', 'all', 'one'].includes(stored.repeat)) settings.repeat = stored.repeat;
    if (THEMES[stored.theme]) settings.theme = stored.theme;
    if (MODES.includes(stored.mode)) settings.mode = stored.mode;

    audio.volume = settings.volume;
    audio.muted = settings.muted;

    setShuffle(settings.shuffle, false);
    setRepeat(settings.repeat, false);
    setTheme(settings.theme, false);
    setMode(settings.mode, false);
    updateVolumeUI();
  }

  /* ------------------------------------------------------------
     Web Audio visualizer
     ------------------------------------------------------------ */

  const cctx = canvas.getContext('2d');
  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let cssWidth = 300;
  let cssHeight = 300;
  let dpr = 1;
  const BAR_COUNT = 64;
  const barHeights = new Array(BAR_COUNT).fill(0);

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;

      try {
        audioCtx = new Ctx();
        const source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        freqData = new Uint8Array(analyser.frequencyBinCount);
      } catch (error) {
        console.warn('Visualizer unavailable:', error);
        analyser = null;
        freqData = null;
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !cctx) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawVisualizer(time) {
    requestAnimationFrame(drawVisualizer);

    if (!cctx || !cssWidth) return;

    cctx.clearRect(0, 0, cssWidth, cssHeight);

    const cx = cssWidth / 2;
    const cy = cssHeight / 2;
    const baseRadius = cssWidth * 0.345;
    const maxBarLength = cssWidth * 0.135;

    if (analyser && isPlaying) {
      analyser.getByteFrequencyData(freqData);
    }

    cctx.beginPath();
    cctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    cctx.strokeStyle = mode === 'light' ? 'rgba(20, 22, 40, 0.09)' : 'rgba(255, 255, 255, 0.045)';
    cctx.lineWidth = 1;
    cctx.stroke();

    const vizHue = THEMES[theme].hue;
    const vizLightness = mode === 'light' ? 46 : 66;

    for (let i = 0; i < BAR_COUNT; i++) {
      let target;

      if (analyser && isPlaying) {
        const mirrored = i < BAR_COUNT / 2 ? i : BAR_COUNT - i;
        const ratio = mirrored / (BAR_COUNT / 2);
        const bin = Math.min(freqData.length - 1, Math.floor(Math.pow(ratio, 1.7) * freqData.length * 0.85));
        target = Math.pow(freqData[bin] / 255, 1.5);
      } else {
        target = 0.06 + 0.05 * (0.5 + 0.5 * Math.sin(time / 700 + i * 0.33));
      }

      barHeights[i] += (target - barHeights[i]) * 0.18;

      const length = Math.max(cssWidth * 0.006, barHeights[i] * maxBarLength);
      const angle = -Math.PI / 2 + (i / BAR_COUNT) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      cctx.beginPath();
      cctx.moveTo(cx + cos * baseRadius, cy + sin * baseRadius);
      cctx.lineTo(cx + cos * (baseRadius + length), cy + sin * (baseRadius + length));
      cctx.lineWidth = Math.max(2, cssWidth * 0.0105);
      cctx.lineCap = 'round';
      cctx.strokeStyle = `hsla(${vizHue + (i / BAR_COUNT) * 45}, 88%, ${vizLightness}%, ${0.32 + barHeights[i] * 0.62})`;
      cctx.stroke();
    }
  }

  /* ------------------------------------------------------------
     Events
     ------------------------------------------------------------ */

  function bindEvents() {
    themeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleThemePanel();
    });

    themePanel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    themePanel.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice));
    });

    themePanel.querySelectorAll('[data-mode-choice]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.modeChoice));
    });

    document.addEventListener('click', (event) => {
      if (!themePanelOpen) return;
      const target = event.target;
      if (target instanceof Node && (themePanel.contains(target) || themeBtn.contains(target))) return;
      closeThemePanel();
    });

    window.addEventListener('resize', positionThemePanel);
    window.addEventListener('scroll', positionThemePanel, { passive: true });

    addBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      addFiles(fileInput.files);
      fileInput.value = '';
    });

    playBtn.addEventListener('click', togglePlay);
    nextBtn.addEventListener('click', () => nextTrack());
    prevBtn.addEventListener('click', prevTrack);

    shuffleBtn.addEventListener('click', () => setShuffle(!shuffle));
    repeatBtn.addEventListener('click', cycleRepeat);
    muteBtn.addEventListener('click', toggleMute);

    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderPlaylist();
    });

    seek.addEventListener('input', () => {
      const value = Number(seek.value);
      currentTimeEl.textContent = formatTime(value);
      setFill(seek, Number(seek.max) > 0 ? (value / Number(seek.max)) * 100 : 0);
    });

    seek.addEventListener('change', () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = clamp(Number(seek.value), 0, audio.duration);
      updateProgressUI();
    });

    volume.addEventListener('input', () => {
      const value = Number(volume.value) / 100;
      audio.volume = value;
      if (value > 0) audio.muted = false;
      setFill(volume, value * 100);
      updateVolumeUI();
      persistSettings();
    });

    audio.addEventListener('play', () => {
      isPlaying = true;
      ensureAudioContext();
      updatePlayState();
    });

    audio.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayState();
    });

    audio.addEventListener('timeupdate', () => {
      if (document.activeElement === seek && seek.matches(':active')) return;
      updateProgressUI();
    });

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      seek.disabled = false;
      seek.max = String(duration);
      updateProgressUI();

      if (currentIndex >= 0) {
        const track = tracks[currentIndex];
        if (track) {
          track.duration = duration;
          track.probed = true;
          renderPlaylist();
          updateActiveRows();
        }
      }
    });

    audio.addEventListener('ended', handleEnded);

    audio.addEventListener('error', () => {
      if (currentIndex < 0 || !audio.src) return;
      isPlaying = false;
      updatePlayState();
      showToast('Could not play this file');
    });

    document.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape' && themePanelOpen) {
        event.preventDefault();
        closeThemePanel(true);
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, button, [contenteditable]')) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          event.preventDefault();
          seekBy(5);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          seekBy(-5);
          break;
        case 'ArrowUp':
          event.preventDefault();
          adjustVolume(0.05);
          break;
        case 'ArrowDown':
          event.preventDefault();
          adjustVolume(-0.05);
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyS':
          setShuffle(!shuffle);
          break;
        case 'KeyR':
          cycleRepeat();
          break;
        case 'KeyN':
          nextTrack();
          break;
        case 'KeyP':
          prevTrack();
          break;
        default:
          break;
      }
    });

    // Drag & drop
    let dragDepth = 0;

    const hasFiles = (event) => {
      const types = event.dataTransfer && event.dataTransfer.types;
      return Boolean(types) && Array.from(types).includes('Files');
    };

    const showDrop = () => dropOverlay.classList.add('visible');
    const hideDrop = () => dropOverlay.classList.remove('visible');

    window.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth++;
      showDrop();
    });

    window.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('dragleave', (event) => {
      if (!event.relatedTarget) {
        dragDepth = 0;
        hideDrop();
        return;
      }
      if (!hasFiles(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) hideDrop();
    });

    window.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth = 0;
      hideDrop();
      if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    });

    window.addEventListener('dragend', () => {
      dragDepth = 0;
      hideDrop();
    });

    window.addEventListener('resize', sizeCanvas);
    if (window.ResizeObserver) {
      new ResizeObserver(sizeCanvas).observe(canvas.parentElement);
    }

    if ('mediaSession' in navigator) {
      const setHandler = (action, handler) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          /* Action unsupported. */
        }
      };

      setHandler('play', playTrack);
      setHandler('pause', () => audio.pause());
      setHandler('previoustrack', prevTrack);
      setHandler('nexttrack', () => nextTrack());
      setHandler('seekto', (details) => {
        if (details.seekTime != null && Number.isFinite(audio.duration)) {
          audio.currentTime = clamp(details.seekTime, 0, audio.duration);
        }
      });
    }
  }

  /* ------------------------------------------------------------
     Service worker
     ------------------------------------------------------------ */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    /* Service workers require a secure context; file:// cannot register one. */
    if (!/^https?:$/.test(location.protocol)) return;

    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Offline support is unavailable — the player still works normally. */
    });
  }

  /* ------------------------------------------------------------
     Init
     ------------------------------------------------------------ */

  function init() {
    loadSettings();
    setFill(seek, 0);
    setFill(volume, audio.volume * 100);
    renderPlaylist();
    resetPlayer();
    bindEvents();

    sizeCanvas();
    requestAnimationFrame(drawVisualizer);
    updateVolumeUI();
    registerServiceWorker();
  }

  init();
})();
