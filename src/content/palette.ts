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
 * HUMAN REVIEW REQUIRED. These ramps are a defensible starting point, not an
 * art-directed choice. Claude cannot judge whether they look good - only that
 * they are structurally valid and sufficiently distinct per Season. Treat this
 * as a first draft to be replaced by a human eye in an hour of work, before any
 * asset enters the repo. See CLAUDE.md, "What Claude cannot judge here".
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
  // Season 1 — Spring. Fresh, high-value, low-saturation ground.
  spring: {
    primary: '#7cb342',
    secondary: '#aed581',
    accent: '#f48fb1',
    shadow: '#33691e',
    ground: '#8d6e63',
    sky: '#c5e1e8',
  },
  // Season 2 — Summer. Warmer and more saturated; gold replaces pink as accent.
  summer: {
    primary: '#43a047',
    secondary: '#fdd835',
    accent: '#fb8c00',
    shadow: '#1b5e20',
    ground: '#a1887f',
    sky: '#81d4fa',
  },
  // Season 3 — Autumn. Hue rotates warm; the ground reads drier and more ochre
  // than Spring's damp earth, so the two Seasons never share terrain colour.
  autumn: {
    primary: '#ef6c00',
    secondary: '#c62828',
    accent: '#ffd54f',
    shadow: '#4e342e',
    ground: '#7d5a3c',
    sky: '#ffcc80',
  },
  // Season 4 — Winter. Desaturated and cool, so Frost reads instantly; the
  // accent stays warm on purpose - it is the Ember Furnace and the Clockwork
  // Heart, the only warmth left in the scene.
  winter: {
    primary: '#90a4ae',
    secondary: '#eceff1',
    accent: '#ff7043',
    shadow: '#37474f',
    ground: '#b0bec5',
    sky: '#cfd8dc',
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
  surface: '#1f1b16',
  surfaceRaised: '#2b2620',
  text: '#f5efe6',
  textMuted: '#a89f92',
  border: '#3d362d',
  positive: '#7cb342',
  negative: '#e53935',
  /** Mana. Deliberately distinct from every Season primary. */
  mana: '#9575cd',
  /** Insight. */
  insight: '#4fc3f7',
} as const;

export const SEASON_KEYS: readonly SeasonKey[] = ['spring', 'summer', 'autumn', 'winter'];
