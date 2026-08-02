/**
 * insightTree.ts — the Insight skill tree (§3).
 *
 * DATA ONLY. Purchase logic and effect aggregation live in `src/sim/insight.ts`.
 *
 * This file resolves `docs/04-spec-open-questions.md` item 5: eight generator
 * tiers unlock on "Insight skill unlock" in the spec's §2 table, with no node
 * behind them. Every one now points at a real node with real prerequisites, and
 * a test asserts the correspondence in both directions.
 *
 * §3 asks for ~45-55 nodes across: generator unlocks, click power, offline
 * efficiency, Kitchen Garden progression, and purely cosmetic decorations.
 */

/** What buying a node does. */
export type NodeEffect =
  /** Opens a Garden Plot tier for purchase (§2's "Insight skill unlock" gates). */
  | { readonly kind: 'unlock-generator'; readonly tier: number }
  /** Additive to the click bonus: 1.0 means +100%. */
  | { readonly kind: 'click-bonus'; readonly amount: number }
  /** Additive to a global production multiplier: 0.1 means +10%. */
  | { readonly kind: 'production-bonus'; readonly amount: number }
  /** Raises §7's offline floor, e.g. 0.05 lifts 50% to 55%. */
  | { readonly kind: 'offline-floor'; readonly amount: number }
  /** Extends §5's Frenzy window, in seconds. */
  | { readonly kind: 'frenzy-duration'; readonly seconds: number }
  /** Extra Kitchen Garden plot slots (§2a). */
  | { readonly kind: 'kg-slots'; readonly amount: number }
  /** Unlocks a Kitchen Garden surface (§2a's table). */
  | { readonly kind: 'kg-surface'; readonly surface: string }
  /** One automation level for one step (§2a). */
  | {
      readonly kind: 'kg-automation';
      readonly step: 'dig' | 'plant' | 'cover';
      readonly level: 1 | 2;
    }
  /** Advances Day Length along §2a's 30/45/60/90/120s ladder. */
  | { readonly kind: 'kg-day-length'; readonly step: number }
  /** Seed Satchel capacity (§2a). */
  | { readonly kind: 'satchel-capacity'; readonly amount: number }
  /** Multiplies §6.2's Barn Capacity. */
  | { readonly kind: 'barn-capacity'; readonly multiplier: number }
  /** One of §6.3's three Insulation steps. */
  | { readonly kind: 'insulation' }
  /** No mechanical effect. §3 asks for these explicitly — pure expression. */
  | { readonly kind: 'cosmetic' };

export interface InsightNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Season the node belongs to. Nodes are hidden until that Season is reached. */
  readonly season: 1 | 2 | 3 | 4;
  readonly cost: number;
  /** Node ids that must be purchased first. Empty means a branch root. */
  readonly requires: readonly string[];
  readonly effect: NodeEffect;
}

export const INSIGHT_TREE: readonly InsightNode[] = [
  // ===========================================================================
  // Season 1 — Spring
  // ===========================================================================
  {
    id: 's1-click-1',
    name: 'Steady Hands',
    description: 'Ringing the Bell yields twice as much Mana.',
    season: 1,
    cost: 1,
    requires: [],
    effect: { kind: 'click-bonus', amount: 1 },
  },
  {
    id: 's1-compost',
    name: 'Rich Compost',
    description: 'All Garden Plots produce 6% more.',
    season: 1,
    cost: 2,
    requires: ['s1-click-1'],
    effect: { kind: 'production-bonus', amount: 0.06 },
  },
  {
    id: 's1-gen-3',
    name: 'Butterfly Husbandry',
    description: 'Unlocks the Butterfly Swarm.',
    season: 1,
    cost: 2,
    requires: ['s1-click-1'],
    effect: { kind: 'unlock-generator', tier: 3 },
  },
  {
    id: 's1-gen-4',
    name: 'Gnome Diplomacy',
    description: 'Unlocks the Garden Gnome Crew.',
    season: 1,
    cost: 4,
    requires: ['s1-gen-3'],
    effect: { kind: 'unlock-generator', tier: 4 },
  },
  {
    id: 's1-deeper-beds',
    name: 'Deeper Beds',
    description: 'All Garden Plots produce a further 8% more.',
    season: 1,
    cost: 4,
    requires: ['s1-compost'],
    effect: { kind: 'production-bonus', amount: 0.08 },
  },
  {
    id: 's1-click-2',
    name: 'Practised Swing',
    description: 'Ringing the Bell yields more again.',
    season: 1,
    cost: 5,
    requires: ['s1-click-1'],
    effect: { kind: 'click-bonus', amount: 1.5 },
  },
  {
    id: 's1-frenzy-1',
    name: 'Lingering Bloom',
    description: 'Growth Frenzy lasts 5 seconds longer.',
    season: 1,
    cost: 3,
    requires: ['s1-click-1'],
    effect: { kind: 'frenzy-duration', seconds: 5 },
  },
  {
    id: 's1-offline-1',
    name: 'Night Watch',
    description: 'The garden keeps a little more of its pace while you are away.',
    season: 1,
    cost: 3,
    requires: [],
    effect: { kind: 'offline-floor', amount: 0.05 },
  },
  {
    id: 's1-kg-slots-1',
    name: 'Broken Ground',
    description: 'Two more Kitchen Garden plot slots.',
    season: 1,
    cost: 2,
    requires: [],
    effect: { kind: 'kg-slots', amount: 2 },
  },
  {
    id: 's1-kg-terracotta',
    name: 'Terracotta Pots',
    description: 'A faster-cycling surface that yields a little less.',
    season: 1,
    cost: 3,
    requires: ['s1-kg-slots-1'],
    effect: { kind: 'kg-surface', surface: 'terracotta-pot' },
  },
  {
    id: 's1-kg-day-1',
    name: 'Longer Mornings',
    description: 'Day Length rises to 45 seconds.',
    season: 1,
    cost: 3,
    requires: ['s1-kg-slots-1'],
    effect: { kind: 'kg-day-length', step: 1 },
  },
  {
    id: 's1-satchel-1',
    name: 'Wider Satchel',
    description: 'Carry ten more Seeds.',
    season: 1,
    cost: 2,
    requires: ['s1-kg-slots-1'],
    effect: { kind: 'satchel-capacity', amount: 10 },
  },

  // ===========================================================================
  // Season 2 — Summer
  // ===========================================================================
  {
    id: 's2-gen-8',
    name: 'Drone Choreography',
    description: 'Unlocks the Pollinator Drone Swarm.',
    season: 2,
    cost: 6,
    requires: ['s1-gen-4'],
    effect: { kind: 'unlock-generator', tier: 8 },
  },
  {
    id: 's2-gen-9',
    name: 'Nectar Chemistry',
    description: 'Unlocks the Nectar Refinery.',
    season: 2,
    cost: 9,
    requires: ['s2-gen-8'],
    effect: { kind: 'unlock-generator', tier: 9 },
  },
  {
    id: 's2-sunlight',
    name: 'Sunlight Discipline',
    description: 'All Garden Plots produce 10% more.',
    season: 2,
    cost: 6,
    requires: ['s1-deeper-beds'],
    effect: { kind: 'production-bonus', amount: 0.1 },
  },
  {
    id: 's2-click-3',
    name: 'Bell Resonance',
    description: 'Ringing the Bell yields substantially more.',
    season: 2,
    cost: 7,
    requires: ['s1-click-2'],
    effect: { kind: 'click-bonus', amount: 3 },
  },
  {
    id: 's2-frenzy-2',
    name: 'Second Wind',
    description: 'Growth Frenzy lasts 5 seconds longer again.',
    season: 2,
    cost: 6,
    requires: ['s1-frenzy-1'],
    effect: { kind: 'frenzy-duration', seconds: 5 },
  },
  {
    id: 's2-offline-2',
    name: 'Moonlit Rows',
    description: 'The garden holds its pace better still while you are away.',
    season: 2,
    cost: 6,
    requires: ['s1-offline-1'],
    effect: { kind: 'offline-floor', amount: 0.05 },
  },
  {
    id: 's2-kg-slots-2',
    name: 'Turned Earth',
    description: 'Four more Kitchen Garden plot slots.',
    season: 2,
    cost: 4,
    requires: ['s1-kg-slots-1'],
    effect: { kind: 'kg-slots', amount: 4 },
  },
  {
    id: 's2-kg-stone',
    name: 'Stone Parterre',
    description: 'A slower surface that rewards patience with a higher yield.',
    season: 2,
    cost: 4,
    requires: ['s1-kg-terracotta'],
    effect: { kind: 'kg-surface', surface: 'stone-parterre' },
  },
  {
    id: 's2-kg-raised',
    name: 'Raised Garden Box',
    description: 'Three plants per slot, planted in one dig-and-cover cycle.',
    season: 2,
    cost: 5,
    requires: ['s1-kg-terracotta'],
    effect: { kind: 'kg-surface', surface: 'raised-garden-box' },
  },
  {
    id: 's2-auto-dig-1',
    name: 'Assisted Digging',
    description: 'Digging takes half as long, at a small cost to yield.',
    season: 2,
    cost: 3,
    requires: ['s2-kg-slots-2'],
    effect: { kind: 'kg-automation', step: 'dig', level: 1 },
  },
  {
    id: 's2-auto-plant-1',
    name: 'Assisted Planting',
    description: 'Planting takes half as long, at a small cost to yield.',
    season: 2,
    cost: 3,
    requires: ['s2-auto-dig-1'],
    effect: { kind: 'kg-automation', step: 'plant', level: 1 },
  },

  // ===========================================================================
  // Season 3 — Autumn
  // ===========================================================================
  {
    id: 's3-gen-13',
    name: 'Cider Craft',
    description: 'Unlocks the Cider Press Guild.',
    season: 3,
    cost: 12,
    requires: ['s2-gen-9'],
    effect: { kind: 'unlock-generator', tier: 13 },
  },
  {
    id: 's3-gen-14',
    name: 'Sentinel Doctrine',
    description: 'Unlocks the Scarecrow Sentinel Network.',
    season: 3,
    cost: 16,
    requires: ['s3-gen-13'],
    effect: { kind: 'unlock-generator', tier: 14 },
  },
  {
    id: 's3-barn-1',
    name: 'Raised Rafters',
    description: 'The Barn holds half again as much Mana.',
    season: 3,
    cost: 8,
    requires: [],
    effect: { kind: 'barn-capacity', multiplier: 1.5 },
  },
  {
    id: 's3-barn-2',
    name: 'Second Granary',
    description: 'The Barn holds twice as much again.',
    season: 3,
    cost: 14,
    requires: ['s3-barn-1'],
    effect: { kind: 'barn-capacity', multiplier: 2 },
  },
  {
    id: 's3-harvest-lore',
    name: 'Harvest Lore',
    description: 'All Garden Plots produce 12% more.',
    season: 3,
    cost: 12,
    requires: ['s2-sunlight'],
    effect: { kind: 'production-bonus', amount: 0.12 },
  },
  {
    id: 's3-click-4',
    name: 'Harvest Peal',
    description: 'Ringing the Bell yields far more.',
    season: 3,
    cost: 12,
    requires: ['s2-click-3'],
    effect: { kind: 'click-bonus', amount: 6 },
  },
  {
    id: 's3-offline-3',
    name: 'Frost-Proof Cloches',
    description: 'The garden barely slows while you are away.',
    season: 3,
    cost: 12,
    requires: ['s2-offline-2'],
    effect: { kind: 'offline-floor', amount: 0.05 },
  },
  {
    id: 's3-kg-slots-3',
    name: 'Widened Beds',
    description: 'Five more Kitchen Garden plot slots.',
    season: 3,
    cost: 6,
    requires: ['s2-kg-slots-2'],
    effect: { kind: 'kg-slots', amount: 5 },
  },
  {
    id: 's3-auto-cover-1',
    name: 'Assisted Covering',
    description: 'Covering takes half as long, at a small cost to yield.',
    season: 3,
    cost: 5,
    requires: ['s2-auto-plant-1'],
    effect: { kind: 'kg-automation', step: 'cover', level: 1 },
  },
  {
    id: 's3-auto-dig-2',
    name: 'Automatic Digging',
    description: 'Digging is instant and free of Day Time, at full yield.',
    season: 3,
    cost: 8,
    requires: ['s3-auto-cover-1'],
    effect: { kind: 'kg-automation', step: 'dig', level: 2 },
  },
  {
    id: 's3-kg-day-2',
    name: 'Long Afternoons',
    description: 'Day Length rises to 60 seconds.',
    season: 3,
    cost: 6,
    requires: ['s1-kg-day-1'],
    effect: { kind: 'kg-day-length', step: 2 },
  },

  // ===========================================================================
  // Season 4 — Winter
  // ===========================================================================
  {
    id: 's4-gen-18',
    name: 'Ember Metallurgy',
    description: 'Unlocks the Ember Furnace Core.',
    season: 4,
    cost: 20,
    requires: ['s3-gen-14'],
    effect: { kind: 'unlock-generator', tier: 18 },
  },
  {
    id: 's4-gen-19',
    name: 'Aurora Theory',
    description: 'Unlocks the Aurora Conduit.',
    season: 4,
    cost: 26,
    requires: ['s4-gen-18'],
    effect: { kind: 'unlock-generator', tier: 19 },
  },
  {
    id: 's4-insulation-1',
    name: 'Insulation',
    description: 'Frost Cycles bite less deeply.',
    season: 4,
    cost: 10,
    requires: [],
    effect: { kind: 'insulation' },
  },
  {
    id: 's4-insulation-2',
    name: 'Double Glazing',
    description: 'Frost Cycles bite less deeply again.',
    season: 4,
    cost: 16,
    requires: ['s4-insulation-1'],
    effect: { kind: 'insulation' },
  },
  {
    id: 's4-insulation-3',
    name: 'Banked Hearths',
    description: 'Frost Cycles bite as little as they ever will.',
    season: 4,
    cost: 24,
    requires: ['s4-insulation-2'],
    effect: { kind: 'insulation' },
  },
  {
    id: 's4-kg-greenhouse',
    name: 'Greenhouse Bed',
    description: 'A surface immune to Frost Dormancy.',
    season: 4,
    cost: 10,
    requires: ['s2-kg-raised'],
    effect: { kind: 'kg-surface', surface: 'greenhouse-bed' },
  },
  {
    id: 's4-kg-trellis',
    name: 'Clockwork Trellis',
    description: 'Five plants per slot, with automation pre-installed.',
    season: 4,
    cost: 16,
    requires: ['s4-kg-greenhouse', 's3-auto-dig-2'],
    effect: { kind: 'kg-surface', surface: 'clockwork-trellis' },
  },
  {
    id: 's4-kg-slots-4',
    name: 'The Whole Plot',
    description: 'The last Kitchen Garden slots.',
    season: 4,
    cost: 10,
    requires: ['s3-kg-slots-3'],
    effect: { kind: 'kg-slots', amount: 5 },
  },
  {
    id: 's4-kg-day-3',
    name: 'Endless Dusk',
    description: 'Day Length rises to 90 seconds.',
    season: 4,
    cost: 10,
    requires: ['s3-kg-day-2'],
    effect: { kind: 'kg-day-length', step: 3 },
  },
  {
    id: 's4-clockwork-heart',
    name: 'Clockwork Sympathy',
    description: 'All Garden Plots produce 20% more.',
    season: 4,
    cost: 24,
    requires: ['s3-harvest-lore'],
    effect: { kind: 'production-bonus', amount: 0.2 },
  },
  {
    id: 's4-frenzy-3',
    name: 'Winter Bloom',
    description: 'Growth Frenzy lasts 10 seconds longer.',
    season: 4,
    cost: 20,
    requires: ['s2-frenzy-2'],
    effect: { kind: 'frenzy-duration', seconds: 10 },
  },

  // ===========================================================================
  // Cosmetic — no mechanical effect. §3 asks for these by name.
  // ===========================================================================
  {
    id: 'cos-lanterns',
    name: 'Paper Lanterns',
    description: 'Hang lanterns along the rows. Purely for the look of it.',
    season: 1,
    cost: 2,
    requires: [],
    effect: { kind: 'cosmetic' },
  },
  {
    id: 'cos-sundial',
    name: 'Brass Sundial',
    description: 'A sundial for the centre of the garden.',
    season: 2,
    cost: 4,
    requires: ['cos-lanterns'],
    effect: { kind: 'cosmetic' },
  },
  {
    id: 'cos-topiary',
    name: 'Topiary Menagerie',
    description: 'Clip the hedges into improbable animals.',
    season: 2,
    cost: 6,
    requires: ['cos-lanterns'],
    effect: { kind: 'cosmetic' },
  },
  {
    id: 'cos-weathervane',
    name: 'Copper Weathervane',
    description: 'It turns with the Season.',
    season: 3,
    cost: 8,
    requires: ['cos-sundial'],
    effect: { kind: 'cosmetic' },
  },
  {
    id: 'cos-frost-lights',
    name: 'Winter Lights',
    description: 'Strings of light for the long nights.',
    season: 4,
    cost: 10,
    requires: ['cos-weathervane'],
    effect: { kind: 'cosmetic' },
  },
] as const;

export const NODE_COUNT = INSIGHT_TREE.length;

const BY_ID = new Map(INSIGHT_TREE.map((node) => [node.id, node]));

export function nodeById(id: string): InsightNode | undefined {
  return BY_ID.get(id);
}

/** Total Insight to buy every node. Compared against milestone supply in tests. */
export const TOTAL_TREE_COST = INSIGHT_TREE.reduce((sum, node) => sum + node.cost, 0);
