// Clearing the air: CO2 kept out of the air by the turbine's power, counted against the South
// West grid's AVERAGE carbon intensity right now (NESO forecast). Average, not marginal — the
// plant a wind turbine actually displaces is usually gas, so this is the cautious figure.
import { fmt, fresh } from './format.js';

export default {
  id: 'air',
  ready: s => fresh(s.carbon, 90) && (s.mode === 'live' || s.mode === 'stale' || s.mode === 'demo'),
  render(s) {
    const g = s.carbon.g, kgPerHour = Math.max(0, s.now.kw) * g / 1000;
    const today = fresh(s.today, 30) ? s.today.kwh * g / 1000 : null;
    if (kgPerHour < 5) return {
      headline: 'Clean air, on hold',
      sub: `The South West grid is running at <b>${fmt.format(g)} g of CO₂</b> per kWh right now. Every kWh the turbine makes displaces some of that${today ? ` — about <b>${fmt.format(Math.round(today))} kg</b> so far today` : ''}.`,
    };
    return {
      headline: `Keeping <span class="num">${fmt.format(Math.round(kgPerHour))}</span>&nbsp;kg of CO₂ an hour out of the air`,
      sub: `At the South West grid’s current mix of <b>${fmt.format(g)} g</b> per kWh${today ? `, about <b>${fmt.format(Math.round(today))} kg</b> so far today` : ''}.`,
    };
  },
};
