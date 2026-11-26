// missions.js — the three sorties, their objectives, and the score.
// A sortie is a route of rings or a chain of landings, a clock, a combo
// multiplier, and a breakdown the end screen shows line by line.

import { CONFIG, RING_RUN_ROUTE, STORM_RUN_ROUTE, RUNWAYS } from './config.js';

export const SORTIES = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    blurb: 'Eight golden rings around Pulau Merak and Pulau Kenanga, against the clock.',
    destination: 'Pulau Kenanga',
    kind: 'rings',
    route: RING_RUN_ROUTE,
    timeLimit: 300,
    pointsMultiplier: 1,
    gusts: false,
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    blurb: 'Deliver parcels to the grass strips on Pulau Kenanga and Pulau Seroja, then fly home.',
    destination: 'Pulau Kenanga, Pulau Seroja, then home',
    kind: 'legs',
    legs: ['kenanga', 'seroja', 'home'],
    timeLimit: 420,
    pointsMultiplier: 1,
    gusts: false,
  },
  {
    id: 'storm-run',
    name: 'Storm Run',
    blurb: 'The ring route in gusty wind, fewer rings, double points. Watch the wind readout.',
    destination: 'Pulau Kenanga',
    kind: 'rings',
    route: STORM_RUN_ROUTE,
    timeLimit: 240,
    pointsMultiplier: 2,
    gusts: true,
  },
];

export function createMission(sortie) {
  return {
    sortie,
    startedAt: 0,
    elapsed: 0,
    timeLeft: sortie.timeLimit,
    nextRing: 0,
    ringsPassed: 0,
    ringsMissed: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    ringScore: 0,
    landingScore: 0,
    legIndex: 0,
    legsDone: 0,
    landings: 0,
    smoothLandings: 0,
    hardLandings: 0,
    status: 'flying', // flying | success | crash | fuel-out | time-out
    breakdown: [],
  };
}

export function missionObjectiveText(mission) {
  const s = mission.sortie;
  if (s.kind === 'rings') {
    if (mission.nextRing < s.route.length) {
      const dest = mission.nextRing >= 2 ? 'Pulau Kenanga' : 'Pulau Merak';
      return `Ring ${mission.nextRing + 1} of ${s.route.length} — ${dest}`;
    }
    return 'Route complete — land on Pulau Merak';
  }
  const leg = s.legs[mission.legIndex];
  if (!leg) return 'All parcels delivered';
  const name = RUNWAYS[leg].name;
  const what = leg === 'home' ? 'Return home to' : 'Deliver to';
  return `${what} ${name} — leg ${mission.legIndex + 1} of ${s.legs.length}`;
}

export function missionDestinationBearing(mission, planePos) {
  // Where the next objective is, as a compass bearing in degrees.
  let target = null;
  const s = mission.sortie;
  if (s.kind === 'rings' && mission.nextRing < s.route.length) {
    const r = s.route[mission.nextRing];
    target = { x: r.x, z: r.z };
  } else if (s.kind === 'legs' && s.legs[mission.legIndex]) {
    const r = RUNWAYS[s.legs[mission.legIndex]];
    target = { x: r.x, z: r.z };
  } else {
    target = { x: RUNWAYS.home.x, z: RUNWAYS.home.z };
  }
  const dx = target.x - planePos.x;
  const dz = target.z - planePos.z;
  const deg = (90 - (Math.atan2(-dz, dx) * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

// Score a ring pass. Consecutive passes build the combo multiplier.
export function scoreRing(mission, quality) {
  const base = CONFIG.rings.points + Math.round(CONFIG.rings.centreBonus * quality);
  mission.combo += 1;
  mission.bestCombo = Math.max(mission.bestCombo, mission.combo);
  const mult = 1 + CONFIG.scoring.comboStep * (mission.combo - 1);
  const capped = Math.min(mult, CONFIG.scoring.comboMax);
  const points = Math.round(base * capped * mission.sortie.pointsMultiplier);
  mission.ringScore += points;
  mission.score += points;
  mission.ringsPassed += 1;
  mission.nextRing += 1;
  if (mission.sortie.kind === 'rings') {
    mission.timeLeft += CONFIG.rings.timeBonus;
  }
  return { points, combo: mission.combo, multiplier: capped };
}

export function scoreMiss(mission) {
  mission.combo = 0;
  mission.ringsMissed += 1;
  mission.nextRing += 1;
}

export function scoreLanding(mission, smooth, stripKey) {
  const points = smooth
    ? CONFIG.scoring.landingSmooth
    : CONFIG.scoring.landingHard;
  mission.landingScore += points;
  mission.score += points;
  mission.landings += 1;
  if (smooth) mission.smoothLandings += 1;
  else {
    mission.hardLandings += 1;
    mission.score = Math.max(0, mission.score - CONFIG.scoring.hardLandingPenalty);
  }
  if (mission.sortie.kind === 'legs') {
    const expected = mission.sortie.legs[mission.legIndex];
    if (stripKey === expected) {
      mission.legsDone += 1;
      mission.legIndex += 1;
      mission.score += CONFIG.scoring.legComplete;
      mission.landingScore += CONFIG.scoring.legComplete;
      return { legDone: true, points: points + CONFIG.scoring.legComplete, smooth };
    }
    return { legDone: false, points, smooth };
  }
  return { legDone: false, points, smooth };
}

export function isMissionComplete(mission) {
  const s = mission.sortie;
  if (s.kind === 'rings') return mission.ringsPassed >= s.route.length;
  return mission.legIndex >= s.legs.length;
}

// Finish the sortie and build the line-by-line breakdown for the end screen.
export function finishMission(mission, reason) {
  mission.status = reason;
  const s = mission.sortie;
  const lines = [];
  const add = (label, value) => lines.push({ label, value });
  add('Rings flown', `${mission.ringsPassed} × ${CONFIG.rings.points} base`);
  add('Ring points', mission.ringScore);
  add('Landing points', mission.landingScore);
  add('Best combo', `×${mission.bestCombo}`);
  if (reason === 'success') {
    const fuelBonus = Math.round(mission.fuelLeft * CONFIG.scoring.fuelBonusPerPoint);
    const timeBonus = Math.round(mission.timeLeft * CONFIG.scoring.timeBonusPerSecond);
    mission.score += fuelBonus + timeBonus;
    add('Fuel remaining bonus', fuelBonus);
    add('Time remaining bonus', timeBonus);
  }
  add('Total score', mission.score);
  mission.breakdown = lines;
  return mission;
}

export function bestScoreKey() {
  return 'cakrawala-courier-best';
}

export function loadBestScore() {
  try {
    return Number(localStorage.getItem(bestScoreKey())) || 0;
  } catch (e) {
    return 0;
  }
}

export function saveBestScore(score) {
  try {
    const best = loadBestScore();
    if (score > best) localStorage.setItem(bestScoreKey(), String(score));
    return Math.max(best, score);
  } catch (e) {
    return score;
  }
}
