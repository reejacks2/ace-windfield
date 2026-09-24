// Paints the real sky: gradient for the sun's altitude, a glow where the sun is, stars, and
// the moon at its true position and phase. The camera looks west from Lawrence Weston, over the
// turbine towards Avonmouth and the Severn — so sunsets (≈230° winter … 310° summer) fall
// behind it all year. Bearing is an assumption: confirm the neighbours' actual view with ACE.
import { view } from './stage.js';
import { rgba } from '../lib/palette.js';

export const VIEW_AZ = 280, FOV = 120;             // camera bearing and horizontal field of view

const wrap180 = a => ((a % 360) + 540) % 360 - 180;
// Screen x for a compass bearing seen by the camera (may fall outside 0..W).
export const bearingX = az => view.W / 2 + wrap180(az - VIEW_AZ) / (FOV / 2) * view.W / 2;

let stars = null;
function starField() {
  if (stars && stars.W === view.W && stars.H === view.H) return stars;
  const n = Math.round(view.W * view.H / 5000), list = [];
  let seed = 7;                                    // fixed seed: the same sky every night
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) list.push({ x: rnd() * view.W, y: rnd(), r: 0.4 + rnd() * rnd() * 1.6, tw: rnd() * 6.28 });
  return (stars = { W: view.W, H: view.H, list });
}

// horizonY: where sky meets land, in canvas px.
export function paintSky(g, sky, horizonY, t = 0) {
  const { W, H, DPR } = view;
  const grad = g.createLinearGradient(0, 0, 0, horizonY);
  grad.addColorStop(0, rgba(sky.zenith, 1));
  grad.addColorStop(1, rgba(sky.horizon, 1));
  g.fillStyle = grad; g.fillRect(0, 0, W, horizonY + 2);
  g.fillStyle = rgba(sky.horizon, 1); g.fillRect(0, horizonY, W, H - horizonY);

  // sun glow, strongest near the horizon; also spills when the sun is just out of frame
  const sx = bearingX(sky.sunAz), sy = horizonY - Math.max(-8, sky.sunAlt) / 50 * horizonY;
  const glowA = Math.max(0, 1 - Math.abs(sky.sunAlt - 2) / 16) * 0.55 + (sky.sunAlt > 0 ? 0.15 : 0);
  if (glowA > 0.01) {
    const R = Math.max(W, H) * 0.7;
    const gl = g.createRadialGradient(sx, Math.min(sy, horizonY), 0, sx, Math.min(sy, horizonY), R);
    gl.addColorStop(0, rgba(sky.glow, glowA)); gl.addColorStop(0.35, rgba(sky.glow, glowA * 0.3)); gl.addColorStop(1, rgba(sky.glow, 0));
    g.fillStyle = gl; g.fillRect(0, 0, W, horizonY + 2);
  }
  // the sun's disc, when above the horizon and in frame
  if (sky.sunAlt > -0.5 && sx > -40 && sx < W + 40) {
    g.fillStyle = rgba([255, 236, 200], 0.9); g.beginPath(); g.arc(sx, sy, 9 * DPR, 0, 6.283); g.fill();
  }

  if (sky.stars > 0.01) {
    for (const s of starField().list) {
      const y = s.y * horizonY * 0.95;
      const a = sky.stars * (0.35 + 0.35 * Math.sin(t * 1.3 + s.tw)) * (0.4 + 0.6 * (1 - y / horizonY));
      g.fillStyle = `rgba(235,240,255,${a})`; g.fillRect(s.x, y, s.r * DPR, s.r * DPR);
    }
  }

  if (sky.moonAlt > -1 && sky.moonFrac > 0.02) {
    const mx = bearingX(sky.moonAz), my = horizonY - sky.moonAlt / 50 * horizonY;
    if (mx > -30 && mx < W + 30) drawMoon(g, mx, my, 11 * DPR, sky);
  }
}

// Lit fraction and side from the ephemeris. Terminator drawn as a half-ellipse.
function drawMoon(g, x, y, r, sky) {
  const halo = g.createRadialGradient(x, y, r, x, y, r * 6);
  halo.addColorStop(0, `rgba(220,226,240,${0.12 * sky.moonFrac * (1 - sky.daylight)})`); halo.addColorStop(1, 'rgba(220,226,240,0)');
  g.fillStyle = halo; g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
  g.save(); g.translate(x, y);
  if (!sky.moonWaxing) g.scale(-1, 1);             // lit limb right when waxing
  g.fillStyle = 'rgba(40,46,60,0.55)'; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
  const k = 1 - 2 * sky.moonFrac;                  // terminator ellipse x-radius, -1..1
  g.fillStyle = `rgba(240,238,228,${0.55 + 0.4 * (1 - sky.daylight)})`;
  g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  g.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
  g.fill(); g.restore();
}
