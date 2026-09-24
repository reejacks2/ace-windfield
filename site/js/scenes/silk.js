// Silk: streamlines flowing with the wind.
import { view, motion as D, MOTION, mkCanvas, BG } from './stage.js';
import { pal, rgba } from '../lib/palette.js';
import { fbm } from '../lib/noise.js';

export default {
  name: 'Silk',
  init() {
    const { W, H } = view;
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.g.fillStyle = BG; this.g.fillRect(0, 0, W, H);
    const n = Math.round(Math.min(2400, W*H/900));
    this.p = Array.from({ length: n }, () => this.spawn({}));
  },
  spawn(o) { o.x = Math.random()*view.W; o.y = Math.random()*view.H; o.life = 60+Math.random()*180; o.hue = Math.random(); return o; },
  update(dt, t) {
    const { W, H, DPR } = view, g = this.g;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(15,20,27,0.045)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const sp = (18 + 160*D.w) * MOTION * DPR, turb = 1.9 - 1.1*D.w, s = 0.0016/DPR;
    g.lineCap = 'round';
    for (const q of this.p) {
      const n = fbm(q.x*s, q.y*s, t*0.05) - 0.5;
      const a = Math.atan2(D.vy, D.vx) + n*Math.PI*turb;
      const nx = q.x + Math.cos(a)*sp*dt, ny = q.y + Math.sin(a)*sp*dt;
      const c = pal(D.p + (q.hue-0.5)*0.28 + n*0.3);
      g.strokeStyle = rgba(c, 0.18 + 0.26*D.p); g.lineWidth = (0.9 + 1.9*q.hue)*DPR;
      g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(nx, ny); g.stroke();
      q.x = nx; q.y = ny; q.life -= 60*dt;
      if (q.life < 0 || q.x < -10 || q.x > W+10 || q.y < -10 || q.y > H+10) this.spawn(q);
    }
    g.globalCompositeOperation = 'source-over';
  },
};
