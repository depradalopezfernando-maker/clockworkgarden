/**
 * kitchenGarden.ts — §2a, the hand-tended subsystem.
 *
 * Pure (ADR-0002). Replaces Phase 1's build-out approximation with the real
 * per-plot state machine.
 *
 * The decision that governs everything here is D2:
 *
 *   PlotContribution = BaseFraction x mods x GardenPlotManaPerSec
 *
 * NOT a fraction of TOTAL production. The spec's wording is self-referential -
 * Kitchen Garden output is part of the total it claims a percentage of - and at
 * full build-out it claims 120% of a number it feeds into, which has no fixed
 * point. Everything below returns a multiplier OF GARDEN PLOT INCOME, so the
 * loop cannot close.
 *
 * §2a's other load-bearing promise, and the easiest to regress: **Night pauses
 * only new Kitchen Garden actions.** It never touches the Bell, Garden Plots,
 * Growth Frenzy, Pollination or the Harvest Festival. Nothing in this file may
 * reach outside the Kitchen Garden, and a test asserts the blast radius.
 */

import {
  DAY_LENGTH_SECONDS_BY_UPGRADE,
  KG_BASE_GROW_SECONDS,
  KG_MAX_SLOTS,
  KG_SLOT_COST_BASE_MULTIPLIER,
  KG_SLOT_COST_GROWTH,
  KG_STARTING_SLOTS,
  KITCHEN_GARDEN_BASE_FRACTION,
  NIGHT_DURATION_SECONDS,
  NIGHT_DURATION_SECONDS_UPGRADED,
  PERFECT_PLANTING_DURATION_SECONDS,
  PERFECT_PLANTING_MULTIPLIER,
  PERFECT_PLANTING_WINDOW_SECONDS,
  SEASON_TRANSITION_LEGACY_FRACTION,
  SEED_REGEN_SECONDS,
  SEED_SATCHEL_BASE_CAPACITY,
  AUTOMATION_ALLOWS_PERFECT_PLANTING,
  AUTOMATION_STEP_SECONDS,
  AUTOMATION_YIELD_MULTIPLIER,
} from '@content/balance';
import { DEFAULT_SURFACE, surfaceById, type SurfaceId } from '@content/surfaces';
import type { AutomationLevels } from './insight';

export type PlotStage = 'bare' | 'dug' | 'planted' | 'growing' | 'grown';
export type PlotStep = 'dig' | 'plant' | 'cover';

export interface Plot {
  readonly surface: SurfaceId;
  readonly stage: PlotStage;
  /** Elapsed-seconds stamps for the current cycle. -1 means "not yet". */
  readonly digAt: number;
  readonly plantAt: number;
  readonly coverAt: number;
  /** Elapsed seconds at which growth completes. -1 when not growing. */
  readonly grownAt: number;
  /** Elapsed seconds until which Perfect Planting doubles this plot. */
  readonly perfectUntil: number;
  /** Season this crop was planted in. Older plantings decay (§2a). */
  readonly plantedSeason: number;
}

export interface KitchenGardenState {
  /** One entry per slot the player has broken ground on. */
  readonly plots: readonly Plot[];
  readonly seeds: number;
  /** Seconds of Day Time left. Spend-only: it never ticks down on its own. */
  readonly dayTimeRemaining: number;
  /** Seconds of Night left. > 0 means Night. Auto-resolves. */
  readonly nightRemaining: number;
  /** Fractional seed regeneration carried between ticks. */
  readonly seedProgress: number;
}

export function emptyPlot(surface: SurfaceId = DEFAULT_SURFACE): Plot {
  return {
    surface,
    stage: 'bare',
    digAt: -1,
    plantAt: -1,
    coverAt: -1,
    grownAt: -1,
    perfectUntil: -1,
    plantedSeason: 0,
  };
}

export function initialKitchenGarden(): KitchenGardenState {
  return {
    plots: Array.from({ length: KG_STARTING_SLOTS }, () => emptyPlot()),
    seeds: SEED_SATCHEL_BASE_CAPACITY,
    dayTimeRemaining: DAY_LENGTH_SECONDS_BY_UPGRADE[0] ?? 30,
    nightRemaining: 0,
    seedProgress: 0,
  };
}

// ---------------------------------------------------------------------------
// Derived capacities — the Insight tree raises ceilings, Mana buys the slots
// ---------------------------------------------------------------------------

/**
 * §2a buys slots with Mana; §3 lists "plot-slot capacity" as an Insight branch.
 * Reconciled: **Insight raises the cap, Mana breaks the ground.** Base 4, plus
 * 16 from the tree, reaching §2a's cap of 20.
 */
export function slotCap(kgSlotBonus: number): number {
  return Math.min(KG_STARTING_SLOTS + kgSlotBonus, KG_MAX_SLOTS);
}

export function satchelCapacity(satchelBonus: number): number {
  return SEED_SATCHEL_BASE_CAPACITY + satchelBonus;
}

export function dayLengthSeconds(dayLengthStep: number): number {
  const index = Math.min(Math.max(dayLengthStep, 0), DAY_LENGTH_SECONDS_BY_UPGRADE.length - 1);
  return DAY_LENGTH_SECONDS_BY_UPGRADE[index] ?? 30;
}

export function nightLengthSeconds(hasShortNight: boolean): number {
  return hasShortNight ? NIGHT_DURATION_SECONDS_UPGRADED : NIGHT_DURATION_SECONDS;
}

/** §2a: `SlotCost(n) = 3 x (Season Tier-1 cost) x 1.15^(n-5)`, n = 5..20. */
export function slotCost(nextSlotNumber: number, seasonTierOneCost: number): number {
  const n = Math.max(nextSlotNumber, KG_STARTING_SLOTS + 1);
  return KG_SLOT_COST_BASE_MULTIPLIER * seasonTierOneCost * Math.pow(KG_SLOT_COST_GROWTH, n - 5);
}

// ---------------------------------------------------------------------------
// The Dig -> Plant -> Cover sequence
// ---------------------------------------------------------------------------

/** Effective automation level for a step, honouring a surface's built-in level. */
export function effectiveLevel(plot: Plot, step: PlotStep, levels: AutomationLevels): 0 | 1 | 2 {
  const built = surfaceById(plot.surface).builtInAutomationLevel;
  const bought = levels[step];
  return (built > bought ? built : bought) as 0 | 1 | 2;
}

/** Day Time this step will cost. Level 2 is free (§2a). */
export function stepCostSeconds(plot: Plot, step: PlotStep, levels: AutomationLevels): number {
  return AUTOMATION_STEP_SECONDS[effectiveLevel(plot, step, levels)] ?? 0;
}

export const NEXT_STAGE: Readonly<Record<PlotStep, PlotStage>> = {
  dig: 'dug',
  plant: 'planted',
  cover: 'growing',
};

const REQUIRED_STAGE: Readonly<Record<PlotStep, PlotStage>> = {
  dig: 'bare',
  plant: 'dug',
  cover: 'planted',
};

export interface KitchenGardenContext {
  readonly levels: AutomationLevels;
  readonly season: number;
  /** Elapsed seconds of engaged play — the sim's clock (ADR-0002). */
  readonly nowSeconds: number;
}

export interface StepOutcome {
  readonly kg: KitchenGardenState;
  readonly performed: boolean;
  /** Set when the Cover completed a Perfect Planting. */
  readonly perfect: boolean;
}

/**
 * Whether a step can be performed right now.
 *
 * Night blocks it — that is the ONLY thing Night blocks (§2a). Day Time and
 * Seeds are the other gates.
 */
export function canPerform(
  kg: KitchenGardenState,
  plotIndex: number,
  step: PlotStep,
  context: KitchenGardenContext
): boolean {
  if (kg.nightRemaining > 0) return false;
  const plot = kg.plots[plotIndex];
  if (!plot) return false;
  if (plot.stage !== REQUIRED_STAGE[step]) return false;
  if (step === 'plant' && kg.seeds < 1) return false;
  return kg.dayTimeRemaining >= stepCostSeconds(plot, step, context.levels);
}

/**
 * Perform one step of the cycle.
 *
 * Day Time is spend-only: it drops HERE, when the player acts, and nowhere else.
 * §2a is emphatic that it must never tick down on a timer - that is the
 * mobile-energy-gate failure mode §9 lists by name.
 */
export function performStep(
  kg: KitchenGardenState,
  plotIndex: number,
  step: PlotStep,
  context: KitchenGardenContext
): StepOutcome {
  if (!canPerform(kg, plotIndex, step, context)) return { kg, performed: false, perfect: false };

  const plot = kg.plots[plotIndex];
  if (!plot) return { kg, performed: false, perfect: false };

  const cost = stepCostSeconds(plot, step, context.levels);
  const now = context.nowSeconds;

  let next: Plot = { ...plot, stage: NEXT_STAGE[step] };
  if (step === 'dig') next = { ...next, digAt: now, plantAt: -1, coverAt: -1 };
  if (step === 'plant') next = { ...next, plantAt: now };

  let perfect = false;
  if (step === 'cover') {
    const surface = surfaceById(plot.surface);
    const growSeconds = KG_BASE_GROW_SECONDS * surface.growTimeMult;

    // §2a: all three steps within the window doubles yield for the crop's first
    // five productive minutes. Only fully-manual cycles are eligible.
    const manual = (['dig', 'plant', 'cover'] as PlotStep[]).every(
      (s) => AUTOMATION_ALLOWS_PERFECT_PLANTING[effectiveLevel(plot, s, context.levels)] === true
    );
    const span = now - plot.digAt;
    perfect = manual && plot.digAt >= 0 && span <= PERFECT_PLANTING_WINDOW_SECONDS;

    const grownAt = now + growSeconds;
    next = {
      ...next,
      coverAt: now,
      grownAt,
      plantedSeason: context.season,
      perfectUntil: perfect ? grownAt + PERFECT_PLANTING_DURATION_SECONDS : -1,
    };
  }

  const plots = kg.plots.slice();
  plots[plotIndex] = next;

  return {
    kg: {
      ...kg,
      plots,
      seeds: step === 'plant' ? kg.seeds - 1 : kg.seeds,
      dayTimeRemaining: kg.dayTimeRemaining - cost,
    },
    performed: true,
    perfect,
  };
}

/** Clear a grown plot back to bare so it can be replanted. */
export function clearPlot(kg: KitchenGardenState, plotIndex: number): KitchenGardenState {
  const plot = kg.plots[plotIndex];
  if (!plot) return kg;
  const plots = kg.plots.slice();
  plots[plotIndex] = emptyPlot(plot.surface);
  return { ...kg, plots };
}

export function applySurface(
  kg: KitchenGardenState,
  plotIndex: number,
  surface: SurfaceId
): KitchenGardenState {
  const plot = kg.plots[plotIndex];
  if (!plot) return kg;
  const plots = kg.plots.slice();
  // Changing surface resets the plot: §2a lists a surface upgrade as one of the
  // three things that require replanting.
  plots[plotIndex] = emptyPlot(surface);
  return { ...kg, plots };
}

export function addSlot(kg: KitchenGardenState, cap: number): KitchenGardenState {
  if (kg.plots.length >= cap) return kg;
  return { ...kg, plots: [...kg.plots, emptyPlot()] };
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export interface KitchenGardenTickContext {
  readonly dayLengthStep: number;
  readonly hasShortNight: boolean;
  readonly satchelBonus: number;
  readonly nowSeconds: number;
}

/**
 * Advance the Kitchen Garden by `dt` seconds.
 *
 * Growth, Night and Seed regeneration all run on real time — including through
 * Night, per §2a ("plants already mid-growth keep growing through Night"). Day
 * Time is the one thing that does NOT move here.
 */
export function tickKitchenGarden(
  kg: KitchenGardenState,
  dt: number,
  context: KitchenGardenTickContext
): KitchenGardenState {
  if (!(dt > 0)) return kg;

  let { seeds, dayTimeRemaining, nightRemaining, seedProgress } = kg;

  // Night resolves itself; no player input required (§2a).
  if (nightRemaining > 0) {
    nightRemaining = Math.max(0, nightRemaining - dt);
    if (nightRemaining === 0) {
      dayTimeRemaining = dayLengthSeconds(context.dayLengthStep);
    }
  } else if (dayTimeRemaining <= 0) {
    nightRemaining = nightLengthSeconds(context.hasShortNight);
  }

  // Seeds regenerate on real time, capped.
  const capacity = satchelCapacity(context.satchelBonus);
  if (seeds < capacity) {
    seedProgress += dt;
    const gained = Math.floor(seedProgress / SEED_REGEN_SECONDS);
    if (gained > 0) {
      seeds = Math.min(capacity, seeds + gained);
      seedProgress -= gained * SEED_REGEN_SECONDS;
    }
  } else {
    seedProgress = 0;
  }

  // Growth completes on real time, Night included.
  let plots: readonly Plot[] = kg.plots;
  let mutable: Plot[] | null = null;
  for (let i = 0; i < plots.length; i++) {
    const plot = plots[i]!;
    if (plot.stage === 'growing' && plot.grownAt >= 0 && context.nowSeconds >= plot.grownAt) {
      mutable ??= kg.plots.slice();
      mutable[i] = { ...plot, stage: 'grown' };
    }
  }
  if (mutable) plots = mutable;

  return { plots, seeds, dayTimeRemaining, nightRemaining, seedProgress };
}

// ---------------------------------------------------------------------------
// Yield (decision D2)
// ---------------------------------------------------------------------------

/** Yield weight of one plot, in "plant units". Zero unless grown. */
export function plotUnits(
  plot: Plot,
  context: {
    readonly levels: AutomationLevels;
    readonly season: number;
    readonly nowSeconds: number;
  }
): number {
  if (plot.stage !== 'grown') return 0;

  const surface = surfaceById(plot.surface);

  // §2a: a Season change decays last Season's planting to a small legacy share
  // until it is refreshed. No hard obsolescence, same philosophy as §3.
  const legacy = plot.plantedSeason === context.season ? 1 : SEASON_TRANSITION_LEGACY_FRACTION;

  const perfect =
    plot.perfectUntil > 0 && context.nowSeconds <= plot.perfectUntil
      ? PERFECT_PLANTING_MULTIPLIER
      : 1;

  // §2a gives one yield modifier per automation LEVEL, not per step. Taking the
  // worst step's modifier keeps Level 1 a "modest yield cost" as described;
  // multiplying the three would compound 0.9 to 0.73, which is not modest.
  const worstLevel = Math.max(
    effectiveLevel(plot, 'dig', context.levels),
    effectiveLevel(plot, 'plant', context.levels),
    effectiveLevel(plot, 'cover', context.levels)
  );
  const automation =
    worstLevel === 1
      ? (AUTOMATION_YIELD_MULTIPLIER[1] ?? 0.9)
      : (AUTOMATION_YIELD_MULTIPLIER[0] ?? 1);

  return surface.capacity * surface.yieldMult * perfect * automation * legacy;
}

export function totalPlantUnits(
  kg: KitchenGardenState,
  context: {
    readonly levels: AutomationLevels;
    readonly season: number;
    readonly nowSeconds: number;
  }
): number {
  let total = 0;
  for (const plot of kg.plots) total += plotUnits(plot, context);
  return total;
}

/**
 * The Kitchen Garden's output as a MULTIPLE of Garden Plot income.
 *
 * Returns e.g. 0.48 for "+48% on top of Garden Plots". Bounded by construction:
 * it never reads total production, so it cannot feed itself (D2).
 */
export function kitchenGardenMultiplier(
  kg: KitchenGardenState,
  context: {
    readonly levels: AutomationLevels;
    readonly season: number;
    readonly nowSeconds: number;
  },
  baseFraction: number = KITCHEN_GARDEN_BASE_FRACTION
): number {
  return totalPlantUnits(kg, context) * baseFraction;
}

/** Share of TOTAL income the Kitchen Garden supplies. §10 item 10 asks this. */
export function kitchenGardenIncomeShare(
  kg: KitchenGardenState,
  context: {
    readonly levels: AutomationLevels;
    readonly season: number;
    readonly nowSeconds: number;
  },
  baseFraction: number = KITCHEN_GARDEN_BASE_FRACTION
): number {
  const added = kitchenGardenMultiplier(kg, context, baseFraction);
  return added / (1 + added);
}

/** Full Season 4 build-out: every slot a grown Clockwork Trellis. */
export function fullBuildOut(season = 4, nowSeconds = 0): KitchenGardenState {
  return {
    plots: Array.from({ length: KG_MAX_SLOTS }, () => ({
      ...emptyPlot('clockwork-trellis'),
      stage: 'grown' as const,
      grownAt: nowSeconds,
      plantedSeason: season,
    })),
    seeds: SEED_SATCHEL_BASE_CAPACITY,
    dayTimeRemaining: 30,
    nightRemaining: 0,
    seedProgress: 0,
  };
}
