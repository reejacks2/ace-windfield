// Lights of Lawrence Weston: the neighbourhood's real rooftops (OpenStreetMap), lit home by home
// for as many homes as the turbine is powering right now (kW ÷ HOME_KW). Light arrives from the
// north-west — the Avonmouth side, where the turbine stands — and spreads across the estate;
// pulses of energy run along the streets. When the turbine powers more homes than this map
// holds, the light spills past its edges.
import { view, motion as D, world, stageInfo, mkCanvas } from './stage.js';
import { rgba } from '../lib/palette.js';
import { state } from '../data/store.js';
import { HOME_KW } from '../config.js';

const fmt = new Intl.NumberFormat('en-GB');
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const WARM = [255, 168, 84], WARM_HOT = [255, 214, 150];      // amber windows, hotter as they come fully on
const LEVELS = 6;

let map = null, loading = null;
function load() {
  loading ??= fetch('data/lawrence-weston.json').then(r => r.json()).then(prepare).catch(e => { console.warn('[windfield] map', e); loading = null; });
  return loading;
}

// One-time: parse, compute each home's place in the lighting order.
function prepare(m) {
  const [hx, hy] = m.half, diag = Math.hypot(2 * hx, 2 * hy);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const b = m.buildings.map(a => {
    const homes = a[0], pts = a.slice(1);
    let cx = 0, cy = 0; for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
    cx /= pts.length / 2; cy /= pts.length / 2;
    const fromNW = Math.hypot(cx + hx, cy + hy) / diag;          // entry corner = north-west
    return { homes, pts, order: 0.82 * fromNW + 0.18 * rnd(), glow: 0, rate: 0.6 + 2.4 * rnd(), path: null };
  });
  const homes = b.filter(x => x.homes > 0).sort((a, z) => a.order - z.order);
  let cum = 0; for (const x of homes) { x.before = cum; cum += x.homes; }
  const streets = m.streets.map(a => {
    const cls = a[0], pts = a.slice(1), segs = []; let len = 0;
    for (let i = 2; i < pts.length; i += 2) { const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); segs.push(l); len += l; }
    // travel away from the north-west end, the way the power flows
    const d0 = Math.hypot(pts[0] + hx, pts[1] + hy), d1 = Math.hypot(pts.at(-2) + hx, pts.at(-1) + hy);
    return { cls, pts, segs, len, dir: d0 <= d1 ? 1 : -1 };
  }).filter(s => s.len > 30);
  map = { ...m, all: b, homesList: homes, total: cum, streets };
}

function pointAt(st, s) {                                           // position s metres along a street
  let i = 0; while (i < st.segs.length - 1 && s > st.segs[i]) { s -= st.segs[i]; i++; }
  const u = Math.min(1, s / (st.segs[i] || 1)), p = st.pts;
  return [p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * u, p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * u];
}

export default {
  name: 'Lights of Lawrence Weston',
  detail: true,
  ready: () => { load(); return !!map; },
  init() {
    load();
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.lit = mkCanvas(); this.lg = this.lit.getContext('2d');
    this.glowC = document.createElement('canvas');
    this.glowC.width = Math.max(1, Math.round(view.W / 6)); this.glowC.height = Math.max(1, Math.round(view.H / 6));
    this.base = null; this.pulses = [];
  },

  transform() {
    const { W, H } = view, [hx, hy] = map.half, portrait = H > W;
    const k = Math.max(W / (2 * hx), H / (2 * hy)) * (portrait ? 1.05 : 1.02);
    // landscape: shift the map right a little so the densest streets clear the copy
    const ox = W / 2 + (portrait ? 0 : W * 0.06), oy = H / 2 - (portrait ? H * 0.08 : 0);
    return { k, ox, oy, X: x => ox + x * k, Y: y => oy + y * k };
  },

  trace(g, pts, T) {
    g.moveTo(T.X(pts[0]), T.Y(pts[1]));
    for (let i = 2; i < pts.length; i += 2) g.lineTo(T.X(pts[i]), T.Y(pts[i + 1]));
  },

  paintBase(sky, T) {
    const { W, H, DPR } = view;
    const base = this.base = mkCanvas(), g = base.getContext('2d');
    const day = sky?.daylight ?? 0;
    const ground = mix([7, 10, 16], [26, 33, 44], day), roof = mix([18, 24, 34], [44, 52, 64], day);
    g.fillStyle = rgba(ground, 1); g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const st of map.streets) {
      g.strokeStyle = `rgba(150,170,200,${0.08 + 0.05 * st.cls})`; g.lineWidth = (0.8 + 1.4 * st.cls) * DPR * Math.min(1.6, T.k * 2);
      g.beginPath(); this.trace(g, st.pts, T); g.stroke();
    }
    g.fillStyle = rgba(roof, 1); g.strokeStyle = rgba(mix(roof, [255, 255, 255], 0.08), 1); g.lineWidth = 0.6 * DPR;
    g.beginPath();
    for (const b of map.all) { this.trace(g, b.pts, T); g.closePath(); }
    g.fill(); g.stroke();
    this.baseDay = day; this.baseW = W; this.baseH = H;
  },

  update(dt, t) {
    const { W, H, DPR } = view, g = this.g, sky = world.sky;
    if (!map) { g.fillStyle = '#070A10'; g.fillRect(0, 0, W, H); return; }
    const T = this.transform();
    if (!this.base || this.baseW !== W || this.baseH !== H || Math.abs((sky?.daylight ?? 0) - this.baseDay) > 0.05) this.paintBase(sky, T);

    const live = ['live', 'stale', 'demo'].includes(state.mode);
    const homesNow = live ? Math.max(0, D.kw) / HOME_KW : 0;

    // screen-space shapes, cached per size
    if (this.pathsFor !== `${W}x${H}`) {
      for (const b of map.homesList) { b.path = new Path2D(); this.trace(b.path, b.pts, T); b.path.closePath(); }
      this.pathsFor = `${W}x${H}`;
    }

    // --- lit roofs, easing on and off at their own pace so a gust ripples across the estate.
    // Roofs are grouped into LEVELS brightness steps and each step is one fill; the lit layer is
    // redrawn every third frame (the easing still runs every frame).
    let litHomes = 0;
    for (const b of map.homesList) {
      const target = b.before < homesNow ? 1 : 0;
      b.glow += (target - b.glow) * Math.min(1, dt * b.rate);
      if (target) litHomes += Math.min(b.homes, homesNow - b.before);
    }
    this.frame = (this.frame || 0) + 1;
    if (this.frame % 3 === 1) {
      const lg = this.lg; lg.clearRect(0, 0, W, H);
      const buckets = Array.from({ length: LEVELS }, () => new Path2D());
      for (const b of map.homesList) if (b.glow >= 0.5 / LEVELS) buckets[Math.min(LEVELS - 1, Math.round(b.glow * LEVELS) - 1)].addPath(b.path);
      buckets.forEach((path, k) => { const v = (k + 1) / LEVELS; lg.fillStyle = rgba(mix(WARM, WARM_HOT, v * v), v); lg.fill(path); });
      const gc = this.glowC.getContext('2d'); gc.clearRect(0, 0, this.glowC.width, this.glowC.height);
      gc.drawImage(this.lit, 0, 0, this.glowC.width, this.glowC.height);
    }

    g.globalCompositeOperation = 'source-over'; g.drawImage(this.base, 0, 0);
    // soft glow: the lit layer shrunk and blown back up, laid on with a gentle breathing shimmer
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.75 + 0.08 * Math.sin(t * 0.8); g.drawImage(this.glowC, 0, 0, W, H); g.drawImage(this.glowC, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1; g.drawImage(this.lit, 0, 0);
    g.globalCompositeOperation = 'lighter';

    // --- energy along the streets
    const want = live ? Math.round(30 + 420 * D.p) : 0;
    while (this.pulses.length < want) {
      const st = map.streets[(Math.random() * map.streets.length) | 0];
      this.pulses.push({ st, s: Math.random() * st.len, v: 25 + 45 * Math.random() });
    }
    if (this.pulses.length > want) this.pulses.length = want;
    const speed = 0.4 + 2.2 * D.p;
    for (const q of this.pulses) {
      q.s += q.v * speed * dt;
      if (q.s > q.st.len) { q.st = map.streets[(Math.random() * map.streets.length) | 0]; q.s = 0; }
      const [x, y] = pointAt(q.st, q.st.dir > 0 ? q.s : q.st.len - q.s);
      g.fillStyle = `rgba(255,214,150,${0.35 + 0.4 * D.p})`;
      g.fillRect(T.X(x) - DPR, T.Y(y) - DPR, 2.2 * DPR, 2.2 * DPR);
    }

    // --- more homes than the map holds: the light spills past the edges
    const spill = Math.max(0, homesNow / map.total - 1);
    if (spill > 0) {
      const a = Math.min(0.45, 0.08 + 0.06 * spill);
      const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(255,190,120,0)'); rg.addColorStop(1, `rgba(255,190,120,${a})`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'source-over';

    // where the power comes from
    g.fillStyle = 'rgba(247,241,231,0.5)'; g.font = `italic ${12 * DPR}px Fraunces, Georgia, serif`; g.textAlign = 'left';
    g.fillText('from the turbine, Avonmouth ↖', 22 * DPR, H * 0.32);

    stageInfo.detail = !live ? 'map © OpenStreetMap contributors'
      : homesNow > map.total
        ? `every home on this map, and ${fmt.format(Math.round((homesNow - map.total) / 100) * 100)} more · map © OpenStreetMap contributors`
        : `${fmt.format(Math.round(litHomes))} of ${fmt.format(map.total)} homes on this map · map © OpenStreetMap contributors`;
  },
};
