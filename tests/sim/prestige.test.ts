import { describe, it, expect } from 'vitest';
import {
  canPrestige,
  prestige,
  prestigeGainFactor,
  prestigeMultiplier,
  sqpAvailable,
  totalSqp,
} from '@sim/prestige';
import { fullBuildOut } from '@sim/kitchenGarden';
import { initialState, type GameState } from '@sim/state';
import { PRESTIGE_SQP_COEFFICIENT, PRESTIGE_SQP_REFERENCE } from '@content/balance';
import { TIER_COUNT } from '@content/generators';

const cleared = (lifetimeMana: number, appliedSqp = 0): GameState => ({
  ...initialState(),
  lifetimeMana,
  appliedSqp,
  capstonesCleared: [1],
  season: 2,
});

describe('D3 — SQP is absolute, never summed', () => {
  it('returns the same value for the same lifetime Mana, always', () => {
    expect(totalSqp(1e12)).toBe(totalSqp(1e12));
  });

  it('grants nothing for a second reset at unchanged lifetime Mana', () => {
    const banked = totalSqp(1e12);
    const state = cleared(1e12, banked);
    expect(sqpAvailable(state)).toBe(0);
    // ...and the reset itself is refused rather than counted.
    expect(prestige(state)).toBe(state);
  });

  it('clamps to zero below the reference, never negative', () => {
    expect(totalSqp(0)).toBe(0);
    expect(totalSqp(-1)).toBe(0);
    expect(totalSqp(PRESTIGE_SQP_REFERENCE)).toBe(0);
    expect(totalSqp(PRESTIGE_SQP_REFERENCE / 1000)).toBe(0);
  });

  it('is monotonic in lifetime Mana', () => {
    let previous = -1;
    for (const l of [1e5, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21]) {
      const sqp = totalSqp(l);
      expect(sqp).toBeGreaterThanOrEqual(previous);
      previous = sqp;
    }
  });
});

describe('D3 — over-banking is self-limiting (§4 "reset cap by design, not by code")', () => {
  it('a fixed multiple of lifetime Mana always adds the same SQP, at any scale', () => {
    const gainAt = (x: number) => totalSqp(x * 10) - totalSqp(x);
    const early = gainAt(1e8);
    const late = gainAt(1e18);
    expect(early).toBe(late);
    // One order of magnitude is worth exactly K SQP, by construction.
    expect(early).toBe(PRESTIGE_SQP_COEFFICIENT);
  });

  it('grinding twice as long does NOT double the reward', () => {
    const base = totalSqp(1e14);
    const doubled = totalSqp(2e14);
    expect(doubled).toBeLessThan(base * 1.1);
  });
});

describe('the first prestige is worth taking', () => {
  // The spec's original formula gave x1.18 here. The simulation then found the
  // reference point mis-scaled, producing x1.00 - literally nothing - because a
  // player at the Season 1 capstone holds less lifetime Mana than the reference.
  // MEASURED, not guessed: `npm run simulate` reports the first prestige is
  // offered at ~9e5 lifetime Mana across all three archetypes. An earlier
  // hand-estimate of 5e5 was wrong and this test caught it.
  const LIFETIME_AT_S1_CAPSTONE = 9e5;

  it('offers a clearly-felt multiplier the moment it unlocks', () => {
    const offered = prestigeMultiplier(totalSqp(LIFETIME_AT_S1_CAPSTONE));
    // 1.65, lowered from 1.75 in Phase 7 — see docs/11 §3.
    expect(offered).toBeGreaterThan(1.65);
  });

  it('the reference sits BELOW the lifetime Mana held at first unlock', () => {
    // This is the regression. If someone raises the reference back toward the
    // spec's 1e6, the first prestige silently becomes worthless again.
    expect(PRESTIGE_SQP_REFERENCE).toBeLessThan(LIFETIME_AT_S1_CAPSTONE / 10);
  });
});

describe('§4 — what a reset keeps and what it takes', () => {
  const before: GameState = {
    ...cleared(1e12),
    mana: 999,
    owned: new Array<number>(TIER_COUNT).fill(7),
    elapsedSeconds: 4321,
    kitchenGarden: fullBuildOut(2, 0),
  };

  it('resets Mana and every Garden Plot', () => {
    const after = prestige(before);
    expect(after.mana).toBe(0);
    expect(after.owned.every((n) => n === 0)).toBe(true);
  });

  it('KEEPS the Kitchen Garden in full — §4 is emphatic about this', () => {
    // Resetting hand-dug progress would punish exactly the players engaging most
    // with the new mechanic.
    expect(prestige(before).kitchenGarden).toEqual(before.kitchenGarden);
  });

  it('KEEPS all-time lifetime Mana — D3 depends on it', () => {
    expect(prestige(before).lifetimeMana).toBe(before.lifetimeMana);
  });

  it('KEEPS Season progress and cleared capstones', () => {
    const after = prestige(before);
    expect(after.season).toBe(before.season);
    expect(after.capstonesCleared).toEqual(before.capstonesCleared);
  });

  it('banks the SQP and counts the reset', () => {
    const after = prestige(before);
    expect(after.appliedSqp).toBe(totalSqp(before.lifetimeMana));
    expect(after.prestigeCount).toBe(1);
  });

  it('does not mutate the input state', () => {
    const snapshot = { ...before, owned: before.owned.slice() };
    prestige(before);
    expect(before.mana).toBe(snapshot.mana);
    expect(before.owned).toEqual(snapshot.owned);
  });
});

describe('§4 — prestige is gated and optional', () => {
  it('is unavailable before the Season 1 capstone', () => {
    const state = { ...initialState(), lifetimeMana: 1e15 };
    expect(canPrestige(state)).toBe(false);
    expect(prestige(state)).toBe(state);
  });

  it('becomes available once Season 1 is cleared', () => {
    expect(canPrestige(cleared(1e9))).toBe(true);
  });
});

describe('the production multiplier', () => {
  it('is exactly 1 with no banked SQP', () => {
    expect(prestigeMultiplier(0)).toBe(1);
  });

  it('grows 2% per SQP (§4)', () => {
    expect(prestigeMultiplier(50)).toBeCloseTo(2, 9);
  });

  it('gain factor is 1 when there is nothing to gain', () => {
    const state = cleared(1e12, totalSqp(1e12));
    expect(prestigeGainFactor(state)).toBeCloseTo(1, 9);
  });
});
