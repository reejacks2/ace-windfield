// Weather at hub height. This turbine's precipitation, visibility, humidity and brightness
// sensors aren't fitted (they read 0xFFFF), so this uses temperature, pressure and wind only.
import { compass, fresh } from './format.js';

export default {
  id: 'weather',
  ready: s => fresh(s.hub, 60) && s.hub.hubC != null && (s.mode === 'live' || s.mode === 'stale'),
  render(s) {
    const { hubC, groundC } = s.hub;
    const bits = [];
    if (groundC != null) {
      const d = hubC - groundC;
      bits.push(Math.abs(d) < 1 ? `Same as on the ground` : `<b>${Math.abs(d).toFixed(0)}°</b> ${d < 0 ? 'cooler' : 'warmer'} than on the ground`);
    }
    bits.push(`wind <b>${s.now.wind.toFixed(1)} m/s</b> from the ${compass(s.now.dir)}`);
    const p = fresh(s.today, 30) ? s.today.pressure : null;
    if (p != null) bits.push(`air pressure <b>${Math.round(p)} mbar</b>`);
    const sub = bits.join(', ') + '.';
    return {
      headline: `<span class="num">${hubC.toFixed(0)}</span>&nbsp;°C at the top of the tower`,
      sub: sub[0].toUpperCase() + sub.slice(1),
    };
  },
};
