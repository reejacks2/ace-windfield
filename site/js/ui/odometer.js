// The lifetime odometer: the turbine's own exported-energy counter (whole kWh, 1 Hz), with the
// tenths filled in from the power being made right now. Never runs ahead of the next real kWh,
// and disappears rather than guessing when the live feed is down.
import { state } from '../data/store.js';
import { TZ_FMT } from '../lib/time.js';

const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const monthYear = d => new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, month: 'long', year: 'numeric' }).format(d);

export function startOdometer(el, numEl, sinceEl) {
  let lastText = '', lastSince = '';
  (function tick() {
    const n = state.now, live = state.mode === 'live' || state.mode === 'stale' || state.mode === 'demo';
    if (n.lifetimeKwh == null || !live) { el.hidden = true; }
    else {
      el.hidden = false;
      const extra = Math.min(0.99, Math.max(0, n.kw) * (Date.now() - n.lifetimeTickAt) / 3.6e6);
      const tenths = Math.floor(extra * 10);
      const text = `${int.format(n.lifetimeKwh)}<span class="tenths">.${tenths}</span>`;
      if (text !== lastText) { numEl.innerHTML = text; lastText = text; }
      const since = state.since ? `kWh made here since ${monthYear(state.since)}` : 'kWh made here so far';
      if (since !== lastSince) { sinceEl.textContent = since; lastSince = since; }
    }
    setTimeout(tick, 100);
  })();
}
