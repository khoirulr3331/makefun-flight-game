// terrain.js — the archipelago: islands, sea, sky, clouds and strips.
// The terrain height function lives here and is shared with the flight
// model, so what you see is exactly what you can crash into.

import * as THREE from 'three';
import { CONFIG, ISLANDS, FLATS, RUNWAYS } from './config.js';
import { makeValueNoise } from './random.js';

const noise = makeValueNoise(20261126);

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Height of the land above sea level at (x, z). Zero out at sea.
export function terrainHeightAt(x, z) {
  let h = 0;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz) / island.radius;
    if (d >= 1) continue;
    // A smooth dome, plus a little seeded roughness on the slopes.
    const dome = Math.pow(1 - d * d, 1.6);
    const rough = 1 + noise(x, z) * 0.12 * d;
    h = Math.max(h, island.peak * dome * rough);
  }
  // Carve the flat airfields into the terrain.
  for (const flat of FLATS) {
    const dx = x - flat.x;
    const dz = z - flat.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const w = 1 - smoothstep(flat.radius * 0.6, flat.radius, d);
    h = h * (1 - w) + flat.height * w;
  }
  return h;
}

function islandColourAt(x, z, h, island) {
  // Sand rim at the waterline, jungle green on the slopes, pale ridges,
  // grey rock on the volcano's peak.
  if (h < 5) return new THREE.Color(0xe8d49a); // beach sand
  if (island.name === 'Pulau Api' && h > 170) return new THREE.Color(0x8a8a86);
  const t = clamp01((h - 5) / 90);
  const deep = new THREE.Color(0x2e6b34);
  const light = new THREE.Color(0x7fb069);
  const c = deep.clone().lerp(light, t);
  // A little variation so the slopes read as low-poly facets.
  const v = noise(x * 2.3, z * 2.3) * 0.08;
  c.offsetHSL(0, 0, v);
  return c;
}

export function buildTerrain(scene) {
  const size = CONFIG.world.terrainSize;
  const seg = CONFIG.world.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeightAt(x, z);
    pos.setY(i, h);
    // Find which island this point belongs to, for its palette.
    let island = null;
    let best = 1e9;
    for (const isl of ISLANDS) {
      const d = Math.hypot(x - isl.x, z - isl.z) / isl.radius;
      if (d < best) { best = d; island = isl; }
    }
    if (h <= 0.5) colour.set(0x2e7fb8); // sea floor tint under the water
    else colour.copy(islandColourAt(x, z, h, island || ISLANDS[0]));
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

export function buildSea(scene) {
  const size = CONFIG.world.terrainSize * 2.4;
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: CONFIG.sun.seaColor,
    shininess: 90,
    specular: 0xffd9a0,
    transparent: true,
    opacity: 0.94,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = 0.4;
  sea.name = 'sea';
  scene.add(sea);
  return sea;
}
// buildSky — a gradient dome, a low warm sun disc and drifting clouds.
export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(6000, 24, 16);
  const top = new THREE.Color(CONFIG.sun.skyTop);
  const horizon = new THREE.Color(CONFIG.sun.skyHorizon);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01(pos.getY(i) / 6000 * 1.6 + 0.12);
    c.copy(horizon).lerp(top, t);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky';
  scene.add(dome);

  // The low sun: a warm disc with a soft halo ring.
  const sunDir = new THREE.Vector3(...CONFIG.sun.direction).normalize();
  const sunPos = sunDir.clone().multiplyScalar(5200);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(180, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }),
  );
  disc.position.copy(sunPos);
  disc.lookAt(0, 0, 0);
  scene.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(300, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffcf7d, fog: false, transparent: true, opacity: 0.35,
    }),
  );
  halo.position.copy(sunPos).multiplyScalar(0.999);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
  return dome;
}

// buildClouds — flat-bottomed stylised puffs made of squashed spheres.
export function buildClouds(scene, seed = 7) {
  const rand = mulberry32Local(seed);
  const group = new THREE.Group();
  group.name = 'clouds';
  // Unlit warm-white puffs: lit clouds read muddy against the golden sky.
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff8ee, transparent: true, opacity: 0.95,
  });
  for (let i = 0; i < 34; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 26 + rand() * 42;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
      puff.position.set((rand() - 0.5) * 130, (rand() - 0.5) * 12, (rand() - 0.5) * 50);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    const angle = rand() * Math.PI * 2;
    const dist = 700 + rand() * 1800;
    cloud.position.set(
      Math.cos(angle) * dist,
      260 + rand() * 260,
      Math.sin(angle) * dist,
    );
    cloud.userData.drift = 1.5 + rand() * 2.5;
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

function mulberry32Local(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function updateClouds(group, dt, time) {
  for (const cloud of group.children) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 2600) cloud.position.x = -2600;
    cloud.position.y += Math.sin(time * 0.12 + cloud.position.z * 0.01) * dt * 0.4;
  }
}

// buildRunways — dark strips with white edges and threshold bars, plus
// a windsock and hangar huts beside the home field.
export function buildRunways(scene) {
  const group = new THREE.Group();
  group.name = 'runways';
  const stripMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x9dbb6a });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  const windsock = { group: null, cone: null };

  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const strip = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(r.length, r.width), r.paved ? stripMat : grassMat,
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 2.4;
    strip.add(surface);
    // White edge lines.
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(r.length, 1.1), whiteMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(0, 2.55, side * (r.width / 2 - 0.8));
      strip.add(edge);
    }
    // Threshold bars at both ends.
    for (const end of [-1, 1]) {
      for (let b = -2; b <= 2; b++) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), whiteMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(end * (r.length / 2 - 12), 2.55, b * 3.6);
        strip.add(bar);
      }
    }
    // Centre dashes.
    const dashes = Math.floor(r.length / 30);
    for (let i = 0; i < dashes; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.4), whiteMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(-r.length / 2 + 22 + i * 30, 2.55, 0);
      strip.add(dash);
    }
    strip.position.set(r.x, 0, r.z);
    strip.rotation.y = -r.heading;
    group.add(strip);
  }

  // Windsock beside the home runway.
  const sock = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.y = 4.5;
  sock.add(pole);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 10, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xff7a2a, side: THREE.DoubleSide }),
  );
  cone.rotation.z = Math.PI / 2;
  cone.position.set(2.4, 8.6, 0);
  sock.add(cone);
  sock.position.set(RUNWAYS.home.x - 40, 2, RUNWAYS.home.z - 40);
  group.add(sock);
  windsock.group = sock;
  windsock.cone = cone;

  // Two small hangar huts with pyramid roofs near the home field.
  const hutMat = new THREE.MeshLambertMaterial({ color: 0xc9a06a, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3a, flatShading: true });
  for (let i = 0; i < 2; i++) {
    const hut = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 9), hutMat);
    walls.position.y = 2.5;
    hut.add(walls);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 8.2, 3.2, 4, 1),
      roofMat,
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 6.6;
    hut.add(roof);
    hut.position.set(RUNWAYS.home.x - 60 - i * 20, 2, RUNWAYS.home.z + 48);
    group.add(hut);
  }

  scene.add(group);
  return { group, windsock };
}

export function updateWindsock(windsock, windAngle) {
  if (!windsock.group) return;
  windsock.group.rotation.y = -windAngle;
}
