/**
 * palette.ts — the locked colour palette.
 *
 * This exists to satisfy §11's consistency guardrail:
 *
 *   "fix a palette and a silhouette treatment BEFORE sourcing more than one pack
 *    — this is the single most common way indie clicker games end up looking
 *    inconsistent, even when every individual asset is technically low poly."
 *
 * Turning that instruction into DATA is what makes asset integration tractable
 * for an agent. Every sourced pack is recoloured to the nearest entry here at
 * import time (see docs/05-asset-pipeline.md §4), so integration becomes a
 * mechanical transform rather than an aesthetic judgement.
 *
 * ---------------------------------------------------------------------------
 * HUMAN REVIEW DONE — 2026-08-04. Direction chosen: "Enamel" for the Seasons,
 * "Slate" for the UI chrome, picked from four worked-through candidates.
 *
 * Enamel is a painted-tin-toy reading: higher chroma than the original draft,
 * clean edges, holds up at phone size. The palette is now LOCKED per §11 - every
 * sourced model is recoloured to the nearest entry here at import time, so a
 * change after assets land is not cheap. Reopen deliberately, not casually.
 * ---------------------------------------------------------------------------
 */

export interface SeasonPalette {
  /** Dominant hue of the Season's foliage and hero props. */
  readonly primary: string;
  /** Supporting hue - secondary planting, structures. */
  readonly secondary: string;
  /** High-chroma highlight. Used sparingly: rewards, active states, capstones. */
  readonly accent: string;
  /** Shadow / occlusion tint. Never pure black - keeps the diorama look soft. */
  readonly shadow: string;
  /** Terrain and plot tiles. */
  readonly ground: string;
  /** Backdrop and atmospheric fill. */
  readonly sky: string;
}

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_PALETTES: Readonly<Record<SeasonKey, SeasonPalette>> = {
  // Season 1 — Spring. Fresh and bright; hot pink accent against warm clay ground.
  spring: {
    primary: '#5fbb46',
    secondary: '#b6e05a',
    accent: '#ff4d87',
    shadow: '#2b6626',
    ground: '#a9703f',
    sky: '#a8dfe8',
  },
  // Season 2 — Summer. Deeper leaf, gold secondary; the sky carries the heat.
  summer: {
    primary: '#2f9e44',
    secondary: '#ffd43b',
    accent: '#ff922b',
    shadow: '#175230',
    ground: '#c08552',
    sky: '#4dabf7',
  },
  // Season 3 — Autumn. Hue rotates warm. Ground reads drier and more ochre than
  // Spring's damp clay, so the two Seasons never share terrain colour.
  autumn: {
    primary: '#f76707',
    secondary: '#c92a2a',
    accent: '#ffd43b',
    shadow: '#4d2f1c',
    ground: '#8f5f3a',
    sky: '#ffc078',
  },
  // Season 4 — Winter. Desaturated and cool so Frost reads instantly; the accent
  // stays warm on purpose - the Ember Furnace and the Clockwork Heart are the only
  // warmth left in the scene.
  winter: {
    primary: '#74a3b8',
    secondary: '#f1f3f5',
    accent: '#ff6b35',
    shadow: '#26383f',
    ground: '#c5ced4',
    sky: '#dbe4e9',
  },
} as const;

/**
 * §11's "silhouette treatment", also locked as data. Flat shading plus a
 * consistent outline is what makes assets from different packs read as one game.
 */
export const EDGE_TREATMENT = {
  flatShaded: true,
  outlineWidth: 0.015,
  outlineColor: '#2b2118',
  /** Fixed isometric camera angle, §11 Style A. Degrees from horizontal. */
  cameraAngleDegrees: 35,
} as const;

/** UI chrome, shared across all Seasons so the HUD stays stable as they change. */
export const UI_PALETTE = {
  surface: '#161a1d',
  surfaceRaised: '#212729',
  text: '#eef2f4',
  textMuted: '#95a2a8',
  border: '#2f383c',
  positive: '#66bb6a',
  negative: '#ef5350',
  /** Mana. Deliberately distinct from every Season primary. */
  mana: '#7e8cff',
  /** Insight. */
  insight: '#29b6f6',
} as const;

export const SEASON_KEYS: readonly SeasonKey[] = ['spring', 'summer', 'autumn', 'winter'];
