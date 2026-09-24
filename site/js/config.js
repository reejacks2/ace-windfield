// Everything a maintainer might want to change lives here.
export const API = 'https://ace-api.duckdns.org';
export const SITE = 'ace';
export const WEC = 'wec-1';              // the turbine asset (GET /v1/sites/ace/assets)
export const TZ = 'Europe/London';

export const NOMINAL_KW = 4200;          // palette scale; site config reports farm_nominal_power 4245
export const HOME_KW = 0.31;             // average UK home draw — NEEDS ACE'S BLESSING before launch
export const PRICE_GBP_PER_MWH = null;   // earnings line stays hidden until ACE confirms a price

export const LIVE_POLL_MS = 1000;        // llms.txt: one-second dashboards may refresh once per second
export const HISTORY = 600;              // seconds of 1 Hz power kept for the ribbon and dial
export const STALE_AFTER_MIN = 5;

export const SCENE_SECONDS = 20, FADE_SECONDS = 2.5;
export const STORY_SECONDS = 12;

const params = new URLSearchParams(location.search);
export const FORCE_DEMO = params.get('demo') === '1';   // ?demo=1 — synthetic data, for development
export const PIN_STORY = params.get('story');           // ?story=energy — hold one story
