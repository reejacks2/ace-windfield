// Scene rotation, crossfade, and the shared power ribbon.
// A scene is { name, init(), update(dt, t), c } — it draws into its own canvas `c`.
import { view, motion, BG } from './stage.js';
import { pal, rgba } from '../lib/palette.js';
import { state } from '../data/store.js';
import { NOMINAL_KW, HISTORY, SCENE_SECONDS, FADE_SECONDS } from '../config.js';
import Silk from './silk.js';
import Meadow from './meadow.js';
import Bloom from './bloom.js';
import Drift from './drift.js';
import Mosaic from './mosaic.js';

const SCENES = [Silk, Meadow, Bloom, Drift, Mosaic];

export function startScenes(stage, nameEl) {
  const ctx = stage.getContext('2d', { alpha: false });
  let cur = 0, next = -1, fadeT = 0, sceneClock = 0;

  function resize() {
    view.DPR = Math.min(2, devicePixelRatio || 1);
    view.W = Math.round(innerWidth*view.DPR); view.H = Math.round(innerHeight*view.DPR);
    stage.width = view.W; stage.height = view.H;
    SCENES[cur].init();
    if (next >= 0) SCENES[next].init();
  }
  addEventListener('resize', resize, { passive: true });
  resize();
  nameEl.textContent = SCENES[cur].name;

  function ease(dt) {
    const k = 1-Math.pow(0.03, dt), n = state.now, D = motion;
    D.kw += (n.kw-D.kw)*k; D.wind += (n.wind-D.wind)*k;
    const dd = ((n.dir - D.dir + 540)%360)-180; D.dir += dd*k;
    D.p = Math.max(0, Math.min(1, D.kw/NOMINAL_KW)); D.w = Math.max(0, Math.min(1, D.wind/20));
    const th = (D.dir+180)*Math.PI/180; D.vx = Math.sin(th); D.vy = -Math.cos(th);
  }

  function drawRibbon() {
    const { W, H, DPR } = view, history = state.history;
    const h = Math.max(18*DPR, H*0.055), top = H - h - 22*DPR;
    const cols = Math.min(HISTORY, Math.floor(W/(4*DPR)));
    const cw = W/cols;
    for (let x = 0; x < cols; x++) {
      const a = Math.floor(x/cols*HISTORY), b = Math.floor((x+1)/cols*HISTORY);
      let s = 0, n = 0; for (let j = a; j < b; j++) { const v = history[j]; if (v != null) { s += v; n++; } }
      if (!n) { ctx.fillStyle = 'rgba(247,241,231,0.06)'; ctx.fillRect(x*cw, top+h-2*DPR, cw-1, 2*DPR); continue; }
      const hp = Math.min(1, s/n/NOMINAL_KW), bh = Math.max(2*DPR, hp*h);
      ctx.fillStyle = rgba(pal(hp), 0.85);
      ctx.fillRect(x*cw, top+h-bh, cw-1, bh);
    }
  }

  let t0 = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now-t0)/1000); t0 = now; const t = now/1000;
    ease(dt);
    sceneClock += dt;
    if (next < 0 && sceneClock >= SCENE_SECONDS) {
      next = (cur+1)%SCENES.length; fadeT = 0; SCENES[next].init(); nameEl.style.opacity = 0;
    }
    SCENES[cur].update(dt, t);
    if (next >= 0) {
      SCENES[next].update(dt, t);
      fadeT += dt/FADE_SECONDS;
      if (fadeT >= 1) {
        cur = next; next = -1; sceneClock = 0; nameEl.textContent = SCENES[cur].name; nameEl.style.opacity = 1;
      }
    }
    ctx.fillStyle = BG; ctx.globalAlpha = 1; ctx.drawImage(SCENES[cur].c, 0, 0);
    if (next >= 0) {
      const e = fadeT < 0.5 ? 2*fadeT*fadeT : 1-Math.pow(-2*fadeT+2, 2)/2;
      ctx.globalAlpha = e; ctx.drawImage(SCENES[next].c, 0, 0); ctx.globalAlpha = 1;
    }
    drawRibbon();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
