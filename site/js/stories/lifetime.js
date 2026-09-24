// Everything this turbine has made since its record began, from its own lifetime counter.
import { fmt, fmt1, fresh } from './format.js';
import { HOME_KW } from '../config.js';
import { TZ_FMT } from '../lib/time.js';

const since = d => new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, month: 'long', year: 'numeric' }).format(d);

export default {
  id: 'lifetime',
  ready: s => s.now.lifetimeKwh != null && (s.mode === 'live' || s.mode === 'stale' || s.mode === 'demo'),
  render(s) {
    const kwh = s.now.lifetimeKwh, homeYears = Math.round(kwh / (HOME_KW * 24 * 365) / 100) * 100;
    return {
      headline: `<span class="num">${fmt1.format(kwh / 1e6)}</span>&nbsp;GWh and counting`,
      sub: `Made here${s.since ? ` since ${since(s.since)}` : ''}. That’s a year’s electricity for about <b>${fmt.format(homeYears)} homes</b>.`,
    };
  },
};
