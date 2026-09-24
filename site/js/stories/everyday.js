// Right now, that's… — the power being made, as everyday things. Each is plain arithmetic on
// the live kW, so it's exactly as true as the reading. One is shown at a time, in rotation.
import { fmt } from './format.js';

const round = n => n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
// A cup of tea: 250 ml from 15 °C to boiling ≈ 89 kJ, plus kettle losses ≈ 0.03 kWh.
// A phone charge ≈ 15 Wh. An electric bus ≈ 1.2 kWh per km. A kettle draws ≈ 3 kW.
const THINGS = [
  kw => ({ n: kw / 3, head: n => `That’s <span class="num">${fmt.format(round(n))}</span> kettles boiling at once`, sub: 'Each kettle draws about 3 kW.' }),
  kw => ({ n: kw / 0.03 / 60, head: n => `Enough for <span class="num">${fmt.format(round(n))}</span> cups of tea a minute`, sub: 'About 0.03 kWh boils a mug’s worth.' }),
  kw => ({ n: kw / 15 * 1000 / 3600, head: n => `A phone fully charged <span class="num">${fmt.format(round(n))}</span> times a second`, sub: 'A phone battery holds about 15 Wh.' }),
  kw => ({ n: kw / 1.2 / 60, head: n => `An electric bus could drive <span class="num">${fmt.format(round(n))}</span>&nbsp;km every minute`, sub: 'A double-decker uses about 1.2 kWh per km.' }),
];
let i = Math.floor(Math.random() * THINGS.length), lastShown = 0;

export default {
  id: 'everyday',
  ready: s => (s.mode === 'live' || s.mode === 'stale' || s.mode === 'demo') && s.now.kw >= 100,
  render(s) {
    if (Date.now() - lastShown > 60_000) i = (i + 1) % THINGS.length;   // a new one each time it comes round
    lastShown = Date.now();
    const t = THINGS[i](s.now.kw);
    return { headline: `Right now: ${t.head(t.n)}`, sub: `${t.sub} The turbine is making <b>${fmt.format(Math.round(s.now.kw))} kW</b>.` };
  },
};
