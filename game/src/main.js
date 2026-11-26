// main.js — starts the loop and ties the pieces together: the world,
// the plane, the missions, the camera, the input, the sound and the HUD.

import * as THREE from 'three';
import { CONFIG, RUNWAYS } from './config.js';
import {
  buildTerrain, buildSea, buildSky, buildClouds, updateClouds,
  buildRunways, updateWindsock, terrainHeightAt,
} from './terrain.js';
import { buildAircraft, applyFlightPose, updatePropeller } from './aircraft.js';
import { createFlightState, stepFlight, forwardVector } from './flight.js';
import { buildRings, highlightNextRing, pulseRings, checkRingPass, resetRings } from './rings.js';
import {
  SORTIES, createMission, scoreRing, scoreMiss, scoreLanding,
  isMissionComplete, finishMission, loadBestScore, saveBestScore,
  missionObjectiveText,
} from './missions.js';
import { createCameraRig, updateChaseCamera, setGlance, releaseGlance, zoomCamera } from './camera.js';
import { createInput, attachInput, consumePress, clearPresses } from './input.js';
import {
  createSound, ensureSound, updateEngineSound,
  playRingChime, playLandingSound, playCrashSound, playSuccessSound, setMuted,
} from './sound.js';
import { buildHud, updateHud, updateRingArrow, showHint, tickHint, setHudVisible } from './hud.js';
import { buildScreens, highlightSortie, showScreen, showEndScreen, updateBestScore } from './screens.js';
import { stageShot } from './shots.js';

const canvasHolder = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
canvasHolder.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CONFIG.sun.fogColor, CONFIG.sun.fogNear, CONFIG.sun.fogFar);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);
camera.position.set(-160, 40, -320);

// Warm low sun plus soft ambient light.
const sunDir = new THREE.Vector3(...CONFIG.sun.direction).normalize();
const sun = new THREE.DirectionalLight(CONFIG.sun.color, CONFIG.sun.intensity);
sun.position.copy(sunDir).multiplyScalar(1000);
scene.add(sun);
scene.add(new THREE.AmbientLight(CONFIG.sun.ambientColor, CONFIG.sun.ambientIntensity));

// The world.
buildTerrain(scene);
buildSea(scene);
buildSky(scene);
const clouds = buildClouds(scene, 7);
const { windsock } = buildRunways(scene);
const plane = buildAircraft();
scene.add(plane);

// The game object every module reads.
const game = {
  state: createFlightState(),
  mission: null,
  rings: null,
  ringsGroup: null,
  camera,
  cameraRig: createCameraRig(camera),
  input: createInput(),
  sound: createSound(),
  wind: { x: CONFIG.wind.x, z: CONFIG.wind.z },
  gusting: false,
  edgeHint: false,
  screen: 'title', // title | flying | paused | end
  selectedSortie: 0,
  paused: false,
  hintShown: false,
  seed: 1,
  prevPlanePos: null,
};

function rebuildRings(sortie) {
  if (game.ringsGroup) {
    scene.remove(game.ringsGroup);
    game.ringsGroup = null;
    game.rings = null;
  }
  if (sortie.kind === 'rings') {
    game.rings = buildRings(scene, sortie.route);
    game.ringsGroup = game.rings.group;
    highlightNextRing(game.rings.rings, 0);
  }
}

game.newMission = (index) => {
  const sortie = SORTIES[index];
  game.mission = createMission(sortie);
  game.mission.startedAt = game.state.time;
  rebuildRings(sortie);
  game.state = createFlightState();
  game.prevPlanePos = game.state.position.clone();
  return game.mission;
};

game.markRingsPassed = (n) => {
  if (!game.rings) return;
  game.rings.rings.forEach((ring, i) => {
    ring.passed = i < n;
  });
  highlightNextRing(game.rings.rings, n);
};

game.placeCameraBehindPlane = () => {
  const forward = forwardVector(game.state);
  const back = forward.clone().multiplyScalar(-game.cameraRig.distance);
  back.y += CONFIG.camera.height;
  camera.position.copy(game.state.position).add(back);
  camera.lookAt(game.state.position.clone().addScaledVector(forward, 24));
};

function startSortie(index) {
  game.newMission(index);
  game.selectedSortie = index;
  game.screen = 'flying';
  game.paused = false;
  game.hintShown = false;
  showScreen('none');
  setHudVisible(true);
  showHint('Shift throttle up · W/S pitch · A/D bank to turn · Space air brake', 7);
  ensureSound(game.sound);
}

game.finishSortie = (reason, staged = false) => {
  if (game.screen === 'end') return;
  game.mission.fuelLeft = game.state.fuel;
  finishMission(game.mission, reason);
  const best = saveBestScore(game.mission.score);
  game.mission.best = best;
  updateBestScore();
  game.screen = 'end';
  if (!staged) {
    if (reason === 'success') playSuccessSound(game.sound);
    else if (reason === 'crash') playCrashSound(game.sound);
  }
  showEndScreen(game, game.mission, reason);
  setHudVisible(true);
};

function handleFlightEvent(event) {
  const mission = game.mission;
  if (!event) return;
  if (event === 'takeoff') {
    showHint('Gear up — climb away, then bank toward the next ring', 4);
  } else if (event === 'land' || event === 'land-hard') {
    const smooth = event === 'land';
    const result = scoreLanding(mission, smooth, game.state.landedStrip);
    playLandingSound(game.sound);
    if (mission.sortie.kind === 'legs' && result.legDone) {
      // A completed leg refuels the courier a little at the strip.
      game.state.fuel = Math.min(100, game.state.fuel + 40);
      if (isMissionComplete(mission)) {
        game.finishSortie('success');
        return;
      }
      showHint(`Leg complete — next: ${missionObjectiveText(mission)}`, 5);
    } else if (mission.sortie.kind === 'rings') {
      showHint(smooth ? 'Smooth landing — nice touch' : 'Hard landing — the airframe felt that', 4);
    }
  } else if (event === 'ditch' || event === 'crash-terrain' || event === 'crash-damage') {
    game.state.damage = 100;
    // A crash with an empty tank is a fuel-out ending, not a flying error.
    game.finishSortie(game.state.engineOut ? 'fuel-out' : 'crash');
  } else if (event === 'fuel-out') {
    showHint('ENGINE OUT — glide her down, find a strip or a beach', 6);
  } else if (event === 'edge') {
    game.edgeHint = true;
    setTimeout(() => { game.edgeHint = false; }, 4000);
  } else if (event === 'rough-touch') {
    showHint('Rough ground — that cost the airframe', 3);
  }
}

function gustWind(time) {
  // Storm Run: slow gusts that push the nose sideways.
  const gust = Math.sin(time / CONFIG.wind.gustPeriod * Math.PI * 2);
  const gust2 = Math.sin(time / 1.7 + 1.3);
  const strength = CONFIG.wind.gustStrength;
  const active = game.mission && game.mission.sortie.gusts;
  game.gusting = active && Math.abs(gust) > 0.55;
  return {
    x: CONFIG.wind.x + (active ? gust * strength * 0.7 + gust2 * strength * 0.3 : 0),
    z: CONFIG.wind.z + (active ? gust2 * strength * 0.5 : 0),
  };
}

function checkRings() {
  const mission = game.mission;
  if (!mission || mission.sortie.kind !== 'rings' || !game.rings) return;
  if (mission.nextRing >= mission.sortie.route.length) return;
  const ring = game.rings.rings[mission.nextRing];
  const result = checkRingPass(ring, game.state.position, game.prevPlanePos);
  if (!result) return;
  if (result.result === 'pass') {
    const scored = scoreRing(mission, result.quality);
    playRingChime(game.sound);
    highlightNextRing(game.rings.rings, mission.nextRing);
    if (isMissionComplete(mission)) {
      game.finishSortie('success');
    }
  } else {
    scoreMiss(mission);
    highlightNextRing(game.rings.rings, mission.nextRing);
  }
}

// --- screens and keys ---------------------------------------------------------

buildHud();
buildScreens((i) => {
  highlightSortie(i);
  game.selectedSortie = i;
  startSortie(i);
});
highlightSortie(0);

attachInput(game.input, renderer.domElement, (code) => {
  ensureSound(game.sound);
  if (code === 'KeyM') {
    setMuted(game.sound, !game.sound.muted);
    return;
  }
  if (game.screen === 'title') {
    if (code === 'ArrowUp' || code === 'KeyW') {
      game.selectedSortie = (game.selectedSortie + SORTIES.length - 1) % SORTIES.length;
      highlightSortie(game.selectedSortie);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      game.selectedSortie = (game.selectedSortie + 1) % SORTIES.length;
      highlightSortie(game.selectedSortie);
    } else if (code === 'Enter') {
      startSortie(game.selectedSortie);
    }
    return;
  }
  if (game.screen === 'flying') {
    if (code === 'KeyP' || code === 'Escape') {
      game.paused = true;
      game.screen = 'paused';
      showScreen('pause');
    } else if (code === 'KeyR') {
      startSortie(game.selectedSortie);
    }
    return;
  }
  if (game.screen === 'paused') {
    if (code === 'KeyP' || code === 'Escape' || code === 'Enter') {
      game.paused = false;
      game.screen = 'flying';
      showScreen('none');
    } else if (code === 'KeyR') {
      startSortie(game.selectedSortie);
    } else if (code === 'KeyT') {
      backToTitle();
    }
    return;
  }
  if (game.screen === 'end') {
    if (code === 'Enter') {
      startSortie(game.selectedSortie);
    } else if (code === 'KeyR') {
      startSortie(game.selectedSortie);
    } else if (code === 'KeyT') {
      backToTitle();
    }
  }
});

function backToTitle() {
  game.newMission(game.selectedSortie);
  game.screen = 'title';
  game.paused = false;
  showScreen('title');
  setHudVisible(true);
  updateBestScore();
}

document.getElementById('resume-btn').addEventListener('click', () => {
  game.paused = false;
  game.screen = 'flying';
  showScreen('none');
});
document.getElementById('restart-btn').addEventListener('click', () => startSortie(game.selectedSortie));
document.getElementById('title-btn').addEventListener('click', () => backToTitle());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- the loop -----------------------------------------------------------------

const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const input = game.input;
  if (game.screen === 'flying' && !game.paused && !game.frozen) {
    game.prevPlanePos.copy(game.state.position);
    const wind = gustWind(elapsed);
    game.wind = wind;
    const event = stepFlight(game.state, {
      pitch: input.pitch,
      roll: input.roll,
      throttleUp: input.throttleUp,
      throttleDown: input.throttleDown,
      brake: input.brake,
    }, wind, dt);
    // A landing after the engine died ends the sortie out of fuel.
    if ((event === 'land' || event === 'land-hard') && game.state.engineOut) {
      game.finishSortie('fuel-out');
    } else {
      handleFlightEvent(event);
    }
    checkRings();
    // Mission clock.
    if (game.mission && game.screen === 'flying') {
      game.mission.elapsed += dt;
      game.mission.timeLeft -= dt;
      if (game.mission.timeLeft <= 0) {
        game.mission.timeLeft = 0;
        game.finishSortie('time-out');
      }
    }
    updateEngineSound(game.sound, game.state.throttle, game.state.speed, game.state.engineOut);
  }

  // Height above the ground below, for the PULL UP warning.
  game.clearance = game.state.position.y
    - terrainHeightAt(game.state.position.x, game.state.position.z);

  // Camera glance and zoom, whatever the screen.
  if (input.rightDragging) {
    game.cameraRig.glancing = true;
    setGlance(game.cameraRig, input.dragDx, input.dragDy);
    input.dragDx = 0;
    input.dragDy = 0;
  } else {
    game.cameraRig.glancing = false;
    releaseGlance(game.cameraRig, dt);
  }
  if (input.wheelDelta !== 0) {
    zoomCamera(game.cameraRig, input.wheelDelta);
    input.wheelDelta = 0;
  }
  // A staged screenshot keeps the camera exactly where staging put it.
  if (!game.frozen) {
    updateChaseCamera(game.cameraRig, game.state, dt, elapsed);
  }
  updatePropeller(plane, game.state, dt);
  applyFlightPose(plane, game.state);
  updateClouds(clouds, dt, elapsed);
  updateWindsock(windsock, Math.atan2(-game.wind.z, game.wind.x));

  if (game.rings) {
    pulseRings(game.rings.rings, elapsed, game.mission ? game.mission.nextRing : 0);
  }
  if (game.screen !== 'title' || game.shotStaged) {
    updateHud(game, dt);
    updateRingArrow(game);
    tickHint();
  }
  renderer.render(scene, camera);
}

// --- boot ---------------------------------------------------------------------

game.newMission(0);
game.screen = 'title';
showScreen('title');
setHudVisible(true);
updateBestScore();

// Stage a screenshot when the page is opened with ?shot=...&seed=...
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = Number(params.get('seed') || 1);
  const staged = stageShot(game, shot, seed);
  if (staged) {
    game.screen = staged;
    game.frozen = true;
    game.shotStaged = true;
    if (staged === 'title') showScreen('title');
    else if (staged === 'end') showScreen('end');
    else showScreen('none');
    setHudVisible(true);
    updateHud(game, 0);
    updateRingArrow(game);
  }
}

// A small handle for automated play-testing in the browser console.
window.__courier = {
  game,
  state: () => game.state,
  mission: () => game.mission,
  startSortie,
  version: 1,
};

animate();
