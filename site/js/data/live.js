// The 1 Hz feed: the turbine's own wec_instantaneous stream → state.now + history + ghost.
// API down → the scenes keep dreaming on synthetic wind, but the copy never shows fake numbers
// (see stories/now.js); polling carries on with backoff and recovers on its own.
//
// Direction, calibrated 2026-09-24:
//   site aggregate_wind_direction == wec_nacelle_position (it is the HEADING, not the wind);
//   wec_wind_direction is the vane angle RELATIVE to the nacelle (≈0 while generating);
//   wind-from = nacelle + relative (yaw turns toward +rel in 84% of moves).
import { NOMINAL_KW, WEC, HISTORY, LIVE_POLL_MS, STALE_AFTER_MIN, FORCE_DEMO } from '../config.js';
import { getJSON, backoff, last, RateLimited } from './api.js';
import { toMs } from '../lib/time.js';
import { state, changed, setMode } from './store.js';

const FIELDS = ['wec_active_power', 'wec_available_power_by_wind', 'wec_wind_speed', 'wec_wind_direction',
                'wec_nacelle_position', 'wec_rotor_speed', 'wec_energy_exported'].join(',');
let firstLoad = true, failures = 0, dreamer = null;
const wrap = a => ((a % 360) + 360) % 360;

function pushSeconds(kwS, availS, ts) {
  if (firstLoad) {
    const n = ts.length;
    state.history = new Array(HISTORY).fill(null);
    state.ghost = new Array(HISTORY).fill(null);
    for (let i = 0; i < n; i++) { state.history[HISTORY - n + i] = kwS[i]; state.ghost[HISTORY - n + i] = availS[i]; }
    firstLoad = false;
    return;
  }
  const lastAt = state.now.at;                   // only append readings newer than the last one
  for (let i = 0; i < ts.length; i++) if (toMs(ts[i]) > lastAt) { state.history.push(kwS[i]); state.ghost.push(availS[i]); }
  state.history = state.history.slice(-HISTORY);
  state.ghost = state.ghost.slice(-HISTORY);
}

async function poll() {
  const d = await getJSON(`/assets/${WEC}/data/wec_instantaneous/latest`,
    { resolution: '1s', fields: FIELDS, limit: firstLoad ? HISTORY : 5 });
  const s = d.series || {}, ts = d.timestamps || [], n = ts.length;
  if (!n) throw new Error('empty');
  stopDreaming();
  pushSeconds(s.wec_active_power || [], s.wec_available_power_by_wind || [], ts);

  const now = state.now, v = k => last(s[k]);
  const kw = v('wec_active_power'), avail = v('wec_available_power_by_wind'), wind = v('wec_wind_speed');
  const yaw = v('wec_nacelle_position'), rel = v('wec_wind_direction'), rpm = v('wec_rotor_speed');
  const counter = v('wec_energy_exported');
  if (kw != null) now.kw = kw;
  if (avail != null) now.avail = avail;
  if (wind != null) now.wind = wind;
  if (yaw != null) now.yaw = wrap(yaw);
  if (yaw != null && rel != null) now.dir = wrap(yaw + rel);
  if (rpm != null) now.rpm = Math.max(0, rpm);
  if (counter != null && counter !== now.lifetimeKwh) { now.lifetimeKwh = counter; now.lifetimeTickAt = Date.now(); }
  now.at = toMs(ts[n - 1]);

  const ageMin = (Date.now() - now.at) / 60000;
  if (ageMin > STALE_AFTER_MIN) setMode('stale', `Last reading ${Math.round(ageMin)} min ago`);
  else setMode('live', 'Live from the turbine');
  changed();
}

function onError(err) {
  failures++;
  if (err instanceof RateLimited) { setMode(state.mode === 'live' ? 'stale' : state.mode, `Turbine data is busy — ${err.message}`); return; }
  if (state.mode === 'live' || state.mode === 'stale') {
    // brief blips keep the last reading; a run of failures means the feed is down
    if (failures < 5) return setMode('stale', 'Connection lost — showing the last reading');
  }
  startDreaming('Can’t reach the turbine — retrying');
}

// Synthetic wind so the art keeps moving. Used for ?demo=1 and while the API is down.
function startDreaming(text) {
  setMode(FORCE_DEMO ? 'demo' : 'offline', text);
  if (dreamer) return;
  let ph = Math.random() * 100;
  state.history = new Array(HISTORY).fill(null);
  state.ghost = new Array(HISTORY).fill(null);
  if (!FORCE_DEMO) state.now.lifetimeKwh = null;     // never show a stale or invented odometer
  else Object.assign(state.now, { lifetimeKwh: 30_480_000, lifetimeTickAt: Date.now() });
  dreamer = setInterval(() => {
    ph += 0.12;
    const wind = 2.5 + 10*(0.5+0.5*Math.sin(ph*0.35)) + 1.0*Math.sin(ph*2.7);
    const r = Math.max(0, Math.min(1, (wind-3)/9)), avail = NOMINAL_KW*r*r;
    const kw = avail * (Math.sin(ph*0.05) > 0.7 ? 0.6 : 0.97);   // occasional "curtailment" for the ghost
    const dir = 220 + 30*Math.sin(ph*0.11);
    Object.assign(state.now, { wind, kw, avail, dir, yaw: dir - 3*Math.sin(ph*0.4), rpm: wind < 2.5 ? 0.3 : Math.min(12.5, 1.2*wind), at: Date.now() });
    state.history.push(kw); state.history = state.history.slice(-HISTORY);
    state.ghost.push(avail); state.ghost = state.ghost.slice(-HISTORY);
    changed();
  }, 1000);
}
function stopDreaming() {
  if (!dreamer) return;
  clearInterval(dreamer); dreamer = null; firstLoad = true;
}

export function startLive() {
  if (FORCE_DEMO) return startDreaming('Demo weather');
  (async function loop() {
    let delay = document.hidden ? 5000 : LIVE_POLL_MS;   // nobody watching: poll gently, but still poll
    try { await poll(); failures = 0; }
    catch (e) { onError(e); delay = backoff(LIVE_POLL_MS * 2, failures); }
    setTimeout(loop, delay);
  })();
}
