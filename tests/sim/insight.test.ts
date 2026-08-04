import { describe, it, expect } from 'vitest';
import {
  aggregateEffects,
  automationLevels,
  availableNodes,
  canPurchaseNode,
  effectsOf,
  purchaseNode,
} from '@sim/insight';
import { claimMilestones, isConditionMet, milestoneProgress, newlyEarned } from '@sim/milestones';
import { isTierUnlocked, clickYield, gardenPlotManaPerSecond, recordUnlocks } from '@sim/economy';
import { prestige } from '@sim/prestige';
import { initialState, type GameState } from '@sim/state';
import { MILESTONES } from '@content/milestones';
import { INSIGHT_TREE } from '@content/insightTree';
import { TIER_COUNT } from '@content/generators';

const withInsight = (insight: number, purchased: string[] = [], season = 1): GameState => ({
  ...initialState(),
  insight,
  season,
  purchasedNodes: purchased,
});

describe('purchasing', () => {
  it('refuses a node the player cannot afford', () => {
    const poor = withInsight(0);
    expect(canPurchaseNode(poor, 's1-click-1')).toBe(false);
    expect(purchaseNode(poor, 's1-click-1')).toBe(poor);
  });

  it('refuses a node whose prerequisites are unmet', () => {
    const rich = withInsight(999);
    expect(canPurchaseNode(rich, 's1-yield-4')).toBe(false);
  });

  it('refuses a node from a future Season', () => {
    const rich = withInsight(999, ['s1-click-1', 's1-gen-3', 's1-gen-4'], 1);
    expect(canPurchaseNode(rich, 's2-gen-8')).toBe(false);
  });

  it('refuses an unknown node id rather than throwing', () => {
    const rich = withInsight(999);
    expect(canPurchaseNode(rich, 'no-such-node')).toBe(false);
    expect(purchaseNode(rich, 'no-such-node')).toBe(rich);
  });

  it('refuses to buy the same node twice', () => {
    const owned = withInsight(999, ['s1-click-1']);
    expect(canPurchaseNode(owned, 's1-click-1')).toBe(false);
  });

  it('deducts the cost and records the purchase', () => {
    const after = purchaseNode(withInsight(10), 's1-click-1');
    expect(after.insight).toBe(9);
    expect(after.purchasedNodes).toContain('s1-click-1');
  });

  it('does not mutate the input state', () => {
    const before = withInsight(10);
    purchaseNode(before, 's1-click-1');
    expect(before.insight).toBe(10);
    expect(before.purchasedNodes).toEqual([]);
  });

  it('lists available nodes cheapest first', () => {
    const options = availableNodes(withInsight(0));
    expect(options.length).toBeGreaterThan(0);
    for (let i = 1; i < options.length; i++) {
      expect(options[i]!.cost).toBeGreaterThanOrEqual(options[i - 1]!.cost);
    }
  });
});

describe('effects', () => {
  it('sums click and production bonuses', () => {
    const effects = aggregateEffects(['s1-click-1', 's1-compost', 's1-deeper-beds']);
    expect(effects.clickBonus).toBeCloseTo(1, 6);
    expect(effects.productionBonus).toBeCloseTo(0.14, 6);
  });

  it('collects per-tier production bonuses, summing levels of the same ladder', () => {
    const effects = aggregateEffects(['s1-yield-3', 's1-yield-3b', 's1-yield-4']);
    expect(effects.tierProduction.get(3)).toBeCloseTo(0.55, 6);
    expect(effects.tierProduction.get(4)).toBeCloseTo(0.25, 6);
    expect(effects.tierProduction.get(5)).toBeUndefined();
  });

  it('ignores node ids this build no longer knows', () => {
    // A save from a build where a node was named differently must not throw.
    expect(() => aggregateEffects(['ghost-node'])).not.toThrow();
    expect(aggregateEffects(['ghost-node']).clickBonus).toBe(0);
  });

  it('multiplies barn capacity rather than adding it', () => {
    expect(aggregateEffects(['s3-barn-1', 's3-barn-2']).barnCapacityMultiplier).toBeCloseTo(3, 6);
  });

  it('counts insulation steps', () => {
    expect(aggregateEffects(['s4-insulation-1', 's4-insulation-2']).insulationSteps).toBe(2);
  });

  it('takes the HIGHEST day-length step, not the sum', () => {
    expect(aggregateEffects(['s1-kg-day-1', 's3-kg-day-2']).kgDayLengthStep).toBe(2);
  });

  it('derives automation levels per step, keeping the highest', () => {
    const levels = automationLevels(['s2-auto-dig-1', 's3-auto-dig-2', 's2-auto-plant-1']);
    expect(levels.dig).toBe(2);
    expect(levels.plant).toBe(1);
    expect(levels.cover).toBe(0);
  });

  it('memoises on the purchased-node array reference', () => {
    const state = withInsight(0, ['s1-click-1']);
    expect(effectsOf(state)).toBe(effectsOf(state));
  });
});

/** Ten of every early tier — enough to satisfy the own-count unlock gates. */
function withTenOfEachEarlyTier(): number[] {
  const owned = new Array<number>(TIER_COUNT).fill(0);
  for (let i = 0; i < 5; i++) owned[i] = 10;
  return owned;
}

describe('the tree drives real systems', () => {
  it('NO node opens a generator tier — Insight buys strength, never access', () => {
    // The soft-lock fix. Buying every node in the tree must not unlock a single
    // tier that owned counts would not have unlocked anyway.
    const bare = withInsight(0);
    const everything = withInsight(
      0,
      INSIGHT_TREE.map((n) => n.id)
    );
    for (let tier = 1; tier <= TIER_COUNT; tier++) {
      expect(isTierUnlocked(everything, tier), `tier ${tier}`).toBe(isTierUnlocked(bare, tier));
    }
  });

  it('a per-tier node raises only its own tier', () => {
    // Only the early tiers are owned. Filling all twenty puts total output past
    // 1e16, where a 0.5/s difference is smaller than one float64 ulp and the
    // assertion measures rounding rather than the effect (ADR-0001).
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[0] = 10; // ten Watering Cans, 0.1/s each
    owned[1] = 10; // ten Sprout Beds, 1/s each

    const base = { ...withInsight(0), owned };
    const boostTier1 = { ...withInsight(0, ['s1-yield-1']), owned };
    const boostTier2 = { ...withInsight(0, ['s1-yield-2']), owned };

    expect(gardenPlotManaPerSecond(boostTier1) - gardenPlotManaPerSecond(base)).toBeCloseTo(
      10 * 0.1 * 0.5,
      6
    );
    // The same node does nothing for a different tier - that is the whole point
    // of per-tier bonuses over "+8% to everything".
    expect(gardenPlotManaPerSecond(boostTier2) - gardenPlotManaPerSecond(base)).toBeCloseTo(
      10 * 1 * 0.4,
      6
    );
  });

  it('click nodes raise click yield', () => {
    const base = clickYield(withInsight(0));
    const boosted = clickYield(withInsight(0, ['s1-click-1']));
    expect(boosted).toBeCloseTo(base * 2, 6);
  });

  it('production nodes raise Garden Plot output', () => {
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[0] = 10;
    const plain = gardenPlotManaPerSecond({ ...withInsight(0), owned });
    const boosted = gardenPlotManaPerSecond({ ...withInsight(0, ['s1-compost']), owned });
    expect(boosted).toBeCloseTo(plain * 1.06, 6);
  });
});

describe('milestones award Insight (§3)', () => {
  const owning = (tier: number, count: number): GameState => {
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[tier - 1] = count;
    return { ...initialState(), owned };
  };

  it('pays out when the condition is first met', () => {
    const { state, awarded } = claimMilestones(owning(1, 10));
    expect(awarded.map((m) => m.id)).toContain('m-water-10');
    expect(state.insight).toBeGreaterThan(0);
    expect(state.lifetimeInsight).toBe(state.insight);
  });

  it('never pays the same milestone twice', () => {
    const first = claimMilestones(owning(1, 10)).state;
    const second = claimMilestones(first);
    expect(second.awarded).toEqual([]);
    expect(second.state.insight).toBe(first.insight);
  });

  it('returns the SAME reference when nothing is earned', () => {
    // Called on every tick; a fresh object ten times a second would re-render
    // the whole UI for nothing.
    const state = initialState();
    expect(claimMilestones(state).state).toBe(state);
  });

  it('awards several at once when several become true together', () => {
    const rich: GameState = { ...initialState(), lifetimeMana: 1e7 };
    expect(newlyEarned(rich).length).toBeGreaterThan(2);
  });

  it('evaluates every condition kind', () => {
    expect(isConditionMet(owning(1, 10), { kind: 'own-count', tier: 1, count: 10 })).toBe(true);
    expect(
      isConditionMet(
        { ...initialState(), lifetimeMana: 5e3 },
        { kind: 'lifetime-mana', amount: 1e3 }
      )
    ).toBe(true);
    expect(
      isConditionMet(
        { ...initialState(), capstonesCleared: [1] },
        {
          kind: 'capstone-cleared',
          season: 1,
        }
      )
    ).toBe(true);
    expect(
      isConditionMet({ ...initialState(), prestigeCount: 2 }, { kind: 'prestige-count', count: 1 })
    ).toBe(true);
    expect(
      isConditionMet(
        { ...initialState(), elapsedSeconds: 9999 },
        {
          kind: 'played-seconds',
          seconds: 100,
        }
      )
    ).toBe(true);
  });

  it('reports progress between 0 and 1', () => {
    for (const milestone of MILESTONES) {
      const progress = milestoneProgress(owning(1, 5), milestone);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('prestige and the tree (§4)', () => {
  const advanced: GameState = {
    ...initialState(),
    lifetimeMana: 1e12,
    capstonesCleared: [1],
    season: 2,
    insight: 7,
    lifetimeInsight: 40,
    purchasedNodes: ['s1-click-1', 's1-gen-3'],
    claimedMilestones: ['m-water-10', 'm-mana-1k'],
    owned: new Array<number>(TIER_COUNT).fill(5),
  };

  it('KEEPS purchased nodes — §4 keeps "unlocked plant types"', () => {
    expect(prestige(advanced).purchasedNodes).toEqual(advanced.purchasedNodes);
  });

  it('KEEPS claimed milestones — otherwise every reset re-pays the same Insight', () => {
    // This is the exploit guard. If claims reset, a player farms Insight by
    // re-buying generators, and §3's whole "not just buy everything" design
    // collapses.
    expect(prestige(advanced).claimedMilestones).toEqual(advanced.claimedMilestones);
  });

  it('generator tiers stay unlocked across a reset', () => {
    // Prestige zeroes `owned`, and unlock gates read owned counts - so without
    // the `tiersUnlocked` high-water mark a reset would confiscate access to
    // every tier the player had opened.
    const before = recordUnlocks({ ...advanced, owned: withTenOfEachEarlyTier() });
    expect(isTierUnlocked(before, 3)).toBe(true);
    const after = prestige(before);
    expect(after.owned.every((n) => n === 0)).toBe(true);
    expect(isTierUnlocked(after, 3)).toBe(true);
  });

  it('keeps unspent Insight (open question 10)', () => {
    expect(prestige(advanced).insight).toBe(7);
  });
});
