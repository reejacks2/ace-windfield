import { HOME_KW } from '../config.js';

export const fmt = new Intl.NumberFormat('en-GB');
export const fmt1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = dir => COMPASS[Math.round((((dir % 360) + 360) % 360) / 45) % 8];

// Homes powered right now, and home-days of electricity in an energy total.
export const homesNow = kw => Math.round(kw / HOME_KW / 100) * 100;
export const homeDays = kwh => Math.round(kwh / (HOME_KW * 24));

export const energy = kwh => kwh >= 1000
  ? `<span class="num">${fmt1.format(kwh / 1000)}</span>&nbsp;MWh`
  : `<span class="num">${fmt.format(Math.round(kwh))}</span>&nbsp;kWh`;

// Fresh = updated within `min` minutes.
export const fresh = (slice, min) => !!slice && Date.now() - slice.at < min * 60_000;
