/**
 * materialPalette.ts — derive every material role from the six locked colours.
 *
 * `SeasonPalette` carries six roles a human chose and signed off (§11). Models
 * need more than six: bark, stone, water, pale trims. Rather than re-opening a
 * locked decision, those are DERIVED here by fixed transforms of the six, so a
 * palette change still propagates everywhere and nobody has to pick a stone
 * colour that no one has an opinion about.
 *
 * Pure and free of three.js so it can be unit-tested under Node.
 */

import type { SeasonPalette } from '@content/palette';
import type { MaterialRole } from '@content/diorama';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parse(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** `amount` 0..1 toward black. */
function darken(hex: string, amount: number): string {
  const c = parse(hex);
  return toHex({ r: c.r * (1 - amount), g: c.g * (1 - amount), b: c.b * (1 - amount) });
}

/** `amount` 0..1 toward white. */
function lighten(hex: string, amount: number): string {
  const c = parse(hex);
  return toHex({
    r: c.r + (255 - c.r) * amount,
    g: c.g + (255 - c.g) * amount,
    b: c.b + (255 - c.b) * amount,
  });
}

/** `t` 0 = a, 1 = b. */
function mix(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  return toHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

/** Pull a colour toward its own grey. `amount` 0 = unchanged, 1 = fully grey. */
function desaturate(hex: string, amount: number): string {
  const c = parse(hex);
  const grey = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return toHex({
    r: c.r + (grey - c.r) * amount,
    g: c.g + (grey - c.g) * amount,
    b: c.b + (grey - c.b) * amount,
  });
}

/**
 * The full role table for one Season.
 *
 * Every value traces back to one of the six locked colours. Read it as: foliage
 * IS the primary, bark is the ground gone woody, stone is the ground pulled
 * toward the sky and drained of chroma.
 */
export function materialPalette(palette: SeasonPalette): Readonly<Record<MaterialRole, string>> {
  const stone = desaturate(mix(palette.ground, palette.sky, 0.62), 0.45);
  return {
    foliage: palette.primary,
    foliageDark: palette.shadow,
    foliageAccent: palette.secondary,

    soil: palette.ground,
    soilDark: darken(palette.ground, 0.28),

    bark: darken(palette.ground, 0.16),
    barkDark: palette.shadow,
    barkPale: lighten(palette.secondary, 0.28),

    stone,
    stoneDark: darken(stone, 0.26),
    water: darken(palette.sky, 0.18),

    // Blooms carry the accent. They are the smallest surfaces in the scene and
    // the ones the eye goes to, which is why §11 reserves the accent for
    // rewards and active states rather than spending it on foliage.
    bloom: palette.accent,
    bloomDark: darken(palette.accent, 0.26),

    pale: lighten(palette.secondary, 0.45),
  };
}
