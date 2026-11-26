// shots.js — stages the four screenshots from a query string, so the
// same shot can be retaken exactly: ?shot=start|play|approach|mission
// with &seed=1. Each shot is a genuine moment of the game: the plane,
// the terrain, the rings and the HUD are all rendered by the game itself.

import * as THREE from 'three';
import { RUNWAYS } from './config.js';
import { forwardVector } from './flight.js';

// Shift the camera to the plane's left so the plane reads left of the
// centred screen panel instead of hiding behind it.
function offsetCameraRight(game, metres) {
  const forward = forwardVector(game.state);
  const up = new THREE.Vector3(0, 1, 0);
  // cross(forward, up) points to the plane's left; moving the camera
  // that way puts the plane on the left of the frame.
  const left = new THREE.Vector3().crossVectors(forward, up).normalize();
  game.camera.position.addScaledVector(left, metres);
}

// Stage a shot after the world is built. Returns the screen the game
// should show ('title', 'flying' or 'end'), or null for normal play.
export function stageShot(game, shot, seed) {
  game.seed = seed || 1;
  if (shot === 'start') {
    // Title screen over the archipelago: the plane sits on the home
    // runway, the first ring visible ahead, HUD instruments lit.
    game.mission = game.newMission(0);
    const state = game.state;
    state.position.set(RUNWAYS.home.x - 130, 3.2, RUNWAYS.home.z);
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0.35;
    state.onGround = true;
    game.placeCameraBehindPlane();
    offsetCameraRight(game, 10);
    return 'title';
  }
  if (shot === 'play') {
    // Mid-flight chase view: the plane banked, flying through a golden
    // ring, islands and sea below, the next ring ahead.
    game.mission = game.newMission(0);
    const state = game.state;
    game.mission.nextRing = 2;
    game.mission.ringsPassed = 2;
    game.mission.combo = 2;
    game.mission.score = 480;
    game.mission.timeLeft = 262;
    state.position.set(1092, 128, -618);
    state.heading = 0.55;
    state.pitch = 0.06;
    state.roll = 0.45;
    state.speed = 46;
    state.throttle = 0.72;
    state.fuel = 78;
    state.onGround = false;
    state.airborne = true;
    game.markRingsPassed(2);
    game.placeCameraBehindPlane();
    return 'flying';
  }
  if (shot === 'approach') {
    // Final approach to the Kenanga grass strip: runway filling the
    // lower frame, airspeed low, altitude low, landing hints visible.
    game.mission = game.newMission(1);
    const state = game.state;
    game.mission.legIndex = 0;
    game.mission.timeLeft = 318;
    game.mission.score = 0;
    state.position.set(1150, 30, -720);
    state.heading = -Math.PI / 2; // flying north along the strip, toward it
    state.pitch = -0.06;
    state.roll = 0.02;
    state.speed = 30;
    state.throttle = 0.28;
    state.fuel = 61;
    state.onGround = false;
    state.airborne = true;
    game.placeCameraBehindPlane();
    return 'flying';
  }
  if (shot === 'mission') {
    // Mission complete: the plane parked on the Seroja strip, the score
    // breakdown on screen, the islands behind it.
    game.mission = game.newMission(1);
    const state = game.state;
    game.mission.legsDone = 3;
    game.mission.legIndex = 3;
    game.mission.ringsPassed = 0;
    game.mission.landings = 3;
    game.mission.smoothLandings = 3;
    game.mission.score = 2140;
    game.mission.ringScore = 0;
    game.mission.landingScore = 1900;
    game.mission.timeLeft = 96;
    game.mission.fuelLeft = 34;
    state.position.set(RUNWAYS.seroja.x - 40, 3.2, RUNWAYS.seroja.z);
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = 34;
    state.onGround = true;
    state.landedStrip = 'seroja';
    game.markRingsPassed(0);
    game.placeCameraBehindPlane();
    offsetCameraRight(game, 10);
    game.finishSortie('success', true);
    return 'end';
  }
  return null;
}
