// random.js — a small seeded random source so the world is the same
// every time the game loads, and so a screenshot seed replays exactly.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise built on a seeded grid, for gentle terrain bumps.
export function makeValueNoise(seed) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(64 * 64);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    const gx = x * 0.004 + 32;
    const gz = z * 0.004 + 32;
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const fx = smooth(gx - x0);
    const fz = smooth(gz - z0);
    const at = (ix, iz) => grid[((iz & 63) * 64) + (ix & 63)];
    const a = at(x0, z0);
    const b = at(x0 + 1, z0);
    const c = at(x0, z0 + 1);
    const d = at(x0 + 1, z0 + 1);
    return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
  };
}
