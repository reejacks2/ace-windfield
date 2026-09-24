// Drift: a sky full of seeds carried on the wind.
import { view, motion as D, MOTION, mkCanvas, BG } from './stage.js';
import { pal, rgba } from '../lib/palette.js';

export default {
  name: 'Drift',
  init() {
    const { W, H } = view;
    this.c = mkCanvas(); this.g = this.c.getContext('2d'); this.g.fillStyle = BG; this.g.fillRect(0, 0, W, H);
    const n = Math.round(Math.min(3000, W*H/700));
    this.p = Array.from({ length: n }, () => ({ x: Math.random()*W, y: Math.random()*H, z: Math.random(), ph: Math.random()*6.28 }));
  },
  update(dt, t) {
    const { W, H, DPR } = view, g = this.g;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(15,20,27,0.10)'; g.fillRect(0, 0, W, H);
    // horizon wash
    const wash = g.createLinearGradient(0, H*0.3, 0, H);
    const wc = pal(D.p*0.6); wash.addColorStop(0, 'rgba(0,0,0,0)'); wash.addColorStop(1, rgba([wc[0]*0.4, wc[1]*0.4, wc[2]*0.45], 0.12));
    g.fillStyle = wash; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const base = (12 + 220*D.w) * MOTION * DPR;
    for (const q of this.p) {
      const sp = base*(0.35+0.9*q.z);
      const flutter = Math.sin(t*(1.5+3*D.w) + q.ph) * (4+30*D.w)*DPR;
      const nx = q.x + D.vx*sp*dt + (-D.vy)*flutter*dt, ny = q.y + D.vy*sp*dt + D.vx*flutter*dt + 6*dt*DPR*(1-q.z);
      const c = pal(D.p*0.9 + q.z*0.25);
      const a = 0.22 + 0.6*q.z*(0.45+0.55*D.p);
      g.strokeStyle = rgba(c, a); g.lineWidth = (0.6 + 2.2*q.z)*DPR; g.lineCap = 'round';
      g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(nx, ny); g.stroke();
      q.x = nx; q.y = ny;
      if (q.x < -20) q.x = W+20; if (q.x > W+20) q.x = -20; if (q.y < -20) q.y = H+20; if (q.y > H+20) q.y = -20;
    }
    g.globalCompositeOperation = 'source-over';
  },
};
