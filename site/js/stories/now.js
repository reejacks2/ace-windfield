// Right now: live power, homes, wind. The default story.
// Offline, it says so plainly — the art keeps moving but no invented number is ever shown.
import { fmt, compass, homesNow } from './format.js';
import stopped from './stopped.js';

export default {
  id: 'now',
  ready: s => !stopped.ready(s),
  render(s) {
    if (s.mode === 'offline' || s.mode === 'connecting') return {
      headline: s.mode === 'offline' ? 'Waiting for the turbine' : 'The turbine is waking up',
      sub: s.mode === 'offline'
        ? 'The live feed is unavailable, so the picture is dreaming its own weather until it’s back.'
        : 'Reading the wind…',
    };
    const kw = Math.round(s.now.kw), wind = s.now.wind, from = compass(s.now.dir);
    if (kw < 15) return {
      headline: 'The turbine is resting',
      sub: `Wind <b>${wind.toFixed(1)} m/s</b> from the ${from}.`,
    };
    return {
      headline: `The turbine is making <span class="num">${fmt.format(kw)}</span>&nbsp;kW`,
      sub: `Enough for about <b>${fmt.format(homesNow(kw))} homes</b> right now. Wind <b>${wind.toFixed(1)} m/s</b> from the ${from}.`,
    };
  },
};
