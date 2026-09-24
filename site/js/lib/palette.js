// Colour keyed to power fraction (kW / NOMINAL_KW).
const STOPS = [
  [0.00, [ 44,  66,  98]],   // still — dusk
  [0.18, [ 60, 132, 172]],   // breeze — estuary
  [0.42, [ 98, 190, 170]],   // working — sea green
  [0.68, [236, 200,  92]],   // strong — gold
  [0.88, [255, 138,  61]],   // full — ember
  [1.00, [255, 214, 170]],   // white-hot tip
];

export function pal(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
    const [t0, a] = STOPS[i-1], [t1, b] = STOPS[i], u = (t-t0)/(t1-t0);
    return [a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u];
  }
  return STOPS[STOPS.length-1][1];
}

export const rgba = (c, a) => `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
