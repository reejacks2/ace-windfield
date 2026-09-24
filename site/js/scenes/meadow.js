// Meadow: grasses bending in the wind, under a sun that brightens with power.
import { view, motion as D, world, MOTION, mkCanvas, BG } from './stage.js';
import { pal, rgba } from '../lib/palette.js';
import { lerp } from '../lib/noise.js';

export default {
  name: 'Meadow',
  init() {
    const { W, H, DPR } = view;
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.rows = [];
    const rowsN = 7;
    for (let r = 0; r < rowsN; r++) {
      const depth = r/(rowsN-1);            // 0 back, 1 front
      const count = Math.round(lerp(90, 34, depth) * (W/(1400*DPR)) + 20);
      const blades = [];
      for (let i = 0; i < count; i++) blades.push({ x: (i+Math.random()*0.9)/count*W*1.06 - W*0.03, len: lerp(0.18, 0.62, depth)*H*(0.7+0.6*Math.random()), ph: Math.random()*6.28, k: 0.7+0.6*Math.random() });
      this.rows.push({ depth, blades, base: H - lerp(0.30, 0.08, depth)*H });
    }
  },
  update(dt, t) {
    const { W, H, DPR } = view, g = this.g;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, H);
    // the real sky's colours, warmed by the power being made
    const real = world.sky, tint = pal(0.1 + D.p*0.7), mix = (a, b, u) => a.map((v, i) => v + (b[i]-v)*u);
    const top = real ? real.zenith : [22, 33, 49], mid = mix(real ? real.horizon : [40, 60, 80], [tint[0]*0.7, tint[1]*0.7, tint[2]*0.75], 0.35);
    sky.addColorStop(0, rgba(top, 1));
    sky.addColorStop(0.55, rgba(mid, 1));
    sky.addColorStop(1, BG);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // low sun — brightness grows with power
    const sunR = (0.10 + 0.18*D.p)*Math.min(W, H);
    const sx = W*0.68, sy = H*0.40;
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, sunR*2.6);
    const sc = pal(Math.min(1, D.p+0.35));
    sun.addColorStop(0, rgba(sc, 0.55+0.4*D.p)); sun.addColorStop(0.25, rgba(sc, 0.18)); sun.addColorStop(1, rgba(sc, 0));
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    // grasses
    const lean = D.vx * (0.25 + 1.1*D.w);       // direction-aware lean
    const gust = (0.02 + 0.10*D.w) * MOTION;
    const freq = 0.9 + 3.2*D.w;
    g.lineCap = 'round';
    for (const row of this.rows) {
      const d = row.depth;
      const col = pal(0.12 + D.p*0.8 + d*0.12);
      const dark = [col[0]*(0.25+0.35*d), col[1]*(0.25+0.35*d), col[2]*(0.3+0.35*d)];
      g.lineWidth = lerp(1.2, 3.2, d)*DPR;
      for (const b of row.blades) {
        const sway = Math.sin(t*freq*b.k + b.ph + b.x*0.004/DPR) * gust + Math.sin(t*freq*2.3 + b.ph*2)*gust*0.3;
        const bend = (lean + sway) * b.len;
        const x0 = b.x, y0 = row.base, x2 = x0 + bend, y2 = y0 - b.len*(1 - 0.35*Math.abs(lean+sway));
        const grad = g.createLinearGradient(x0, y0, x2, y2);
        grad.addColorStop(0, rgba(dark, 1)); grad.addColorStop(1, rgba(col, 0.7+0.3*d));
        g.strokeStyle = grad;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + bend*0.25, y0 - b.len*0.55, x2, y2); g.stroke();
      }
    }
  },
};
