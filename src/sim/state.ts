/**
 * state.ts — the shape of a game in progress.
 *
 * Pure data. Serializable as-is (ADR-0004). No methods, no class instances,
 * nothing that survives `JSON.parse(JSON.stringify(state))` differently.
 */

import { TIER_COUNT } from '@content/generators';
import { initialFrenzy, type FrenzyState } from './frenzy';

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

  /** Kitchen Garden build-out, as far as Phase 1 models it. */
  readonly kitchenGarden: KitchenGardenState;

  /** §5 Growth Frenzy meter and active window. */
  readonly frenzy: FrenzyState;
}

/**
 * Phase 1 models the Kitchen Garden at build-out level only - enough to fit
 * `KITCHEN_GARDEN_BASE_FRACTION` (decision D2) against its income-share target.
 * The per-plot state machine, Day/Night budget, and Dig/Plant/Cover sequence are
 * Phase 4.
 */
export interface KitchenGardenState {
  /** Plot slots unlocked, 4-20. */
  readonly slots: number;
  /** Plants per slot, from the surface installed (1, 3 or 5). */
  readonly capacityPerSlot: number;
  /** Combined surface yield multiplier. */
  readonly surfaceYieldMult: number;
  /** Fraction of plots currently grown and producing. */
  readonly activeFraction: number;
}

export function initialKitchenGarden(): KitchenGardenState {
  return { slots: 4, capacityPerSlot: 1, surfaceYieldMult: 1, activeFraction: 1 };
}

export function initialState(): GameState {
  return {
    mana: 0,
    lifetimeMana: 0,
    owned: new Array<number>(TIER_COUNT).fill(0),
    season: 1,
    capstonesCleared: [],
    appliedSqp: 0,
    prestigeCount: 0,
    elapsedSeconds: 0,
    kitchenGarden: initialKitchenGarden(),
    frenzy: initialFrenzy(),
  };
}

/** Units owned of a 1-based tier. */
export function ownedOf(state: GameState, tier: number): number {
  return state.owned[tier - 1] ?? 0;
}
