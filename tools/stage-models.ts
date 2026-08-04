/**
 * stage-models.ts — copy only the models the game actually references into
 * `public/models/`, so Vite serves them and the bundle carries no more than it
 * needs.
 *
 * The Nature Kit is 329 models and 10.5MB. The registry references a few dozen.
 * Copying the whole pack into `public/` would ship the rest to every player.
 *
 * Run: npm run assets:stage   (assets:fetch must have run first)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { referencedModels } from '@content/diorama';

const SOURCE = 'assets/vendor/kenney-nature-kit/Models/GLTF format';
const TARGET = 'public/models';

if (!existsSync(SOURCE)) {
  console.error(`No pack at ${SOURCE}. Run: npm run assets:fetch`);
  process.exit(1);
}

const available = new Set(
  readdirSync(SOURCE)
    .filter((f) => f.endsWith('.glb'))
    .map((f) => f.replace(/\.glb$/, ''))
);

const wanted = referencedModels();
const missing = wanted.filter((name) => !available.has(name));
if (missing.length > 0) {
  // Fail rather than ship a diorama with holes in it. A test catches this too,
  // but the test cannot run without the pack, so the check lives here as well.
  console.error(`Registry references models the pack does not have:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });
let bytes = 0;
for (const name of wanted) {
  const from = join(SOURCE, `${name}.glb`);
  copyFileSync(from, join(TARGET, `${name}.glb`));
  bytes += statSync(from).size;
}

console.log(`Staged ${wanted.length} models (${(bytes / 1e6).toFixed(2)}MB) into ${TARGET}/`);
