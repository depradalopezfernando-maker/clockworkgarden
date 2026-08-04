import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import {
  GROUND_MODEL,
  MATERIAL_ROLES,
  PLOT_STAGE_MODELS,
  SEASON_SCENERY,
  TIER_MODELS,
  referencedModels,
} from '@content/diorama';
import { materialPalette } from '@render/materialPalette';
import { SEASON_KEYS, SEASON_PALETTES } from '@content/palette';
import { TIER_COUNT } from '@content/generators';

const PACK = 'assets/vendor/kenney-nature-kit/Models/GLTF format';
const STAGED = 'public/models';

describe('the diorama registry covers the game', () => {
  it('has a model for every generator tier', () => {
    for (let tier = 1; tier <= TIER_COUNT; tier++) {
      expect(TIER_MODELS[tier], `tier ${tier}`).toBeDefined();
    }
  });

  it('has a model for every Kitchen Garden plot stage', () => {
    // The §2a stages. A stage with no model renders an empty slot, which reads
    // as a bug rather than as bare soil.
    for (const stage of ['bare', 'dug', 'planted', 'growing', 'grown']) {
      expect(PLOT_STAGE_MODELS[stage], stage).toBeDefined();
    }
  });

  it('has scenery for every Season', () => {
    for (let season = 1; season <= SEASON_KEYS.length; season++) {
      expect(SEASON_SCENERY[season]?.length, `season ${season}`).toBeGreaterThan(0);
    }
  });

  it('gives each Season its own trees, so Autumn is not Spring tinted orange', () => {
    const signatures = Object.values(SEASON_SCENERY).map((list) =>
      list.map((entry) => entry.model).join()
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe.runIf(existsSync(PACK))('every referenced model exists in the pack', () => {
  const available = new Set(
    readdirSync(PACK)
      .filter((f) => f.endsWith('.glb'))
      .map((f) => f.replace(/\.glb$/, ''))
  );

  it('names no model the pack does not ship', () => {
    expect(referencedModels().filter((name) => !available.has(name))).toEqual([]);
  });

  it('includes the ground tile', () => {
    expect(available.has(GROUND_MODEL.model)).toBe(true);
  });
});

describe.runIf(existsSync(STAGED))('staging copies exactly what is referenced', () => {
  it('serves every referenced model and nothing else', () => {
    const staged = readdirSync(STAGED)
      .filter((f) => f.endsWith('.glb'))
      .map((f) => f.replace(/\.glb$/, ''))
      .sort();
    expect(staged).toEqual(referencedModels());
  });
});

describe('§11 — every material is recoloured, none keeps the pack palette', () => {
  it('maps every material name the Nature Kit uses', () => {
    // The 23 names the pack actually contains. A name missing here silently
    // keeps Kenney's own colour, which is the "looks like three asset packs"
    // failure §11 exists to prevent.
    const packMaterials = [
      'grass',
      'dirt',
      'stone',
      '_defaultMat',
      'leafsDark',
      'dirtDark',
      'woodBark',
      'woodBarkDark',
      'wood',
      'stoneDark',
      'leafsGreen',
      'water',
      'woodBirch',
      'leafsFall',
      'woodDark',
      'woodInner',
      'colorRed',
      'colorPurple',
      'colorWhite',
      'colorYellow',
      'colorTan',
      'colorRedDark',
      'corn',
    ];
    expect(packMaterials.filter((name) => !(name in MATERIAL_ROLES))).toEqual([]);
  });

  it('resolves every role to a colour, for every Season', () => {
    for (const key of SEASON_KEYS) {
      const roles = materialPalette(SEASON_PALETTES[key]);
      for (const role of Object.values(MATERIAL_ROLES)) {
        expect(roles[role], `${key}/${role}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('derives everything from the six locked colours — Seasons stay distinct', () => {
    const foliage = SEASON_KEYS.map((key) => materialPalette(SEASON_PALETTES[key]).foliage);
    expect(new Set(foliage).size).toBe(SEASON_KEYS.length);
    const soil = SEASON_KEYS.map((key) => materialPalette(SEASON_PALETTES[key]).soil);
    expect(new Set(soil).size).toBe(SEASON_KEYS.length);
  });

  it('keeps derived shades ordered — dark roles are actually darker', () => {
    const value = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    for (const key of SEASON_KEYS) {
      const p = materialPalette(SEASON_PALETTES[key]);
      expect(value(p.soilDark), `${key} soil`).toBeLessThan(value(p.soil));
      expect(value(p.stoneDark), `${key} stone`).toBeLessThan(value(p.stone));
      expect(value(p.bloomDark), `${key} bloom`).toBeLessThan(value(p.bloom));
    }
  });
});
