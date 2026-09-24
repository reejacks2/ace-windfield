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
            'available_power_after_force_majeure_mean,available_power_after_external_setpoints_mean,air_pressure_mean',
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
}

// ?demo=1 only — lets every story be seen without the API. Never used when the API is merely down.
function fakeSlow() {
  const now = Date.now();
  state.today = { kwh: 18400, windOnlyKwh: 19900, gapKwh: 1200, since: londonMidnight().getTime(), at: now, pressure: 1012,
                  lastRow: { wind: 3000, tech: 3000, fm: 3000, ext: 2100, actual: 2080 } };
  state.hub = { hubC: 11, groundC: 13, at: now };
  state.status = { main: 0, sub: 0, fault: false, warning: false, service: false, at: now };
  state.season = { days: 90, curtailedDays: 6, gapMWh: 14.2, windOnlyMWh: 1650, producedMWh: 1610, at: now };
  changed();
}
