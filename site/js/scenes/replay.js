// Replay: the last 60 days as a 24-hour clock. Each ring is a day (oldest at the centre),
// midnight at the top, and every 10-minute cell is coloured by the power made. Where the wind
// offered much more than was made (curtailment, faults), an ember tick marks the gap.
// While it plays, the scenes' motion follows the replayed wind and power, and the caption
// replaces the rotating stories.
import { view, stageInfo, mkCanvas, BG } from './stage.js';
import { pal, rgba } from '../lib/palette.js';
import { londonMidnight, TZ_FMT } from '../lib/time.js';
import { state } from '../data/store.js';
import { NOMINAL_KW, HOME_KW } from '../config.js';

const PLAY_SECONDS = 34, HOLD_SECONDS = 6;
const GAP_KW = 300;
const fmtDay = new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, weekday: 'short', day: 'numeric', month: 'long' });
const fmtMonth = new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, month: 'short' });
const fmtTime = new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, hour: '2-digit', minute: '2-digit' });
const fmtN = new Intl.NumberFormat('en-GB');
const dayOfMonth = t => +new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, day: 'numeric' }).format(t);

export default {
  name: 'Replay',
  seconds: PLAY_SECONDS + HOLD_SECONDS,
  ready: () => !!state.replay,
  init() {
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.g.fillStyle = BG; this.g.fillRect(0, 0, view.W, view.H);
    this.drawn = 0; this.clock = 0; this.mwh = 0; this.gapMwh = 0; this.captionAt = -1;
    const r = state.replay;
    if (!r) return;
    this.r = r;
    this.day0 = londonMidnight(new Date(r.t0)).getTime();
    this.days = Math.ceil((r.t0 + r.kw.length * r.step - this.day0) / 864e5);
  },
  end() { stageInfo.caption = null; },

  geometry() {
    const { W, H } = view, portrait = H > W;
    // clear of the odometer above and the ribbon below
    const cx = W * (portrait ? 0.5 : 0.64), cy = H * (portrait ? 0.40 : 0.51);
    const R = Math.min(W, H) * (portrait ? 0.40 : 0.355), r0 = R * 0.2;
    return { cx, cy, R, r0, ring: (R - r0) / Math.max(1, this.days) };
  },

  cell(i) {                                              // → { d, frac } for record i
    const t = this.r.t0 + i * this.r.step, since = t - this.day0;
    return { t, d: Math.floor(since / 864e5), frac: (since % 864e5) / 864e5 };
  },

  // What the rest of the stage should feel: the replayed wind and power.
  override() {
    if (!this.r || !this.drawn) return null;
    const i = Math.min(this.drawn, this.r.kw.length) - 1, kw = this.r.kw[i], w = this.r.wind[i];
    return Number.isFinite(kw) ? { kw: Math.max(0, kw), wind: Number.isFinite(w) ? w : 0, avail: this.r.avail[i] } : null;
  },

  update(dt) {
    if (!this.r) return;
    const { DPR } = view, g = this.g, n = this.r.kw.length, G = this.geometry();
    this.clock += dt;
    const target = Math.min(n, Math.floor(n * Math.min(1, this.clock / PLAY_SECONDS)));
    const dA = 6.2832 / 144;
    for (let i = this.drawn; i < target; i++) {
      const kw = this.r.kw[i], av = this.r.avail[i];
      if (!Number.isFinite(kw)) continue;
      const { d, frac } = this.cell(i);
      const a = -Math.PI / 2 + frac * 6.2832, rIn = G.r0 + d * G.ring, rOut = rIn + G.ring * 0.86;
      const p = Math.max(0, kw) / NOMINAL_KW;
      g.strokeStyle = rgba(pal(p), p < 0.01 ? 0.18 : 0.35 + 0.65 * Math.min(1, p * 1.6));
      g.lineWidth = rOut - rIn;
      g.beginPath(); g.arc(G.cx, G.cy, (rIn + rOut) / 2, a, a + dA * 1.04); g.stroke();
      if (Number.isFinite(av) && av - kw > GAP_KW) {
        g.strokeStyle = 'rgba(255,120,60,0.9)'; g.lineWidth = Math.max(1, G.ring * 0.22);
        g.beginPath(); g.arc(G.cx, G.cy, rOut + G.ring * 0.05, a, a + dA * 1.04); g.stroke();
        this.gapMwh += (av - kw) / 6 / 1000;
      }
      this.mwh += Math.max(0, kw) / 6 / 1000;
      if (frac === 0 && (d === 0 || dayOfMonth(this.cell(i).t) === 1)) this.monthLabel(g, G, d, i);
    }
    this.drawn = Math.max(this.drawn, target);

    // clock face marks: midnight / 6 / noon / 18
    if (this.clock < 0.1) {
      g.fillStyle = 'rgba(247,241,231,0.5)'; g.font = `${11 * DPR}px "Atkinson Hyperlegible", sans-serif`; g.textAlign = 'center';
      [['00', 0], ['06', 0.25], ['12', 0.5], ['18', 0.75]].forEach(([s, f]) => {
        const a = -Math.PI / 2 + f * 6.2832;
        g.fillText(s, G.cx + Math.cos(a) * (G.R + 16 * DPR), G.cy + Math.sin(a) * (G.R + 16 * DPR) + 4 * DPR);
      });
    }
    this.caption();
  },

  monthLabel(g, G, d, i) {
    const { DPR } = view;
    g.fillStyle = 'rgba(247,241,231,0.55)'; g.font = `${10 * DPR}px "Atkinson Hyperlegible", sans-serif`; g.textAlign = 'right';
    g.fillText(fmtMonth.format(this.cell(i).t), G.cx - 6 * DPR, G.cy - (G.r0 + d * G.ring) + 3 * DPR);
  },

  caption() {
    const i = Math.max(0, Math.min(this.drawn, this.r.kw.length) - 1);
    if (this.clock - this.captionAt < 0.2) return;
    this.captionAt = this.clock;
    const t = this.r.t0 + i * this.r.step, kw = this.r.kw[i];
    if (this.drawn >= this.r.kw.length) {
      const homes = Math.round(this.mwh * 1000 / (HOME_KW * 24 * 365));
      stageInfo.caption = {
        headline: `<span class="num">${fmtN.format(Math.round(this.mwh))}</span>&nbsp;MWh in ${this.days} days`,
        sub: `Each ring is a day, midnight at the top. Enough for about <b>${fmtN.format(homes)} homes for a year</b>`
           + (this.gapMwh >= 1 ? `; the orange ticks mark <b>${fmtN.format(Math.round(this.gapMwh))} MWh</b> the wind offered but didn’t become power.` : '.'),
      };
      return;
    }
    stageInfo.caption = {
      headline: fmtDay.format(t),
      sub: Number.isFinite(kw)
        ? `${fmtTime.format(t)} · <b>${fmtN.format(Math.max(0, Math.round(kw)))} kW</b> · replaying the last ${this.days} days`
        : `${fmtTime.format(t)} · no data · replaying the last ${this.days} days`,
    };
  },
};
