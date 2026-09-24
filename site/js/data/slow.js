// Slow feeds for the stories. Each refresh writes one slice of state; a failed refresh leaves
// the previous value in place and retries with backoff. Stories check `at` for freshness.
import { WEC, FORCE_DEMO } from '../config.js';
import { getJSON, getAllPages, backoff, clean, last } from './api.js';
import { toMs, isoZ, londonMidnight } from '../lib/time.js';
import { state, changed } from './store.js';

const A = `/assets/${WEC}`;
const H = 10 / 60;                      // hours per 10-minute record
const pos = v => (v > 0 ? v : 0);

// Today (since Bristol midnight): energy, and the wind-only estimate vs each constraint.
// The four available-power fields are independent constraints, NOT a cascade — see NOTES.md.
async function refreshToday() {
  const since = londonMidnight();
  const d = await getAllPages(`${A}/data/wecstd/range`, {
    resolution: '10m', start: isoZ(since), end: isoZ(new Date()), page_size: 200,
    fields: 'energy_produced,active_power_mean,available_power_by_wind_mean,technically_available_power_mean,' +
            'available_power_after_force_majeure_mean,available_power_after_external_setpoints_mean,air_pressure_mean,' +
            'blade_angle_mean',
  });
  const s = d.series, n = d.timestamps.length;
  if (!n) return;
  let windOnly = 0, gap = 0, sumKw = 0;
  for (let i = 0; i < n; i++) {
    const w = s.available_power_by_wind_mean[i], e = s.available_power_after_external_setpoints_mean[i];
    if (w != null) windOnly += pos(w) * H;
    if (w != null && e != null) gap += pos(w - e) * H;
    sumKw += pos(s.active_power_mean[i] ?? 0) * H;
  }
  // energy_produced is a lifetime kWh counter; fall back to integrating power if it misbehaves.
  const c0 = s.energy_produced.find(v => v != null), c1 = last(s.energy_produced);
  const counter = c0 != null && c1 != null ? c1 - c0 : null;
  const kwh = counter != null && counter >= 0 && counter < 4300 * 24 ? counter : sumKw;
  const i = n - 1;
  state.today = {
    kwh, windOnlyKwh: windOnly, gapKwh: gap, since: since.getTime(), at: toMs(d.timestamps[i]),
    pressure: clean(last(s.air_pressure_mean)),
    pitch: clean(last(s.blade_angle_mean)),
    lastRow: {
      wind: s.available_power_by_wind_mean[i], tech: s.technically_available_power_mean[i],
      fm: s.available_power_after_force_majeure_mean[i], ext: s.available_power_after_external_setpoints_mean[i],
      actual: s.active_power_mean[i],
    },
  };
}

async function refreshHub() {
  const d = await getJSON(`${A}/data/tep3c021/latest`,
    { resolution: '10m', limit: 1, fields: 'outside_hub_height_temperature_mean,outside_ground_temperature_mean' });
  if (!d.timestamps?.length) return;
  state.hub = {
    hubC: clean(last(d.series.outside_hub_height_temperature_mean)),
    groundC: clean(last(d.series.outside_ground_temperature_mean)),
    at: toMs(d.timestamps.at(-1)),
  };
}

async function refreshStatus() {
  const d = await getJSON(`${A}/events/status/latest`, { limit: 10 });
  const ev = (d.events || []).slice().sort((a, b) => a.observed_at - b.observed_at).at(-1);
  if (!ev) return;
  const v = ev.values;
  state.status = {
    main: v.main_status, sub: v.substatus, fault: !!v.fault_message_flag,
    warning: !!v.warning_message_flag, service: !!v.service_flag, at: toMs(ev.observed_at),
  };
}

// The last 90 days, from daily means. Day-level gap = max(0, wind − ext) × 24 h: approximate,
// and blind to very short episodes that round away in a daily mean.
async function refreshSeason() {
  const end = londonMidnight(), start = new Date(end.getTime() - 90 * 864e5);
  const d = await getAllPages(`${A}/data/wecstd/range`, {
    resolution: 'daily', start: isoZ(start), end: isoZ(end), page_size: 200,
    fields: 'energy_produced,available_power_by_wind_mean,available_power_after_external_setpoints_mean',
  });
  const s = d.series; let gap = 0, windOnly = 0, produced = 0, curtailedDays = 0, days = 0;
  for (let i = 0; i < d.timestamps.length; i++) {
    const w = s.available_power_by_wind_mean[i], e = s.available_power_after_external_setpoints_mean[i];
    if (w == null || e == null) continue;
    days++;
    const g = pos(w - e) * 24;
    gap += g; windOnly += pos(w) * 24; produced += pos(s.energy_produced[i] ?? 0);
    if (g >= 24) curtailedDays++;
  }
  if (days) state.season = { days, curtailedDays, gapMWh: gap / 1000, windOnlyMWh: windOnly / 1000, producedMWh: produced / 1000, at: Date.now() };
}

// When the turbine's record starts ("since March 2023" on the odometer).
async function refreshSince() {
  const d = await getJSON(`${A}/configuration/latest`);
  const c = (d.changes || []).find(x => x.signal === 'wec_availability_start');
  const t = c && Date.parse(c.value);
  if (Number.isFinite(t)) state.since = new Date(t);
}

// History for the replay scene: every 10-minute record the API has for the last 60 days
// (10m history begins 2026-07-21, so early on this is shorter).
async function refreshReplay() {
  const end = new Date(), start = new Date(end.getTime() - 60 * 864e5);
  const d = await getAllPages(`${A}/data/wecstd/range`, {
    resolution: '10m', start: isoZ(start), end: isoZ(end), page_size: 5000,
    fields: 'active_power_mean,available_power_by_wind_mean,wind_speed_mean',
  });
  const n = d.timestamps.length;
  if (n < 144) return;
  // Re-grid onto a regular 10-minute axis so gaps stay gaps (NaN), not silently closed up.
  const step = 600_000, t0 = Math.floor(toMs(d.timestamps[0]) / step) * step;
  const len = Math.floor((toMs(d.timestamps[n - 1]) - t0) / step) + 1;
  const kw = new Float32Array(len).fill(NaN), avail = new Float32Array(len).fill(NaN), wind = new Float32Array(len).fill(NaN);
  for (let i = 0; i < n; i++) {
    const k = Math.round((toMs(d.timestamps[i]) - t0) / step);
    kw[k] = d.series.active_power_mean[i] ?? NaN;
    avail[k] = d.series.available_power_by_wind_mean[i] ?? NaN;
    wind[k] = d.series.wind_speed_mean[i] ?? NaN;
  }
  state.replay = { t0, step, kw, avail, wind, at: Date.now() };
}

// Grid carbon intensity for South West England (NESO Carbon Intensity API, region 11).
// Regional figures are forecasts — the API publishes no regional actuals. Refreshed half-hourly
// like the source. Used to say how much CO2 the turbine's power displaces at the AVERAGE grid mix.
async function refreshCarbon() {
  const r = await fetch('https://api.carbonintensity.org.uk/regional/regionid/11', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`carbon HTTP ${r.status}`);
  const d = (await r.json()).data?.[0]?.data?.[0];
  const g = d?.intensity?.forecast;
  if (!Number.isFinite(g)) return;
  const mix = Object.fromEntries((d.generationmix || []).map(x => [x.fuel, x.perc]));
  state.carbon = { g, index: d.intensity.index, from: d.from, gas: mix.gas ?? null, at: Date.now() };
}

function every(fn, ms, offset) {
  let failures = 0;
  const run = async () => {
    let delay = ms;
    try { await fn(); failures = 0; changed(); }
    catch (e) { failures++; delay = Math.min(ms, backoff(15_000, failures, 30 * 60_000)); console.warn('[windfield]', fn.name, e.message); }
    setTimeout(run, document.hidden ? Math.max(delay, 300_000) : delay);
  };
  setTimeout(run, offset);   // staggered so a page load isn't a burst
}

export function startSlow() {
  if (FORCE_DEMO) return fakeSlow();
  every(refreshStatus, 60_000, 1_500);
  every(refreshToday, 300_000, 3_000);       // 10m family: recommended refresh 300 s
  every(refreshHub, 600_000, 4_500);
  every(refreshSeason, 3_600_000, 6_000);    // daily family: recommended refresh 3600 s
  every(refreshSince, 24 * 3_600_000, 7_500);
  every(refreshReplay, 6 * 3_600_000, 9_000);
  every(refreshCarbon, 30 * 60_000, 10_500);
}

// ?demo=1 only — lets every story be seen without the API. Never used when the API is merely down.
function fakeSlow() {
  const now = Date.now();
  state.today = { kwh: 18400, windOnlyKwh: 19900, gapKwh: 1200, since: londonMidnight().getTime(), at: now, pressure: 1012,
                  lastRow: { wind: 3000, tech: 3000, fm: 3000, ext: 2100, actual: 2080 } };
  state.hub = { hubC: 11, groundC: 13, at: now };
  state.status = { main: 0, sub: 0, fault: false, warning: false, service: false, at: now };
  state.season = { days: 90, curtailedDays: 6, gapMWh: 14.2, windOnlyMWh: 1650, producedMWh: 1610, at: now };
  state.since = new Date('2023-03-29T00:00:00+01:00');
  state.carbon = { g: 140, index: 'moderate', from: new Date(now).toISOString(), gas: 30, at: now };
  const len = 60 * 144, step = 600_000, kw = new Float32Array(len), avail = new Float32Array(len), wind = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const w = 6 + 4 * Math.sin(i / 300) + 2.5 * Math.sin(i / 37) + 1.5 * Math.sin(i / 7);
    const r = Math.max(0, Math.min(1, (w - 3) / 9)); wind[i] = w; avail[i] = 4200 * r * r;
    kw[i] = avail[i] * (i % 997 < 30 ? 0.5 : 0.98);
  }
  state.replay = { t0: now - len * step, step, kw, avail, wind, at: now };
  changed();
}
