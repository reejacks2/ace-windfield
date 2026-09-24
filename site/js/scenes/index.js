// Scene rotation, real-sky compositing, crossfade, and the shared power ribbon.
// A scene is { name, init(), update(dt, t), c, seconds?, ready?(), override?(), end?() } and
// draws into its own canvas `c`. How it meets the sky is set in BLEND below:
//   own    — paints its own sky (Murmuration, Meadow), or is a map or chart (Lights, Replay)
//   screen — light marks on dark: the real sky shows through the dark (Silk, Bloom, Drift)
//   tint   — a full-colour field washed with the sky's light (Mosaic)
import { view, motion, world, stageInfo, mkCanvas } from './stage.js';
import { paintSky } from './backdrop.js';
import { pal, rgba } from '../lib/palette.js';
import { skyNow } from '../lib/sky.js';
import { state } from '../data/store.js';
import { NOMINAL_KW, HISTORY, SCENE_SECONDS, FADE_SECONDS, PIN_SCENE } from '../config.js';
import Lights from './lights.js';
import Murmuration from './murmuration.js';
import Silk from './silk.js';
import Meadow from './meadow.js';
import Replay from './replay.js';
import Bloom from './bloom.js';
import Drift from './drift.js';
import Mosaic from './mosaic.js';

const BLEND = new Map([[Lights, 'own'], [Murmuration, 'own'], [Meadow, 'own'], [Replay, 'own'], [Silk, 'screen'], [Bloom, 'screen'], [Drift, 'screen'], [Mosaic, 'tint']]);
// Lights comes back between the others: it's the one about what the turbine does for people.
const ORDER = [Lights, Murmuration, Silk, Lights, Replay, Meadow, Lights, Murmuration, Bloom, Lights, Drift, Mosaic];
const BY_NAME = Object.fromEntries([...BLEND.keys()].map(s => [s.name.toLowerCase().replace(/\s+/g, '-'), s]));

export function startScenes(stage, nameEl) {
  const ctx = stage.getContext('2d', { alpha: false });
  const pinned = BY_NAME[PIN_SCENE];
  let slot = 0, cur = pinned || ORDER[0], next = null, fadeT = 0, sceneClock = 0;
  let skyLayer = null, dimLayer = null, skyAt = 0, layerA = null, layerB = null;

  function refreshSky(force) {
    const now = Date.now();
    if (!force && now - skyAt < 5000) return;
    skyAt = now; world.sky = skyNow(now);
    const g = skyLayer.getContext('2d');
    paintSky(g, world.sky, view.H * 0.8);
    // The art scenes get the same sky, dimmed, so light strokes keep their glow in daylight.
    const d = dimLayer.getContext('2d');
    d.drawImage(skyLayer, 0, 0);
    d.fillStyle = `rgba(6,9,14,${0.35 + 0.35 * world.sky.daylight})`; d.fillRect(0, 0, view.W, view.H);
  }

  function resize() {
    view.DPR = Math.min(2, devicePixelRatio || 1);
    view.W = Math.round(innerWidth*view.DPR); view.H = Math.round(innerHeight*view.DPR);
    stage.width = view.W; stage.height = view.H;
    skyLayer = mkCanvas(); dimLayer = mkCanvas(); layerA = mkCanvas(); layerB = mkCanvas();
    refreshSky(true);
    cur.init(); if (next) next.init();
  }
  addEventListener('resize', resize, { passive: true });
  resize();

  function pickNext() {
    for (let i = 1; i <= ORDER.length; i++) {
      const s = ORDER[(slot + i) % ORDER.length];
      if (s !== cur && (!s.ready || s.ready())) { slot = (slot + i) % ORDER.length; return s; }
    }
    return cur;
  }

  // Ease toward the live reading — or, while a scene overrides (the replay), toward its values.
  function ease(dt) {
    const o = (next && fadeT > 0.5 ? next : cur).override?.();
    const n = o ? { ...state.now, ...o } : state.now, D = motion;
    const k = 1-Math.pow(0.03, dt);
    D.kw += (n.kw-D.kw)*k; D.wind += (n.wind-D.wind)*k; D.avail += ((n.avail ?? n.kw)-D.avail)*k;
    const dd = ((n.dir - D.dir + 540)%360)-180; D.dir += dd*k;
    const dy = ((n.yaw - D.yaw + 540)%360)-180; D.yaw += dy*(1-Math.pow(0.2, dt));   // yaw is slow in life too
    D.rpm += (n.rpm - D.rpm)*(1-Math.pow(0.1, dt));
    D.p = Math.max(0, Math.min(1, D.kw/NOMINAL_KW)); D.w = Math.max(0, Math.min(1, D.wind/20));
    const th = (D.dir+180)*Math.PI/180; D.vx = Math.sin(th); D.vy = -Math.cos(th);
  }

  function compose(scene, g) {
    const mode = BLEND.get(scene);
    if (mode === 'own') { g.drawImage(scene.c, 0, 0); return; }
    if (mode === 'screen') {
      g.drawImage(dimLayer, 0, 0);
      g.globalCompositeOperation = 'screen'; g.drawImage(scene.c, 0, 0);
    } else {
      g.drawImage(scene.c, 0, 0);
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.85; g.drawImage(dimLayer, 0, 0);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  // Solid bars = power made; the pale outline above = what the wind offered. The space between
  // is energy the wind had but the turbine didn't make (curtailment, faults, ramping).
  function drawRibbon() {
    const { W, H, DPR } = view, history = state.history, ghost = state.ghost;
    const h = Math.max(18*DPR, H*0.055), top = H - h - 22*DPR;
    const cols = Math.min(HISTORY, Math.floor(W/(4*DPR)));
    const cw = W/cols;
    let prevGy = null;
    for (let x = 0; x < cols; x++) {
      const a = Math.floor(x/cols*HISTORY), b = Math.floor((x+1)/cols*HISTORY);
      let s = 0, n = 0, gs = 0, gn = 0;
      for (let j = a; j < b; j++) {
        const v = history[j]; if (v != null) { s += v; n++; }
        const q = ghost[j]; if (q != null) { gs += q; gn++; }
      }
      if (!n) { ctx.fillStyle = 'rgba(247,241,231,0.06)'; ctx.fillRect(x*cw, top+h-2*DPR, cw-1, 2*DPR); prevGy = null; continue; }
      const hp = Math.min(1, Math.max(0, s/n)/NOMINAL_KW), bh = Math.max(2*DPR, hp*h);
      if (gn) {
        const gp = Math.min(1, Math.max(0, gs/gn)/NOMINAL_KW), gh = Math.max(2*DPR, gp*h), gy = top+h-gh;
        if (gh > bh + DPR) {                               // the gap: faint ember wash
          ctx.fillStyle = 'rgba(255,138,61,0.16)'; ctx.fillRect(x*cw, gy, cw-1, gh-bh);
        }
        ctx.strokeStyle = 'rgba(247,241,231,0.55)'; ctx.lineWidth = 1.2*DPR;   // the outline
        ctx.beginPath(); ctx.moveTo(x*cw, prevGy ?? gy); ctx.lineTo(x*cw, gy); ctx.lineTo((x+1)*cw, gy); ctx.stroke();
        prevGy = gy;
      }
      ctx.fillStyle = rgba(pal(hp), 0.85);
      ctx.fillRect(x*cw, top+h-bh, cw-1, bh);
    }
  }

  let t0 = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now-t0)/1000); t0 = now; const t = now/1000;
    refreshSky(false);
    ease(dt);
    sceneClock += dt;
    if (!pinned && !next && sceneClock >= (cur.seconds || SCENE_SECONDS)) {
      const n = pickNext();
      if (n !== cur) { next = n; fadeT = 0; next.init(); nameEl.style.opacity = 0; }
      else sceneClock = 0;
    }
    cur.update(dt, t);
    if (next) {
      next.update(dt, t);
      fadeT += dt/FADE_SECONDS;
      if (fadeT >= 1) { cur.end?.(); cur = next; next = null; sceneClock = 0; nameEl.style.opacity = 1; }
    }
    if (!next) compose(cur, ctx);
    else {
      const ga = layerA.getContext('2d'), gb = layerB.getContext('2d');
      compose(cur, ga); compose(next, gb);
      const e = fadeT < 0.5 ? 2*fadeT*fadeT : 1-Math.pow(-2*fadeT+2, 2)/2;
      ctx.globalAlpha = 1; ctx.drawImage(layerA, 0, 0);
      ctx.globalAlpha = e; ctx.drawImage(layerB, 0, 0); ctx.globalAlpha = 1;
    }
    drawRibbon();
    const label = cur.name + (cur.detail && stageInfo.detail ? ` — ${stageInfo.detail}` : '');
    if (nameEl.textContent !== label) nameEl.textContent = label;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
