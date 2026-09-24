// Opt-in sound, built live from the turbine's numbers. Silent until someone taps the button.
//   wind  — filtered noise; brighter and louder as the wind rises, gusting with the real readings
//   swish — the blade-pass "whoosh": a band of noise pulsed at 3 × rotor rpm / 60 Hz, which is
//           the real acoustic signature of a three-bladed rotor
//   drone — a quiet open fifth that swells with the power being made
import { state } from '../data/store.js';
import { NOMINAL_KW } from '../config.js';

let ac = null, nodes = null, on = false;

function noiseBuffer(ctx, seconds = 3) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;                                  // pinkish noise
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
  }
  return buf;
}

function build() {
  ac = new AudioContext();
  const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const src = (buf) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const buf = noiseBuffer(ac);

  const windBP = ac.createBiquadFilter(); windBP.type = 'bandpass'; windBP.Q.value = 0.6;
  const windG = ac.createGain(); src(buf).connect(windBP).connect(windG).connect(master);

  const swishBP = ac.createBiquadFilter(); swishBP.type = 'bandpass'; swishBP.frequency.value = 700; swishBP.Q.value = 1.2;
  const swishG = ac.createGain(); swishG.gain.value = 0;
  const lfo = ac.createOscillator(); lfo.type = 'sine';
  const lfoDepth = ac.createGain(); lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(swishG.gain); lfo.start();
  const nb = ac.createBufferSource(); nb.buffer = buf; nb.loop = true; nb.loopStart = 1.3; nb.start(0, 1.3);
  nb.connect(swishBP).connect(swishG).connect(master);

  const droneLP = ac.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 600;
  const droneG = ac.createGain(); droneG.gain.value = 0; droneLP.connect(droneG).connect(master);
  const oscs = [110, 164.81, 220.5].map((f, i) => {
    const o = ac.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.value = [0.5, 0.25, 0.18][i]; o.connect(g).connect(droneLP); o.start(); return o;
  });
  nodes = { master, windBP, windG, swishG, lfo, lfoDepth, droneG, oscs };
}

function update() {
  if (!on || !nodes) return;
  const n = state.now, t = ac.currentTime, w = Math.min(1, n.wind / 20), p = Math.max(0, Math.min(1, n.kw / NOMINAL_KW));
  const rpm = n.rpm || 0, set = (param, v, tc = 0.8) => param.setTargetAtTime(v, t, tc);
  set(nodes.windBP.frequency, 250 + 1400 * w);
  set(nodes.windG.gain, 0.05 + 0.5 * w);
  const bladePass = 3 * rpm / 60;                              // Hz — 0.6 Hz at 12 rpm
  set(nodes.lfo.frequency, Math.max(0.01, bladePass), 0.3);
  const swish = Math.min(1, rpm / 12);
  set(nodes.swishG.gain, 0.12 * swish);                        // the pulse rides on this…
  set(nodes.lfoDepth.gain, 0.11 * swish);                      // …and dips to near zero between blades
  set(nodes.droneG.gain, 0.015 + 0.08 * p, 2);
  nodes.oscs.forEach((o, i) => set(o.frequency, [110, 164.81, 220.5][i] * (1 + 0.03 * p), 3));
}

export function startSound(button) {
  const render = () => { button.setAttribute('aria-pressed', String(on)); button.textContent = on ? 'Sound on' : 'Sound off'; };
  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    on = !on;
    if (on) {
      if (!ac) build();
      await ac.resume();
      update();
      nodes.master.gain.setTargetAtTime(0.5, ac.currentTime, 1.2);
    } else if (ac) {
      nodes.master.gain.setTargetAtTime(0, ac.currentTime, 0.4);
      setTimeout(() => { if (!on) ac.suspend(); }, 1500);
    }
    render();
  });
  button.addEventListener('dblclick', e => e.stopPropagation());   // don't toggle fullscreen
  setInterval(update, 1000);
  render();
}
