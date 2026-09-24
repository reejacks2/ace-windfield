// Murmuration: starlings over the reeds, like the winter flocks on the Somerset Levels.
// Many small parts moving as one — the way a community owns a turbine.
//   power      → how many birds are up (a couple of hundred when still, 1,500 at full power)
//   wind speed → how fast and how wide the flock sweeps
//   wind dir   → the flock drifts downwind
//   a rise in power → a dark wave ripples through the flock
import { view, motion as D, world, MOTION, mkCanvas } from './stage.js';
import { paintSky } from './backdrop.js';
import { rgba } from '../lib/palette.js';
import { fbm } from '../lib/noise.js';

const MAX = 1500;

export default {
  name: 'Murmuration',
  init() {
    const { W, H } = view;
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.birds = this.birds && this.W === W && this.H === H ? this.birds : Array.from({ length: MAX }, () => ({
      x: W * (0.3 + 0.4 * Math.random()), y: H * (0.25 + 0.25 * Math.random()),
      vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, up: 0,
    }));
    this.W = W; this.H = H;
    this.lastKw = D.kw; this.waves = [];
    this.reeds = Array.from({ length: Math.round(W / (5 * view.DPR)) }, (_, i) => ({ x: i / (W / (5 * view.DPR)) * W, h: 0.4 + Math.random() * 0.6, ph: Math.random() * 6.28 }));
  },

  update(dt, t) {
    const { W, H, DPR } = view, g = this.g, sky = world.sky;
    if (!sky) return;
    this.frame = (this.frame || 0) + 1;
    const horizon = H - 62 * DPR;                    // reeds live below the copy, just above the ribbon
    paintSky(g, sky, horizon, t);

    // the flock's wandering centre: a slow loop across the sky, pushed downwind
    const reach = 0.18 + 0.2 * D.w;
    const cx = W * (0.5 + reach * (fbm(t * 0.05, 1.3, 0) - 0.5) * 2 + 0.08 * D.vx);
    const cy = H * (0.36 + 0.08 * (fbm(t * 0.06, 7.1, 2) - 0.5) * 2);

    // a jump in power sends a wave through the flock from its leading edge
    if (D.kw - this.lastKw > 60 && this.waves.length < 3) this.waves.push({ r: 0, x: cx - W * 0.2 * Math.sign(D.vx || 1), y: cy });
    this.lastKw = D.kw;
    for (const w of this.waves) w.r += W * 0.35 * dt;
    this.waves = this.waves.filter(w => w.r < W * 1.2);

    const active = Math.round(180 + (MAX - 180) * Math.min(1, D.p * 1.15));
    // the flock's body: a soft ball that grows with the flock and the wind; a slow roll inside it
    const R0 = Math.min(W, H) * (0.16 + 0.12 * D.w) * Math.sqrt(active / MAX + 0.1);
    const swirl = Math.sin(t * 0.23) * (0.15 + 0.2 * D.w);
    const spring = 0.4 - 0.34 * Math.min(1, D.p * 1.2), flow = (200 + 260 * D.w) * (0.35 + 0.65 * Math.min(1, D.p * 1.2));   // big, loose flocks when it's blowing
    const speed = (70 + 190 * D.w) * DPR * MOTION, cell = 26 * DPR;
    const grid = new Map(), key = (x, y) => ((x / cell) | 0) * 4096 + ((y / cell) | 0);
    for (let i = 0; i < active; i++) {
      const b = this.birds[i], k = key(b.x, b.y);
      let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(b);
    }

    const ink = sky.daylight > 0.35 ? [16, 18, 24] : [214, 220, 232];
    const calm = new Path2D(), bank = new Path2D();
    for (let i = 0; i < MAX; i++) {
      const b = this.birds[i], flying = i < active;
      b.up += ((flying ? 1 : 0) - b.up) * Math.min(1, dt * 0.8);
      if (b.up < 0.02 && !flying) continue;
      let ax = 0, ay = 0;
      if (flying) {
        // separation, alignment, cohesion over the 3×3 neighbourhood — each bird re-reads its
        // neighbours on alternate frames (and keeps the last answer between), halving the cost
        if ((i + this.frame) % 2 === 0) {
        let n = 0, sx = 0, sy = 0, avx = 0, avy = 0, mx = 0, my = 0;
        const gx = (b.x / cell) | 0, gy = (b.y / cell) | 0;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const list = grid.get((gx + ox) * 4096 + (gy + oy)); if (!list) continue;
          for (const o of list) {
            if (o === b) continue;
            const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 > cell * cell) continue;
            n++; avx += o.vx; avy += o.vy; mx += o.x; my += o.y;
            if (d2 < 196 * DPR * DPR) { sx -= dx; sy -= dy; }
            if (n > 8) break;
          }
        }
        b.fx = b.fy = 0;
        if (n) {
          b.fx = (avx / n - b.vx) * 1.6 + (mx / n - b.x) * 0.5 + sx * 12;
          b.fy = (avy / n - b.vy) * 1.6 + (my / n - b.y) * 0.5 + sy * 12;
        }
        }
        ax += b.fx || 0; ay += b.fy || 0;
        const dx = cx - b.x, dy = cy - b.y, dist = Math.hypot(dx, dy) || 1;
        ax += dx * spring; ay += dy * spring * 1.3;                         // a gentle spring to the centre fills the shape
        if (dist > R0) { const f = (dist - R0) * 2.0 / dist; ax += dx * f; ay += dy * f; }   // firmer past the edge
        ax += -dy * swirl; ay += dx * swirl * 0.6;                          // a slow roll
        // a coherent flow field shears the body into folding sheets
        const ang = fbm(b.x * 0.0025 / DPR, b.y * 0.0025 / DPR, t * 0.12) * 12.57;
        ax += Math.cos(ang) * flow * DPR; ay += Math.sin(ang) * flow * 0.45 * DPR;
      } else {
        ax -= b.vx * 0.8; ay += (horizon + 6 * DPR - b.y) * 2;             // settle into the reeds
      }
      b.vx += ax * dt; b.vy += ay * dt;
      const v = Math.hypot(b.vx, b.vy) || 1, cap = flying ? speed : speed * 0.4;
      if (v > cap) { b.vx *= cap / v; b.vy *= cap / v; }
      else if (flying && v < cap * 0.3) { b.vx *= cap * 0.3 / v; b.vy *= cap * 0.3 / v; }   // starlings never hover
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -40) b.x += W + 80; if (b.x > W + 40) b.x -= W + 80;

      // wave: birds on the front bank at once, showing more wing — darker and larger
      let wing = 0;
      for (const w of this.waves) { const d = Math.abs(Math.hypot(b.x - w.x, b.y - w.y) - w.r); if (d < 30 * DPR) wing = 1; }
      const vv = Math.hypot(b.vx, b.vy) || 1, len = 2.6 * DPR * b.up;
      const path = wing ? bank : calm;
      path.moveTo(b.x - b.vx / vv * len, b.y - b.vy / vv * len); path.lineTo(b.x + b.vx / vv * len, b.y + b.vy / vv * len);
    }
    g.lineCap = 'round'; g.strokeStyle = rgba(ink, 0.85);
    g.lineWidth = 1.5 * DPR; g.stroke(calm);
    g.lineWidth = 2.4 * DPR; g.stroke(bank);

    // reeds along the bottom, bending downwind
    g.strokeStyle = rgba(sky.daylight > 0.35 ? [20, 26, 30] : [8, 11, 16], 1); g.lineWidth = 1.4 * DPR;
    g.fillStyle = rgba(sky.daylight > 0.35 ? [20, 26, 30] : [8, 11, 16], 1); g.fillRect(0, horizon + 10 * DPR, W, H - horizon);
    const bend = D.vx * (0.15 + 0.5 * D.w);
    g.beginPath();
    for (const r of this.reeds) {
      const len = (14 + 24 * r.h) * DPR, sway = bend + Math.sin(t * (1 + 3 * D.w) + r.ph) * 0.08 * (0.3 + D.w);
      g.moveTo(r.x, horizon + 12 * DPR); g.quadraticCurveTo(r.x + sway * len * 0.3, horizon + 12 * DPR - len * 0.6, r.x + sway * len, horizon + 12 * DPR - len);
    }
    g.stroke();
  },
};
