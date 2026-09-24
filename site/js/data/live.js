// The 1 Hz feed: site_instantaneous → state.now + state.history.
// API down → the scenes keep dreaming on synthetic wind, but the copy never shows fake numbers
// (see stories/now.js); polling carries on with backoff and recovers on its own.
import { NOMINAL_KW, HISTORY, LIVE_POLL_MS, STALE_AFTER_MIN, FORCE_DEMO } from '../config.js';
import { getJSON, backoff, last, RateLimited } from './api.js';
import { toMs } from '../lib/time.js';
import { state, changed, setMode } from './store.js';

const FIELDS = 'aggregate_wind_speed,aggregate_wind_direction,aggregate_active_power';
let firstLoad = true, failures = 0, dreamer = null;

async function poll() {
  const d = await getJSON('/data/site_instantaneous/latest',
    { resolution: '1s', fields: FIELDS, limit: firstLoad ? HISTORY : 5 });
  const s = d.series || {}, ts = d.timestamps || [], n = ts.length;
  if (!n) throw new Error('empty');
  stopDreaming();
  const kwS = s.aggregate_active_power || [];
  if (firstLoad) {
    state.history = new Array(HISTORY).fill(null);
    for (let i = 0; i < n; i++) state.history[HISTORY - n + i] = kwS[i];
    firstLoad = false;
  } else {
    // only append readings newer than the last one we have
    const lastAt = state.now.at;
    for (let i = 0; i < n; i++) if (toMs(ts[i]) > lastAt) state.history.push(kwS[i]);
    state.history = state.history.slice(-HISTORY);
  }
  const kw = last(kwS), wind = last(s.aggregate_wind_speed), dir = last(s.aggregate_wind_direction);
  if (kw != null) state.now.kw = kw;
  if (wind != null) state.now.wind = wind;
  if (dir != null) state.now.dir = dir;
  state.now.at = toMs(ts[n - 1]);
  const ageMin = (Date.now() - state.now.at) / 60000;
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
  dreamer = setInterval(() => {
    ph += 0.12;
    const wind = 2.5 + 10*(0.5+0.5*Math.sin(ph*0.35)) + 1.0*Math.sin(ph*2.7);
    const r = Math.max(0, Math.min(1, (wind-3)/9)), kw = NOMINAL_KW*r*r*(0.9+0.1*Math.sin(ph*5));
    Object.assign(state.now, { wind, kw, dir: 220 + 30*Math.sin(ph*0.11), at: Date.now() });
    state.history.push(kw); state.history = state.history.slice(-HISTORY);
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
    let delay = LIVE_POLL_MS;
    if (document.hidden) delay = 5000;          // nobody watching: poll gently
    else {
      try { await poll(); failures = 0; }
      catch (e) { onError(e); delay = backoff(LIVE_POLL_MS * 2, failures); }
    }
    setTimeout(loop, delay);
  })();
}
