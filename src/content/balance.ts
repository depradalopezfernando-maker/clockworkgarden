/**
 * balance.ts — EVERY tunable constant in the game, in one file.
 *
 * Nothing else in the codebase may hard-code a balance number. Phase 11's tuning
 * work should never need to read game logic; it edits this file and re-runs the
 * simulation. See docs/01-effort-estimate.md §5.
 *
 * Each constant carries a provenance tag:
 *
 *   SPEC   Fixed by clockwork-garden-design-spec.md. Changing it changes the
 *          design, not the balance.
 *   SIM    Starting value. Phase 1's harness fits it against the 6-10 hr and
 *          4-5 reset targets. The formula SHAPE is fixed; this number is not.
 *   HUMAN  Game feel. A simulation cannot evaluate this - only a player can.
 *          Claude may report consequences but must not decide the value.
 *          (See CLAUDE.md, "What Claude cannot judge here".)
 *
 * Decisions D1/D2/D3/D6 are recorded in docs/04-spec-open-questions.md and
 * override the spec text where they conflict.
 */

// ---------------------------------------------------------------------------
// Simulation core
// ---------------------------------------------------------------------------

/** SPEC-adjacent. 10 Hz keeps sub-second windows (Perfect Planting, Frenzy) crisp. */
export const SIM_TICK_HZ = 10;
export const SIM_TICK_SECONDS = 1 / SIM_TICK_HZ;

/** Largest single catch-up step, so a refocused tab never freezes. */
export const MAX_CATCHUP_SECONDS = 5;

// ---------------------------------------------------------------------------
// §2 — Mana, clicking, generators
// ---------------------------------------------------------------------------

/** SPEC §2. `BaseClick` starts at 1. */
export const BASE_CLICK_YIELD = 1;

/** SPEC §9. Core generator cost multipliers must stay inside this band - no cliffs. */
export const COST_MULT_BAND = { min: 1.07, max: 1.12 } as const;

/**
 * SPEC §2 (derived). Payback time = cost / yield for one unit. The audit found
 * this is flat at ~150-180s across all 20 tiers, which is what makes the economy
 * read the same whether the number on screen is 15 or 250 quadrillion.
 * Guarded by an invariant test; tuning must not break it.
 */
export const PAYBACK_SECONDS_BAND = { min: 140, max: 190 } as const;

// ---------------------------------------------------------------------------
// §4 — Prestige ("Turn the Soil")  ·  DECISION D3 + D6
// ---------------------------------------------------------------------------

/**
 * D3. Log-shaped, computed ABSOLUTELY from all-time lifetime Mana:
 *
 *   TotalSQP           = max(0, floor(K * log10(LifetimeMana / REFERENCE)))
 *   SQPGainedThisReset = TotalSQP_now - TotalSQP_at_last_reset
 *   PrestigeMultiplier = 1 + BONUS_PER_SQP * TotalSQP
 *
 * LifetimeMana is all-time and does NOT reset. SQP is absolute, never summed
 * across resets - summing double-counts (x27 vs x12.6 by the fourth reset).
 *
 * Why log: gain scales with the log of lifetime Mana, so grinding twice as long
 * adds a fixed small amount. Over-banking is self-limiting, which mechanises
 * §4's "reset cap by design, not by code" instead of leaving it to hope.
 */
/**
 * SIM (K). Fitted by `npm run fit` in Phase 1.
 *
 * K scales the absolute multiplier and therefore campaign LENGTH. It provably
 * cannot change the reset COUNT: SQP is linear in K, so the ratio between
 * successive prestiges - which is what the player's reset decision compares
 * against - is K-independent. Reset count is set by player behaviour and by the
 * span of lifetime Mana across the campaign. See docs/06-phase-1-balance-report.md.
 */
export const PRESTIGE_SQP_COEFFICIENT = 26;
/**
 * SIM. The lifetime Mana at which SQP starts accruing.
 *
 * The spec says 1e6. The simulation found that at the Season 1 capstone - the
 * moment §4 unlocks prestige - a player holds only ~5e5 lifetime Mana, BELOW
 * that reference. log10 goes negative, SQP clamps to zero, and the first
 * prestige is worth exactly x1.00: nothing at all.
 *
 * That is worse than the x1.18 problem decision D3 set out to fix, and it is not
 * visible on paper - it needs a simulated playthrough to see, because it depends
 * on when the capstone actually fires.
 *
 * Re-fitted in Phase 3 (5e4 -> 1e4) once the Insight tree's production bonuses
 * entered the economy. First prestige is now ~x1.78.
 */
export const PRESTIGE_SQP_REFERENCE = 1e4;
export const PRESTIGE_BONUS_PER_SQP = 0.02; // SPEC §4  (+2% per SQP)

/** SIM. Phase 1 fits PRESTIGE_SQP_COEFFICIENT until natural play lands here. */
export const TARGET_PRESTIGE_RESETS = { min: 4, max: 5 } as const;

/** SPEC §4. Prestige unlocks after the Season 1 capstone; never required. */
export const PRESTIGE_UNLOCK_SEASON = 1;

/**
 * D6. Seasons advance on capstone-clear ONLY. §8's timeline is a prediction the
 * simulation validates, never a trigger.
 */
export const SEASON_ADVANCE_MODE = 'capstone-clear' as const;

/** SPEC §8. Target campaign length. Phase 1's exit criterion. */
export const TARGET_CAMPAIGN_HOURS = { min: 6, max: 10 } as const;

// ---------------------------------------------------------------------------
// §5 — Growth Frenzy
// ---------------------------------------------------------------------------

export const FRENZY_MULTIPLIER = 2.0; // SPEC §5
export const FRENZY_DURATION_SECONDS = 20; // HUMAN §10 item 3
export const FRENZY_METER_GAIN_PER_CLICK = 0.05; // HUMAN
export const FRENZY_METER_DRAIN_PER_SECOND = 0.02; // HUMAN

// ---------------------------------------------------------------------------
// §6.1 — Season 2: Pollination Combo
// ---------------------------------------------------------------------------

/** HUMAN §10 item 5. Forgiving enough for casual play, tight enough to matter. */
export const POLLINATION_CHAIN_WINDOW_SECONDS = 3;

/** SPEC §6.1. Chain milestones. `bonus` is additive to the Mana multiplier. */
export const POLLINATION_TIERS = [
  { chain: 3, name: 'Bronze Bloom', bonus: 0.25, durationSeconds: 15, seeds: 0 },
  { chain: 6, name: 'Silver Bloom', bonus: 0.5, durationSeconds: 15, seeds: 0 },
  { chain: 9, name: 'Golden Bloom', bonus: 1.0, durationSeconds: 20, seeds: 1 },
] as const;

/**
 * SPEC §6.1. Tier 8 (Pollinator Drone Swarm) auto-attempts chains at this rate.
 * INVARIANT: active play must reliably out-earn this. Guarded by test.
 */
export const POLLINATION_DRONE_SUCCESS_RATE = 0.4;

// ---------------------------------------------------------------------------
// §6.2 — Season 3: Harvest Festival & the Barn  ·  DECISION D1
// ---------------------------------------------------------------------------

/**
 * D1. BarnCapacity = max(MULT * TotalManaPerSec, NEXT_TIER_FLOOR * nextTierCost)
 *
 * TotalManaPerSec is TOTAL production, not per-unit yield. The floor term is a
 * structural safety rail: the audit found that the per-unit reading put the cap
 * below the next tier's cost on 9 of 9 Season 3-4 transitions, deadlocking the
 * game at Tier 11. The floor makes that impossible under any future retune.
 */
export const BARN_CAPACITY_MULTIPLIER = 500; // SPEC §6.2
export const BARN_CAPACITY_NEXT_TIER_FLOOR = 2.5; // D1 safety rail

/** SPEC §6.2. Overflow decays rather than being lost outright - soft cap. */
export const BARN_OVERFLOW_DECAY_PER_MINUTE = 0.05;

export const FESTIVAL_INTERVAL_MINUTES = { min: 20, max: 30 } as const; // HUMAN §10 item 6
export const FESTIVAL_DURATION_SECONDS = 60; // SPEC §6.2
export const FESTIVAL_PRODUCTION_MULTIPLIER = 2.0; // SPEC §6.2

// ---------------------------------------------------------------------------
// §6.3 — Season 4: Frost Dormancy & The Long Night
// ---------------------------------------------------------------------------

export const FROST_INTERVAL_MINUTES = { min: 5, max: 8 } as const; // SPEC §6.3
export const FROST_DURATION_SECONDS = 45; // SPEC §6.3

/** SPEC §6.3. Output floor during a Frost Cycle, by Insulation upgrades owned. */
export const FROST_OUTPUT_FLOOR_BY_INSULATION = [0.6, 0.7, 0.8, 0.8] as const;

export const LONG_NIGHT_DURATION_SECONDS = { min: 120, max: 180 } as const; // SPEC §6.3
export const LONG_NIGHT_OUTPUT_FLOOR = 0.25; // SPEC §6.3

/**
 * SPEC §6.3. Gates for clearing The Long Night *well*. Under-invested players
 * must still be able to clear it, just slower - it is a difficulty spike, not a
 * hard build gate. Guarded by an invariant test.
 */
export const LONG_NIGHT_INSULATION_REQUIRED = 2;

/** HUMAN. Fill this by clicking during a Frost Cycle to cancel the penalty early. */
export const STOKE_METER_GAIN_PER_CLICK = 0.04;
export const STOKE_METER_DRAIN_PER_SECOND = 0.01;

// ---------------------------------------------------------------------------
// §7 — Offline progress
// ---------------------------------------------------------------------------

/**
 * SPEC §7. Piecewise: 100% to 8h, tapering 100%->50% across 8-24h, flat 50%
 * after. Computed analytically by closed-form integration, never by ticking -
 * 8 hours at 10 Hz would be 288,000 ticks. See docs/03 §5.
 */
export const OFFLINE_FULL_RATE_HOURS = 8;
export const OFFLINE_TAPER_END_HOURS = 24;
export const OFFLINE_MIN_EFFICIENCY = 0.5;

/** Guard against clock skew: a save from the future grants nothing. */
export const OFFLINE_MAX_SECONDS = 30 * 24 * 3600;

// ---------------------------------------------------------------------------
// §2a — Kitchen Garden  ·  DECISION D2
// ---------------------------------------------------------------------------

/**
 * D2. NON-RECURSIVE. The base is Garden Plot income only:
 *
 *   PlotContribution = BASE_FRACTION * surfaceMult * perfectMult * automationMult
 *                                    * GardenPlotManaPerSec
 *   TotalManaPerSec  = GardenPlotManaPerSec + sum(PlotContribution)
 *
 * The spec's "% of CurrentTotalManaPerSec" is self-referential: at 20 Clockwork
 * Trellis slots the Kitchen Garden claims 120% of a number it feeds into, which
 * has no fixed point and runs to infinity.
 *
 * SIM. 0.004 targets ~1/3 of total income at full Season 4 build-out
 * (20 slots x 5 plants x 1.2 yield = 120 plant-units -> +48% -> 32% share).
 * Large enough to be worth engaging with; never eclipses the Garden Plot
 * backbone, which also keeps the spec's §7 "Light integration" cut viable.
 */
export const KITCHEN_GARDEN_BASE_FRACTION = 0.004;

/** SIM. Phase 1 fits BASE_FRACTION until full build-out lands in this band. */
export const KITCHEN_GARDEN_TARGET_INCOME_SHARE = { min: 0.28, max: 0.38 } as const;

export const KG_STARTING_SLOTS = 4; // SPEC §2a
export const KG_MAX_SLOTS = 20; // SPEC §2a and §9

/** SPEC §2a. SlotCost(n) = BASE_MULT * (Season Tier-1 cost) * GROWTH^(n-5). */
export const KG_SLOT_COST_BASE_MULTIPLIER = 3;
export const KG_SLOT_COST_GROWTH = 1.15; // open question 8 - too shallow late

/**
 * HUMAN §2a. Base time for a crop to grow, before the surface's multiplier.
 *
 * The spec gives surfaces RELATIVE grow times (0.75x, 1.3x) but never an
 * absolute. 120s makes a Bare Soil crop roughly two minutes and a Stone
 * Parterre a little over two and a half - long enough that replanting is a
 * ritual rather than a treadmill, short enough to see within a session.
 */
export const KG_BASE_GROW_SECONDS = 120;

/** HUMAN §2a. All three of Dig/Plant/Cover within this window doubles yield. */
export const PERFECT_PLANTING_WINDOW_SECONDS = 2;
export const PERFECT_PLANTING_MULTIPLIER = 2.0; // SPEC §2a
export const PERFECT_PLANTING_DURATION_SECONDS = 300; // SPEC §2a - first 5 minutes

/**
 * SPEC §2a. Automation: 3 steps (Dig/Plant/Cover) x 2 levels, universal across
 * surfaces. Level 0 is manual. Index = automation level.
 *
 * INVARIANT: a fully-automated plot must NOT out-earn attentive manual play.
 * Manual 1.0 + a temporary 2x Perfect Planting beats a flat 1.0. Guarded by test.
 */
export const AUTOMATION_STEP_SECONDS = [2, 1, 0] as const;
export const AUTOMATION_YIELD_MULTIPLIER = [1.0, 0.9, 1.0] as const;
export const AUTOMATION_ALLOWS_PERFECT_PLANTING = [true, true, false] as const;

/** HUMAN §10 item 8. "The single number most likely to need retuning." */
export const DAY_LENGTH_SECONDS_BY_UPGRADE = [30, 45, 60, 90, 120] as const;

/** SPEC §2a. Night is a short auto-resolving beat, never a wall. */
export const NIGHT_DURATION_SECONDS = 6;
export const NIGHT_DURATION_SECONDS_UPGRADED = 3;

export const SEED_REGEN_SECONDS = 10; // SPEC §2a
export const SEED_SATCHEL_BASE_CAPACITY = 20; // SPEC §2a
export const SEED_HARVEST_BONUS_CHANCE = 0.1; // SPEC §2a
export const SEED_HARVEST_BONUS_RANGE = { min: 1, max: 3 } as const; // SPEC §2a

/** SPEC §2a. Last Season's planting decays to this until refreshed. */
export const SEASON_TRANSITION_LEGACY_FRACTION = 0.15; // SIM

// ---------------------------------------------------------------------------
// §3 — Insight
// ---------------------------------------------------------------------------

/** SPEC §3. Revised up from 30-40 once the Kitchen Garden branch was added. */
export const INSIGHT_TREE_NODE_TARGET = { min: 45, max: 55 } as const;
