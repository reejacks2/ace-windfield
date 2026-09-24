// What every scene can see: canvas size, and the eased wind/power it draws from.
export const view = { W: 0, H: 0, DPR: 1 };

// Eased copies of state.now, updated once per frame by main.js.
//   p = power fraction 0..1, w = wind fraction 0..1 (of 20 m/s), (vx, vy) = direction the wind blows TO.
export const motion = { kw: 0, wind: 0, dir: 225, p: 0, w: 0, vx: 0, vy: -1 };

export const MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.15 : 1;
export const BG = '#0F141B';

export function mkCanvas() {
  const c = document.createElement('canvas');
  c.width = view.W; c.height = view.H;
  return c;
}
