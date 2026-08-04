import { describe, it, expect } from 'vitest';
import {
  buy,
  clearCapstone,
  costOfNext,
  costOfNextN,
  costOfNextUnpurchasedTier,
  isCampaignComplete,
  isCapstoneAvailable,
  isTierUnlocked,
  gardenPlotManaPerSecond,
  paybackSeconds,
  totalManaPerSecond,
} from '@sim/economy';
import { fullBuildOut } from '@sim/kitchenGarden';
import { initialState, ownedOf, type GameState } from '@sim/state';
import { GENERATOR_TIERS, TIER_COUNT, tierAt } from '@content/generators';
import { COST_MULT_BAND, PAYBACK_SECONDS_BAND } from '@content/balance';

const withMana = (mana: number): GameState => ({ ...initialState(), mana });

describe('§2 cost curve', () => {
  it('charges exactly base cost for the first unit', () => {
    for (const t of GENERATOR_TIERS) {
      expect(costOfNext(t.tier, 0)).toBeCloseTo(t.baseCost, 6);
    }
  });

  it('compounds by the tier multiplier per unit owned', () => {
    const t = tierAt(1);
    expect(costOfNext(1, 3)).toBeCloseTo(t.baseCost * Math.pow(t.costMult, 3), 6);
  });

  it('bulk cost matches summing unit costs', () => {
    for (const tier of [1, 7, 20]) {
      let summed = 0;
      for (let i = 0; i < 12; i++) summed += costOfNext(tier, 5 + i);
      expect(costOfNextN(tier, 5, 12)).toBeCloseTo(summed, 3);
    }
  });

  it('bulk cost of zero units is free', () => {
    expect(costOfNextN(3, 10, 0)).toBe(0);
    expect(costOfNextN(3, 10, -5)).toBe(0);
  });
});

describe('§9 guardrail — cost multipliers stay in the 1.07-1.12 band', () => {
  it('holds for every one of the 20 tiers', () => {
    for (const t of GENERATOR_TIERS) {
      expect(t.costMult, `tier ${t.tier} ${t.name}`).toBeGreaterThanOrEqual(COST_MULT_BAND.min);
      expect(t.costMult, `tier ${t.tier} ${t.name}`).toBeLessThanOrEqual(COST_MULT_BAND.max);
    }
  });
});

describe('INVARIANT — tier payback time stays flat across the whole campaign', () => {
  // This is the property that makes the economy read the same whether the number
  // on screen is 15 or 250 quadrillion. It is the single most valuable thing in
  // the spec's tier table and the easiest to destroy by "tidying" a number.
  it('every tier repays a fresh unit inside the 140-190s band', () => {
    for (const t of GENERATOR_TIERS) {
      const payback = paybackSeconds(t.tier, 0);
      expect(payback, `tier ${t.tier} ${t.name}`).toBeGreaterThanOrEqual(PAYBACK_SECONDS_BAND.min);
      expect(payback, `tier ${t.tier} ${t.name}`).toBeLessThanOrEqual(PAYBACK_SECONDS_BAND.max);
    }
  });

  it('spread between the fastest and slowest tier stays under 40s', () => {
    const paybacks = GENERATOR_TIERS.map((t) => paybackSeconds(t.tier, 0));
    expect(Math.max(...paybacks) - Math.min(...paybacks)).toBeLessThan(40);
  });

  it('never drifts more than 15% tier-to-tier', () => {
    for (let i = 1; i < GENERATOR_TIERS.length; i++) {
      const a = paybackSeconds(i, 0);
      const b = paybackSeconds(i + 1, 0);
      expect(Math.abs(b / a - 1), `tier ${i} -> ${i + 1}`).toBeLessThan(0.15);
    }
  });
});

describe('purchasing', () => {
  it('refuses a purchase the player cannot afford', () => {
    const poor = withMana(5);
    expect(buy(poor, 1)).toBe(poor);
  });

  it('refuses a locked tier even with unlimited Mana', () => {
    const rich = withMana(1e30);
    expect(ownedOf(buy(rich, 20), 20)).toBe(0);
  });

  it('deducts exactly the quoted cost', () => {
    const before = withMana(1000);
    const after = buy(before, 1);
    expect(after.mana).toBeCloseTo(1000 - costOfNext(1, 0), 6);
    expect(ownedOf(after, 1)).toBe(1);
  });

  it('does not mutate the input state', () => {
    const before = withMana(1000);
    const ownedRef = before.owned;
    buy(before, 1);
    expect(before.mana).toBe(1000);
    expect(before.owned).toBe(ownedRef);
    expect(ownedRef[0]).toBe(0);
  });
});

describe('unlock gates', () => {
  it('tier 1 is available from the start', () => {
    expect(isTierUnlocked(initialState(), 1)).toBe(true);
  });

  it('tier 2 opens on 10x tier 1 OR 500 lifetime Mana (either alone suffices)', () => {
    const base = initialState();
    expect(isTierUnlocked(base, 2)).toBe(false);

    const byCount: GameState = { ...base, owned: [10, ...base.owned.slice(1)] };
    expect(isTierUnlocked(byCount, 2)).toBe(true);

    const byMana: GameState = { ...base, lifetimeMana: 500 };
    expect(isTierUnlocked(byMana, 2)).toBe(true);
  });

  it('capstone-gated tiers stay locked until that Season is cleared', () => {
    const base = initialState();
    expect(isTierUnlocked(base, 5)).toBe(false);
    expect(isTierUnlocked({ ...base, capstonesCleared: [1] }, 5)).toBe(true);
  });
});

describe('D6 — Seasons advance on capstone clear only', () => {
  it('does not advance on elapsed time alone', () => {
    const aged: GameState = { ...initialState(), elapsedSeconds: 10 * 3600 };
    expect(clearCapstone(aged).season).toBe(1);
  });

  it('advances exactly one Season per capstone, and never past 4', () => {
    let state = initialState();
    const owned = state.owned.slice();
    owned[3] = 10; // 10x tier 4 - the Phase 1 capstone proxy
    state = { ...state, owned };

    expect(isCapstoneAvailable(state)).toBe(true);
    state = clearCapstone(state);
    expect(state.season).toBe(2);
    expect(state.capstonesCleared).toEqual([1]);

    // Same capstone cannot be cleared twice.
    expect(isCapstoneAvailable(state)).toBe(false);
    expect(clearCapstone(state)).toBe(state);
  });
});

describe('production', () => {
  it('is zero with nothing owned', () => {
    expect(gardenPlotManaPerSecond(initialState())).toBe(0);
  });

  it('scales linearly with owned units', () => {
    const base = initialState();
    const one: GameState = { ...base, owned: [1, ...base.owned.slice(1)] };
    const ten: GameState = { ...base, owned: [10, ...base.owned.slice(1)] };
    expect(gardenPlotManaPerSecond(ten)).toBeCloseTo(gardenPlotManaPerSecond(one) * 10, 9);
  });

  it('D2 — total exceeds Garden Plots alone but stays finite', () => {
    const base = initialState();
    const state: GameState = {
      ...base,
      owned: [100, ...base.owned.slice(1)],
      kitchenGarden: fullBuildOut(1, 0),
    };
    const plots = gardenPlotManaPerSecond(state);
    const total = totalManaPerSecond(state);
    expect(total).toBeGreaterThan(plots);
    expect(Number.isFinite(total)).toBe(true);
    // The Kitchen Garden is a bonus layer, never the majority.
    expect(total).toBeLessThan(plots * 2);
  });
});

describe('campaign completion and the next-tier cost used by D1', () => {
  it('completes only once the final tier is owned', () => {
    const base = initialState();
    expect(isCampaignComplete(base)).toBe(false);
    const owned = base.owned.slice();
    owned[TIER_COUNT - 1] = 1;
    expect(isCampaignComplete({ ...base, owned })).toBe(true);
  });

  it('reports the cheapest not-yet-owned tier', () => {
    expect(costOfNextUnpurchasedTier(initialState())).toBeCloseTo(tierAt(1).baseCost, 6);
    const base = initialState();
    const owned = base.owned.slice();
    owned[0] = 5;
    expect(costOfNextUnpurchasedTier({ ...base, owned })).toBeCloseTo(tierAt(2).baseCost, 6);
  });
});
