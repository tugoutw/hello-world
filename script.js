(function(){
  'use strict';

  // Virtual 1920x1080 canvas scaling
  const appRoot = document.getElementById('app');
  function scaleToFit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / 1920, vh / 1080);
    appRoot.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', scaleToFit);
  window.addEventListener('orientationchange', scaleToFit);

  // App state
  const state = {
    thermostat: {
      current: 24,
      target: 24,
      mode: 'auto', // heat | cool | auto | off
      running: false
    },
    lights: [
      { id: 'living', name: '客廳', on: true, brightness: 72 },
      { id: 'dining', name: '餐廳', on: false, brightness: 0 },
      { id: 'kitchen', name: '廚房', on: true, brightness: 60 },
      { id: 'bedroom1', name: '主臥', on: false, brightness: 0 },
      { id: 'bedroom2', name: '次臥', on: true, brightness: 40 },
      { id: 'bath', name: '浴室', on: false, brightness: 0 },
      { id: 'porch', name: '門廊', on: false, brightness: 0 }
    ],
    security: {
      armed: false,
      doorLocked: false,
      backdoorClosed: true,
      garageClosed: true,
      motion: false,
      camerasOnline: true
    },
    energy: {
      nowKw: 0.85,
      history: [] // {t, v}
    },
    media: {
      playing: false,
      volume: 70,
      index: 0,
      position: 0, // seconds
      tracks: [
        { title: 'Endless Skyline', artist: 'Nova', length: 214 },
        { title: 'Night Drive', artist: 'Echoes', length: 198 },
        { title: 'Sunrise Bloom', artist: 'Kite', length: 236 }
      ]
    }
  };

  // Elements
  const el = {
    // header
    statIndoor: document.getElementById('stat-indoor-temp'),
    statHumidity: document.getElementById('stat-humidity'),
    statPower: document.getElementById('stat-power'),
    statSecurity: document.getElementById('stat-security'),
    clockTime: document.getElementById('clock-time'),
    clockDate: document.getElementById('clock-date'),

    // thermostat
    thermoModeIndicator: document.getElementById('thermo-mode-indicator'),
    thermoCurrent: document.getElementById('thermo-current'),
    thermoTarget: document.getElementById('thermo-target'),
    thermoDecrease: document.getElementById('thermo-decrease'),
    thermoIncrease: document.getElementById('thermo-increase'),
    thermoModeChips: Array.from(document.querySelectorAll('.thermo-modes .chip')),
    thermoStatus: document.getElementById('thermo-status'),

    // lights
    lightsList: document.getElementById('lights-list'),
    lightsSummary: document.getElementById('lights-summary'),

    // security
    securityArm: document.getElementById('security-arm'),
    lockDoor: document.getElementById('lock-door'),
    sensorBackdoor: document.getElementById('sensor-backdoor'),
    sensorGarage: document.getElementById('sensor-garage'),
    sensorMotion: document.getElementById('sensor-motion'),
    sensorCameras: document.getElementById('sensor-cameras'),

    // energy
    energyNow: document.getElementById('energy-now'),
    energyCanvas: document.getElementById('energy-canvas'),

    // media
    mediaTitle: document.getElementById('media-track-title'),
    mediaArtist: document.getElementById('media-track-artist'),
    mediaPrev: document.getElementById('media-prev'),
    mediaPlay: document.getElementById('media-play'),
    mediaNext: document.getElementById('media-next'),
    mediaProgress: document.getElementById('media-progress'),
    mediaProgressSlider: document.querySelector('.progress'),
    mediaTrackTime: document.getElementById('media-track-time'),
    mediaVolume: document.getElementById('media-volume')
  };

  // Render
  function renderHeader() {
    el.statIndoor.textContent = `${state.thermostat.current.toFixed(1)}°C`;
    const humidity = 40 + Math.round(Math.random() * 20);
    el.statHumidity.textContent = `${humidity}%`;
    el.statPower.textContent = `${state.energy.nowKw.toFixed(2)} kW`;
    el.statSecurity.textContent = state.security.armed ? '布防' : '未布防';

    const now = new Date();
    el.clockTime.textContent = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit' });
    el.clockDate.textContent = now.toLocaleDateString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  }

  function renderThermostat() {
    el.thermoModeIndicator.textContent = ({ heat: '加熱', cool: '制冷', auto: '自動', off: '關閉' })[state.thermostat.mode];
    el.thermoCurrent.textContent = state.thermostat.current.toFixed(1);
    el.thermoTarget.textContent = state.thermostat.target.toFixed(1);
    el.thermoStatus.textContent = `狀態：${state.thermostat.running ? '運轉中' : '待機'}`;

    el.thermoModeChips.forEach(chip => {
      const isActive = chip.dataset.mode === state.thermostat.mode;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-selected', String(isActive));
    });
  }

  function renderLights() {
    const onCount = state.lights.filter(l => l.on).length;
    el.lightsSummary.textContent = `${onCount}/${state.lights.length} 開啟`;

    // Build list once, then only update values
    if (!el.lightsList.dataset.built) {
      el.lightsList.innerHTML = '';
      for (const light of state.lights) {
        const li = document.createElement('li');
        li.className = 'light-item';
        li.dataset.id = light.id;

        const name = document.createElement('div');
        name.className = 'light-name';
        name.textContent = light.name;

        const dimmer = document.createElement('div');
        dimmer.className = 'light-dimmer';
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '100';
        range.value = String(light.brightness);
        const pct = document.createElement('span');
        pct.className = 'subtle';
        pct.textContent = `${light.brightness}%`;
        dimmer.append(range, pct);

        const toggle = document.createElement('button');
        toggle.className = 'btn light-toggle';
        toggle.textContent = light.on ? '開啟' : '關閉';
        toggle.setAttribute('aria-pressed', String(light.on));

        li.append(name, dimmer, toggle);
        el.lightsList.appendChild(li);

        range.addEventListener('input', () => {
          const value = Number(range.value);
          light.brightness = value;
          if (value > 0) light.on = true;
          pct.textContent = `${value}%`;
          updateLightsSummary();
          updateLightVisual(li, light);
        });
        toggle.addEventListener('click', () => {
          light.on = !light.on;
          if (!light.on) light.brightness = 0;
          range.value = String(light.brightness);
          pct.textContent = `${light.brightness}%`;
          updateLightsSummary();
          updateLightVisual(li, light);
        });
      }
      el.lightsList.dataset.built = '1';
    }

    // Update visuals
    for (const li of Array.from(el.lightsList.children)) {
      const id = li.dataset.id;
      const light = state.lights.find(l => l.id === id);
      if (light) updateLightVisual(li, light);
    }

    function updateLightsSummary() {
      const onCount = state.lights.filter(l => l.on).length;
      el.lightsSummary.textContent = `${onCount}/${state.lights.length} 開啟`;
    }

    function updateLightVisual(li, light) {
      const toggle = li.querySelector('.light-toggle');
      const range = li.querySelector('input[type="range"]');
      const pct = li.querySelector('.subtle');
      toggle.textContent = light.on ? '開啟' : '關閉';
      toggle.setAttribute('aria-pressed', String(light.on));
      if (!document.activeElement || document.activeElement !== range) {
        range.value = String(light.brightness);
      }
      pct.textContent = `${light.brightness}%`;
    }
  }

  function renderSecurity() {
    el.securityArm.textContent = state.security.armed ? '布防中' : '未布防';
    el.securityArm.classList.toggle('danger', !state.security.armed);
    el.securityArm.setAttribute('aria-pressed', String(state.security.armed));

    el.lockDoor.setAttribute('aria-pressed', String(state.security.doorLocked));

    el.sensorBackdoor.textContent = state.security.backdoorClosed ? '關閉' : '開啟';
    el.sensorBackdoor.classList.toggle('active', !state.security.backdoorClosed);

    el.sensorGarage.textContent = state.security.garageClosed ? '關閉' : '開啟';
    el.sensorGarage.classList.toggle('active', !state.security.garageClosed);

    el.sensorMotion.textContent = state.security.motion ? '有' : '無';
    el.sensorMotion.classList.toggle('active', state.security.motion);

    el.sensorCameras.textContent = state.security.camerasOnline ? '線上' : '離線';
    el.sensorCameras.classList.toggle('active', !state.security.camerasOnline);
  }

  // Energy chart (simple sparkline)
  const chart = {
    maxPoints: 300,
    padding: 12,
    color: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4ba3ff'
  };

  function pushEnergy(value) {
    const t = Date.now();
    state.energy.history.push({ t, v: value });
    if (state.energy.history.length > chart.maxPoints) {
      state.energy.history.splice(0, state.energy.history.length - chart.maxPoints);
    }
  }

  function renderEnergy() {
    const canvas = el.energyCanvas;
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    // Fill canvas to container size
    canvas.width = Math.max(100, Math.floor(rect.width * dpr));
    canvas.height = Math.max(100, Math.floor((rect.height - 4) * dpr));

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.energy.history.length < 2) return;

    let min = Infinity, max = -Infinity;
    for (const p of state.energy.history) {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
    if (min === max) {
      min -= 0.1; max += 0.1;
    }

    const left = chart.padding * dpr;
    const right = canvas.width - chart.padding * dpr;
    const top = chart.padding * dpr;
    const bottom = canvas.height - chart.padding * dpr;

    const n = state.energy.history.length;
    const stepX = (right - left) / (n - 1);

    ctx.lineWidth = Math.max(2, 2 * dpr);
    ctx.strokeStyle = chart.color;
    ctx.beginPath();

    state.energy.history.forEach((p, i) => {
      const x = left + i * stepX;
      const y = bottom - ((p.v - min) / (max - min)) * (bottom - top);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Area fill
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, 'rgba(75,163,255,0.35)');
    gradient.addColorStop(1, 'rgba(75,163,255,0.00)');
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function renderMedia() {
    const { index, tracks, playing, position } = state.media;
    const track = tracks[index];
    el.mediaTitle.textContent = track.title;
    el.mediaArtist.textContent = track.artist;
    el.mediaPlay.textContent = playing ? '暫停' : '播放';
    const progressPct = Math.min(100, Math.floor(position / track.length * 100));
    el.mediaProgress.style.width = `${progressPct}%`;
    el.mediaTrackTime.textContent = `${formatTime(position)} / ${formatTime(track.length)}`;
    el.mediaVolume.value = String(state.media.volume);
  }

  // Interactions
  function bindInteractions() {
    // thermostat
    el.thermoDecrease.addEventListener('click', () => adjustTarget(-0.5));
    el.thermoIncrease.addEventListener('click', () => adjustTarget(0.5));
    el.thermoModeChips.forEach(chip => chip.addEventListener('click', () => setMode(chip.dataset.mode)));

    // lights handled during renderLights for each control

    // security
    el.securityArm.addEventListener('click', () => {
      state.security.armed = !state.security.armed;
      renderSecurity();
      renderHeader();
    });
    el.lockDoor.addEventListener('click', () => {
      state.security.doorLocked = !state.security.doorLocked;
      renderSecurity();
    });

    // media
    el.mediaPrev.addEventListener('click', () => {
      state.media.index = (state.media.index - 1 + state.media.tracks.length) % state.media.tracks.length;
      state.media.position = 0;
      renderMedia();
    });
    el.mediaNext.addEventListener('click', () => {
      state.media.index = (state.media.index + 1) % state.media.tracks.length;
      state.media.position = 0;
      renderMedia();
    });
    el.mediaPlay.addEventListener('click', () => {
      state.media.playing = !state.media.playing;
      renderMedia();
    });
    el.mediaVolume.addEventListener('input', () => {
      state.media.volume = Number(el.mediaVolume.value);
    });

    // progress seek
    el.mediaProgressSlider.addEventListener('click', (e) => {
      const rect = el.mediaProgressSlider.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const track = state.media.tracks[state.media.index];
      state.media.position = Math.floor(track.length * pct);
      renderMedia();
    });
    el.mediaProgressSlider.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const track = state.media.tracks[state.media.index];
      const delta = e.key === 'ArrowLeft' ? -5 : 5;
      state.media.position = Math.min(track.length, Math.max(0, state.media.position + delta));
      renderMedia();
    });
  }

  function adjustTarget(delta) {
    state.thermostat.target = Math.min(30, Math.max(16, state.thermostat.target + delta));
    renderThermostat();
  }
  function setMode(mode) {
    state.thermostat.mode = mode;
    renderThermostat();
  }

  // Mock data updates
  function tickThermostat() {
    const { mode, target } = state.thermostat;
    const env = 23 + Math.sin(Date.now() / 20000) * 1.5; // simple drift
    const current = state.thermostat.current;
    const towards = mode === 'heat' || (mode === 'auto' && env < target) ? target + 0.2 :
                    mode === 'cool' || (mode === 'auto' && env > target) ? target - 0.2 : env;
    const next = current + (towards - current) * 0.02; // easing
    state.thermostat.current = Number(next.toFixed(2));
    const running = (mode === 'heat' && current < target - 0.2) || (mode === 'cool' && current > target + 0.2) || (mode === 'auto' && Math.abs(current - target) > 0.3);
    state.thermostat.running = running && mode !== 'off';
  }

  function tickEnergy() {
    const base = 0.6 + Math.abs(Math.sin(Date.now() / 5000)) * 0.7;
    const hvac = state.thermostat.running ? 0.8 : 0.2;
    const lightsLoad = state.lights.reduce((acc, l) => acc + (l.on ? 0.05 + l.brightness / 100 * 0.15 : 0), 0);
    const noise = (Math.random() - 0.5) * 0.1;
    state.energy.nowKw = Math.max(0.2, base + hvac + lightsLoad + noise);
    pushEnergy(state.energy.nowKw);
    el.energyNow.textContent = `${state.energy.nowKw.toFixed(2)} kW`;
  }

  function tickSecurity() {
    // Random motion events when disarmed
    if (!state.security.armed) {
      state.security.motion = Math.random() < 0.05 ? !state.security.motion : state.security.motion;
    } else {
      state.security.motion = Math.random() < 0.02;
    }
    // Backdoor/garage occasional toggle
    if (Math.random() < 0.01) state.security.backdoorClosed = !state.security.backdoorClosed;
    if (Math.random() < 0.008) state.security.garageClosed = !state.security.garageClosed;
  }

  function tickMedia(dt) {
    if (!state.media.playing) return;
    const track = state.media.tracks[state.media.index];
    state.media.position += dt;
    if (state.media.position >= track.length) {
      state.media.index = (state.media.index + 1) % state.media.tracks.length;
      state.media.position = 0;
    }
  }

  function animate(ts) {
    if (!animate.prev) animate.prev = ts;
    const dtSec = Math.min(1, (ts - animate.prev) / 1000);
    animate.prev = ts;

    // periodic updates
    tickThermostat();
    tickEnergy();
    tickSecurity();
    tickMedia(dtSec);

    // render
    renderHeader();
    renderThermostat();
    renderLights();
    renderSecurity();
    renderEnergy();
    renderMedia();

    requestAnimationFrame(animate);
  }

  function init() {
    // Seed energy history
    for (let i = 0; i < 120; i++) pushEnergy(0.8 + Math.sin(i / 10) * 0.2 + Math.random() * 0.1);

    renderHeader();
    renderThermostat();
    renderLights();
    renderSecurity();
    renderEnergy();
    renderMedia();
    bindInteractions();

    scaleToFit();
    requestAnimationFrame(animate);
  }

  function formatTime(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(totalSeconds / 60);
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  window.addEventListener('load', init);
})();
