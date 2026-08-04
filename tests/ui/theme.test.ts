import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeVariables, seasonKeyFor } from '@ui/theme';
import { SEASON_KEYS, SEASON_PALETTES, UI_PALETTE } from '@content/palette';

const CSS = readFileSync(
  fileURLToPath(new URL('../../src/ui/styles.css', import.meta.url)),
  'utf8'
);

describe('the stylesheet only uses variables the theme actually defines', () => {
  // A `var(--nope, #4a4a4a)` looks fine and renders fine - silently, on the
  // fallback, forever. Three of those shipped before this test existed, which is
  // how a "the stylesheet never hard-codes a colour" rule quietly stopped being
  // true. CSS cannot fail loudly here, so the check has to live outside it.
  const defined = new Set(Object.keys(themeVariables(1)));

  it('every custom property referenced in styles.css is provided by themeVariables', () => {
    const referenced = [...CSS.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]!);
    const dangling = [...new Set(referenced)].filter((name) => !defined.has(name));
    expect(dangling, `styles.css references ${dangling.join(', ')}`).toEqual([]);
  });

  it('no var() carries a colour fallback, which would mask a missing variable', () => {
    const withColourFallback = [
      ...CSS.matchAll(/var\(\s*--[a-z0-9-]+\s*,\s*(#[0-9a-f]{3,8})/gi),
    ].map((m) => m[0]!);
    expect(withColourFallback).toEqual([]);
  });

  it('themeVariables exposes every palette role', () => {
    for (const role of ['primary', 'secondary', 'accent', 'shadow', 'ground', 'sky']) {
      expect(defined.has(`--season-${role}`), role).toBe(true);
    }
    for (const key of Object.keys(UI_PALETTE)) {
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(defined.has(`--ui-${kebab}`), key).toBe(true);
    }
  });
});

describe('the Season ramp actually changes with the Season', () => {
  it('maps each Season number to its own palette', () => {
    for (let season = 1; season <= 4; season++) {
      const key = seasonKeyFor(season);
      expect(themeVariables(season)['--season-primary']).toBe(SEASON_PALETTES[key].primary);
    }
  });

  it('clamps out-of-range Seasons rather than producing undefined', () => {
    expect(seasonKeyFor(0)).toBe(SEASON_KEYS[0]);
    expect(seasonKeyFor(99)).toBe(SEASON_KEYS[SEASON_KEYS.length - 1]);
    for (const value of Object.values(themeVariables(99))) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
