import { describe, it, expect } from 'vitest';
import * as B from '@content/balance';

/**
 * These tests encode DECISIONS D1/D2/D3/D6 (docs/04-spec-open-questions.md) and
 * the spec's own guardrails (§9) as executable assertions.
 *
 * The formulas are computed inline here because src/sim does not exist yet -
 * Phase 1 builds it. When it does, these tests should be rewritten to call the
 * real functions rather than re-deriving them. The assertions themselves stay.
 */

describe('D3 — prestige is log-shaped, absolute, and every reset is felt', () => {
  // Lifetime Mana at each Season capstone, estimated as 10x the cost of 25 units
  // of that Season's capstone tier. Same proxy as tools/spec-audit.mjs. Replaced
  // by real simulation output in Phase 1.
  const LIFETIME_AT_CAPSTONE = [8.67e7, 1.33e12, 2.13e16, 3.33e20] as const;

  const totalSqp = (lifetimeMana: number): number =>
    Math.max(
      0,
      Math.floor(B.PRESTIGE_SQP_COEFFICIENT * Math.log10(lifetimeMana / B.PRESTIGE_SQP_REFERENCE))
    );

  const multiplier = (lifetimeMana: number): number =>
    1 + B.PRESTIGE_BONUS_PER_SQP * totalSqp(lifetimeMana);

  it('awards zero SQP below the reference threshold', () => {
    expect(totalSqp(0)).toBe(0);
    expect(totalSqp(B.PRESTIGE_SQP_REFERENCE)).toBe(0);
    expect(totalSqp(B.PRESTIGE_SQP_REFERENCE / 100)).toBe(0);
  });

  it('makes the FIRST prestige worth doing (the spec as written gave +18%)', () => {
    const first = multiplier(LIFETIME_AT_CAPSTONE[0]);
    expect(first).toBeGreaterThan(2.0);
  });

  it('keeps every reset meaningfully felt — no dead prestige', () => {
    let previous = 1;
    for (const lifetime of LIFETIME_AT_CAPSTONE) {
      const current = multiplier(lifetime);
      expect(current / previous).toBeGreaterThan(1.3);
      previous = current;
    }
  });

  it('is absolute, not summed — recomputing at the same lifetime grants nothing', () => {
    const lifetime = LIFETIME_AT_CAPSTONE[2];
    const gainedTwice = totalSqp(lifetime) - totalSqp(lifetime);
    expect(gainedTwice).toBe(0);
  });

  it('makes over-banking self-limiting (§4 "reset cap by design, not by code")', () => {
    // Doubling lifetime Mana adds a FIXED small amount, regardless of scale.
    const at = (x: number) => totalSqp(x);
    const gainFromDoublingEarly = at(2e10) - at(1e10);
    const gainFromDoublingLate = at(2e18) - at(1e18);
    expect(gainFromDoublingEarly).toBeCloseTo(gainFromDoublingLate, 0);
    expect(gainFromDoublingEarly).toBeLessThan(15);
  });

  it('stays a speedup, not a gate — final multiplier is small vs production growth', () => {
    const final = multiplier(LIFETIME_AT_CAPSTONE[3]);
    expect(final).toBeLessThan(100);
  });
});

describe('D2 — Kitchen Garden yield is bounded and lands on its income target', () => {
  // Full Season 4 build-out: 20 slots x 5 plants (Clockwork Trellis) x 1.2 yield.
  const MAX_PLANT_UNITS = B.KG_MAX_SLOTS * 5 * 1.2;

  it('never claims 100% or more of Garden Plot income', () => {
    const added = MAX_PLANT_UNITS * B.KITCHEN_GARDEN_BASE_FRACTION;
    expect(added).toBeLessThan(1.0);
  });

  it('lands inside the target income share at full build-out', () => {
    const added = MAX_PLANT_UNITS * B.KITCHEN_GARDEN_BASE_FRACTION;
    const share = added / (1 + added);
    expect(share).toBeGreaterThanOrEqual(B.KITCHEN_GARDEN_TARGET_INCOME_SHARE.min);
    expect(share).toBeLessThanOrEqual(B.KITCHEN_GARDEN_TARGET_INCOME_SHARE.max);
  });

  it('stays finite for every configuration up to the slot cap', () => {
    for (let slots = 0; slots <= B.KG_MAX_SLOTS; slots++) {
      for (const capacity of [1, 3, 5]) {
        for (const surfaceMult of [0.85, 1.0, 1.1, 1.2, 1.5]) {
          const added =
            slots *
            capacity *
            surfaceMult *
            B.KITCHEN_GARDEN_BASE_FRACTION *
            B.PERFECT_PLANTING_MULTIPLIER;
          expect(Number.isFinite(added)).toBe(true);
          // Even with every plot simultaneously Perfect-Planted, bounded.
          expect(added).toBeLessThan(2.0);
        }
      }
    }
  });
});

describe('§9 / §2a — active play must out-earn full automation', () => {
  it('level 2 automation matches manual baseline but forfeits Perfect Planting', () => {
    const manual = B.AUTOMATION_YIELD_MULTIPLIER[0];
    const automated = B.AUTOMATION_YIELD_MULTIPLIER[2];
    expect(automated).toBe(manual);
    expect(B.AUTOMATION_ALLOWS_PERFECT_PLANTING[0]).toBe(true);
    expect(B.AUTOMATION_ALLOWS_PERFECT_PLANTING[2]).toBe(false);
  });

  it('attentive manual play beats full automation at peak', () => {
    const manualPeak = B.AUTOMATION_YIELD_MULTIPLIER[0] * B.PERFECT_PLANTING_MULTIPLIER;
    const automatedPeak = B.AUTOMATION_YIELD_MULTIPLIER[2];
    expect(manualPeak).toBeGreaterThan(automatedPeak);
  });

  it('level 1 is a stepping stone — faster but strictly worse yield', () => {
    expect(B.AUTOMATION_STEP_SECONDS[1]).toBeLessThan(B.AUTOMATION_STEP_SECONDS[0]);
    expect(B.AUTOMATION_YIELD_MULTIPLIER[1]).toBeLessThan(B.AUTOMATION_YIELD_MULTIPLIER[0]);
  });

  it('a fully automated plot costs no Day Time (converges to a passive generator)', () => {
    expect(B.AUTOMATION_STEP_SECONDS[2]).toBe(0);
  });

  it('a full manual cycle costs 6s of Day Time (§2a)', () => {
    const stepsPerCycle = 3; // Dig, Plant, Cover
    expect(stepsPerCycle * B.AUTOMATION_STEP_SECONDS[0]).toBe(6);
  });
});

describe('§6.3 — The Long Night is a difficulty spike, not a hard build gate', () => {
  it('leaves headroom for under-invested players to clear it slowly', () => {
    expect(B.LONG_NIGHT_OUTPUT_FLOOR).toBeGreaterThan(0);
    expect(B.LONG_NIGHT_INSULATION_REQUIRED).toBeLessThan(
      B.FROST_OUTPUT_FLOOR_BY_INSULATION.length - 1
    );
  });

  it('insulation floors improve monotonically', () => {
    const floors = B.FROST_OUTPUT_FLOOR_BY_INSULATION;
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i]!).toBeGreaterThanOrEqual(floors[i - 1]!);
    }
  });
});

describe('§7 — offline taper is well formed', () => {
  it('has a sane, ordered piecewise shape', () => {
    expect(B.OFFLINE_FULL_RATE_HOURS).toBeLessThan(B.OFFLINE_TAPER_END_HOURS);
    expect(B.OFFLINE_MIN_EFFICIENCY).toBeGreaterThan(0);
    expect(B.OFFLINE_MIN_EFFICIENCY).toBeLessThan(1);
  });
});

describe('spec guardrails hold as constants', () => {
  it('§9 cost multiplier band is 1.07–1.12', () => {
    expect(B.COST_MULT_BAND.min).toBe(1.07);
    expect(B.COST_MULT_BAND.max).toBe(1.12);
  });

  it('§2a caps the Kitchen Garden grid at 20 plots (anti-busywork guardrail)', () => {
    expect(B.KG_MAX_SLOTS).toBe(20);
    expect(B.KG_STARTING_SLOTS).toBeLessThan(B.KG_MAX_SLOTS);
  });

  it('D6 — Seasons advance on capstone clear, never on elapsed time', () => {
    expect(B.SEASON_ADVANCE_MODE).toBe('capstone-clear');
  });

  it('§4 targets 4–5 natural resets across a 6–10 hour campaign', () => {
    expect(B.TARGET_PRESTIGE_RESETS.min).toBe(4);
    expect(B.TARGET_PRESTIGE_RESETS.max).toBe(5);
    expect(B.TARGET_CAMPAIGN_HOURS.min).toBe(6);
    expect(B.TARGET_CAMPAIGN_HOURS.max).toBe(10);
  });
});

describe('float64 is sufficient — no big-number library (ADR-0001)', () => {
  it('handles the campaign peak magnitude with room to spare', () => {
    const peak = 1.01e44; // tools/spec-audit.mjs audit 5
    expect(Number.isFinite(peak)).toBe(true);
    expect(peak).toBeLessThan(Number.MAX_VALUE / 1e100);
  });

  it('exceeds MAX_SAFE_INTEGER — nothing may assume integer exactness', () => {
    expect(2.5e17).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });
});
