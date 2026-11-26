// sound.js — every sound is synthesised with the Web Audio API.
// No audio files are shipped and no network is used. Sound starts only
// after the pilot's first key press or click, as browsers require.

export function createSound() {
  return {
    ctx: null,
    master: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

export function ensureSound(sound) {
  if (sound.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    sound.ctx = ctx;
    sound.master = ctx.createGain();
    sound.master.gain.value = 0.9;
    sound.master.connect(ctx.destination);

    // Engine hum: two soft sawtooth voices through a low-pass filter.
    sound.engineGain = ctx.createGain();
    sound.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    sound.engineOsc1 = ctx.createOscillator();
    sound.engineOsc1.type = 'sawtooth';
    sound.engineOsc1.frequency.value = 55;
    sound.engineOsc2 = ctx.createOscillator();
    sound.engineOsc2.type = 'sawtooth';
    sound.engineOsc2.frequency.value = 82.5;
    sound.engineOsc1.connect(filter);
    sound.engineOsc2.connect(filter);
    filter.connect(sound.engineGain);
    sound.engineGain.connect(sound.master);
    sound.engineOsc1.start();
    sound.engineOsc2.start();

    // Wind: looped filtered noise that rises with speed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    sound.windSource = ctx.createBufferSource();
    sound.windSource.buffer = buffer;
    sound.windSource.loop = true;
    sound.windFilter = ctx.createBiquadFilter();
    sound.windFilter.type = 'bandpass';
    sound.windFilter.frequency.value = 500;
    sound.windFilter.Q.value = 0.6;
    sound.windGain = ctx.createGain();
    sound.windGain.gain.value = 0;
    sound.windSource.connect(sound.windFilter);
    sound.windFilter.connect(sound.windGain);
    sound.windGain.connect(sound.master);
    sound.windSource.start();

    sound.started = true;
  } catch (e) {
    sound.started = false;
  }
}

// Continuous engine and wind, called every frame while flying.
export function updateEngineSound(sound, throttle, speed, engineOut) {
  if (!sound.started || !sound.ctx) return;
  const t = sound.ctx.currentTime;
  const base = 42 + throttle * 48;
  sound.engineOsc1.frequency.setTargetAtTime(base, t, 0.1);
  sound.engineOsc2.frequency.setTargetAtTime(base * 1.5, t, 0.1);
  const engineLevel = engineOut ? 0.02 : 0.04 + throttle * 0.09;
  sound.engineGain.gain.setTargetAtTime(engineLevel, t, 0.15);
  const windLevel = Math.min(0.12, Math.max(0, (speed - 15) / 60) * 0.12);
  sound.windGain.gain.setTargetAtTime(windLevel, t, 0.2);
  sound.windFilter.frequency.setTargetAtTime(350 + speed * 12, t, 0.2);
}

function tone(sound, freq, startAt, duration, type = 'sine', level = 0.25) {
  if (!sound.started || !sound.ctx) return;
  const ctx = sound.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
  gain.gain.linearRampToValueAtTime(level, ctx.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
  osc.connect(gain);
  gain.connect(sound.master);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.05);
}

function thump(sound, freq, duration, level = 0.5) {
  if (!sound.started || !sound.ctx) return;
  const ctx = sound.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(sound.master);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.05);
}

// One-shot sounds: a ring chime, a landing thud with a short success
// phrase, a crash thump with a descending tone.
export function playRingChime(sound) {
  tone(sound, 880, 0, 0.35);
  tone(sound, 1318.5, 0.09, 0.45);
}

export function playLandingSound(sound) {
  thump(sound, 120, 0.25, 0.4);
  tone(sound, 523.25, 0.12, 0.3);
  tone(sound, 659.25, 0.22, 0.3);
  tone(sound, 783.99, 0.32, 0.5);
}

export function playCrashSound(sound) {
  thump(sound, 90, 0.7, 0.6);
  tone(sound, 220, 0.05, 0.9, 'sawtooth', 0.12);
  tone(sound, 110, 0.25, 1.0, 'sawtooth', 0.12);
}

export function playSuccessSound(sound) {
  tone(sound, 523.25, 0, 0.3);
  tone(sound, 659.25, 0.12, 0.3);
  tone(sound, 783.99, 0.24, 0.3);
  tone(sound, 1046.5, 0.36, 0.6);
}

export function setMuted(sound, muted) {
  sound.muted = muted;
  if (sound.master && sound.ctx) {
    sound.master.gain.setTargetAtTime(muted ? 0 : 0.9, sound.ctx.currentTime, 0.05);
  }
}
