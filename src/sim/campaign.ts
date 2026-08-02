/**
 * campaign.ts — the balance harness.
 *
 * Runs a whole playthrough forward, headlessly, in milliseconds. This is the
 * point of ADR-0002's purity boundary: nine of the ten open playtest questions
 * in §10 are answerable here, without a browser, swept across thousands of
 * parameter combinations.
 *
 * What it measures is ENGAGED PLAY TIME, which is what §8's 6-10 hour target is
 * denominated in. Offline progress is deliberately excluded and tested
 * separately in `offline.ts` - mixing them would make "campaign length" depend
 * on how often a hypothetical player closed the tab.
 *
 * Deterministic: no RNG, no clock. Same inputs, same result, every time.
 */

import {
  FRENZY_MULTIPLIER,
  KITCHEN_GARDEN_BASE_FRACTION,
  PRESTIGE_SQP_COEFFICIENT,
  PRESTIGE_SQP_REFERENCE,
} from '@content/balance';
import { CAPSTONE_DURATION_SECONDS, TIER_COUNT } from '@content/generators';
import {
  bestPurchase,
  buy,
  clearCapstone,
  clickYield,
  gardenPlotManaPerSecond,
  isCampaignComplete,
  isCapstoneAvailable,
  totalManaPerSecond,
} from './economy';
import { buildOutForSeason, kitchenGardenIncomeShare } from './kitchenGarden';
import {
  canPrestige,
  prestige,
  prestigeGainFactor,
  prestigeMultiplier,
  totalSqp,
} from './prestige';
import { initialState, ownedOf, type GameState } from './state';

export interface PlayerArchetype {
  readonly name: string;
  /** Bell clicks per minute while playing. */
  readonly clicksPerMinute: number;
  /** 0-1: fraction of time the §5 Growth Frenzy 2x window is up. */
  readonly frenzyUptime: number;
  /**
   * Resets when Turning the Soil would improve the production multiplier by at
   * least this factor. Lower = prestiges more eagerly.
   */
  readonly prestigeThreshold: number;
}

/**
 * Three archetypes spanning the realistic range. §8 targets 6-10 hours; a design
 * that only lands for one of these is not balanced, it is lucky.
 */
export const ARCHETYPES: readonly PlayerArchetype[] = [
  { name: 'idle', clicksPerMinute: 10, frenzyUptime: 0.05, prestigeThreshold: 2.0 },
  { name: 'casual', clicksPerMinute: 60, frenzyUptime: 0.25, prestigeThreshold: 1.6 },
  { name: 'active', clicksPerMinute: 240, frenzyUptime: 0.6, prestigeThreshold: 1.4 },
] as const;

export interface CampaignOptions {
  /** D3's K. Exposed so the harness can fit it. */
  readonly prestigeCoefficient?: number;
  /**
   * D3's reference point - the lifetime Mana at which SQP starts accruing.
   * Fittable because the spec's 1e6 turned out to sit ABOVE the lifetime Mana a
   * player holds when prestige unlocks, making the first reset worth nothing.
   */
  readonly prestigeReference?: number;
  /** D2's BaseFraction. Exposed so the harness can fit it. */
  readonly kitchenGardenBaseFraction?: number;
  /** Simulation step. 1s is ample for pacing; the tick loop itself runs at 10Hz. */
  readonly stepSeconds?: number;
  /** Safety valve so a broken economy fails fast instead of hanging. */
  readonly maxHours?: number;
  /**
   * Force every archetype to the same prestige threshold.
   *
   * Threshold is a BEHAVIOURAL assumption, not a design knob - it is how strong a
   * boost a player demands before accepting a reset. Overriding it lets the
   * harness separate "the economy paces well" from "I picked flattering habits
   * for each archetype", and lets a sweep measure how robust the design is to
   * players who prestige more or less eagerly than assumed.
   */
  readonly prestigeThresholdOverride?: number;
  /**
   * Season at which players stop resetting, because too little campaign remains
   * to earn a reset back. Also behavioural, not a design knob. Default 4.
   */
  readonly endgameSeason?: number;
}

export interface CampaignResult {
  readonly archetype: string;
  readonly completed: boolean;
  readonly totalHours: number;
  /** Engaged-play hours at which each Season began. Index 0 = Season 1 (always 0). */
  readonly seasonStartHours: readonly number[];
  readonly prestigeCount: number;
  readonly prestigeAtHours: readonly number[];
  readonly prestigeMultipliers: readonly number[];
  /**
   * Multiplier the player WOULD get by resetting the moment prestige first
   * unlocks (the Season 1 capstone). This is the "is the first prestige worth
   * doing" number - the spec's original formula made it x1.18, which taught
   * players the mechanic was a trap.
   *
   * Distinct from `prestigeMultipliers[0]`, which reflects when the player
   * chose to reset, not when they could have.
   */
  readonly firstPrestigeOfferedMultiplier: number;
  readonly finalMultiplier: number;
  readonly kitchenGardenShareAtEnd: number;
  readonly finalManaPerSecond: number;
  readonly lifetimeMana: number;
}

/**
 * Run one playthrough to the Full Bloom ending (or `maxHours`, whichever first).
 */
export function simulateCampaign(
  archetype: PlayerArchetype,
  options: CampaignOptions = {}
): CampaignResult {
  const {
    prestigeCoefficient = PRESTIGE_SQP_COEFFICIENT,
    prestigeReference = PRESTIGE_SQP_REFERENCE,
    kitchenGardenBaseFraction = KITCHEN_GARDEN_BASE_FRACTION,
    stepSeconds = 1,
    maxHours = 60,
    prestigeThresholdOverride,
    endgameSeason = 4,
  } = options;

  const prestigeThreshold = prestigeThresholdOverride ?? archetype.prestigeThreshold;

  let state: GameState = initialState();
  const maxSteps = Math.ceil((maxHours * 3600) / stepSeconds);

  const seasonStartHours: number[] = [0];
  const prestigeAtHours: number[] = [];
  const prestigeMultipliers: number[] = [];

  // Frenzy is modelled as an average uptime rather than a discrete meter. For
  // pacing that is accurate enough; the meter's feel is a Phase 2 concern and a
  // HUMAN-tagged constant either way.
  const frenzy = 1 + (FRENZY_MULTIPLIER - 1) * archetype.frenzyUptime;
  const clicksPerSecond = archetype.clicksPerMinute / 60;

  let capstoneTimer = 0;
  let firstPrestigeOfferedMultiplier = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (isCampaignComplete(state)) break;

    // --- Kitchen Garden build-out ramps with Season and elapsed time ---------
    const kg = buildOutForSeason(state.season, state.elapsedSeconds);
    state = { ...state, kitchenGarden: kg };

    // --- Income ------------------------------------------------------------
    const clicks = clicksPerSecond * clickYield(state, 0, frenzy);
    const income = totalManaPerSecond(state, kitchenGardenBaseFraction) * frenzy + clicks;

    const earned = income * stepSeconds;
    state = {
      ...state,
      mana: state.mana + earned,
      lifetimeMana: state.lifetimeMana + earned,
      elapsedSeconds: state.elapsedSeconds + stepSeconds,
    };

    // --- Spend -------------------------------------------------------------
    // A player buys everything they can afford before moving on. Capped so a
    // pathological economy cannot spin here forever.
    for (let purchases = 0; purchases < 500; purchases++) {
      const option = bestPurchase(state);
      if (!option) break;
      state = buy(state, option.tier);
    }

    // --- Capstone, and therefore Season advancement (D6) --------------------
    if (capstoneTimer > 0) {
      capstoneTimer -= stepSeconds;
      if (capstoneTimer <= 0) {
        const before = state.season;
        state = clearCapstone(state);
        if (state.season > before) {
          seasonStartHours.push(state.elapsedSeconds / 3600);
        }
      }
    } else if (isCapstoneAvailable(state)) {
      capstoneTimer = CAPSTONE_DURATION_SECONDS;
    }

    // Snapshot what the very first prestige is WORTH the moment it unlocks,
    // independent of when this player chooses to take it.
    if (firstPrestigeOfferedMultiplier === 0 && canPrestige(state)) {
      firstPrestigeOfferedMultiplier = prestigeMultiplier(
        totalSqp(state.lifetimeMana, prestigeCoefficient, prestigeReference)
      );
    }

    // --- Prestige ("Turn the Soil") -----------------------------------------
    // A reset trades your entire generator stock for a permanent multiplier, so
    // it only pays when enough campaign remains to earn the trade back. Real
    // players feel this and stop resetting in the endgame; a model that resets
    // at hour nine would slander the design. `endgameSeason` is where that
    // instinct kicks in.
    if (
      canPrestige(state) &&
      state.season < endgameSeason &&
      prestigeGainFactor(state, prestigeCoefficient, prestigeReference) >= prestigeThreshold &&
      !isCampaignComplete(state)
    ) {
      state = prestige(state, prestigeCoefficient, prestigeReference);
      prestigeAtHours.push(state.elapsedSeconds / 3600);
      prestigeMultipliers.push(prestigeMultiplier(state.appliedSqp));
    }
  }

  return {
    archetype: archetype.name,
    completed: isCampaignComplete(state),
    totalHours: state.elapsedSeconds / 3600,
    seasonStartHours,
    prestigeCount: state.prestigeCount,
    prestigeAtHours,
    prestigeMultipliers,
    finalMultiplier: prestigeMultiplier(state.appliedSqp),
    firstPrestigeOfferedMultiplier,
    kitchenGardenShareAtEnd: kitchenGardenIncomeShare(
      state.kitchenGarden,
      kitchenGardenBaseFraction
    ),
    finalManaPerSecond: gardenPlotManaPerSecond(state),
    lifetimeMana: state.lifetimeMana,
  };
}

/** Run every archetype. The exit criterion for Phase 1 is measured on this. */
export function simulateAllArchetypes(options: CampaignOptions = {}): CampaignResult[] {
  return ARCHETYPES.map((a) => simulateCampaign(a, options));
}

/** Highest tier the player owns at least one of. Used in reporting. */
export function highestOwnedTier(state: GameState): number {
  for (let tier = TIER_COUNT; tier >= 1; tier--) {
    if (ownedOf(state, tier) > 0) return tier;
  }
  return 0;
}
