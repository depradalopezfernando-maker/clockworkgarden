/**
 * prestige.ts — §4, as revised by decision D3.
 *
 * The spec's original formula (`SQP = floor(sqrt(LifetimeMana / 1e6))`, summed
 * across resets) produced a first prestige worth +18% and a fourth worth
 * x368,000. D3 replaces it with a log-shaped curve computed ABSOLUTELY from
 * all-time lifetime Mana:
 *
 *   TotalSQP           = max(0, floor(K * log10(LifetimeMana / REFERENCE)))
 *   SQPGainedThisReset = TotalSQP(now) - appliedSqp
 *   PrestigeMultiplier = 1 + BONUS_PER_SQP * appliedSqp
 *
 * Two properties this buys, both wanted for a bounded game:
 *
 *   - Every reset is felt. The first is ~x2.5 rather than x1.18.
 *   - Over-banking is self-limiting. Because gain scales with the log of
 *     lifetime Mana, grinding twice as long adds a FIXED small amount. That
 *     mechanises §4's "reset cap by design, not by code" instead of hoping for
 *     it.
 */

import {
  PRESTIGE_BONUS_PER_SQP,
  PRESTIGE_SQP_COEFFICIENT,
  PRESTIGE_SQP_REFERENCE,
  PRESTIGE_UNLOCK_SEASON,
} from '@content/balance';
import { initialKitchenGarden, type GameState } from './state';
import { TIER_COUNT } from '@content/generators';

/**
 * Soil Quality Points the player's all-time lifetime Mana entitles them to.
 *
 * Absolute, not incremental. Calling this twice at the same lifetime Mana yields
 * the same number - which is exactly why it cannot be double-counted.
 */
export function totalSqp(
  lifetimeMana: number,
  coefficient = PRESTIGE_SQP_COEFFICIENT,
  reference = PRESTIGE_SQP_REFERENCE
): number {
  if (!(lifetimeMana > 0)) return 0;
  const raw = coefficient * Math.log10(lifetimeMana / reference);
  return Math.max(0, Math.floor(raw));
}

/** SQP the player would bank by resetting right now. Never negative. */
export function sqpAvailable(
  state: GameState,
  coefficient = PRESTIGE_SQP_COEFFICIENT,
  reference = PRESTIGE_SQP_REFERENCE
): number {
  return Math.max(0, totalSqp(state.lifetimeMana, coefficient, reference) - state.appliedSqp);
}

/** §4: +2% production per banked SQP. */
export function prestigeMultiplier(appliedSqp: number): number {
  return 1 + PRESTIGE_BONUS_PER_SQP * appliedSqp;
}

/** How much the production multiplier would improve by resetting now. */
export function prestigeGainFactor(
  state: GameState,
  coefficient = PRESTIGE_SQP_COEFFICIENT,
  reference = PRESTIGE_SQP_REFERENCE
): number {
  const current = prestigeMultiplier(state.appliedSqp);
  const next = prestigeMultiplier(totalSqp(state.lifetimeMana, coefficient, reference));
  return next / current;
}

/** §4: available any time after the Season 1 capstone. Never required. */
export function canPrestige(state: GameState): boolean {
  return state.capstonesCleared.includes(PRESTIGE_UNLOCK_SEASON);
}

/**
 * "Turn the Soil" — renamed from the spec's "Season Change" per D6, because that
 * name collided with Season advancement, which prestige explicitly does NOT do.
 *
 * §4 resets current Mana, Garden Plots owned, and in-progress Insight. It keeps
 * unlocked plant types, cosmetics, story progress, capstones, Season, and - the
 * spec is emphatic - the Kitchen Garden in full.
 *
 * NOTE: `lifetimeMana` deliberately survives. D3's whole model depends on it.
 */
export function prestige(
  state: GameState,
  coefficient = PRESTIGE_SQP_COEFFICIENT,
  reference = PRESTIGE_SQP_REFERENCE
): GameState {
  if (!canPrestige(state)) return state;
  const banked = totalSqp(state.lifetimeMana, coefficient, reference);
  if (banked <= state.appliedSqp) return state;

  return {
    ...state,
    mana: 0,
    owned: new Array<number>(TIER_COUNT).fill(0),
    appliedSqp: banked,
    prestigeCount: state.prestigeCount + 1,
    // Explicitly preserved:
    lifetimeMana: state.lifetimeMana,
    season: state.season,
    capstonesCleared: state.capstonesCleared,
    elapsedSeconds: state.elapsedSeconds,
    kitchenGarden: state.kitchenGarden,
  };
}

/** Only used by tests, to prove prestige does NOT reset the Kitchen Garden. */
export const FRESH_KITCHEN_GARDEN = initialKitchenGarden();
