// Shared state. Feeds write it, stories and scenes read it.
import { HISTORY } from '../config.js';

export const state = {
  mode: 'connecting',        // connecting | live | stale | offline | demo
  statusText: 'Connecting to the turbine…',
  now: { kw: 0, wind: 0, dir: 225, at: 0 },     // latest 1 Hz reading (target for easing)
  history: new Array(HISTORY).fill(null),        // last HISTORY seconds of kW
  today: null,     // { kwh, windOnlyKwh, gapKwh, since, at, lastRow: {wind, tech, fm, ext, actual}, pressure }
  hub: null,       // { hubC, groundC, at }
  status: null,    // { main, sub, fault, warning, service, at }
  season: null,    // { days, curtailedDays, gapMWh, windOnlyMWh, producedMWh, at }
};

const subs = new Set();
export const onChange = fn => subs.add(fn);
export const changed = () => subs.forEach(fn => fn(state));

export function setMode(mode, text) {
  if (state.mode === mode && state.statusText === text) return;
  state.mode = mode; state.statusText = text; changed();
}
