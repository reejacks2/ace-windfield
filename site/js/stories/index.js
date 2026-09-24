// Story rotation. The live story ("now", or "stopped" when idle) comes back between the others
// so the headline number is never far away. Stories without fresh data are skipped.
// A story is { id, ready(state) → bool, render(state) → { headline, sub } } (HTML strings).
import { STORY_SECONDS, PIN_STORY } from '../config.js';
import { state, onChange } from '../data/store.js';
import now from './now.js';
import stopped from './stopped.js';
import energy from './energy.js';
import curtailment from './curtailment.js';
import weather from './weather.js';
import lifetime from './lifetime.js';
import { stageInfo } from '../scenes/stage.js';

const ALL = { now, stopped, energy, curtailment, weather, lifetime };
const LIVE = [stopped, now];                  // first ready one wins
const SEQUENCE = ['live', energy, 'live', lifetime, 'live', curtailment, 'live', weather];

export function startStories({ copy, headline, sub, status, statusText }) {
  let slot = 0, current = null, shownHTML = '';

  const liveStory = () => LIVE.find(s => s.ready(state)) || now;
  function pick() {
    if (ALL[PIN_STORY]?.ready(state)) return ALL[PIN_STORY];
    for (let i = 0; i < SEQUENCE.length; i++) {
      const s = SEQUENCE[(slot + i) % SEQUENCE.length];
      const story = s === 'live' ? liveStory() : s;
      if (story.ready(state)) { slot = (slot + i) % SEQUENCE.length; return story; }
    }
    return liveStory();
  }

  function paint() {
    // the live slot re-picks every tick so "now" ↔ "stopped" switches straight away
    if (current && LIVE.includes(current) && SEQUENCE[slot] === 'live') current = liveStory();
    if (ALL[PIN_STORY]?.ready(state)) current = ALL[PIN_STORY];
    if (!current?.ready(state)) current = pick();
    // a scene with its own words (the replay) takes the copy while it plays
    const { headline: h, sub: s } = stageInfo.caption || current.render(state);
    const html = h + '\u0000' + s;
    if (html !== shownHTML) { headline.innerHTML = h; sub.innerHTML = s; shownHTML = html; }
    status.className = 'status ' + state.mode; statusText.textContent = state.statusText;
    copy.dataset.story = stageInfo.caption ? 'scene' : current.id;
  }

  function advance() {
    if (stageInfo.caption) return;                    // don't rotate under a scene's caption
    slot = (slot + 1) % SEQUENCE.length;
    const nextStory = pick();
    if (nextStory === current) return paint();
    copy.classList.add('out');                        // fade out, swap, fade in
    setTimeout(() => { current = nextStory; paint(); copy.classList.remove('out'); }, 600);
  }

  current = pick(); paint();
  onChange(paint);
  setInterval(paint, 250);                          // scene captions change faster than data
  setInterval(advance, STORY_SECONDS * 1000);
}
