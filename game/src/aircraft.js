// aircraft.js — the courier plane, built up from simple shaped parts:
// a rounded fuselage, a high wing with a slight dihedral, tail, a
// spinning propeller, fixed gear, warm orange-and-cream paint.

import * as THREE from 'three';

const CREAM = 0xf6ead2;
const ORANGE = 0xe8641c;
const DARK = 0x2e2a26;
const GLASS = 0x9fc8e8;

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'courier-plane';

  // --- fuselage: a tapered body with a rounded nose -------------------------
  const bodyMat = lambert(CREAM);
  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.55, 4.6, 12),
    bodyMat,
  );
  fuselage.rotation.z = Math.PI / 2; // cylinder axis along +x
  fuselage.position.x = 0.1;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), bodyMat);
  nose.scale.set(1.15, 1, 1);
  nose.position.x = 2.4;
  plane.add(nose);
  const tailCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.8, 10),
    lambert(ORANGE),
  );
  tailCone.rotation.z = Math.PI / 2;
  tailCone.position.x = -3.0;
  plane.add(tailCone);

  // Orange cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.87, 0.57, 3.4, 12, 1, true),
    lambert(ORANGE),
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.position.set(-0.2, -0.05, 0);
  stripe.scale.set(1, 1, 0.5);
  plane.add(stripe);

  // Cockpit windows: a dark glass canopy hump.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 10, 8),
    lambert(GLASS, { transparent: true, opacity: 0.9 }),
  );
  canopy.scale.set(1.5, 0.75, 1.1);
  canopy.position.set(1.1, 0.62, 0);
  plane.add(canopy);

  // --- high wing with a slight dihedral --------------------------------------
  const wingMat = lambert(ORANGE);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 4.4), wingMat);
    wing.position.set(0.35, 0.95, side * 2.15);
    wing.rotation.x = side * 0.07; // dihedral
    plane.add(wing);
  }
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 1.2), wingMat);
  wingRoot.position.set(0.35, 0.98, 0);
  plane.add(wingRoot);
  // Cream wing tips.
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 0.5), bodyMat);
    tip.position.set(0.35, 0.95 + side * 0.07 * 2.15, side * 4.15);
    tip.rotation.x = side * 0.07;
    plane.add(tip);
  }

  // --- tail ------------------------------------------------------------------
  const tailMat = lambert(CREAM);
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.7), tailMat);
    stab.position.set(-3.4, 0.25, side * 0.85);
    plane.add(stab);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.12), lambert(ORANGE));
  fin.position.set(-3.5, 0.85, 0);
  fin.rotation.z = 0.25;
  plane.add(fin);

  // --- propeller -------------------------------------------------------------
  const prop = new THREE.Group();
  prop.name = 'propeller';
  prop.position.set(3.35, 0, 0);
  const hub = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.7, 8),
    lambert(DARK),
  );
  hub.rotation.z = -Math.PI / 2;
  prop.add(hub);
  const bladeMat = lambert(DARK);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 0.32), bladeMat);
    blade.rotation.x = angle;
    blade.position.x = 0.05;
    prop.add(blade);
  }
  // The faint spinning disc, visible when the engine runs.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    }),
  );
  disc.name = 'prop-disc';
  disc.rotation.y = Math.PI / 2;
  prop.add(disc);
  plane.add(prop);

  // --- fixed landing gear ----------------------------------------------------
  const gearMat = lambert(DARK);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), gearMat);
    leg.position.set(0.9, -0.85, side * 0.7);
    leg.rotation.x = side * 0.25;
    plane.add(leg);
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10),
      lambert(0x1a1a1a),
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.9, -1.35, side * 0.85);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.14, 8),
    lambert(0x1a1a1a),
  );
  tailWheel.rotation.x = Math.PI / 2;
  tailWheel.position.set(-3.3, -0.55, 0);
  plane.add(tailWheel);

  plane.userData.propeller = prop;
  plane.userData.disc = disc;
  return plane;
}

// Pose the plane from a flight state: heading about world up, then pitch
// about the wing axis, then roll about the nose axis.
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const qRoll = new THREE.Quaternion();

export function applyFlightPose(plane, state) {
  qYaw.setFromAxisAngle(AXIS_Y, state.heading);
  qPitch.setFromAxisAngle(AXIS_Z, state.pitch);
  qRoll.setFromAxisAngle(AXIS_X, -state.roll);
  plane.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);
  plane.position.copy(state.position);
}

// Spin the propeller with the throttle, and fade the blur disc in.
export function updatePropeller(plane, state, dt) {
  const prop = plane.userData.propeller;
  const disc = plane.userData.disc;
  if (!prop) return;
  const spin = (2 + state.throttle * 38) * (state.engineOut ? 0.1 : 1);
  prop.rotation.x += spin * dt;
  const targetOpacity = state.throttle > 0.05 && !state.engineOut ? 0.16 : 0;
  disc.material.opacity += (targetOpacity - disc.material.opacity) * Math.min(1, dt * 4);
}
