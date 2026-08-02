/**
 * kitchenGarden.ts — §2a's yield contribution, as revised by decision D2.
 *
 * Phase 1 models the Kitchen Garden at BUILD-OUT level only: how many slots, how
 * much capacity, which surfaces. That is enough to fit
 * `KITCHEN_GARDEN_BASE_FRACTION` against its income-share target. The per-plot
 * Dig/Plant/Cover state machine, the Day/Night budget, Perfect Planting and the
 * automation tracks are Phase 4.
 *
 * The decision that matters here:
 *
 *   PlotContribution = BaseFraction * mods * GardenPlotManaPerSec
 *
 * NOT `* CurrentTotalManaPerSec`. The spec's wording is self-referential -
 * Kitchen Garden output is part of the total it claims a percentage of - and at
 * 20 Clockwork Trellis slots it claims 120% of a number it feeds into, which has
 * no fixed point and runs to infinity.
 */

import { KITCHEN_GARDEN_BASE_FRACTION, KG_MAX_SLOTS } from '@content/balance';
import type { KitchenGardenState } from './state';

/**
 * The Kitchen Garden's output as a MULTIPLE of Garden Plot income.
 *
 * Returns e.g. 0.48 to mean "+48% on top of Garden Plots". Bounded by
 * construction: it never reads total production, so it cannot feed itself.
 */
export function kitchenGardenMultiplier(
  kg: KitchenGardenState,
  baseFraction: number = KITCHEN_GARDEN_BASE_FRACTION
): number {
  const slots = Math.min(Math.max(kg.slots, 0), KG_MAX_SLOTS);
  const plantUnits = slots * kg.capacityPerSlot * kg.surfaceYieldMult * kg.activeFraction;
  return plantUnits * baseFraction;
}

/**
 * Share of the player's TOTAL income that the Kitchen Garden supplies.
 *
 * This is the number D2 targets (~1/3 at full Season 4 build-out) and the one
 * §10 item 10 asks about - "meaningful strategic layer or forgettable
 * side-mechanic".
 */
export function kitchenGardenIncomeShare(
  kg: KitchenGardenState,
  baseFraction = KITCHEN_GARDEN_BASE_FRACTION
): number {
  const added = kitchenGardenMultiplier(kg, baseFraction);
  return added / (1 + added);
}

/** Full Season 4 build-out: every slot a Clockwork Trellis (5 plants, 1.2x). */
export const FULL_BUILD_OUT: KitchenGardenState = {
  slots: KG_MAX_SLOTS,
  capacityPerSlot: 5,
  surfaceYieldMult: 1.2,
  activeFraction: 1,
};

/**
 * Roughly how the Kitchen Garden grows across the campaign. §2a expects one new
 * slot every 20-30 minutes of engaged play, with higher-capacity surfaces
 * arriving in Seasons 2 and 4.
 *
 * Used by the harness so the Kitchen Garden's contribution ramps rather than
 * appearing fully-formed at minute zero.
 */
export function buildOutForSeason(season: number, elapsedSeconds: number): KitchenGardenState {
  const slotsFromTime = Math.floor(elapsedSeconds / (25 * 60));
  const slots = Math.min(4 + slotsFromTime, KG_MAX_SLOTS);

  // Raised Garden Box (3 plants) unlocks in Season 2; Clockwork Trellis (5) in
  // Season 4. Players do not convert every slot the instant it unlocks.
  const capacityPerSlot = season >= 4 ? 5 : season >= 2 ? 3 : 1;
  const surfaceYieldMult = season >= 4 ? 1.2 : season >= 2 ? 1.0 : 1.0;

  return { slots, capacityPerSlot, surfaceYieldMult, activeFraction: 0.9 };
}
