// main.ts — the hand-in program for Cakrawala Courier.
// Copies game/ and screenshots/ from beside this file into the output
// directory (MAKEFUN_OUTPUT_DIR when set, otherwise /output) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts,
// using the same caps the kit starter uses.

import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      cpSync(from, to);
    }
  }
}

function main(): void {
  const gameDir = join(repoDir, 'game');
  const shotsDir = join(repoDir, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error('main.ts: no game/ directory beside main.ts');
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error('main.ts: no screenshots/ directory beside main.ts');
  }
  // A clean output directory, so a second run writes the same bytes.
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(gameDir, join(outDir, 'game'));
  copyTree(shotsDir, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const shotCount = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).length;
  console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes) with ${shotCount} screenshots`);
}

main();
