import { describe, it, expect } from 'vitest';
import {
  averageOfflineEfficiency,
  effectiveOfflineHours,
  offlineEfficiencyAt,
  offlineManaEarned,
} from '@sim/offline';
import {
  OFFLINE_FULL_RATE_HOURS,
  OFFLINE_MAX_SECONDS,
  OFFLINE_MIN_EFFICIENCY,
  OFFLINE_TAPER_END_HOURS,
} from '@content/balance';

describe('§7 — the efficiency curve', () => {
  it('is full rate up to the cutoff', () => {
    for (const h of [0, 1, 4, OFFLINE_FULL_RATE_HOURS]) {
      expect(offlineEfficiencyAt(h)).toBe(1);
    }
  });

  it('is at the floor from the taper end onward', () => {
    for (const h of [OFFLINE_TAPER_END_HOURS, 48, 1000]) {
      expect(offlineEfficiencyAt(h)).toBe(OFFLINE_MIN_EFFICIENCY);
    }
  });

  it('is exactly halfway down at the taper midpoint', () => {
    const mid = (OFFLINE_FULL_RATE_HOURS + OFFLINE_TAPER_END_HOURS) / 2;
    expect(offlineEfficiencyAt(mid)).toBeCloseTo((1 + OFFLINE_MIN_EFFICIENCY) / 2, 9);
  });

  it('is continuous and non-increasing', () => {
    let previous = Infinity;
    for (let h = 0; h <= 30; h += 0.25) {
      const e = offlineEfficiencyAt(h);
      expect(e).toBeLessThanOrEqual(previous + 1e-12);
      previous = e;
    }
  });
});

describe('§7 — the closed-form integral matches numeric integration', () => {
  // The whole point of computing this analytically is that it must agree with
  // what ticking would have produced - just instantly and exactly.
  const numeric = (hours: number, steps = 200_000): number => {
    const dt = hours / steps;
    let total = 0;
    for (let i = 0; i < steps; i++) total += offlineEfficiencyAt((i + 0.5) * dt) * dt;
    return total;
  };

  for (const hours of [0.5, 8, 12, 16, 24, 40]) {
    it(`agrees at ${hours}h`, () => {
      expect(effectiveOfflineHours(hours)).toBeCloseTo(numeric(hours), 4);
    });
  }
});

describe('§7 — the table in the spec', () => {
  it('8 hours away is 8 productive hours', () => {
    expect(effectiveOfflineHours(8)).toBe(8);
    expect(averageOfflineEfficiency(8)).toBe(1);
  });

  it('24 hours away is 20 productive hours (8 full + 16 averaging 75%)', () => {
    expect(effectiveOfflineHours(24)).toBeCloseTo(20, 9);
  });

  it('beyond the taper it accrues at exactly the floor rate', () => {
    const extra = effectiveOfflineHours(48) - effectiveOfflineHours(24);
    expect(extra).toBeCloseTo(24 * OFFLINE_MIN_EFFICIENCY, 9);
  });

  it('average efficiency never leaves [floor, 1]', () => {
    for (const h of [0.1, 5, 16, 24, 100, 10_000]) {
      const avg = averageOfflineEfficiency(h);
      expect(avg).toBeGreaterThanOrEqual(OFFLINE_MIN_EFFICIENCY);
      expect(avg).toBeLessThanOrEqual(1);
    }
  });
});

describe('offline earnings guard against bad clocks (ADR-0004)', () => {
  it('grants nothing for a save from the future', () => {
    expect(offlineManaEarned(100, -5000)).toBe(0);
  });

  it('grants nothing for zero elapsed time or zero production', () => {
    expect(offlineManaEarned(100, 0)).toBe(0);
    expect(offlineManaEarned(0, 10_000)).toBe(0);
  });

  it('clamps absurd durations rather than paying out unbounded Mana', () => {
    const atCap = offlineManaEarned(1, OFFLINE_MAX_SECONDS);
    const wayPast = offlineManaEarned(1, OFFLINE_MAX_SECONDS * 1000);
    expect(wayPast).toBe(atCap);
    expect(Number.isFinite(wayPast)).toBe(true);
  });

  it('scales linearly with production rate', () => {
    expect(offlineManaEarned(200, 3600)).toBeCloseTo(offlineManaEarned(100, 3600) * 2, 6);
  });

  it('one hour away at full rate earns exactly one hour of production', () => {
    expect(offlineManaEarned(50, 3600)).toBeCloseTo(50 * 3600, 6);
  });
});
