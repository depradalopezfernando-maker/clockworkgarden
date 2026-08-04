/**
 * state.ts — the shape of a game in progress.
 *
 * Pure data. Serializable as-is (ADR-0004). No methods, no class instances,
 * nothing that survives `JSON.parse(JSON.stringify(state))` differently.
 */

import { TIER_COUNT } from '@content/generators';
import { initialFrenzy, type FrenzyState } from './frenzy';
import { initialKitchenGarden, type KitchenGardenState } from './kitchenGarden';
import { initialCapstone, type CapstoneState } from './capstone';
import { initialPollination, type PollinationState } from './pollination';

export type { KitchenGardenState };
export { initialKitchenGarden };

export interface GameState {
  /** Spendable Mana. Reset by prestige. */
  readonly mana: number;

  /**
   * ALL-TIME Mana earned. Never reset, not by prestige, not by Season change.
   * Decision D3 depends on this: prestige SQP is computed absolutely from it.
   */
  readonly lifetimeMana: number;

  /** Units owned per tier, index 0 = tier 1. Reset by prestige. */
  readonly owned: readonly number[];

  /**
   * Highest generator tier ever unlocked. A HIGH-WATER MARK: never decreases,
   * survives prestige.
   *
   * Tiers gate on owning ten of the previous tier, and prestige zeroes `owned` -
   * so without this a reset would re-lock everything the player had opened.
   * Access, once earned, is permanent; only the units are lost.
   */
  readonly tiersUnlocked: number;

  /** 1-4. Advances only on capstone clear (decision D6). */
  readonly season: number;

  /** Seasons whose capstone has been cleared. */
  readonly capstonesCleared: readonly number[];

  /**
   * SQP banked at the last prestige. This is what feeds the production
   * multiplier - NOT the live value derived from lifetimeMana, which only
   * becomes active when the player actually resets.
   */
  readonly appliedSqp: number;

  /** How many times the player has Turned the Soil. */
  readonly prestigeCount: number;

  /** Seconds of engaged play. §8's timeline is measured in this, not wall clock. */
  readonly elapsedSeconds: number;

  /** §2a. Per-plot state, Seeds, and the Day/Night budget. */
  readonly kitchenGarden: KitchenGardenState;

  /** §5 Growth Frenzy meter and active window. */
  readonly frenzy: FrenzyState;

  /** §6.1 Pollination Combo. Inert until Season 2. */
  readonly pollination: PollinationState;

  /** Unspent Insight (§3). */
  readonly insight: number;

  /** All-time Insight earned. Never reset; used for reporting and milestones. */
  readonly lifetimeInsight: number;

  /**
   * Insight tree nodes bought. Survives prestige — §4 keeps "unlocked plant
   * types", and these ARE those unlocks.
   */
  readonly purchasedNodes: readonly string[];

  /**
   * Milestones already paid out. MUST survive prestige: if these reset, a player
   * re-earns the same Insight every reset and the tree becomes free, which is
   * exactly what §3's milestone design exists to prevent.
   */
  readonly claimedMilestones: readonly string[];

  /** §2/§8 Season capstone attempt state. Decision D4a. */
  readonly capstone: CapstoneState;
}

export function initialState(): GameState {
  return {
    mana: 0,
    lifetimeMana: 0,
    owned: new Array<number>(TIER_COUNT).fill(0),
    tiersUnlocked: 0,
    season: 1,
    capstonesCleared: [],
    appliedSqp: 0,
    prestigeCount: 0,
    elapsedSeconds: 0,
    kitchenGarden: initialKitchenGarden(),
    frenzy: initialFrenzy(),
    pollination: initialPollination(),
    insight: 0,
    lifetimeInsight: 0,
    purchasedNodes: [],
    claimedMilestones: [],
    capstone: initialCapstone(),
  };
}

/** Units owned of a 1-based tier. */
export function ownedOf(state: GameState, tier: number): number {
  return state.owned[tier - 1] ?? 0;
}
