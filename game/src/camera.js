// camera.js — the chase camera: behind and above the plane, banking a
// little with it, never snapping. Right-drag glances around; the wheel
// nudges the camera nearer or farther.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { forwardVector } from './flight.js';

export function createCameraRig(camera) {
  return {
    camera,
    distance: CONFIG.camera.distance,
    glanceYaw: 0,
    glancePitch: 0,
    glancing: false,
    target: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    shake: 0,
  };
}

export function updateChaseCamera(rig, state, dt, time) {
  const forward = forwardVector(state);
  const up = new THREE.Vector3(0, 1, 0);
  // Desired spot: behind the plane, above it, a touch to the side of the bank.
  const back = forward.clone().multiplyScalar(-rig.distance);
  back.y += CONFIG.camera.height;
  rig.desired.copy(state.position).add(back);
  // Never let the camera dip under the sea or the terrain.
  if (rig.desired.y < 6) rig.desired.y = 6;

  const lerp = 1 - Math.exp(-CONFIG.camera.followLerp * dt);
  rig.camera.position.lerp(rig.desired, lerp);

  // Look ahead of the plane, with the glance offset when the pilot drags.
  rig.lookAt.copy(state.position).addScaledVector(forward, 24);
  if (rig.glancing || Math.abs(rig.glanceYaw) > 0.001) {
    const yaw = rig.glanceYaw;
    const pitch = rig.glancePitch;
    const dir = forward.clone();
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    dir.applyAxisAngle(up, yaw);
    dir.applyAxisAngle(side, pitch);
    rig.lookAt.copy(state.position).addScaledVector(dir, 24);
  }
  // A little buffet shake near the stall.
  if (state.buffeting > 0) {
    rig.shake = state.buffeting;
    rig.camera.position.x += (Math.random() - 0.5) * rig.shake * 0.35;
    rig.camera.position.y += (Math.random() - 0.5) * rig.shake * 0.3;
  }
  rig.camera.lookAt(rig.lookAt);
  // Lean the view a little with the bank, like a pilot's head.
  rig.camera.rotateZ(-state.roll * CONFIG.camera.bankLean);
}

export function setGlance(rig, dx, dy) {
  rig.glanceYaw -= dx * 0.004;
  rig.glancePitch = Math.max(-0.6, Math.min(0.6, rig.glancePitch - dy * 0.004));
}

export function releaseGlance(rig, dt) {
  rig.glanceYaw *= Math.max(0, 1 - dt * 5);
  rig.glancePitch *= Math.max(0, 1 - dt * 5);
}

export function zoomCamera(rig, delta) {
  rig.distance = Math.max(
    CONFIG.camera.minDistance,
    Math.min(CONFIG.camera.maxDistance, rig.distance + delta * 0.01),
  );
}
