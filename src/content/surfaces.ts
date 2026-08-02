/**
 * surfaces.ts — the six Kitchen Garden surfaces (§2a).
 *
 * DATA ONLY. Behaviour lives in `src/sim/kitchenGarden.ts`.
 *
 * Surfaces are unlocked by Insight nodes (`kg-surface` effects) and then applied
 * to a plot for a small Mana fee. §2a's table, transcribed:
 *
 *   Surface            Unlocks     Grow    Yield   Capacity  Special
 *   Bare Soil Plot     Start       1.00x   1.00x   1         free forever
 *   Terracotta Pot     S1 Insight  0.75x   0.85x   1         rapid early cycling
 *   Stone Parterre     S2 Insight  1.30x   1.50x   1         rewards patience
 *   Raised Garden Box  S2 Insight  1.00x   1.00x   3         one cycle plants all
 *   Greenhouse Bed     S4 Insight  1.00x   1.10x   1         immune to Frost
 *   Clockwork Trellis  S4 Insight  1.00x   1.20x   5         automation built in
 */

export type SurfaceId =
  | 'bare-soil'
  | 'terracotta-pot'
  | 'stone-parterre'
  | 'raised-garden-box'
  | 'greenhouse-bed'
  | 'clockwork-trellis';

export interface Surface {
  readonly id: SurfaceId;
  readonly name: string;
  /** Multiplies grow time. Below 1 is faster. */
  readonly growTimeMult: number;
  /** Multiplies this plot's yield contribution. */
  readonly yieldMult: number;
  /** Plants per slot. One Dig/Plant/Cover cycle fills all of them. */
  readonly capacity: number;
  /** Mana fee to apply, as a multiple of the current Season's Tier-1 cost. */
  readonly applyCostMultiplier: number;
  /** §6.3: exempt from Frost Dormancy's output penalty. Read in Phase 9. */
  readonly frostImmune: boolean;
  /**
   * §2a: the Clockwork Trellis "ships with Level-2 automation pre-installed", so
   * its cycles cost no Day Time regardless of what the Insight tree has bought.
   */
  readonly builtInAutomationLevel: 0 | 2;
  readonly description: string;
}

export const SURFACES: Readonly<Record<SurfaceId, Surface>> = {
  'bare-soil': {
    id: 'bare-soil',
    name: 'Bare Soil',
    growTimeMult: 1,
    yieldMult: 1,
    capacity: 1,
    applyCostMultiplier: 0,
    frostImmune: false,
    builtInAutomationLevel: 0,
    description: 'Free forever. The hands-on default.',
  },
  'terracotta-pot': {
    id: 'terracotta-pot',
    name: 'Terracotta Pot',
    growTimeMult: 0.75,
    yieldMult: 0.85,
    capacity: 1,
    applyCostMultiplier: 2,
    frostImmune: false,
    builtInAutomationLevel: 0,
    description: 'Faster to cycle, a little less from each crop.',
  },
  'stone-parterre': {
    id: 'stone-parterre',
    name: 'Stone Parterre',
    growTimeMult: 1.3,
    yieldMult: 1.5,
    capacity: 1,
    applyCostMultiplier: 6,
    frostImmune: false,
    builtInAutomationLevel: 0,
    description: 'Slower, but rewards the wait.',
  },
  'raised-garden-box': {
    id: 'raised-garden-box',
    name: 'Raised Garden Box',
    growTimeMult: 1,
    yieldMult: 1,
    capacity: 3,
    applyCostMultiplier: 10,
    frostImmune: false,
    builtInAutomationLevel: 0,
    description: 'Three plants, one cycle.',
  },
  'greenhouse-bed': {
    id: 'greenhouse-bed',
    name: 'Greenhouse Bed',
    growTimeMult: 1,
    yieldMult: 1.1,
    capacity: 1,
    applyCostMultiplier: 20,
    frostImmune: true,
    builtInAutomationLevel: 0,
    description: 'Untouched by Frost Dormancy.',
  },
  'clockwork-trellis': {
    id: 'clockwork-trellis',
    name: 'Clockwork Trellis',
    growTimeMult: 1,
    yieldMult: 1.2,
    capacity: 5,
    applyCostMultiplier: 40,
    frostImmune: false,
    builtInAutomationLevel: 2,
    description: 'Five plants, and it tends itself.',
  },
} as const;

export const DEFAULT_SURFACE: SurfaceId = 'bare-soil';

export const SURFACE_IDS = Object.keys(SURFACES) as SurfaceId[];

export function surfaceById(id: string): Surface {
  return SURFACES[id as SurfaceId] ?? SURFACES[DEFAULT_SURFACE];
}

/** The Insight node id that unlocks each surface. Bare Soil needs none. */
export const SURFACE_UNLOCK_NODE: Readonly<Partial<Record<SurfaceId, string>>> = {
  'terracotta-pot': 's1-kg-terracotta',
  'stone-parterre': 's2-kg-stone',
  'raised-garden-box': 's2-kg-raised',
  'greenhouse-bed': 's4-kg-greenhouse',
  'clockwork-trellis': 's4-kg-trellis',
};
