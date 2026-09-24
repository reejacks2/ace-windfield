// The curtailment gap: energy the wind offered that the grid wouldn't take.
// Today if it happened today; otherwise the last 90 days — including "none", which is a story too.
import { fmt, fmt1, energy, homeDays, fresh } from './format.js';

export default {
  id: 'curtailment',
  ready: s => (fresh(s.today, 30) && s.today.gapKwh >= 50) || fresh(s.season, 6 * 60),
  render(s) {
    if (fresh(s.today, 30) && s.today.gapKwh >= 50) {
      const g = s.today.gapKwh;
      return {
        headline: `The grid held back ${energy(g)} today`,
        sub: `The wind was there, but the local network was full. That’s a day’s electricity for <b>${fmt.format(homeDays(g))} homes</b>.`,
      };
    }
    const z = s.season;
    if (z.curtailedDays === 0 || z.gapMWh < 0.5) return {
      headline: 'The grid took everything',
      sub: `In the last ${z.days} days the network never had to ask the turbine to hold back for long.`,
    };
    return {
      headline: `The grid held back about <span class="num">${fmt1.format(z.gapMWh)}</span>&nbsp;MWh`,
      sub: `Over the last ${z.days} days, on <b>${z.curtailedDays} ${z.curtailedDays === 1 ? 'day' : 'days'}</b> — `
         + `${fmt1.format(z.gapMWh / z.windOnlyMWh * 100)}% of what the wind offered.`,
    };
  },
};
