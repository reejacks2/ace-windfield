globalThis.location = { search: '' }; globalThis.matchMedia = () => ({ matches: false });
const noop = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : noop, apply: () => noop, construct: () => noop, set: () => true });
globalThis.document = { createElement: () => ({ getContext: () => noop, width: 0, height: 0 }), hidden: false };
globalThis.Path2D = class { moveTo() {} lineTo() {} };
const base = new URL('../site/js/', import.meta.url).href;   // run: node tools/flock_shape.mjs
const { view, motion, world } = await import(base + 'scenes/stage.js');
const { skyNow } = await import(base + 'lib/sky.js');
Object.assign(view, { W: 1568, H: 698, DPR: 1 }); world.sky = skyNow();
const M = (await import(base + 'scenes/murmuration.js?' + Date.now())).default;
for (const [kw, wind] of [[2500, 9], [300, 4], [0, 2]]) {
  Object.assign(motion, { kw, p: kw / 4200, wind, w: wind / 20, vx: 0.8, vy: 0.2 });
  M.birds = null; M.init(); let t = 0;
  const shapes = [];
  for (let i = 0; i < 900; i++) { M.update(1 / 60, (t += 1 / 60)); if (i > 300 && i % 60 === 0) {
    const act = M.birds.filter(b => b.up > 0.5); const n = act.length;
    const mx = act.reduce((s, b) => s + b.x, 0) / n, my = act.reduce((s, b) => s + b.y, 0) / n;
    const sx = Math.sqrt(act.reduce((s, b) => s + (b.x - mx) ** 2, 0) / n), sy = Math.sqrt(act.reduce((s, b) => s + (b.y - my) ** 2, 0) / n);
    shapes.push(`${Math.round(sx)}x${Math.round(sy)}`);
  } }
  console.log(`kW ${kw} birds ${M.birds.filter(b => b.up > 0.5).length}: spread sd (px) ${shapes.join(' ')}`);
}
