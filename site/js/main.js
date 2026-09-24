import { startScenes } from './scenes/index.js';
import { startStories } from './stories/index.js';
import { startLive } from './data/live.js';
import { startSlow } from './data/slow.js';
import { startOdometer } from './ui/odometer.js';
import { startKiosk } from './ui/kiosk.js';
import { startSound } from './ui/sound.js';

const $ = id => document.getElementById(id);

startScenes($('stage'), $('sceneName'));
startStories({
  copy: $('copy'), headline: $('headline'), sub: $('sub'),
  status: $('status'), statusText: $('statusText'),
});
startOdometer($('odometer'), $('odoNum'), $('odoSince'));
startKiosk();
startSound($('sound'));
startLive();
startSlow();
