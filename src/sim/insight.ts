/**
 * insight.ts — buying Insight nodes and reading what they add up to.
 *
 * Pure (ADR-0002). The tree itself is data in `src/content/insightTree.ts`.
 *
 * Some effect kinds belong to systems that do not exist yet — Kitchen Garden
 * automation is Phase 4, Insulation is Phase 9. Those nodes are authored now
 * because they are content, and `PENDING_EFFECT_KINDS` records exactly which are
 * declared-but-not-yet-applied. A test walks every effect kind and fails if one
 * is neither applied here nor listed there, so a node cannot silently do nothing.
 */

import { INSIGHT_TREE, nodeById, type InsightNode, type NodeEffect } from '@content/insightTree';
import type { GameState } from './state';

/**
 * Effect kinds whose systems arrive in a later phase. Everything else must be
 * read by `aggregateEffects` below.
 */
export const PENDING_EFFECT_KINDS: readonly NodeEffect['kind'][] = [
  'kg-slots', // Phase 4
  'kg-surface', // Phase 4
  'kg-automation', // Phase 4
  'kg-day-length', // Phase 4
  'satchel-capacity', // Phase 4
  'barn-capacity', // Phase 8
  'insulation', // Phase 9
  'cosmetic', // no mechanical effect, by design (§3)
];

export interface InsightEffects {
  /** Summed additive click bonus. Feeds §2's `(1 + Σ upgrade bonuses)`. */
  readonly clickBonus: number;
  /** Summed additive production bonus, applied as `1 + bonus`. */
  readonly productionBonus: number;
  /** Added to §7's offline floor. */
  readonly offlineFloorBonus: number;
  /** Added to §5's Frenzy duration, in seconds. */
  readonly frenzyBonusSeconds: number;
  /** Generator tiers this build has opened. */
  readonly unlockedTiers: ReadonlySet<number>;
  /** Phase 4 reads these; recorded now so nothing is lost. */
  readonly kgSlotBonus: number;
  readonly kgSurfaces: ReadonlySet<string>;
  readonly kgDayLengthStep: number;
  readonly satchelBonus: number;
  /** Phase 8. Multiplicative. */
  readonly barnCapacityMultiplier: number;
  /** Phase 9. Count of §6.3's three Insulation steps. */
  readonly insulationSteps: number;
}

const EMPTY: InsightEffects = {
  clickBonus: 0,
  productionBonus: 0,
  offlineFloorBonus: 0,
  frenzyBonusSeconds: 0,
  unlockedTiers: new Set(),
  kgSlotBonus: 0,
  kgSurfaces: new Set(),
  kgDayLengthStep: 0,
  satchelBonus: 0,
  barnCapacityMultiplier: 1,
  insulationSteps: 0,
};

/** Roll every purchased node up into one object the rest of the sim reads. */
export function aggregateEffects(purchasedNodeIds: readonly string[]): InsightEffects {
  let clickBonus = 0;
  let productionBonus = 0;
  let offlineFloorBonus = 0;
  let frenzyBonusSeconds = 0;
  let kgSlotBonus = 0;
  let kgDayLengthStep = 0;
  let satchelBonus = 0;
  let barnCapacityMultiplier = 1;
  let insulationSteps = 0;
  const unlockedTiers = new Set<number>();
  const kgSurfaces = new Set<string>();

  for (const id of purchasedNodeIds) {
    const node = nodeById(id);
    if (!node) continue; // A save naming a node this build removed must not throw.

    const effect = node.effect;
    switch (effect.kind) {
      case 'unlock-generator':
        unlockedTiers.add(effect.tier);
        break;
      case 'click-bonus':
        clickBonus += effect.amount;
        break;
      case 'production-bonus':
        productionBonus += effect.amount;
        break;
      case 'offline-floor':
        offlineFloorBonus += effect.amount;
        break;
      case 'frenzy-duration':
        frenzyBonusSeconds += effect.seconds;
        break;
      case 'kg-slots':
        kgSlotBonus += effect.amount;
        break;
      case 'kg-surface':
        kgSurfaces.add(effect.surface);
        break;
      case 'kg-day-length':
        kgDayLengthStep = Math.max(kgDayLengthStep, effect.step);
        break;
      case 'satchel-capacity':
        satchelBonus += effect.amount;
        break;
      case 'barn-capacity':
        barnCapacityMultiplier *= effect.multiplier;
        break;
      case 'insulation':
        insulationSteps += 1;
        break;
      case 'kg-automation':
      case 'cosmetic':
        break;
    }
  }

  return {
    clickBonus,
    productionBonus,
    offlineFloorBonus,
    frenzyBonusSeconds,
    unlockedTiers,
    kgSlotBonus,
    kgSurfaces,
    kgDayLengthStep,
    satchelBonus,
    barnCapacityMultiplier,
    insulationSteps,
  };
}

export function noEffects(): InsightEffects {
  return EMPTY;
}

/**
 * Memoised per purchased-node array.
 *
 * `aggregateEffects` is called from the production formula, which runs on every
 * tick and inside the balance harness's inner loop - tens of millions of times
 * per simulated campaign. Because state is immutable, the array reference only
 * changes when a node is actually bought, so keying on it is exact rather than
 * approximate.
 */
const effectsCache = new WeakMap<readonly string[], InsightEffects>();

export function effectsOf(state: GameState): InsightEffects {
  const key = state.purchasedNodes;
  const cached = effectsCache.get(key);
  if (cached) return cached;
  const computed = aggregateEffects(key);
  effectsCache.set(key, computed);
  return computed;
}

/** Automation levels per step, derived from purchased nodes. Phase 4 uses this. */
export function automationLevels(
  purchasedNodeIds: readonly string[]
): Readonly<Record<'dig' | 'plant' | 'cover', 0 | 1 | 2>> {
  const levels = { dig: 0, plant: 0, cover: 0 } as Record<'dig' | 'plant' | 'cover', 0 | 1 | 2>;
  for (const id of purchasedNodeIds) {
    const node = nodeById(id);
    if (node?.effect.kind === 'kg-automation') {
      const current = levels[node.effect.step];
      if (node.effect.level > current) levels[node.effect.step] = node.effect.level;
    }
  }
  return levels;
}

// ---------------------------------------------------------------------------
// Availability and purchasing
// ---------------------------------------------------------------------------

/** A node is visible once its Season is reached. Prerequisites are separate. */
export function isNodeVisible(state: GameState, node: InsightNode): boolean {
  return state.season >= node.season;
}

export function arePrerequisitesMet(state: GameState, node: InsightNode): boolean {
  return node.requires.every((id) => state.purchasedNodes.includes(id));
}

export function isNodePurchased(state: GameState, nodeId: string): boolean {
  return state.purchasedNodes.includes(nodeId);
}

/** Visible, prerequisites met, not already owned, and affordable. */
export function canPurchaseNode(state: GameState, nodeId: string): boolean {
  const node = nodeById(nodeId);
  if (!node) return false;
  if (isNodePurchased(state, nodeId)) return false;
  if (!isNodeVisible(state, node)) return false;
  if (!arePrerequisitesMet(state, node)) return false;
  return state.insight >= node.cost;
}

/** Buy a node. Returns the state unchanged if the purchase is not legal. */
export function purchaseNode(state: GameState, nodeId: string): GameState {
  if (!canPurchaseNode(state, nodeId)) return state;
  const node = nodeById(nodeId);
  if (!node) return state;

  return {
    ...state,
    insight: state.insight - node.cost,
    purchasedNodes: [...state.purchasedNodes, nodeId],
  };
}

/** Everything the player could buy right now, cheapest first. */
export function availableNodes(state: GameState): InsightNode[] {
  return INSIGHT_TREE.filter(
    (node) =>
      !isNodePurchased(state, node.id) &&
      isNodeVisible(state, node) &&
      arePrerequisitesMet(state, node)
  ).sort((a, b) => a.cost - b.cost);
}
