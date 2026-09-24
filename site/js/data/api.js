// One polite client for every call to the ACE API.
//  - A 429/503 closes a shared gate for Retry-After (or longer, doubling on repeats), so the
//    live feed and the slow feeds all back off together.
//  - Pagination is sequential (llms.txt: never crawl pages in parallel).
import { API, SITE } from '../config.js';

let gateUntil = 0, penalty = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class RateLimited extends Error {}

function retryAfterMs(h) {
  if (!h) return 5000;
  const s = Number(h);
  if (Number.isFinite(s)) return s * 1000;
  const at = Date.parse(h);                       // HTTP-date form
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 5000;
}

export async function getJSON(path, params = {}) {
  const wait = gateUntil - Date.now();
  if (wait > 0) await sleep(wait);
  const url = new URL(`${API}/v1/sites/${SITE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429 || res.status === 503) {
    penalty = Math.min(120_000, Math.max(retryAfterMs(res.headers.get('Retry-After')), penalty ? penalty * 2 : 0));
    gateUntil = Date.now() + penalty;
    throw new RateLimited(`retrying in ${Math.round(penalty / 1000)} s`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.pathname}`);
  penalty = 0;
  return res.json();
}

// Follow next_cursor to the end. `key` is the array to concatenate ('events' for event routes).
export async function getAllPages(path, params, key = null) {
  let cursor = null, out = null;
  do {
    const d = await getJSON(path, { ...params, cursor });
    if (key) out = (out || []).concat(d[key] || []);
    else if (!out) out = { timestamps: [...d.timestamps], series: structuredClone(d.series) };
    else { out.timestamps.push(...d.timestamps); for (const k in d.series) out.series[k].push(...d.series[k]); }
    cursor = d.page?.has_more ? d.page.next_cursor : null;
  } while (cursor);
  return out;
}

// Exponential delay after consecutive failures, capped.
export const backoff = (base, failures, cap = 60_000) => Math.min(cap, base * 2 ** Math.min(failures, 6));

// Enercon writes 0xFFFF (scaled) where a sensor isn't fitted — on this turbine precipitation,
// visibility, humidity and brightness all read 65.535 / 6553.5 / 65535.
const SENTINELS = [65535, 6553.5, 655.35, 65.535, 6.5535];
export const clean = v => (v == null || SENTINELS.some(s => Math.abs(v - s) < s * 1e-6)) ? null : v;

export const last = arr => { for (let i = (arr?.length ?? 0) - 1; i >= 0; i--) if (clean(arr[i]) != null) return arr[i]; return null; };
