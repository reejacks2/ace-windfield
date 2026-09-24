// The real sky over the turbine: sun and moon position, moon phase, and the colours they imply.
// Low-precision almanac formulas (~1° — plenty at screen scale).
// Azimuths are compass bearings (0 = north, 90 = east); altitudes in degrees above the horizon.
export const SITE_LAT = 51.503, SITE_LON = -2.672;      // Lawrence Weston, Bristol

const rad = Math.PI / 180, deg = 180 / Math.PI, e = rad * 23.4397;
const toDays = ms => ms / 864e5 - 0.5 + 2440588 - 2451545;
const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
const altitude = (H, phi, dc) => Math.asin(Math.sin(phi) * Math.sin(dc) + Math.cos(phi) * Math.cos(dc) * Math.cos(H));
const azimuth = (H, phi, dc) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dc) * Math.cos(phi));

function sunCoords(d) {
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  return { dec: dec(L, 0), ra: ra(L, 0) };
}
function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  return { ra: ra(l, b), dec: dec(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

export function astro(ms = Date.now(), lat = SITE_LAT, lon = SITE_LON) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(ms);
  const s = sunCoords(d), Hs = sidereal(d, lw) - s.ra;
  const m = moonCoords(d), Hm = sidereal(d, lw) - m.ra;
  let mAlt = altitude(Hm, phi, m.dec);
  mAlt += 0.0002967 / Math.tan(mAlt + 0.00312536 / (mAlt + 0.08901179));   // refraction
  // illumination
  const sdist = 149598000;
  const ph = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(ph), m.dist - sdist * Math.cos(ph));
  const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return {
    sunAlt: altitude(Hs, phi, s.dec) * deg, sunAz: (azimuth(Hs, phi, s.dec) * deg + 180) % 360,
    moonAlt: mAlt * deg, moonAz: (azimuth(Hm, phi, m.dec) * deg + 180) % 360,
    moonFrac: (1 + Math.cos(inc)) / 2,                     // lit fraction 0..1
    moonWaxing: ang < 0,                                   // lit limb on the right (N. hemisphere)
  };
}

// Sky colours keyed to sun altitude. Kept deliberately muted so white copy stays legible.
const KEYS = [   // alt°, zenith, horizon, glow near the sun
  [-90, [ 4,  7, 13], [ 10, 16, 28], [ 20, 24, 40]],
  [-18, [ 4,  7, 13], [ 10, 16, 28], [ 20, 24, 40]],
  [-10, [ 7, 11, 26], [ 26, 30, 62], [ 60, 48, 90]],
  [ -4, [14, 20, 46], [ 92, 60, 86], [196,108, 92]],
  [  1, [24, 34, 66], [176,110, 84], [255,170, 96]],
  [  6, [34, 54, 86], [150,128,112], [255,200,130]],
  [ 20, [40, 66,100], [104,132,156], [230,220,190]],
  [ 90, [44, 74,110], [112,142,168], [235,230,210]],
];
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

export function skyColours(sunAlt) {
  let i = 1; while (i < KEYS.length - 1 && sunAlt > KEYS[i][0]) i++;
  const [a0, z0, h0, g0] = KEYS[i - 1], [a1, z1, h1, g1] = KEYS[i];
  const u = Math.max(0, Math.min(1, (sunAlt - a0) / (a1 - a0)));
  return {
    zenith: mix(z0, z1, u), horizon: mix(h0, h1, u), glow: mix(g0, g1, u),
    daylight: Math.max(0, Math.min(1, (sunAlt + 6) / 18)),         // 0 at night … 1 by mid-morning
    stars: Math.max(0, Math.min(1, (-sunAlt - 4) / 10)),            // fade in through nautical twilight
  };
}

export function skyNow(ms = Date.now()) {
  const a = astro(ms);
  return { ...a, ...skyColours(a.sunAlt) };
}
