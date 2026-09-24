import { startScenes } from './scenes/index.js';
import { startStories } from './stories/index.js';
import { startLive } from './data/live.js';
import { startSlow } from './data/slow.js';

const $ = id => document.getElementById(id);

startScenes($('stage'), $('sceneName'));
startStories({
  copy: $('copy'), headline: $('headline'), sub: $('sub'),
  status: $('status'), statusText: $('statusText'),
});
startLive();
startSlow();
