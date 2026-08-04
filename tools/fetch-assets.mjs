#!/usr/bin/env node
/**
 * fetch-assets.mjs — pull the CC0 art packs into `assets/vendor/`.
 *
 * The packs are NOT committed. They are 13MB of binary that would sit in git
 * history forever and never diff usefully. Instead every pack is pinned by URL
 * *and* SHA-256, so a fetch either reproduces the exact bytes this project was
 * built against or fails loudly - which is the property committing them was
 * meant to buy in the first place.
 *
 * `assets/vendor/` is gitignored. Run this after a fresh clone:
 *
 *   npm run assets:fetch
 *
 * Idempotent: a pack already extracted with a matching checksum is skipped.
 *
 * NETWORK. kenney.nl was blocked by this environment's policy until 2026-08-04
 * and is now allowed. If this script starts returning 403 at the gateway the
 * policy has changed rather than the site - see /root/.ccr/README.md, and never
 * work around it by disabling TLS verification.
 *
 * The npm script sets NODE_USE_ENV_PROXY=1 because Node's built-in fetch does
 * not read HTTPS_PROXY on its own; without it every request 403s at the gateway
 * while curl to the same URL succeeds, which is a confusing half hour.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'assets', 'vendor');

/**
 * Every pack is CC0 (Creative Commons Zero) — free for commercial use, credit
 * appreciated but not required. Verified by reading each pack's License.txt,
 * not by trusting the store page.
 *
 * `sha256` pins the exact archive. Kenney's URLs carry a content hash and a
 * timestamp, so a new release gets a new URL rather than silently replacing
 * this one — but the checksum is what actually guarantees that.
 */
const PACKS = [
  {
    name: 'kenney-nature-kit',
    version: '2.1',
    url: 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip',
    sha256: 'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d',
    // 329 .glb models: 61 trees, 29 grounds, 17 crops, 12 fences, 9 flowers,
    // 8 plants, 4 grasses. GLTF-binary is exactly what three.js loads.
    note: '3D garden props (GLB). The one that matters.',
  },
  {
    name: 'kenney-foliage-pack',
    version: '1.0',
    url: 'https://kenney.nl/media/pages/assets/foliage-pack/06a6c43298-1677693473/kenney_foliage-pack.zip',
    sha256: '33bd564f2cebb6a68bee9a798650d669571a389a437b0bd601d257ca2b5e7aed',
    note: '2D foliage sprites. Optional — UI icons come from npm instead.',
    optional: true,
  },
  {
    name: 'kenney-tiny-farm',
    version: '1.0',
    url: 'https://kenney.nl/media/pages/assets/tiny-farm/dfded1ae3e-1782913588/kenney_tiny-farm.zip',
    sha256: 'a06f75f312c27eff15a2288475612e6f6699411be7259d408323cd15a790decc',
    note: '2D farm tiles. Optional — a fallback if the 3D garden is cut.',
    optional: true,
  },
];

const wantOptional = process.argv.includes('--all');
let failures = 0;

for (const pack of PACKS) {
  if (pack.optional && !wantOptional) {
    console.log(`  [skip] ${pack.name} — optional, pass --all to include`);
    continue;
  }

  const dir = join(VENDOR, pack.name);
  const stamp = join(dir, '.sha256');

  if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === pack.sha256) {
    console.log(`  [have] ${pack.name} ${pack.version}`);
    continue;
  }

  process.stdout.write(`  [get ] ${pack.name} ${pack.version} … `);
  let bytes;
  try {
    const response = await fetch(pack.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.log(`FAILED (${error.message})`);
    failures++;
    continue;
  }

  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== pack.sha256) {
    // Never extract bytes that are not the ones this project was built against.
    console.log(`CHECKSUM MISMATCH\n         expected ${pack.sha256}\n         got      ${actual}`);
    failures++;
    continue;
  }

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const archive = join(dir, 'pack.zip');
  writeFileSync(archive, bytes);
  execFileSync('unzip', ['-q', '-o', archive, '-d', dir]);
  rmSync(archive);
  writeFileSync(stamp, `${pack.sha256}\n`);
  console.log(`ok (${(bytes.length / 1e6).toFixed(1)}MB)`);
}

if (failures > 0) {
  console.error(`\n${failures} pack(s) failed. Nothing was extracted for those.`);
  process.exit(1);
}
console.log('\nAssets ready in assets/vendor/. All packs are CC0 (kenney.nl).');
