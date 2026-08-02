/**
 * generators.ts — the 20-tier Garden Plot table, transcribed from §2 of
 * clockwork-garden-design-spec.md.
 *
 * DATA ONLY. The economy that reads it lives in `src/sim/economy.ts`.
 *
 * The audit (`node tools/spec-audit.mjs`) found this table is better built than
 * the spec claims: every tier sits inside the stated 7-10x band, and payback time
 * (cost / yield) is flat at ~150-180s across all 20 tiers. That flatness is what
 * makes the economy read the same whether the number on screen is 15 or 250
 * quadrillion, and it is protected by a regression test. Do not "tidy" these
 * numbers.
 */

/**
 * How a tier becomes purchasable.
 *
 * `insight-node` is a placeholder until Phase 3 authors the real tree
 * (docs/04-spec-open-questions.md item 5) - eight tiers currently gate on
 * "Insight skill unlock" with no node behind it. The simulation approximates it
 * with `proxyOwnedOfPreviousTier` until then.
 */
export type UnlockGate =
  | { readonly kind: 'start' }
  | { readonly kind: 'own-count'; readonly tier: number; readonly count: number }
  | { readonly kind: 'lifetime-mana'; readonly amount: number }
  | { readonly kind: 'any'; readonly gates: readonly UnlockGate[] }
  | { readonly kind: 'insight-node'; readonly proxyOwnedOfPreviousTier: number }
  | { readonly kind: 'capstone-clear'; readonly season: number }
  | { readonly kind: 'season-start'; readonly season: number };

export interface GeneratorTier {
  /** 1-based tier index, matching the spec's table. */
  readonly tier: number;
  readonly season: 1 | 2 | 3 | 4;
  readonly name: string;
  /** Cost of the FIRST unit. Cost(n) = baseCost * costMult^n, n = owned. */
  readonly baseCost: number;
  /** Must stay inside §9's 1.07-1.12 guardrail band. */
  readonly costMult: number;
  /** Mana per second per owned unit, before any multiplier. */
  readonly baseYield: number;
  readonly unlock: UnlockGate;
}

export const GENERATOR_TIERS: readonly GeneratorTier[] = [
  // --- Season 1: Spring -----------------------------------------------------
  {
    tier: 1,
    season: 1,
    name: 'Watering Can',
    baseCost: 15,
    costMult: 1.1,
    baseYield: 0.1,
    unlock: { kind: 'start' },
  },
  {
    tier: 2,
    season: 1,
    name: 'Sprout Bed',
    baseCost: 150,
    costMult: 1.1,
    baseYield: 1,
    unlock: {
      kind: 'any',
      gates: [
        { kind: 'own-count', tier: 1, count: 10 },
        { kind: 'lifetime-mana', amount: 500 },
      ],
    },
  },
  {
    tier: 3,
    season: 1,
    name: 'Butterfly Swarm',
    baseCost: 1_200,
    costMult: 1.11,
    baseYield: 8,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 4,
    season: 1,
    name: 'Garden Gnome Crew',
    baseCost: 9_000,
    costMult: 1.11,
    baseYield: 55,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 5,
    season: 1,
    name: 'Sunbeam Lattice',
    baseCost: 65_000,
    costMult: 1.12,
    baseYield: 380,
    unlock: { kind: 'capstone-clear', season: 1 },
  },

  // --- Season 2: Summer -----------------------------------------------------
  {
    tier: 6,
    season: 2,
    name: 'Beehive Outpost',
    baseCost: 450_000,
    costMult: 1.1,
    baseYield: 2_600,
    unlock: { kind: 'season-start', season: 2 },
  },
  {
    tier: 7,
    season: 2,
    name: 'Sunflower Field',
    baseCost: 3_200_000,
    costMult: 1.1,
    baseYield: 18_000,
    unlock: { kind: 'own-count', tier: 6, count: 10 },
  },
  {
    tier: 8,
    season: 2,
    name: 'Pollinator Drone Swarm',
    baseCost: 22_000_000,
    costMult: 1.11,
    baseYield: 125_000,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 9,
    season: 2,
    name: 'Nectar Refinery',
    baseCost: 150_000_000,
    costMult: 1.11,
    baseYield: 850_000,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 10,
    season: 2,
    name: 'Solar Bloom Array',
    baseCost: 1e9,
    costMult: 1.12,
    baseYield: 5_800_000,
    unlock: { kind: 'capstone-clear', season: 2 },
  },

  // --- Season 3: Autumn -----------------------------------------------------
  {
    tier: 11,
    season: 3,
    name: 'Harvest Cart Brigade',
    baseCost: 7e9,
    costMult: 1.1,
    baseYield: 4e7,
    unlock: { kind: 'season-start', season: 3 },
  },
  {
    tier: 12,
    season: 3,
    name: 'Grain Silo Complex',
    baseCost: 4.8e10,
    costMult: 1.1,
    baseYield: 2.75e8,
    unlock: { kind: 'own-count', tier: 11, count: 10 },
  },
  {
    tier: 13,
    season: 3,
    name: 'Cider Press Guild',
    baseCost: 3.3e11,
    costMult: 1.11,
    baseYield: 1.9e9,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 14,
    season: 3,
    name: 'Scarecrow Sentinel Network',
    baseCost: 2.3e12,
    costMult: 1.11,
    baseYield: 1.3e10,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 15,
    season: 3,
    name: 'Harvest Moon Shrine',
    baseCost: 1.6e13,
    costMult: 1.12,
    baseYield: 9e10,
    unlock: { kind: 'capstone-clear', season: 3 },
  },

  // --- Season 4: Winter -----------------------------------------------------
  {
    tier: 16,
    season: 4,
    name: 'Frost Lantern Ring',
    baseCost: 1.1e14,
    costMult: 1.1,
    baseYield: 6.2e11,
    unlock: { kind: 'season-start', season: 4 },
  },
  {
    tier: 17,
    season: 4,
    name: 'Insulated Greenhouse Wing',
    baseCost: 7.5e14,
    costMult: 1.1,
    baseYield: 4.3e12,
    unlock: { kind: 'own-count', tier: 16, count: 10 },
  },
  {
    tier: 18,
    season: 4,
    name: 'Ember Furnace Core',
    baseCost: 5.2e15,
    costMult: 1.11,
    baseYield: 2.9e13,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 19,
    season: 4,
    name: 'Aurora Conduit',
    baseCost: 3.6e16,
    costMult: 1.11,
    baseYield: 2e14,
    unlock: { kind: 'insight-node', proxyOwnedOfPreviousTier: 10 },
  },
  {
    tier: 20,
    season: 4,
    name: 'The Clockwork Heart',
    baseCost: 2.5e17,
    costMult: 1.12,
    baseYield: 1.4e15,
    unlock: { kind: 'capstone-clear', season: 4 },
  },
] as const;

export const TIER_COUNT = GENERATOR_TIERS.length;

/** The final tier. Buying it triggers the "Full Bloom" ending (§2). */
export const FINAL_TIER = TIER_COUNT;

/** Tier lookup by 1-based tier number. Throws rather than returning undefined. */
export function tierAt(tier: number): GeneratorTier {
  const entry = GENERATOR_TIERS[tier - 1];
  if (!entry) throw new RangeError(`No generator tier ${tier}`);
  return entry;
}

/**
 * Season capstone gate — a PHASE 1 PLACEHOLDER.
 *
 * Seasons advance on capstone-clear (decision D6), but the Season 1 and 2
 * capstones are undesigned (docs/04 item 4, blocks Phase 5). Until then the
 * simulation gates on owning 10 of the Season's fourth tier, which mirrors the
 * table's own "Own 10x Tier N" idiom and stands in for "has fully engaged with
 * this Season's content".
 */
export const CAPSTONE_GATE_TIER: Readonly<Record<number, number>> = {
  1: 4,
  2: 9,
  3: 14,
  4: 19,
};

export const CAPSTONE_GATE_COUNT = 10;

/** How long clearing a capstone challenge takes, in seconds. Placeholder. */
export const CAPSTONE_DURATION_SECONDS = 90;

/**
 * The first generator tier of each Season. §2a prices Kitchen Garden slots and
 * surfaces relative to this rather than as absolute numbers, so they stay
 * meaningful at every stage without separate quadrillion-scale tuning.
 */
export const SEASON_FIRST_TIER: Readonly<Record<number, number>> = { 1: 1, 2: 6, 3: 11, 4: 16 };

export function seasonTierOneCost(season: number): number {
  return tierAt(SEASON_FIRST_TIER[Math.min(Math.max(season, 1), 4)] ?? 1).baseCost;
}
