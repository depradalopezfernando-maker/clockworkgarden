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
import { CAPSTONE_DURATION_SECONDS, TIER_COUNT, seasonTierOneCost } from '@content/generators';
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
import {
  addSlot,
  applySurface,
  canPerform,
  clearPlot,
  kitchenGardenIncomeShare,
  performStep,
  slotCap,
  slotCost,
  tickKitchenGarden,
  type PlotStep,
} from './kitchenGarden';
import { SURFACES, SURFACE_UNLOCK_NODE, type SurfaceId } from '@content/surfaces';
import {
  canPrestige,
  prestige,
  prestigeGainFactor,
  prestigeMultiplier,
  totalSqp,
} from './prestige';
import { availableNodes, effectsOf, levelsOf, purchaseNode } from './insight';
import { claimMilestones } from './milestones';
import { capstoneTargetRate, hasDesignedChallenge } from './capstone';
import { initialState, ownedOf, type GameState } from './state';

/**
 * Effect kinds this harness can price.
 *
 * Phase 3 excluded the Kitchen Garden kinds because their systems did not exist
 * and the sim could not value them. Phase 4 built those systems, so they are in
 * - and they now compete for the same Insight, which is the tightening Phase 3's
 * report predicted. Only Barn Capacity (Phase 8), Insulation (Phase 9) and
 * cosmetics remain unpriced.
 */
const MODELLED_EFFECTS = new Set([
  'unlock-generator',
  'click-bonus',
  'production-bonus',
  'frenzy-duration',
  'offline-floor',
  'kg-slots',
  'kg-surface',
  'kg-automation',
  'kg-day-length',
  'satchel-capacity',
]);

export interface PlayerArchetype {
  readonly name: string;
  /** Bell clicks per minute while playing. */
  readonly clicksPerMinute: number;
  /** 0-1: fraction of time the §5 Growth Frenzy 2x window is up. */
  readonly frenzyUptime: number;
  /**
   * Dig/Plant/Cover cycles attempted per second of play (§2a). An idle player
   * barely touches the Kitchen Garden; an active one works it constantly.
   * Automation makes cycles free of Day Time, so this ceiling matters most
   * early.
   */
  readonly kgTendingRate: number;
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
  {
    name: 'idle',
    clicksPerMinute: 10,
    frenzyUptime: 0.05,
    prestigeThreshold: 2.0,
    kgTendingRate: 0.02,
  },
  {
    name: 'casual',
    clicksPerMinute: 60,
    frenzyUptime: 0.25,
    prestigeThreshold: 1.6,
    kgTendingRate: 0.15,
  },
  {
    name: 'active',
    clicksPerMinute: 240,
    frenzyUptime: 0.6,
    prestigeThreshold: 1.4,
    kgTendingRate: 0.5,
  },
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
  /** Phase 3: how much of the Insight tree a playthrough actually affords. */
  readonly lifetimeInsight: number;
  readonly nodesPurchased: number;
  readonly insightUnspent: number;
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
  const tendCarry = { value: 0 };

  for (let step = 0; step < maxSteps; step++) {
    if (isCampaignComplete(state)) break;

    // --- Kitchen Garden (§2a) ----------------------------------------------
    state = tendKitchenGarden(state, stepSeconds, archetype.kgTendingRate, tendCarry);
    tendCarry.value = state.kitchenGarden.plots.length > 0 ? tendCarry.value : 0;

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

    // Award Insight (§3). This loop does not go through `advance()` because it
    // models Frenzy as an average uptime rather than a meter, so anything
    // `advance()` does must be mirrored here deliberately. Forgetting this line
    // stalled the whole campaign: no Insight meant no tree, no tree meant Tiers
    // 3 and 4 never unlocked, and no archetype ever cleared Season 1.
    state = claimMilestones(state).state;

    // --- Spend -------------------------------------------------------------
    // A player buys everything they can afford before moving on. Capped so a
    // pathological economy cannot spin here forever.
    for (let purchases = 0; purchases < 500; purchases++) {
      const option = bestPurchase(state);
      if (!option) break;
      state = buy(state, option.tier);
    }

    // --- Spend Insight -----------------------------------------------------
    //
    // The policy buys only nodes whose effects this simulation can actually
    // value, and takes generator unlocks first because they gate progression
    // outright - no sensible player leaves the next tier locked to buy a click
    // bonus.
    //
    // Kitchen Garden and cosmetic nodes are SKIPPED, not because they are
    // worthless but because their systems do not exist until Phase 4 and the
    // sim cannot price them. Spending cheapest-first instead starved the
    // generator unlocks so badly that no archetype finished inside 60 hours.
    //
    // Consequence worth stating: this makes the simulated Insight economy more
    // generous than the real one. When Phase 4 lands, ~166 Insight of Kitchen
    // Garden nodes start competing for the same pool and the tree gets
    // materially tighter. Re-run this then.
    for (let purchases = 0; purchases < 20; purchases++) {
      const reachable = availableNodes(state).filter((node) =>
        MODELLED_EFFECTS.has(node.effect.kind)
      );

      // SAVE UP for the next generator unlock rather than spending down.
      // Unlocks gate progression outright and cost far more than a Kitchen
      // Garden node; buying cheap nodes while one is pending starves it
      // indefinitely. With a spend-down policy no archetype finished in 60
      // hours once Kitchen Garden nodes became worth buying.
      const pendingUnlock = reachable.find((node) => node.effect.kind === 'unlock-generator');

      let pick;
      if (pendingUnlock && state.insight >= pendingUnlock.cost) {
        pick = pendingUnlock;
      } else if (pendingUnlock) {
        // Spend only SURPLUS while saving: buy something else if it still
        // leaves enough for the pending unlock. Pure saving means a player
        // never buys a Kitchen Garden node at all; pure spending starves the
        // unlock. Real players do this - keep the goal funded, spend the rest.
        pick = reachable.find((node) => node.cost <= state.insight - pendingUnlock.cost);
      } else {
        pick = reachable.find((node) => state.insight >= node.cost);
      }

      if (!pick) break;
      const next = purchaseNode(state, pick.id);
      if (next === state) break;
      state = next;
    }

    // --- Capstone, and therefore Season advancement (D6) --------------------
    //
    // Season 1 now has a real challenge (D4a): reach a target rate during a
    // Frenzy. The harness models Frenzy as an average uptime rather than a
    // meter, so it cannot "play" First Bloom - instead it clears once the
    // player's rate WITH a full Frenzy would beat the target, which is the same
    // condition a real attempt tests. Seasons 2-4 keep the readiness-only
    // placeholder until they are designed.
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
      const clearable =
        !hasDesignedChallenge(state.season) ||
        totalManaPerSecond(state, kitchenGardenBaseFraction) * FRENZY_MULTIPLIER >=
          capstoneTargetRate(state.season);
      if (clearable) capstoneTimer = CAPSTONE_DURATION_SECONDS;
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
      { levels: levelsOf(state), season: state.season, nowSeconds: state.elapsedSeconds },
      kitchenGardenBaseFraction
    ),
    finalManaPerSecond: gardenPlotManaPerSecond(state),
    lifetimeMana: state.lifetimeMana,
    lifetimeInsight: state.lifetimeInsight,
    nodesPurchased: state.purchasedNodes.length,
    insightUnspent: state.insight,
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

// ---------------------------------------------------------------------------
// Kitchen Garden play (§2a)
// ---------------------------------------------------------------------------

const CYCLE: readonly PlotStep[] = ['dig', 'plant', 'cover'];

/**
 * One step of a simulated player working their Kitchen Garden.
 *
 * Uses the same functions the UI calls, so the harness cannot drift from the
 * game. Deterministic: `carry` accumulates fractional cycles rather than
 * rolling dice, because ADR-0002 forbids RNG in `src/sim`.
 */
function tendKitchenGarden(
  state: GameState,
  dt: number,
  tendingRate: number,
  carry: { value: number }
): GameState {
  const effects = effectsOf(state);
  const levels = levelsOf(state);
  const now = state.elapsedSeconds;

  let kg = tickKitchenGarden(state.kitchenGarden, dt, {
    dayLengthStep: effects.kgDayLengthStep,
    hasShortNight: effects.kgDayLengthStep >= 2,
    satchelBonus: effects.satchelBonus,
    nowSeconds: now,
  });

  let mana = state.mana;

  // Break ground on a new slot when the tree has raised the cap and Mana allows.
  const cap = slotCap(effects.kgSlotBonus);
  if (kg.plots.length < cap) {
    const cost = slotCost(kg.plots.length + 1, seasonTierOneCost(state.season));
    if (mana >= cost) {
      mana -= cost;
      kg = addSlot(kg, cap);
    }
  }

  const context = { levels, season: state.season, nowSeconds: now };

  // Replant anything left over from a previous Season - §2a decays it to a small
  // legacy share until refreshed, so leaving it is real lost income.
  for (let i = 0; i < kg.plots.length; i++) {
    const plot = kg.plots[i]!;
    if (plot.stage === 'grown' && plot.plantedSeason !== state.season) {
      kg = clearPlot(kg, i);
    }
  }

  // Upgrade a bare plot to the best surface unlocked and affordable.
  const best = bestUnlockedSurface(state.purchasedNodes);
  if (best) {
    const upgradeCost = SURFACES[best].applyCostMultiplier * seasonTierOneCost(state.season);
    const index = kg.plots.findIndex((p) => p.stage === 'bare' && p.surface !== best);
    if (index >= 0 && mana >= upgradeCost) {
      mana -= upgradeCost;
      kg = applySurface(kg, index, best);
    }
  }

  // Work the cycle, as far as attention and Day Time allow.
  carry.value += tendingRate * dt;
  while (carry.value >= 1) {
    carry.value -= 1;
    const index = kg.plots.findIndex((p) => p.stage !== 'grown' && p.stage !== 'growing');
    if (index < 0) break;

    let progressed = false;
    for (const step of CYCLE) {
      if (!canPerform(kg, index, step, context)) break;
      const outcome = performStep(kg, index, step, context);
      if (!outcome.performed) break;
      kg = outcome.kg;
      progressed = true;
    }
    if (!progressed) break;
  }

  return { ...state, mana, kitchenGarden: kg };
}

/** The most valuable surface this build has unlocked, by yield-per-slot. */
function bestUnlockedSurface(purchasedNodes: readonly string[]): SurfaceId | null {
  let best: SurfaceId | null = null;
  let bestValue = 1; // Bare Soil is capacity 1 x yield 1.
  for (const [id, node] of Object.entries(SURFACE_UNLOCK_NODE)) {
    if (!node || !purchasedNodes.includes(node)) continue;
    const surface = SURFACES[id as SurfaceId];
    const value = surface.capacity * surface.yieldMult;
    if (value > bestValue) {
      bestValue = value;
      best = surface.id;
    }
  }
  return best;
}
