// rings.js — the golden hoops: placement, glow, and pass detection.
// A ring is passed when the plane crosses its plane close to the centre.

import * as THREE from 'three';
import { CONFIG, RUNWAYS } from './config.js';

const RING_RADIUS = CONFIG.rings.radius;

export function buildRings(scene, route) {
  const group = new THREE.Group();
  group.name = 'rings';
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xffc93c });
  const dimMat = new THREE.MeshBasicMaterial({
    color: 0xb98a2e, transparent: true, opacity: 0.55,
  });
  const rings = [];
  for (let i = 0; i < route.length; i++) {
    const p = route[i];
    // Face the direction the pilot arrives from: the normal points back
    // along the incoming leg, so the hoop faces the plane flying into it.
    const prev = i === 0
      ? { x: RUNWAYS.home.x - 130, z: RUNWAYS.home.z }
      : route[i - 1];
    const normal = new THREE.Vector3(p.x - prev.x, 0, p.z - prev.z).normalize();
    const ringGroup = new THREE.Group();
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, 1.1, 10, 40),
      i === 0 ? goldMat.clone() : dimMat.clone(),
    );
    ringGroup.add(hoop);
    // A thinner inner hoop for the glow.
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS * 0.82, 0.35, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.8 }),
    );
    ringGroup.add(inner);
    // A small beacon light on top so the ring reads from far away.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    beacon.position.y = RING_RADIUS + 1.5;
    ringGroup.add(beacon);

    ringGroup.position.set(p.x, p.y, p.z);
    // Torus lies in the XY plane facing +Z; rotate it to face the normal.
    const yaw = Math.atan2(-normal.z, normal.x);
    ringGroup.rotation.y = yaw - Math.PI / 2;
    // Keep the hoop upright: torus in XY plane is already vertical.
    group.add(ringGroup);
    rings.push({
      index: i,
      centre: new THREE.Vector3(p.x, p.y, p.z),
      normal,
      group: ringGroup,
      hoop,
      inner,
      passed: false,
      prevSide: null,
    });
  }
  scene.add(group);
  return { group, rings };
}

// Mark which ring is next: it glows bright gold, the rest stay dim.
export function highlightNextRing(rings, nextIndex) {
  rings.forEach((ring, i) => {
    const active = i === nextIndex;
    ring.hoop.material.color.set(active ? 0xffc93c : 0xb98a2e);
    ring.hoop.material.opacity = active ? 1 : 0.55;
    ring.hoop.material.transparent = !active;
    ring.inner.material.opacity = active ? 0.95 : 0.35;
  });
}

export function pulseRings(rings, time, nextIndex) {
  rings.forEach((ring, i) => {
    if (ring.passed) {
      ring.group.visible = false;
      return;
    }
    ring.group.visible = true;
    const pulse = 1 + Math.sin(time * 2.4 + i) * 0.03;
    ring.group.scale.setScalar(i === nextIndex ? pulse * 1.06 : pulse);
    ring.inner.material.opacity = (i === nextIndex ? 0.95 : 0.35)
      + Math.sin(time * 3 + i * 1.7) * 0.12;
  });
}

// Check whether the plane crossed the next ring's plane this step.
// Returns 'pass' with a centre quality 0..1, or null.
export function checkRingPass(ring, planePos, prevPlanePos) {
  if (ring.passed) return null;
  const toPrev = new THREE.Vector3().copy(prevPlanePos).sub(ring.centre);
  const toNow = new THREE.Vector3().copy(planePos).sub(ring.centre);
  const sidePrev = Math.sign(toPrev.dot(ring.normal));
  const sideNow = Math.sign(toNow.dot(ring.normal));
  if (sidePrev === 0 || sideNow === 0 || sidePrev === sideNow) return null;
  // Crossed the plane: how far from the centre line?
  const along = toNow.dot(ring.normal);
  const radial = Math.sqrt(Math.max(0, toNow.lengthSq() - along * along));
  // A crossing far from the hoop is not a pass or a miss — the plane only
  // clipped the ring's plane extension while manoeuvring. The ring stays
  // the objective until the pilot flies through its neighbourhood.
  if (radial > 40) return null;
  if (radial > CONFIG.rings.passRadius) return { result: 'miss', quality: 0 };
  ring.passed = true;
  const quality = Math.max(0, 1 - radial / CONFIG.rings.passRadius);
  return { result: 'pass', quality };
}

export function resetRings(rings) {
  for (const ring of rings) {
    ring.passed = false;
    ring.prevSide = null;
  }
}
