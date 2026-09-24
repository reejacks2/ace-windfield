// Wall-screen behaviour.
//   Always: the cursor hides after 3 s still; double-click or "f" toggles fullscreen.
//   ?kiosk=1: keep the screen awake, and reload quietly at 04:00 Bristol time so a screen that
//   runs for weeks picks up new releases and never accumulates drift.
import { KIOSK } from '../config.js';
import { TZ_FMT } from '../lib/time.js';

function hideIdleCursor() {
  let timer = null;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(timer); timer = setTimeout(() => document.body.classList.add('idle'), 3000);
  };
  addEventListener('pointermove', wake, { passive: true });
  wake();
}

function fullscreenToggle() {
  const toggle = () => document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {});
  addEventListener('dblclick', toggle);
  addEventListener('keydown', e => { if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) toggle(); });
}

async function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  let lock = null;
  const take = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed yet */ } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (!lock || lock.released)) take(); });
  addEventListener('pointerdown', () => { if (!lock || lock.released) take(); });   // some browsers need a gesture
  take();
}

function nightlyReload() {
  const hm = () => new Intl.DateTimeFormat('en-GB', { ...TZ_FMT, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Date.now());
  const started = Date.now();
  setInterval(() => { if (hm() === '04:00' && Date.now() - started > 3_600_000) location.reload(); }, 30_000);
}

export function startKiosk() {
  hideIdleCursor();
  fullscreenToggle();
  if (KIOSK) { document.body.classList.add('kiosk'); keepAwake(); nightlyReload(); }
}
