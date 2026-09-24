// Live twin: the ACE turbine under the real Bristol sky. The rotor turns at the rotor speed the
// turbine reports each second, the nacelle faces its reported heading, the blades feather with
// the reported pitch, and the whole machine glows with the power it is making.
import { view, motion as D, world, stageInfo, mkCanvas } from './stage.js';
import { paintSky, bearingX, VIEW_AZ } from './backdrop.js';
import { pal, rgba } from '../lib/palette.js';
import { fbm } from '../lib/noise.js';
import { state } from '../data/store.js';

const wrap180 = a => ((a % 360) + 540) % 360 - 180;
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const PAINT = [226, 228, 226];                          // turbine white, before lighting

export default {
  name: 'Live twin',
  seconds: 30,
  init() {
    this.c = mkCanvas(); this.g = this.c.getContext('2d');
    this.rot = this.rot ?? Math.random() * 6.283;       // keep blade angle across resizes
    this.streaks = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), l: 0.3 + Math.random(), s: 0.5 + Math.random() }));
    this.land = null;
  },

  layout() {
    const { W, H } = view, portrait = H > W;
    // Proportions of the real machine: rotor radius ≈ half the hub height (E-138-class rotor).
    const groundY = H * (portrait ? 0.64 : 0.80);
    const hubY = H * (portrait ? 0.27 : 0.30);
    const R = Math.min((groundY - hubY) * 0.55, W * (portrait ? 0.40 : 0.24));
    return { portrait, groundY, hubY, R, hubX: W * (portrait ? 0.5 : 0.64), horizonY: groundY - H * 0.05 };
  },

  // Far hills, the Severn, near ground: drawn once per size into an offscreen layer (shapes only).
  landShapes(L) {
    const { W, H } = view;
    const hills = [], near = [];
    for (let x = 0; x <= W; x += 6) {
      hills.push([x, L.horizonY - H * 0.035 * fbm(x * 0.004 / view.DPR, 3.1, 0.2) - H * 0.008]);
      near.push([x, L.groundY + H * 0.02 * (fbm(x * 0.003 / view.DPR, 9.7, 1.3) - 0.5)]);
    }
    return { hills, near };
  },

  update(dt, t) {
    const { W, H, DPR } = view, g = this.g, sky = world.sky;
    if (!sky) return;
    const L = this.layout();
    if (!this.land || this.land.W !== W || this.land.H !== H) this.land = { W, H, ...this.landShapes(L) };

    // --- sky
    paintSky(g, sky, L.horizonY, t);
    const lit = 0.25 + 0.75 * sky.daylight;             // how much daylight falls on things

    // wind streaks, moving the way the wind blows (projected onto the screen)
    const blowX = -Math.sin((wrap180((D.dir + 180) - (VIEW_AZ + 180))) * Math.PI / 180);
    g.lineCap = 'round';
    for (const s of this.streaks) {
      s.x += blowX * (0.004 + 0.03 * D.w) * s.s * dt * 6;
      if (s.x > 1.1) s.x -= 1.2; if (s.x < -0.1) s.x += 1.2;
      const y = s.y * L.horizonY * 0.9, len = (20 + 160 * D.w) * s.l * DPR;
      g.strokeStyle = `rgba(235,240,250,${(0.03 + 0.07 * D.w) * (0.4 + 0.6 * lit)})`;
      g.lineWidth = 1.2 * DPR;
      g.beginPath(); g.moveTo(s.x * W, y); g.lineTo(s.x * W - blowX * len, y); g.stroke();
    }

    // --- land: far hills, estuary shimmer, near ground
    const hillC = mix([12, 16, 22], mix(sky.horizon, [40, 52, 58], 0.5), 0.35 + 0.35 * sky.daylight);
    g.fillStyle = rgba(hillC, 1); g.beginPath(); g.moveTo(0, H);
    for (const [x, y] of this.land.hills) g.lineTo(x, y);
    g.lineTo(W, H); g.fill();
    const waterTop = L.horizonY, waterBot = L.groundY - H * 0.012;
    const wg = g.createLinearGradient(0, waterTop, 0, waterBot);
    wg.addColorStop(0, rgba(mix(sky.horizon, [30, 40, 50], 0.35), 1)); wg.addColorStop(1, rgba(mix(sky.zenith, [10, 14, 20], 0.5), 1));
    g.fillStyle = wg; g.fillRect(0, waterTop, W, waterBot - waterTop);
    g.fillStyle = `rgba(240,236,220,${0.05 + 0.1 * sky.daylight})`;
    for (let i = 0; i < 40; i++) {                        // glints drift with the wind
      const y = waterTop + (waterBot - waterTop) * ((i * 0.618) % 1);
      const x = (((i * 137.5 + t * 30 * blowX * (0.3 + D.w)) % W) + W) % W;
      g.fillRect(x, y, (8 + 26 * ((i * 0.37) % 1)) * DPR, 1 * DPR);
    }
    g.fillStyle = rgba(mix([6, 9, 12], hillC, 0.45), 1); g.beginPath(); g.moveTo(0, H);
    for (const [x, y] of this.land.near) g.lineTo(x, y);
    g.lineTo(W, H); g.fill();

    // --- the turbine
    const rpm = D.rpm;
    this.rot += rpm / 60 * 6.283 * dt;                  // true speed, even under reduced motion
    const pitch = state.today?.pitch ?? (rpm < 1 ? 60 : 2);
    this.drawTurbine(g, L, sky, lit, pitch);

    const facing = COMPASS[Math.round(((D.yaw % 360) + 360) % 360 / 45) % 8];
    stageInfo.detail = `${rpm.toFixed(1)} rpm · facing ${facing} · blades ${Math.round(pitch)}°`;
  },

  drawTurbine(g, L, sky, lit, pitch) {
    const { DPR } = view, { hubX, hubY, R, groundY } = L;
    // δ: angle between where the rotor faces and the direction to the camera.
    const delta = wrap180(D.yaw - (VIEW_AZ + 180)) * Math.PI / 180;
    const face = Math.cos(delta), side = -Math.sin(delta);   // disc width factor; screen x of where the rotor faces
    const front = face >= 0;
    const body = mix(mix(sky.horizon, [20, 24, 30], 0.6), PAINT, lit * 0.85);
    const shade = mix(body, [8, 10, 14], 0.45);
    const glow = pal(D.p);

    const tower = () => {
      const topW = R * 0.045, botW = R * 0.1;
      const tg = g.createLinearGradient(hubX - botW, 0, hubX + botW, 0);
      tg.addColorStop(0, rgba(shade, 1)); tg.addColorStop(0.45, rgba(body, 1)); tg.addColorStop(1, rgba(shade, 1));
      g.fillStyle = tg; g.beginPath();
      g.moveTo(hubX - topW, hubY + R * 0.05); g.lineTo(hubX + topW, hubY + R * 0.05);
      g.lineTo(hubX + botW, groundY); g.lineTo(hubX - botW, groundY); g.fill();
    };
    const nacelle = () => {
      // Enercon's egg: from the hub back along the axis, foreshortened by the viewing angle.
      const len = R * 0.30, back = hubX - side * len * 0.9, h = R * 0.085;   // trails downwind
      const ng = g.createLinearGradient(0, hubY - h, 0, hubY + h);
      ng.addColorStop(0, rgba(body, 1)); ng.addColorStop(1, rgba(shade, 1));
      g.fillStyle = ng; g.beginPath();
      g.ellipse((hubX + back) / 2, hubY, Math.max(h * 0.9, Math.abs(back - hubX) / 2 + h * 0.6), h, 0, 0, 6.283);
      g.fill();
      g.fillStyle = rgba(glow, 0.08 + 0.35 * D.p);           // a thin band of power colour
      g.fillRect(Math.min(hubX, back) - h * 0.3, hubY + h * 0.25, Math.abs(back - hubX) + h * 0.6, h * 0.14);
    };
    const blades = () => {
      const chord = R * 0.075 * (0.25 + 0.75 * Math.abs(Math.cos(pitch * Math.PI / 180)));
      for (let b = 0; b < 3; b++) {
        const th = this.rot + b * 2.0944;
        const sx = Math.sin(th) * face, cy = -Math.cos(th);
        const tipX = hubX + sx * R, tipY = hubY + cy * R;
        const nx = -cy, ny = sx;                              // perpendicular in screen space
        const nl = Math.hypot(nx, ny) || 1, px = nx / nl, py = ny / nl;
        const rootX = hubX + sx * R * 0.08, rootY = hubY + cy * R * 0.08;
        const midX = hubX + sx * R * 0.28, midY = hubY + cy * R * 0.28;
        const bg = g.createLinearGradient(rootX, rootY, tipX, tipY);
        bg.addColorStop(0, rgba(body, 1)); bg.addColorStop(1, rgba(mix(body, shade, 0.5), 1));
        g.fillStyle = bg; g.beginPath();
        g.moveTo(rootX + px * chord * 0.5, rootY + py * chord * 0.5);
        g.quadraticCurveTo(midX + px * chord, midY + py * chord, tipX + px * chord * 0.1, tipY + py * chord * 0.1);
        g.lineTo(tipX - px * chord * 0.05, tipY - py * chord * 0.05);
        g.quadraticCurveTo(midX - px * chord * 0.3, midY - py * chord * 0.3, rootX - px * chord * 0.5, rootY - py * chord * 0.5);
        g.fill();
      }
    };
    const spinner = () => {
      const r = R * 0.075;
      const sg = g.createRadialGradient(hubX - r * 0.3, hubY - r * 0.3, 0, hubX, hubY, r * 1.2);
      sg.addColorStop(0, rgba(mix(body, [255, 255, 255], 0.3 * lit), 1)); sg.addColorStop(1, rgba(shade, 1));
      g.fillStyle = sg; g.beginPath(); g.ellipse(hubX + side * r * 0.4, hubY, r * (0.6 + 0.4 * Math.abs(face)), r, 0, 0, 6.283); g.fill();
    };

    // glow of the power being made, behind everything
    if (D.p > 0.01) {
      const hg = g.createRadialGradient(hubX, hubY, 0, hubX, hubY, R * 1.25);
      hg.addColorStop(0, rgba(glow, 0.16 * D.p + 0.04)); hg.addColorStop(1, rgba(glow, 0));
      g.fillStyle = hg; g.fillRect(hubX - R * 1.3, hubY - R * 1.3, R * 2.6, R * 2.6);
    }
    // faint swept disc: the circle the blades trace
    g.strokeStyle = rgba(glow, 0.05 + 0.12 * D.p); g.lineWidth = 1.5 * DPR;
    g.beginPath(); g.ellipse(hubX, hubY, Math.max(1, R * Math.abs(face)), R, 0, 0, 6.283); g.stroke();

    if (front) { tower(); nacelle(); blades(); spinner(); }
    else { blades(); spinner(); tower(); nacelle(); }
  },
};
