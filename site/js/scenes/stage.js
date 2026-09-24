// What every scene can see: canvas size, the eased wind/power it draws from, and the sky.
export const view = { W: 0, H: 0, DPR: 1 };

// Eased copies of state.now, updated once per frame by scenes/index.js.
//   p = power fraction 0..1, w = wind fraction 0..1 (of 20 m/s), (vx, vy) = direction the wind blows TO.
//   yaw = nacelle heading (°), rpm = rotor speed.
export const motion = { kw: 0, wind: 0, dir: 225, p: 0, w: 0, vx: 0, vy: -1, yaw: 225, rpm: 0, avail: 0 };

// The real sky right now (lib/sky.js skyNow), refreshed every few seconds.
export const world = { sky: null };

// A scene may put words on screen in place of the rotating stories (the replay does).
export const stageInfo = { caption: null, detail: '' };

export const MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.15 : 1;
export const BG = '#0F141B';

export function mkCanvas() {
  const c = document.createElement('canvas');
  c.width = view.W; c.height = view.H;
  return c;
}
