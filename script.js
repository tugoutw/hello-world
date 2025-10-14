// Smart Home Dashboard - Vanilla JS
(function () {
  'use strict';

  const BASE_WIDTH = 1920;
  const BASE_HEIGHT = 1080;
  const STORAGE_KEY = 'smarthome-state-v1';

  /** @type {ReturnType<typeof createDefaultState>} */
  let appState;
  /** @type {number | null} */
  let mediaIntervalId = null;

  function createDefaultState() {
    return {
      thermostat: { isOn: true, mode: 'heat', target: 24, indoor: 24, humidity: 48 },
      lights: {
        masterOn: false,
        rooms: {
          living: { on: true, brightness: 80 },
          kitchen: { on: false, brightness: 70 },
          bedroom: { on: false, brightness: 40 },
          bathroom: { on: false, brightness: 60 },
        },
      },
      security: { armed: false, frontDoorLocked: true, backDoorLocked: true, camsOn: true },
      energy: {
        nowKw: 0.42,
        todayKwh: 12.3,
        history: Array.from({ length: 24 }, () => 0.2 + Math.random() * 1.2),
      },
      air: { aqi: 42, humidity: 48, fan: 30 },
      media: {
        playing: false,
        volume: 60,
        trackIndex: 0,
        tracks: [
          { title: 'Chill Vibes', artist: 'DJ Home', duration: 210 },
          { title: 'Cozy Beats', artist: 'LoFi Lab', duration: 185 },
          { title: 'Morning Light', artist: 'Sunrise', duration: 200 },
        ],
        position: 0,
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      return { ...createDefaultState(), ...parsed };
    } catch {
      return createDefaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {}
  }

  function byId(id) { return document.getElementById(id); }

  function updateClock() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const mon = (now.getMonth()+1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    byId('clock-time').textContent = `${hh}:${mm}`;
    byId('clock-date').textContent = `${yyyy}/${mon}/${dd}`;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function scaleToFit() {
    const app = byId('app');
    if (!app) return;
    const scaleX = window.innerWidth / BASE_WIDTH;
    const scaleY = window.innerHeight / BASE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    app.style.transform = `scale(${scale})`;
  }

  function setChipPressed(el, pressed) {
    el.setAttribute('aria-pressed', String(pressed));
  }

  function renderThermostat() {
    const { thermostat } = appState;
    byId('thermo-current').textContent = String(thermostat.indoor);
    byId('temp-target').textContent = String(thermostat.target);
    byId('temp-indoor').textContent = String(thermostat.indoor);
    byId('humidity').textContent = String(thermostat.humidity);

    setChipPressed(byId('thermo-power'), thermostat.isOn);
    setChipPressed(byId('mode-heat'), thermostat.mode === 'heat');
    setChipPressed(byId('mode-cool'), thermostat.mode === 'cool');
    setChipPressed(byId('mode-auto'), thermostat.mode === 'auto');

    // Gauge mapping: 10-32C to dashoffset 565 -> 0
    const minC = 10, maxC = 32;
    const ratio = clamp((thermostat.target - minC) / (maxC - minC), 0, 1);
    const dash = 565 - 565 * ratio;
    const gauge = byId('thermo-gauge');
    gauge.style.strokeDashoffset = String(dash);
  }

  function renderLights() {
    const { lights } = appState;
    const master = byId('lights-master');
    const rooms = lights.rooms;
    const allOn = Object.values(rooms).every(r => r.on);
    setChipPressed(master, lights.masterOn || allOn);

    /** @type {Array<[string, {on:boolean, brightness:number}]>} */
    const entries = Object.entries(rooms);
    for (const [roomKey, room] of entries) {
      const toggleBtn = document.querySelector(`button[data-room="${roomKey}"][data-action="toggle"]`);
      if (toggleBtn) setChipPressed(toggleBtn, room.on);
      const slider = document.querySelector(`input[data-room="${roomKey}"]`);
      if (slider) slider.value = String(room.brightness);
    }
  }

  function renderSecurity() {
    const { security } = appState;
    setChipPressed(byId('security-arm'), security.armed);
    byId('lock-front').textContent = security.frontDoorLocked ? '已上鎖' : '未上鎖';
    byId('lock-back').textContent = security.backDoorLocked ? '已上鎖' : '未上鎖';
    byId('cams').textContent = security.camsOn ? '開啟' : '關閉';
  }

  function formatNumber(n, digits=1) { return Number(n).toFixed(digits); }

  function renderEnergy() {
    const { energy } = appState;
    byId('power-now').textContent = formatNumber(energy.nowKw, 2);
    byId('energy-today').textContent = formatNumber(energy.todayKwh, 1);

    const canvas = /** @type {HTMLCanvasElement} */ (byId('energy-chart'));
    const ctx = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // Axes
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i=0;i<=6;i++) {
      const y = (h-20) - (i*(h-40)/6);
      ctx.moveTo(40, y);
      ctx.lineTo(w-10, y);
    }
    ctx.stroke();

    // Bars
    const data = energy.history;
    const maxVal = Math.max(1.2, Math.max(...data));
    const barW = (w-70)/data.length;
    ctx.globalAlpha = 1;
    for (let i=0;i<data.length;i++) {
      const val = data[i];
      const height = (val / maxVal) * (h-60);
      const x = 50 + i*barW;
      const y = (h-30) - height;
      const grad = ctx.createLinearGradient(0, y, 0, y+height);
      grad.addColorStop(0, '#6bc2ff');
      grad.addColorStop(1, '#7be495');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, Math.max(6, barW*0.6), height);
    }
  }

  function renderAir() {
    const { air } = appState;
    byId('aqi').textContent = String(air.aqi);
    byId('air-humidity').textContent = String(air.humidity);
    byId('fan-speed').value = String(air.fan);
  }

  function secondsToMmSs(s) {
    const m = Math.floor(s/60);
    const sec = Math.floor(s%60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function renderMedia() {
    const m = appState.media;
    const track = m.tracks[m.trackIndex];
    byId('track-info').textContent = `${track.title} — ${track.artist}`;
    byId('duration').textContent = secondsToMmSs(track.duration);
    byId('elapsed').textContent = secondsToMmSs(m.position);
    byId('seek').value = String(Math.floor((m.position/track.duration)*100));
    byId('volume').value = String(m.volume);
    byId('play').textContent = m.playing ? '⏸' : '▶️';
  }

  function renderAll() {
    renderThermostat();
    renderLights();
    renderSecurity();
    renderEnergy();
    renderAir();
    renderMedia();
  }

  function bindThermostat() {
    byId('thermo-power').addEventListener('click', () => {
      appState.thermostat.isOn = !appState.thermostat.isOn;
      saveState(); renderThermostat();
    });
    byId('mode-heat').addEventListener('click', () => { appState.thermostat.mode = 'heat'; saveState(); renderThermostat(); });
    byId('mode-cool').addEventListener('click', () => { appState.thermostat.mode = 'cool'; saveState(); renderThermostat(); });
    byId('mode-auto').addEventListener('click', () => { appState.thermostat.mode = 'auto'; saveState(); renderThermostat(); });
    byId('temp-up').addEventListener('click', () => {
      appState.thermostat.target = clamp(appState.thermostat.target + 1, 10, 32);
      saveState(); renderThermostat();
    });
    byId('temp-down').addEventListener('click', () => {
      appState.thermostat.target = clamp(appState.thermostat.target - 1, 10, 32);
      saveState(); renderThermostat();
    });
  }

  function bindLights() {
    const master = byId('lights-master');
    master.addEventListener('click', () => {
      const next = !(master.getAttribute('aria-pressed') === 'true');
      appState.lights.masterOn = next;
      for (const room of Object.values(appState.lights.rooms)) room.on = next;
      saveState(); renderLights();
    });

    const toggleButtons = document.querySelectorAll('section.lights button[data-action="toggle"]');
    toggleButtons.forEach(btn => btn.addEventListener('click', () => {
      const roomKey = btn.getAttribute('data-room');
      const room = appState.lights.rooms[roomKey];
      room.on = !room.on;
      saveState(); renderLights();
    }));

    const sliders = document.querySelectorAll('section.lights input[type=range]');
    sliders.forEach(sl => sl.addEventListener('input', () => {
      const roomKey = sl.getAttribute('data-room');
      const room = appState.lights.rooms[roomKey];
      room.brightness = Number(sl.value);
      saveState();
    }));
  }

  function bindSecurity() {
    byId('security-arm').addEventListener('click', () => {
      appState.security.armed = !appState.security.armed;
      saveState(); renderSecurity();
    });
    byId('toggle-front').addEventListener('click', () => { appState.security.frontDoorLocked = !appState.security.frontDoorLocked; saveState(); renderSecurity(); });
    byId('toggle-back').addEventListener('click', () => { appState.security.backDoorLocked = !appState.security.backDoorLocked; saveState(); renderSecurity(); });
    byId('toggle-cams').addEventListener('click', () => { appState.security.camsOn = !appState.security.camsOn; saveState(); renderSecurity(); });
  }

  function stopMediaTimer() { if (mediaIntervalId !== null) { clearInterval(mediaIntervalId); mediaIntervalId = null; } }
  function startMediaTimer() {
    stopMediaTimer();
    mediaIntervalId = setInterval(() => {
      if (!appState.media.playing) return;
      const track = appState.media.tracks[appState.media.trackIndex];
      appState.media.position = Math.min(track.duration, appState.media.position + 1);
      if (appState.media.position >= track.duration) {
        nextTrack();
      }
      renderMedia();
    }, 1000);
  }

  function prevTrack() {
    const m = appState.media;
    m.trackIndex = (m.trackIndex - 1 + m.tracks.length) % m.tracks.length;
    m.position = 0; saveState(); renderMedia();
  }
  function nextTrack() {
    const m = appState.media;
    m.trackIndex = (m.trackIndex + 1) % m.tracks.length;
    m.position = 0; saveState(); renderMedia();
  }

  function bindMedia() {
    byId('play').addEventListener('click', () => {
      appState.media.playing = !appState.media.playing;
      startMediaTimer(); saveState(); renderMedia();
    });
    byId('prev').addEventListener('click', () => { prevTrack(); });
    byId('next').addEventListener('click', () => { nextTrack(); });
    byId('volume').addEventListener('input', (e) => {
      appState.media.volume = Number(e.target.value); saveState();
    });
    byId('seek').addEventListener('input', (e) => {
      const percent = Number(e.target.value) / 100;
      const track = appState.media.tracks[appState.media.trackIndex];
      appState.media.position = Math.floor(track.duration * percent);
      saveState(); renderMedia();
    });
  }

  function bindAccessibilityShortcuts() {
    // Space/Enter toggles for any [role=button] or button with aria-pressed
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if ((e.key === ' ' || e.key === 'Enter') && target.tagName === 'BUTTON') {
        // Let native button handle; prevent space scrolling
        if (e.key === ' ') e.preventDefault();
      }
    });
  }

  function simulateSensors() {
    // Lightly drift indoor temp and humidity
    setInterval(() => {
      const t = appState.thermostat;
      const drift = (Math.random() - 0.5) * 0.2;
      t.indoor = Math.round((t.indoor + drift) * 10) / 10;
      t.humidity = clamp(t.humidity + (Math.random() - 0.5) * 0.6, 30, 70);
      saveState(); renderThermostat();
    }, 4000);

    // Energy now fluctuate and history shift
    setInterval(() => {
      const e = appState.energy;
      e.nowKw = Math.max(0.12, Math.min(2.4, e.nowKw + (Math.random()-0.5) * 0.2));
      e.todayKwh = e.todayKwh + e.nowKw / 120; // add per 30s step
      e.history.shift();
      e.history.push(0.2 + Math.random() * 1.2);
      saveState(); renderEnergy();
    }, 30000);
  }

  function init() {
    appState = loadState();
    updateClock();
    setInterval(updateClock, 1000 * 30);

    scaleToFit();
    window.addEventListener('resize', scaleToFit);

    bindThermostat();
    bindLights();
    bindSecurity();
    bindMedia();
    bindAccessibilityShortcuts();

    renderAll();
    startMediaTimer();
    simulateSensors();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
