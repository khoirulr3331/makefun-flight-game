// hud.js — the instruments: altitude and attitude top left, the compass
// tape top centre, speed, throttle and fuel top right, the objective
// bottom left, score and clock bottom right, warnings centre-top.
// All DOM, one clean sans-serif face, readable when the shot is shrunk.

import { headingDegrees, altitudeFeet, speedKnots } from './flight.js';
import { missionObjectiveText, missionDestinationBearing } from './missions.js';

const PX_PER_DEG = 4; // heading tape scale
const PX_PER_KT = 3; // speed tape scale

export function buildHud() {
  const hud = document.getElementById('hud');
  buildHeadingTape();
  buildSpeedTape();
  return hud;
}

function buildHeadingTape() {
  const inner = document.getElementById('heading-tape-inner');
  if (!inner || inner.children.length) return;
  const labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let deg = -360; deg <= 720; deg += 10) {
    const tick = document.createElement('div');
    tick.className = 'tape-tick';
    const norm = ((deg % 360) + 360) % 360;
    const isCardinal = norm % 90 === 0;
    const isMajor = norm % 30 === 0;
    tick.style.left = `${(deg + 360) * PX_PER_DEG}px`;
    if (isCardinal) {
      tick.textContent = labels[norm];
      tick.classList.add('cardinal');
    } else if (isMajor) {
      tick.textContent = String(norm);
    } else {
      tick.classList.add('minor');
    }
    inner.appendChild(tick);
  }
}

function buildSpeedTape() {
  const inner = document.getElementById('speed-tape-inner');
  if (!inner || inner.children.length) return;
  for (let kt = -40; kt <= 180; kt += 10) {
    const tick = document.createElement('div');
    tick.className = 'tape-tick-v';
    tick.style.top = `${(180 - kt) * PX_PER_KT}px`;
    if (kt % 20 === 0 && kt >= 0) tick.textContent = String(kt);
    else tick.classList.add('minor');
    inner.appendChild(tick);
  }
}

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function showWarning(text, level) {
  const el = document.getElementById('warnings');
  if (!el) return;
  el.textContent = text;
  el.className = level ? `warn-${level}` : '';
  el.style.display = text ? 'block' : 'none';
}

// Update every HUD element from the live game state. Called every frame.
export function updateHud(game, dt) {
  const { state, mission, camera } = game;
  const altFt = Math.round(altitudeFeet(state));
  const altM = Math.round(state.position.y);
  const vs = state.verticalSpeed;
  const vsArrow = vs > 0.5 ? '▲' : vs < -0.5 ? '▼' : '—';
  setText('alt-value', `${altFt.toLocaleString('en-US')} ft`);
  setText('alt-m', `${altM} m`);
  setText('vs-arrow', vsArrow);
  setText('vs-value', `${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`);

  // Attitude ball: rolls with the plane, pitches with it.
  const horizon = document.getElementById('att-horizon');
  if (horizon) {
    const rollDeg = (state.roll * 180) / Math.PI;
    const pitchPx = state.pitch * 60;
    horizon.style.transform = `rotate(${-rollDeg}deg) translateY(${pitchPx}px)`;
  }

  // Heading tape and destination bearing.
  const heading = headingDegrees(state);
  const tape = document.getElementById('heading-tape-inner');
  if (tape) {
    tape.style.transform = `translateX(${170 - (heading + 360) * PX_PER_DEG}px)`;
  }
  setText('heading-value', `${String(Math.round(heading)).padStart(3, '0')}°`);
  if (mission) {
    const dest = missionDestinationBearing(mission, state.position);
    let diff = dest - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const arrow = diff > 12 ? '▶' : diff < -12 ? '◀' : '▲';
    setText('dest-bearing', `${arrow} ${String(Math.round(dest)).padStart(3, '0')}°`);
  }

  // Speed, throttle, fuel.
  const kt = Math.round(speedKnots(state));
  setText('speed-value', `${kt} kt`);
  const speedTape = document.getElementById('speed-tape-inner');
  if (speedTape) {
    speedTape.style.transform = `translateY(${70 - (180 - kt) * PX_PER_KT}px)`;
  }
  const throttleFill = document.getElementById('throttle-fill');
  if (throttleFill) throttleFill.style.width = `${Math.round(state.throttle * 100)}%`;
  setText('throttle-value', `${Math.round(state.throttle * 100)}%`);
  const fuelFill = document.getElementById('fuel-fill');
  if (fuelFill) {
    fuelFill.style.width = `${Math.round(state.fuel)}%`;
    fuelFill.className = state.fuel < 20 ? 'fuel-low' : state.fuel < 45 ? 'fuel-amber' : 'fuel-ok';
  }
  setText('fuel-value', `${Math.round(state.fuel)}%`);

  // Wind readout.
  const wind = game.wind || { x: 0, z: 0 };
  const windSpeed = Math.hypot(wind.x, wind.z) * 1.94;
  const windDir = (90 - (Math.atan2(-wind.z, wind.x) * 180) / Math.PI + 360) % 360;
  setText('wind-value', `WIND ${Math.round(windSpeed)} kt ${String(Math.round(windDir)).padStart(3, '0')}°`);

  // Objective, score, combo, clock.
  if (mission) {
    setText('sortie-name', mission.sortie.name.toUpperCase());
    setText('objective', missionObjectiveText(mission));
    if (mission.sortie.kind === 'rings') {
      setText('ring-counter', `RINGS ${mission.ringsPassed}/${mission.sortie.route.length}`);
    } else {
      setText('ring-counter', `LEG ${Math.min(mission.legIndex + 1, mission.sortie.legs.length)}/${mission.sortie.legs.length}`);
    }
    setText('score-value', mission.score.toLocaleString('en-US'));
    const combo = document.getElementById('combo');
    if (combo) {
      combo.style.display = mission.combo > 1 ? 'block' : 'none';
      const mult = Math.min(3, 1 + 0.25 * (mission.combo - 1));
      setText('combo', `COMBO ×${mission.combo}  ·  ${mult.toFixed(2)}×`);
    }
    setText('clock', formatClock(mission.timeLeft));
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.className = mission.timeLeft < 30 ? 'clock-low' : '';
  }

  // Warnings, in priority order.
  let warning = '';
  let level = '';
  if (state.stalled) { warning = 'STALL'; level = 'red'; }
  else if (state.engineOut) { warning = 'ENGINE OUT — GLIDE'; level = 'red'; }
  else if (state.fuel < 15) { warning = 'LOW FUEL'; level = 'red'; }
  else if (state.fuel < 30) { warning = 'LOW FUEL'; level = 'amber'; }
  else if (game.clearance !== undefined && game.clearance < 40 && state.verticalSpeed < -2 && !state.onGround) {
    warning = 'PULL UP'; level = 'amber';
  } else if (game.gusting) { warning = 'WIND GUST'; level = 'amber'; }
  else if (game.edgeHint) { warning = 'EDGE OF THE CHART — TURNING BACK'; level = 'amber'; }
  showWarning(warning, level);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

// The edge arrow: when the next ring is off-screen, point at it from the
// screen edge so the pilot always knows where to fly.
export function updateRingArrow(game) {
  const arrow = document.getElementById('ring-arrow');
  if (!arrow || !game.mission || !game.rings) return;
  const mission = game.mission;
  if (mission.sortie.kind !== 'rings' || mission.nextRing >= mission.sortie.route.length) {
    arrow.style.display = 'none';
    return;
  }
  const ring = game.rings.rings[mission.nextRing];
  if (!ring) { arrow.style.display = 'none'; return; }
  const v = ring.centre.clone().project(game.camera);
  const onScreen = Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8 && v.z < 1;
  if (onScreen) {
    arrow.style.display = 'none';
    return;
  }
  // Clamp the projected point to the screen edge and point the arrow at it.
  const x = Math.max(-0.92, Math.min(0.92, v.x));
  const y = Math.max(-0.85, Math.min(0.85, v.y));
  const angle = Math.atan2(-y, x);
  arrow.style.display = 'block';
  arrow.style.left = `${(x * 0.5 + 0.5) * 100}%`;
  arrow.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
  arrow.style.transform = `translate(-50%, -50%) rotate(${-angle}rad)`;
}

// The hint line that shows for the first seconds of a sortie.
export function showHint(text, seconds) {
  const el = document.getElementById('hint');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  el.dataset.until = String(performance.now() + seconds * 1000);
}

export function tickHint() {
  const el = document.getElementById('hint');
  if (!el || el.style.display === 'none') return;
  if (performance.now() > Number(el.dataset.until || 0)) {
    el.style.display = 'none';
  }
}

export function setHudVisible(visible) {
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = visible ? 'block' : 'none';
}
