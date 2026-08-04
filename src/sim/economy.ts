/**
 * economy.ts — §2 of the spec. Generator costs, yields, and unlock gates.
 *
 * Pure and deterministic (ADR-0002). Every function here takes state and returns
 * a number or a new state; nothing reads a clock or a global.
 */

import { GENERATOR_TIERS, TIER_COUNT, tierAt, type UnlockGate } from '@content/generators';
import { BASE_CLICK_YIELD } from '@content/balance';
import { ownedOf, type GameState } from './state';
import { prestigeMultiplier } from './prestige';
import { kitchenGardenMultiplier } from './kitchenGarden';
import { effectsOf, levelsOf } from './insight';
import { isCapstoneReady } from './capstone';

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

/**
 * §2: `Cost(n) = BaseCost * (CostMult ^ n)` where n is the number already owned.
 * So the first unit costs exactly BaseCost.
 */
export function costOfNext(tier: number, owned: number): number {
  const t = tierAt(tier);
  return t.baseCost * Math.pow(t.costMult, owned);
}

/**
 * Cost of buying `count` more units starting from `owned`. Closed-form geometric
 * sum - never loop, this is called inside the simulation's inner loop.
 */
export function costOfNextN(tier: number, owned: number, count: number): number {
  if (count <= 0) return 0;
  const t = tierAt(tier);
  const first = t.baseCost * Math.pow(t.costMult, owned);
  return (first * (Math.pow(t.costMult, count) - 1)) / (t.costMult - 1);
}

/**
 * Seconds for one newly-bought unit to pay for itself, ignoring multipliers
 * (which cancel out - they scale cost and yield's value equally).
 *
 * This is the number that governs how a purchase FEELS, and the audit found the
 * spec holds it flat at ~150-180s across all 20 tiers. Guarded by a regression
 * test.
 */
export function paybackSeconds(tier: number, owned: number): number {
  return costOfNext(tier, owned) / tierAt(tier).baseYield;
}

/** Cost of the cheapest tier the player has not yet bought a single unit of. */
export function costOfNextUnpurchasedTier(state: GameState): number {
  for (let tier = 1; tier <= TIER_COUNT; tier++) {
    if (ownedOf(state, tier) === 0) return costOfNext(tier, 0);
  }
  return costOfNext(TIER_COUNT, ownedOf(state, TIER_COUNT));
}

// ---------------------------------------------------------------------------
// Unlock gates
// ---------------------------------------------------------------------------

export function isGateMet(state: GameState, gate: UnlockGate): boolean {
  switch (gate.kind) {
    case 'start':
      return true;
    case 'own-count':
      return ownedOf(state, gate.tier) >= gate.count;
    case 'lifetime-mana':
      return state.lifetimeMana >= gate.amount;
    case 'any':
      return gate.gates.some((g) => isGateMet(state, g));
    case 'capstone-clear':
      return state.capstonesCleared.includes(gate.season);
    case 'season-start':
      return state.season >= gate.season;
  }
}

export function isTierUnlocked(state: GameState, tier: number): boolean {
  // No Insight consultation: a tier's gate is a fact about the garden, never
  // about how the player spent their Insight. That is what makes the soft-lock
  // impossible rather than merely unlikely.
  //
  // `tiersUnlocked` is a high-water mark, so a tier the player has already
  // opened stays open through a prestige that zeroed the owned counts feeding
  // its gate.
  return tier <= state.tiersUnlocked || isGateMet(state, tierAt(tier).unlock);
}

/**
 * Raise the unlock high-water mark to match what is currently reachable.
 *
 * Called wherever the inputs to a gate can change - buying a generator,
 * advancing the world, clearing a capstone. Returns the same reference when
 * nothing moved, so the store does not republish on every tick.
 */
export function recordUnlocks(state: GameState): GameState {
  let highest = state.tiersUnlocked;
  for (let tier = highest + 1; tier <= TIER_COUNT; tier++) {
    if (!isGateMet(state, tierAt(tier).unlock)) continue;
    highest = tier;
  }
  return highest === state.tiersUnlocked ? state : { ...state, tiersUnlocked: highest };
}

export function unlockedTiers(state: GameState): number[] {
  const out: number[] = [];
  for (let tier = 1; tier <= TIER_COUNT; tier++) {
    if (isTierUnlocked(state, tier)) out.push(tier);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Production
// ---------------------------------------------------------------------------

/**
 * Mana/sec from Garden Plots alone, including the prestige multiplier but NOT
 * the Kitchen Garden.
 *
 * Decision D2 depends on this distinction: Kitchen Garden yield is a fraction of
 * THIS number, not of the total. Making it a fraction of the total would be
 * self-referential and diverge to infinity at full build-out.
 */
export function gardenPlotManaPerSecond(state: GameState): number {
  const insight = effectsOf(state);
  let base = 0;
  for (const t of GENERATOR_TIERS) {
    const owned = state.owned[t.tier - 1] ?? 0;
    if (owned === 0) continue;
    // Per-tier Insight bonuses apply to their own tier only, before the global
    // multipliers. Additive within a tier, so two levels of the same ladder read
    // as "+25% then +30%" rather than compounding into something unstateable.
    base += owned * t.baseYield * (1 + (insight.tierProduction.get(t.tier) ?? 0));
  }
  return base * prestigeMultiplier(state.appliedSqp) * (1 + insight.productionBonus);
}

/**
 * Total production, Garden Plots plus the Kitchen Garden's bounded share.
 *
 * `kitchenGardenBaseFraction` is overridable so the balance harness can sweep
 * D2's constant through the SAME code path the live game uses. Duplicating the
 * income formula for the simulation would let the two drift apart, which would
 * quietly invalidate every number in the balance report.
 */
export function totalManaPerSecond(state: GameState, kitchenGardenBaseFraction?: number): number {
  const plots = gardenPlotManaPerSecond(state);
  return plots + plots * kitchenGardenShare(state, kitchenGardenBaseFraction);
}

/** The Kitchen Garden's bonus as a multiple of Garden Plot income (D2). */
export function kitchenGardenShare(state: GameState, baseFraction?: number): number {
  return kitchenGardenMultiplier(
    state.kitchenGarden,
    { levels: levelsOf(state), season: state.season, nowSeconds: state.elapsedSeconds },
    baseFraction
  );
}

/**
 * §2: `ClickYield = BaseClick x (1 + sum of upgrade bonuses) x PrestigeMultiplier
 * x FrenzyMultiplier`.
 *
 * `extraBonus` is for callers with a bonus the tree does not know about; the
 * Insight tree's own click nodes are read from state.
 */
export function clickYield(state: GameState, extraBonus = 0, frenzyMultiplier = 1): number {
  const bonus = effectsOf(state).clickBonus + extraBonus;
  return BASE_CLICK_YIELD * (1 + bonus) * prestigeMultiplier(state.appliedSqp) * frenzyMultiplier;
}

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

export interface PurchaseOption {
  readonly tier: number;
  readonly cost: number;
  readonly paybackSeconds: number;
}

/**
 * The tier a rational player buys next: the unlocked, affordable tier whose next
 * unit repays itself fastest. Ties break toward the higher tier, since newer
 * tiers carry the content the player is progressing toward.
 *
 * Returns null when nothing is affordable.
 */
export function bestPurchase(state: GameState): PurchaseOption | null {
  let best: PurchaseOption | null = null;
  for (const tier of unlockedTiers(state)) {
    const owned = ownedOf(state, tier);
    const cost = costOfNext(tier, owned);
    if (cost > state.mana) continue;
    const payback = paybackSeconds(tier, owned);
    // Ties break toward the higher tier: iteration ascends, so `<=` lets a later
    // (higher) tier displace an equal-payback earlier one.
    if (best === null || payback <= best.paybackSeconds) {
      best = { tier, cost, paybackSeconds: payback };
    }
  }
  return best;
}

/** Buy one unit of a tier. Returns unchanged state if unaffordable or locked. */
export function buy(state: GameState, tier: number): GameState {
  if (!isTierUnlocked(state, tier)) return state;
  const owned = ownedOf(state, tier);
  const cost = costOfNext(tier, owned);
  if (cost > state.mana) return state;

  const nextOwned = state.owned.slice();
  nextOwned[tier - 1] = owned + 1;
  // Buying is the main way an own-count gate becomes satisfied, so record it
  // here rather than waiting for the next tick to notice.
  return recordUnlocks({ ...state, mana: state.mana - cost, owned: nextOwned });
}

// ---------------------------------------------------------------------------
// Capstones and Season advancement (decision D6)
// ---------------------------------------------------------------------------

/**
 * Whether the player has built enough to attempt this Season's capstone.
 *
 * Re-exported from `capstone.ts`, which owns capstone logic since Phase 5.
 */
export { isCapstoneReady, isCapstoneReady as isCapstoneAvailable } from './capstone';

/**
 * Clear the current Season's capstone unconditionally once ready.
 *
 * Kept for Seasons 2-4, whose capstones are undesigned (`docs/04` item 4).
 * Season 1 goes through the real "First Bloom" challenge in `capstone.ts` and
 * must NOT use this path.
 */
export function clearCapstone(state: GameState): GameState {
  if (!isCapstoneReady(state)) return state;
  return {
    ...state,
    capstonesCleared: [...state.capstonesCleared, state.season],
    season: Math.min(state.season + 1, 4),
  };
}

/** True once the final tier is owned - the "Full Bloom" ending trigger (§2). */
export function isCampaignComplete(state: GameState): boolean {
  return ownedOf(state, TIER_COUNT) >= 1;
}
