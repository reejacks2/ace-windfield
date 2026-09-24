// Bloom: a rotor mandala, rings turning with the wind, ringed by a ten-minute power dial.
import { view, motion as D, MOTION, mkCanvas, BG } from './stage.js';
import { pal, rgba } from '../lib/palette.js';
import { state } from '../data/store.js';
import { NOMINAL_KW, HISTORY } from '../config.js';

export default {
  name: 'Bloom',
  init() {
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.g.fillStyle = BG; this.g.fillRect(0, 0, view.W, view.H);
    this.rot = 0;
  },
  update(dt, t) {
    const { W, H, DPR } = view, g = this.g, history = state.history;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(15,20,27,0.16)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const cx = W*0.5, cy = H*0.47, R = Math.min(W, H)*0.40;
    const rpm = 2 + 12*D.w;                       // visual rotor speed
    this.rot += rpm/60 * 6.283 * dt * MOTION;
    const rings = 11;
    for (let k = 0; k < rings; k++) {
      const f = k/(rings-1);
      const r = R*(0.12 + 0.88*f) * (0.8 + 0.2*D.p);
      const c = pal(D.p + (f-0.5)*0.35);
      const dirSign = k%2 ? -1 : 1;
      const ang = this.rot*(1 + f*0.8)*dirSign + Math.atan2(D.vy, D.vx)*f;
      const blades = 3;
      g.lineWidth = (2 + 10*(1-f)*(0.3+D.p))*DPR; g.lineCap = 'round';
      g.strokeStyle = rgba(c, 0.22 + 0.22*(1-f)*(0.5+D.p));
      for (let b = 0; b < blades; b++) {
        const a0 = ang + b*6.283/blades, span = 0.55 + 0.9*D.w*(1-f) + 0.25*Math.sin(t*0.7+k);
        g.beginPath(); g.arc(cx, cy, r, a0, a0+span); g.stroke();
      }
    }
    // hub glow
    const hub = g.createRadialGradient(cx, cy, 0, cx, cy, R*0.35);
    const hc = pal(Math.min(1, D.p+0.3));
    hub.addColorStop(0, rgba(hc, 0.12+0.28*D.p)); hub.addColorStop(1, rgba(hc, 0));
    g.fillStyle = hub; g.fillRect(cx-R, cy-R, 2*R, 2*R);
    // ten-minute dial around the outside
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 2*DPR;
    for (let i = 0; i < 180; i++) {
      const a = Math.floor(i/180*HISTORY), b = Math.floor((i+1)/180*HISTORY);
      let s = 0, n = 0; for (let j = a; j < b; j++) { const v = history[j]; if (v != null) { s += v; n++; } }
      if (!n) continue;
      const hp = Math.min(1, s/n/NOMINAL_KW), ang = -Math.PI/2 + i/180*6.283;
      const r0 = R*1.04, r1 = r0 + R*0.14*hp + 2*DPR;
      g.strokeStyle = rgba(pal(hp), 0.35 + 0.5*hp);
      g.beginPath(); g.moveTo(cx+Math.cos(ang)*r0, cy+Math.sin(ang)*r0); g.lineTo(cx+Math.cos(ang)*r1, cy+Math.sin(ang)*r1); g.stroke();
    }
  },
};
