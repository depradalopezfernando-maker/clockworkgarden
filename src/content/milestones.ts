/**
 * milestones.ts — how Insight is earned (§3).
 *
 * DATA ONLY. The engine that evaluates these lives in `src/sim/milestones.ts`.
 *
 * §3 is explicit that Insight is "**not** earned by spending Mana directly" but
 * from milestones, "which keeps the tree from becoming 'just buy everything
 * eventually'". So the total Insight available across a campaign is deliberately
 * LESS than the cost of every node — the player chooses a build. A test asserts
 * that gap, because it is the property that makes the tree a decision.
 *
 * Conditions read only fields that already exist on GameState. Anything needing
 * new tracking (total clicks, Perfect Plantings landed) is deferred rather than
 * bolted on, so this file cannot silently expand the save schema.
 */

export type MilestoneCondition =
  | { readonly kind: 'own-count'; readonly tier: number; readonly count: number }
  | { readonly kind: 'lifetime-mana'; readonly amount: number }
  | { readonly kind: 'capstone-cleared'; readonly season: number }
  | { readonly kind: 'prestige-count'; readonly count: number }
  | { readonly kind: 'played-seconds'; readonly seconds: number }
  /** Longest §6.1 Pollination chain ever landed. Reads `pollination.bestChain`. */
  | { readonly kind: 'best-chain'; readonly length: number };

export interface Milestone {
  readonly id: string;
  readonly name: string;
  readonly condition: MilestoneCondition;
  /** Insight awarded, once, the first time the condition holds. */
  readonly reward: number;
}

export const MILESTONES: readonly Milestone[] = [
  // --- Season 1 -------------------------------------------------------------
  {
    id: 'm-water-10',
    name: 'A Row of Cans',
    condition: { kind: 'own-count', tier: 1, count: 10 },
    reward: 3,
  },
  {
    id: 'm-mana-1k',
    name: 'First Thousand',
    condition: { kind: 'lifetime-mana', amount: 1e3 },
    reward: 3,
  },
  {
    id: 'm-water-25',
    name: 'Well Watered',
    condition: { kind: 'own-count', tier: 1, count: 25 },
    reward: 3,
  },
  {
    id: 'm-sprout-10',
    name: 'Sprouting',
    condition: { kind: 'own-count', tier: 2, count: 10 },
    reward: 6,
  },
  {
    id: 'm-mana-10k',
    name: 'Ten Thousand',
    condition: { kind: 'lifetime-mana', amount: 1e4 },
    reward: 6,
  },
  {
    id: 'm-sprout-25',
    name: 'A Bed of Sprouts',
    condition: { kind: 'own-count', tier: 2, count: 25 },
    reward: 6,
  },
  {
    id: 'm-butterfly-10',
    name: 'Wingbeats',
    condition: { kind: 'own-count', tier: 3, count: 10 },
    reward: 6,
  },
  {
    id: 'm-butterfly-25',
    name: 'A Cloud of Wings',
    condition: { kind: 'own-count', tier: 3, count: 25 },
    reward: 4,
  },
  {
    id: 'm-mana-100k',
    name: 'A Hundred Thousand',
    condition: { kind: 'lifetime-mana', amount: 1e5 },
    reward: 6,
  },
  {
    id: 'm-gnome-10',
    name: 'The Gnome Committee',
    condition: { kind: 'own-count', tier: 4, count: 10 },
    reward: 6,
  },
  {
    id: 'm-gnome-25',
    name: 'The Whole Crew',
    condition: { kind: 'own-count', tier: 4, count: 25 },
    reward: 5,
  },
  {
    id: 'm-capstone-1',
    name: 'Spring Cleared',
    condition: { kind: 'capstone-cleared', season: 1 },
    reward: 10,
  },
  {
    id: 'm-mana-1m',
    name: 'A Million Mana',
    condition: { kind: 'lifetime-mana', amount: 1e6 },
    reward: 8,
  },

  // --- Season 2 -------------------------------------------------------------
  {
    id: 'm-prestige-1',
    name: 'Turned the Soil',
    condition: { kind: 'prestige-count', count: 1 },
    reward: 10,
  },
  {
    id: 'm-beehive-10',
    name: 'The Hum',
    condition: { kind: 'own-count', tier: 6, count: 10 },
    reward: 8,
  },
  {
    id: 'm-beehive-25',
    name: 'Humming Rows',
    condition: { kind: 'own-count', tier: 6, count: 25 },
    reward: 6,
  },
  {
    id: 'm-mana-100m',
    name: 'A Hundred Million',
    condition: { kind: 'lifetime-mana', amount: 1e8 },
    reward: 10,
  },
  {
    id: 'm-sunflower-10',
    name: 'Facing the Sun',
    condition: { kind: 'own-count', tier: 7, count: 10 },
    reward: 10,
  },
  {
    id: 'm-sunflower-25',
    name: 'Turning Heads',
    condition: { kind: 'own-count', tier: 7, count: 25 },
    reward: 7,
  },
  {
    id: 'm-drone-10',
    name: 'Swarm Logic',
    condition: { kind: 'own-count', tier: 8, count: 10 },
    reward: 8,
  },
  {
    id: 'm-drone-25',
    name: 'Full Formation',
    condition: { kind: 'own-count', tier: 8, count: 25 },
    reward: 8,
  },
  {
    id: 'm-mana-10g',
    name: 'Ten Billion',
    condition: { kind: 'lifetime-mana', amount: 1e10 },
    reward: 8,
  },
  {
    id: 'm-nectar-10',
    name: 'Refined',
    condition: { kind: 'own-count', tier: 9, count: 10 },
    reward: 8,
  },
  {
    id: 'm-nectar-25',
    name: 'Running the Vats',
    condition: { kind: 'own-count', tier: 9, count: 25 },
    reward: 9,
  },
  // §6.1's own progression. These pay the player for LEARNING the combo rather
  // than for owning generators, which is the only kind of milestone that
  // rewards the Season's actual new verb.
  {
    id: 'm-chain-3',
    name: 'Three Petals',
    condition: { kind: 'best-chain', length: 3 },
    reward: 4,
  },
  {
    id: 'm-chain-6',
    name: 'Silver Touch',
    condition: { kind: 'best-chain', length: 6 },
    reward: 7,
  },
  {
    id: 'm-chain-9',
    name: 'The Golden Bloom',
    condition: { kind: 'best-chain', length: 9 },
    reward: 11,
  },
  {
    id: 'm-capstone-2',
    name: 'Summer Cleared',
    condition: { kind: 'capstone-cleared', season: 2 },
    reward: 13,
  },

  // --- Season 3 -------------------------------------------------------------
  {
    id: 'm-prestige-3',
    name: 'Thrice Turned',
    condition: { kind: 'prestige-count', count: 3 },
    reward: 13,
  },
  {
    id: 'm-cart-10',
    name: 'The Brigade',
    condition: { kind: 'own-count', tier: 11, count: 10 },
    reward: 10,
  },
  {
    id: 'm-mana-1t',
    name: 'A Trillion',
    condition: { kind: 'lifetime-mana', amount: 1e12 },
    reward: 10,
  },
  {
    id: 'm-silo-10',
    name: 'Stores Laid In',
    condition: { kind: 'own-count', tier: 12, count: 10 },
    reward: 12,
  },
  {
    id: 'm-cider-10',
    name: 'Pressed',
    condition: { kind: 'own-count', tier: 13, count: 10 },
    reward: 13,
  },
  {
    id: 'm-mana-1p',
    name: 'A Quadrillion',
    condition: { kind: 'lifetime-mana', amount: 1e15 },
    reward: 13,
  },
  {
    id: 'm-scarecrow-10',
    name: 'The Watch',
    condition: { kind: 'own-count', tier: 14, count: 10 },
    reward: 12,
  },
  {
    id: 'm-capstone-3',
    name: 'Autumn Cleared',
    condition: { kind: 'capstone-cleared', season: 3 },
    reward: 18,
  },

  // --- Season 4 -------------------------------------------------------------
  {
    id: 'm-lantern-10',
    name: 'Lanterns Lit',
    condition: { kind: 'own-count', tier: 16, count: 10 },
    reward: 13,
  },
  {
    id: 'm-mana-1e17',
    name: 'A Hundred Quadrillion',
    condition: { kind: 'lifetime-mana', amount: 1e17 },
    reward: 13,
  },
  {
    id: 'm-greenhouse-10',
    name: 'Under Glass',
    condition: { kind: 'own-count', tier: 17, count: 10 },
    reward: 14,
  },
  {
    id: 'm-ember-10',
    name: 'Stoked',
    condition: { kind: 'own-count', tier: 18, count: 10 },
    reward: 15,
  },
  {
    id: 'm-mana-1e19',
    name: 'Ten Quintillion',
    condition: { kind: 'lifetime-mana', amount: 1e19 },
    reward: 15,
  },
  {
    id: 'm-aurora-10',
    name: 'Conducted',
    condition: { kind: 'own-count', tier: 19, count: 10 },
    reward: 17,
  },
  {
    id: 'm-capstone-4',
    name: 'Winter Cleared',
    condition: { kind: 'capstone-cleared', season: 4 },
    reward: 22,
  },

  // --- Cross-campaign -------------------------------------------------------
  {
    id: 'm-prestige-5',
    name: 'Five Times Turned',
    condition: { kind: 'prestige-count', count: 5 },
    reward: 13,
  },
  {
    id: 'm-played-2h',
    name: 'Two Hours Tending',
    condition: { kind: 'played-seconds', seconds: 2 * 3600 },
    reward: 10,
  },
  {
    id: 'm-played-5h',
    name: 'Five Hours Tending',
    condition: { kind: 'played-seconds', seconds: 5 * 3600 },
    reward: 10,
  },
] as const;

export const MILESTONE_COUNT = MILESTONES.length;

/** Every point of Insight the campaign can yield. */
export const TOTAL_INSIGHT_AVAILABLE = MILESTONES.reduce((sum, m) => sum + m.reward, 0);
