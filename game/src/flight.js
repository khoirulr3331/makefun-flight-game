// flight.js — the arcade flight model: throttle, lift, banking turns,
// stall, fuel burn, damage, wind, and the ground. It knows nothing about
// rendering; it only moves a state object the renderer reads.

import * as THREE from 'three';
import { CONFIG, RUNWAYS } from './config.js';
import { terrainHeightAt } from './terrain.js';

const P = CONFIG.plane;
const GRAVITY = 9.81;

// A fresh flight state, parked on the home runway, engine off.
export function createFlightState() {
  return {
    position: new THREE.Vector3(RUNWAYS.home.x - 130, 3.2, RUNWAYS.home.z),
    heading: 0, // radians, 0 = east (+x)
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: P.fuelCapacity,
    damage: 0,
    onGround: true,
    airborne: false,
    verticalSpeed: 0,
    stalled: false,
    buffeting: 0,
    engineOut: false,
    landedStrip: null, // key of the strip the plane is parked on
    lastTouchdownVs: 0,
    time: 0,
  };
}

export function forwardVector(state) {
  return new THREE.Vector3(
    Math.cos(state.heading) * Math.cos(state.pitch),
    Math.sin(state.pitch),
    -Math.sin(state.heading) * Math.cos(state.pitch),
  );
}

function stripLocal(runway, x, z) {
  // Coordinates along and across a strip, from its centre.
  const dx = x - runway.x;
  const dz = z - runway.z;
  const along = dx * Math.cos(runway.heading) - dz * Math.sin(runway.heading);
  const across = dx * Math.sin(runway.heading) + dz * Math.cos(runway.heading);
  return { along, across };
}

export function stripAt(x, z) {
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const { along, across } = stripLocal(r, x, z);
    if (Math.abs(along) < r.length / 2 + 10 && Math.abs(across) < r.width / 2 + 8) {
      return { key, runway: r, along, across };
    }
  }
  return null;
}

// One simulation step. input: { pitch, roll, throttleUp, throttleDown,
// brake } each -1..1 or boolean. wind: { x, z } in m/s. Returns an event
// string when something notable happened this step, else null.
export function stepFlight(state, input, wind, dt) {
  state.time += dt;
  let event = null;

  // --- throttle ------------------------------------------------------------
  if (state.engineOut) {
    state.throttle = Math.max(0, state.throttle - dt * 0.8);
  } else {
    if (input.throttleUp) state.throttle += P.throttleRate * dt;
    if (input.throttleDown) state.throttle -= P.throttleRate * dt;
    state.throttle = Math.max(0, Math.min(1, state.throttle));
  }

  // --- target speed from throttle, with climb costing speed ---------------
  let targetSpeed = P.minSpeed + state.throttle * (P.maxSpeed - P.minSpeed);
  if (state.pitch > 0) targetSpeed -= state.pitch * 22;
  if (state.pitch < 0) targetSpeed -= state.pitch * 14; // dive gains speed
  targetSpeed = Math.max(P.minSpeed, Math.min(P.maxSpeed + 8, targetSpeed));
  if (input.brake) targetSpeed = Math.min(targetSpeed, state.speed - P.brakeDecel * dt);
  const accel = input.brake ? P.brakeDecel * 2.2 : P.accel;
  const diff = targetSpeed - state.speed;
  state.speed += Math.max(-accel * dt, Math.min(accel * dt, diff));
  if (state.speed < 0) state.speed = 0;

  // --- stall ---------------------------------------------------------------
  state.stalled = !state.onGround && state.speed < P.stallSpeed;
  state.buffeting = state.stalled
    ? Math.min(1, state.buffeting + dt * 3)
    : Math.max(0, state.buffeting - dt * 2);

  // --- pitch and roll ------------------------------------------------------
  // In a stall the wing stops flying and the nose drops, however hard the
  // pilot pulls: the stick cannot hold the nose up below flying speed.
  if (state.stalled) {
    state.pitch = Math.max(-0.45, state.pitch - 0.9 * dt);
  } else {
    const pitchTarget = input.pitch * P.maxPitch;
    state.pitch += Math.max(-P.pitchRate * dt, Math.min(P.pitchRate * dt, pitchTarget - state.pitch));
  }
  if (state.onGround) state.pitch = 0;
  const rollTarget = input.roll * P.maxBank;
  state.roll += Math.max(-P.rollRate * dt, Math.min(P.rollRate * dt, rollTarget - state.roll));

  // --- a banked turn actually turns the heading ----------------------------
  // Banking right (positive roll) turns the nose right: heading grows.
  if (!state.onGround && state.speed > 4) {
    const turnRate = (GRAVITY * Math.tan(state.roll)) / Math.max(state.speed, 12);
    state.heading += turnRate * dt;
    // A steep bank at low speed bleeds speed.
    if (Math.abs(state.roll) > 0.7 && state.speed < 30) {
      state.speed = Math.max(P.minSpeed, state.speed - 6 * dt);
    }
  }

  // --- move ------------------------------------------------------------------
  const forward = forwardVector(state);
  const prevY = state.position.y;
  state.position.addScaledVector(forward, state.speed * dt);
  state.position.x += wind.x * dt;
  state.position.z += wind.z * dt;

  // Stay inside the chart: steer gently back toward the middle.
  const bx = CONFIG.world.bounds;
  if (Math.abs(state.position.x) > bx || Math.abs(state.position.z) > bx) {
    // Steer back toward the middle of the chart.
    const homeAngle = Math.atan2(state.position.z, -state.position.x);
    let diff = homeAngle - state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.heading += Math.max(-0.5 * dt, Math.min(0.5 * dt, diff));
    event = 'edge';
  }
  state.verticalSpeed = (state.position.y - prevY) / Math.max(dt, 1e-6);

  // --- fuel ------------------------------------------------------------------
  if (!state.onGround || state.speed > 1) {
    const burn = P.fuelBurnBase + state.throttle * P.fuelBurnThrottle;
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= 0 && !state.engineOut) {
      state.engineOut = true;
      event = 'fuel-out';
    }
  }

  // --- ground contact --------------------------------------------------------
  const ground = terrainHeightAt(state.position.x, state.position.z);
  const groundClearance = state.position.y - ground;
  if (state.onGround) {
    state.position.y = ground + 1.2;
    // Rolling into the sea is a ditching, not a boat ride.
    if (ground <= 0.5) {
      return 'ditch';
    }
    // Rolling takeoff: enough speed and a pull on the stick lifts off.
    if (state.speed >= P.takeoffSpeed && input.pitch > 0.2) {
      state.onGround = false;
      state.airborne = true;
      state.landedStrip = null;
      event = 'takeoff';
    }
  } else if (groundClearance <= 1.2 && state.verticalSpeed <= 0) {
    // Touching down: only when actually descending, so a fresh takeoff
    // (nose up, climbing away) does not immediately count as a landing.
    state.position.y = ground + 1.2;
    const vs = state.verticalSpeed;
    state.lastTouchdownVs = vs;
    const strip = stripAt(state.position.x, state.position.z);
    // A strip can be landed on from either end.
    const headingDiff = strip
      ? Math.min(
          Math.abs(angleDiff(state.heading, strip.runway.heading)),
          Math.abs(angleDiff(state.heading, strip.runway.heading + Math.PI)),
        )
      : 99;
    const gentle = vs > -P.hardLandingVs && state.speed < P.landingMaxSpeed;
    const aligned = strip && headingDiff < P.landingHeadingTolerance;
    if (strip && gentle && aligned) {
      // A landing. Hard ones still count, but they cost damage and points.
      state.onGround = true;
      state.airborne = false;
      state.landedStrip = strip.key;
      state.pitch = 0;
      state.roll = 0;
      state.speed = Math.max(0, state.speed - 6);
      event = vs < -2 ? 'land-hard' : 'land';
    } else if (ground <= 1.5) {
      // Ditching in the sea.
      event = 'ditch';
    } else if (vs < -P.crashVs) {
      event = 'crash-terrain';
    } else {
      // A rough touchdown on open ground: damage, but the plane survives.
      state.damage = Math.min(P.damageLimit, state.damage + 25);
      state.onGround = true;
      state.airborne = false;
      state.speed = Math.max(0, state.speed - 10);
      state.pitch = 0;
      state.roll = 0;
      event = state.damage >= P.damageLimit ? 'crash-damage' : 'rough-touch';
    }
  }

  // Damage past the limit ends the sortie.
  if (state.damage >= P.damageLimit && event !== 'crash-damage') {
    event = 'crash-damage';
  }
  return event;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Heading in degrees, 0 = north, clockwise — what the compass tape shows.
export function headingDegrees(state) {
  // Our heading 0 = east, positive turns left; compass 0 = north.
  const deg = (90 - (state.heading * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

export function altitudeFeet(state) {
  return Math.max(0, state.position.y * 3.28084);
}

export function speedKnots(state) {
  return state.speed * 1.94384;
}
