// Why it's stopped. Only when live and not generating; replaces the "now" story.
// Reasons come from evidence in the data (flags, wind, available-power gaps), not from a
// guessed status-code table. Codes verified against wind so far: main 0 = running,
// main 2 = lack of wind (median wind 0.6 m/s across Aug–Sep 2026 events).
import { clock } from '../lib/time.js';
import { compass, fresh } from './format.js';

const GAP_KW = 50;

function reason(s) {
  const st = fresh(s.status, 24 * 60) ? s.status : null;
  const row = fresh(s.today, 30) ? s.today.lastRow : null;
  const wind = s.now.wind, at = st ? ` at ${clock(st.at)}` : '';
  const gap = x => row && row.wind != null && x != null && row.wind - x > GAP_KW;
  if (st?.service) return ['Someone is working on the turbine',
    `It’s in service mode${at}. It will be back once the visit is done.`];
  if (st?.fault) return ['The turbine has paused itself',
    `Its control system logged a fault${at}.`];
  if (gap(row?.ext)) return ['The grid has asked it to hold back',
    'Bristol’s local network can’t always take all the power, so it tells the turbine to turn down. The wind is there; the wires are full.'];
  if (gap(row?.fm)) return ['Paused by something outside its control',
    'Like a storm, ice on the blades, or a grid outage.'];
  if (gap(row?.tech)) return ['The turbine is paused for a technical reason',
    'The wind could turn it, but the machine is holding still for now.'];
  if (st?.main === 2 || wind < 3) return ['Waiting for wind',
    `It needs about 3 m/s to start. Right now it’s <b>${wind.toFixed(1)} m/s</b> from the ${compass(s.now.dir)}.`];
  return ['The turbine is paused', st ? `Status ${st.main}:${st.sub}${at}.` : 'It isn’t generating right now.'];
}

export default {
  id: 'stopped',
  ready: s => (s.mode === 'live' || s.mode === 'stale') && s.now.kw < 15,
  render(s) {
    const [headline, sub] = reason(s);
    return { headline, sub };
  },
};
