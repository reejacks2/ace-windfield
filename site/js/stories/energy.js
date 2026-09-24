// Today's energy (since Bristol midnight) and, once ACE confirms a price, earnings.
import { PRICE_GBP_PER_MWH } from '../config.js';
import { fmt, energy, homeDays, fresh } from './format.js';

export default {
  id: 'energy',
  ready: s => fresh(s.today, 30) && s.today.kwh > 0,
  render(s) {
    const kwh = s.today.kwh;
    const money = PRICE_GBP_PER_MWH
      ? ` Worth about <b>£${fmt.format(Math.round(kwh / 1000 * PRICE_GBP_PER_MWH))}</b> to the community.` : '';
    return {
      headline: `Today so far: ${energy(kwh)}`,
      sub: `That’s a day’s electricity for about <b>${fmt.format(homeDays(kwh))} homes</b>.${money}`,
    };
  },
};
