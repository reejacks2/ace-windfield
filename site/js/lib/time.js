import { TZ } from '../config.js';

// The API returns epoch MICROseconds (the schema only says "integer").
// Normalise by magnitude so s / ms / µs all land as ms.
export const toMs = t => t >= 1e14 ? t / 1000 : t >= 1e11 ? t : t * 1000;

export const isoZ = d => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

// Start of today in Bristol, as a UTC Date. Off by an hour on the two clock-change days.
export function londonMidnight(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(x => [x.type, x.value]));
  const sinceMidnight = (+p.hour*3600 + +p.minute*60 + +p.second) * 1000;
  return new Date(Math.floor((now.getTime() - sinceMidnight) / 1000) * 1000);
}

export const clock = ms => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(ms);
