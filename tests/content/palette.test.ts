import { describe, it, expect } from 'vitest';
import { SEASON_PALETTES, SEASON_KEYS, UI_PALETTE, EDGE_TREATMENT } from '@content/palette';
import type { SeasonPalette } from '@content/palette';

/**
 * §11's consistency guardrail says to lock a palette BEFORE sourcing assets.
 * These tests verify the lock is structurally sound - that it covers every
 * Season, every role, and that the Seasons are actually distinguishable.
 *
 * They cannot verify that it LOOKS good. That is a human review, flagged in
 * src/content/palette.ts.
 */

const HEX = /^#[0-9a-f]{6}$/;
const ROLES: readonly (keyof SeasonPalette)[] = [
  'primary',
  'secondary',
  'accent',
  'shadow',
  'ground',
  'sky',
];

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
};

describe('palette lock is complete', () => {
  it('covers all four Seasons', () => {
    expect(SEASON_KEYS).toHaveLength(4);
    for (const key of SEASON_KEYS) {
      expect(SEASON_PALETTES[key]).toBeDefined();
    }
  });

  it('defines every role for every Season as lowercase 6-digit hex', () => {
    for (const key of SEASON_KEYS) {
      const palette = SEASON_PALETTES[key];
      for (const role of ROLES) {
        expect(palette[role], `${key}.${role}`).toMatch(HEX);
      }
    }
  });

  it('defines the UI chrome palette', () => {
    for (const [name, value] of Object.entries(UI_PALETTE)) {
      expect(value, name).toMatch(HEX);
    }
  });
});

describe('Seasons are visually distinguishable', () => {
  it('no two Seasons share a primary hue', () => {
    const primaries = SEASON_KEYS.map((k) => SEASON_PALETTES[k].primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });

  it('no two Seasons share an identical colour in the same role', () => {
    // Caught Spring and Autumn both using #8d6e63 for ground, which made the two
    // Seasons' terrain indistinguishable.
    for (const role of ROLES) {
      const used = SEASON_KEYS.map((k) => SEASON_PALETTES[k][role]);
      expect(
        new Set(used).size,
        `role "${role}" is reused across Seasons: ${used.join(', ')}`
      ).toBe(used.length);
    }
  });

  it('every Season has internal contrast between shadow and primary', () => {
    for (const key of SEASON_KEYS) {
      const p = SEASON_PALETTES[key];
      const delta = Math.abs(luminance(p.primary) - luminance(p.shadow));
      expect(delta, `${key}: shadow must read against primary`).toBeGreaterThan(0.1);
    }
  });

  it('shadows are tinted, never pure black (keeps the diorama look soft)', () => {
    for (const key of SEASON_KEYS) {
      expect(SEASON_PALETTES[key].shadow).not.toBe('#000000');
      expect(luminance(SEASON_PALETTES[key].shadow)).toBeGreaterThan(0.05);
    }
  });

  it('Winter is the most desaturated Season, so Frost reads instantly (§6.3)', () => {
    const saturation = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const max = Math.max(r!, g!, b!);
      const min = Math.min(r!, g!, b!);
      return max === 0 ? 0 : (max - min) / max;
    };
    const winter = saturation(SEASON_PALETTES.winter.primary);
    for (const key of ['spring', 'summer', 'autumn'] as const) {
      expect(winter, `winter vs ${key}`).toBeLessThan(saturation(SEASON_PALETTES[key].primary));
    }
  });
});

describe('silhouette treatment is locked (§11)', () => {
  it('commits to flat shading and a consistent outline', () => {
    expect(EDGE_TREATMENT.flatShaded).toBe(true);
    expect(EDGE_TREATMENT.outlineWidth).toBeGreaterThan(0);
    expect(EDGE_TREATMENT.outlineColor).toMatch(HEX);
  });

  it('fixes the isometric camera inside §11 Style A range (30–45°)', () => {
    expect(EDGE_TREATMENT.cameraAngleDegrees).toBeGreaterThanOrEqual(30);
    expect(EDGE_TREATMENT.cameraAngleDegrees).toBeLessThanOrEqual(45);
  });
});
