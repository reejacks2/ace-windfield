// Mosaic: the pixel field, flowing downwind in quantised bands.
import { view, motion as D, MOTION, mkCanvas } from './stage.js';
import { pal } from '../lib/palette.js';
import { fbm } from '../lib/noise.js';

export default {
  name: 'Mosaic',
  init() {
    this.c = mkCanvas(); this.g = this.c.getContext('2d'); this.g.imageSmoothingEnabled = false;
    const cell = (innerWidth < 700 ? 9 : 12);
    this.cols = Math.ceil(innerWidth/cell); this.rows = Math.ceil(innerHeight/cell);
    this.off = document.createElement('canvas'); this.off.width = this.cols; this.off.height = this.rows;
    this.og = this.off.getContext('2d'); this.img = this.og.createImageData(this.cols, this.rows);
    this.dx = 0; this.dy = 0;
  },
  update(dt, t) {
    const px = this.img.data, cols = this.cols, rows = this.rows;
    const speed = MOTION*(0.4 + 6*D.w);
    this.dx += D.vx*speed*dt; this.dy += D.vy*speed*dt;
    const z = t*0.08*(1+3*D.w), gust = 0.35+0.65*D.w, levels = 7, sc = 0.055;
    const base = pal(D.p), lit = pal(Math.min(1, D.p+0.22)), dark = pal(Math.max(0, D.p-0.18));
    let i = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let n = fbm((x-this.dx)*sc, (y-this.dy)*sc, z);
      n = 0.5 + (n-0.5)*(0.8+1.6*gust); n = n < 0 ? 0 : n > 1 ? 1 : n; n = Math.round(n*(levels-1))/(levels-1);
      let r, g, b;
      if (n < 0.5) { const u = n*2; r = dark[0]+(base[0]-dark[0])*u; g = dark[1]+(base[1]-dark[1])*u; b = dark[2]+(base[2]-dark[2])*u; }
      else { const u = n*2-1; r = base[0]+(lit[0]-base[0])*u; g = base[1]+(lit[1]-base[1])*u; b = base[2]+(lit[2]-base[2])*u; }
      px[i++] = r; px[i++] = g; px[i++] = b; px[i++] = 255;
    }
    this.og.putImageData(this.img, 0, 0);
    this.g.imageSmoothingEnabled = false;
    this.g.drawImage(this.off, 0, 0, view.W, view.H);
  },
};
