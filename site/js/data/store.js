// Shared state. Feeds write it, stories and scenes read it.
import { HISTORY } from '../config.js';

export const state = {
  mode: 'connecting',        // connecting | live | stale | offline | demo
  statusText: 'Connecting to the turbine…',
  // latest 1 Hz reading. dir = wind FROM (true bearing); yaw = nacelle heading; avail = wind-only kW.
  now: { kw: 0, avail: 0, wind: 0, dir: 225, yaw: 225, rpm: 0, lifetimeKwh: null, lifetimeTickAt: 0, at: 0 },
  history: new Array(HISTORY).fill(null),        // last HISTORY seconds of kW made
  ghost: new Array(HISTORY).fill(null),          // … and of kW the wind offered
  today: null,     // { kwh, windOnlyKwh, gapKwh, since, at, lastRow: {wind, tech, fm, ext, actual}, pressure, pitch }
  hub: null,       // { hubC, groundC, at }
  status: null,    // { main, sub, fault, warning, service, at }
  season: null,    // { days, curtailedDays, gapMWh, windOnlyMWh, producedMWh, at }
  since: null,     // Date the turbine's availability record starts (asset configuration)
  replay: null,    // { t0, step, kw: Float32Array, avail: Float32Array, wind: Float32Array, at }
  carbon: null,    // { g (gCO2/kWh, SW England forecast), index, from, gas (% of mix), at }
};

const subs = new Set();
export const onChange = fn => subs.add(fn);
export const changed = () => subs.forEach(fn => fn(state));

export function setMode(mode, text) {
  if (state.mode === mode && state.statusText === text) return;
  state.mode = mode; state.statusText = text; changed();
}
