import { describe, it, expect } from 'vitest';
import { ARCHETYPES, simulateAllArchetypes, simulateCampaign } from '@sim/campaign';
import {
  FULL_BUILD_OUT,
  kitchenGardenIncomeShare,
  kitchenGardenMultiplier,
} from '@sim/kitchenGarden';
import {
  KG_MAX_SLOTS,
  KITCHEN_GARDEN_TARGET_INCOME_SHARE,
  TARGET_CAMPAIGN_HOURS,
} from '@content/balance';

/**
 * Phase 1's exit criteria, as tests. If a future tuning session breaks one of
 * these, CI names the promise that was broken.
 *
 * These are slower than the rest of the suite (each runs a full playthrough) but
 * still well under a second, because the sim is pure and stepping is cheap.
 */

const results = simulateAllArchetypes();

describe('PHASE 1 EXIT — the campaign lands on §8 for every archetype', () => {
  it.each(results.map((r) => [r.archetype, r] as const))(
    '%s reaches the Full Bloom ending',
    (_name, r) => {
      expect(r.completed).toBe(true);
    }
  );

  it.each(results.map((r) => [r.archetype, r] as const))(
    '%s finishes inside the 6-10 hour target',
    (_name, r) => {
      expect(r.totalHours).toBeGreaterThanOrEqual(TARGET_CAMPAIGN_HOURS.min);
      expect(r.totalHours).toBeLessThanOrEqual(TARGET_CAMPAIGN_HOURS.max);
    }
  );

  it('the first prestige is clearly felt for every archetype', () => {
    for (const r of results) {
      expect(r.firstPrestigeOfferedMultiplier, r.archetype).toBeGreaterThan(1.75);
    }
  });

  it('every archetype resets at least twice, and none spirals', () => {
    for (const r of results) {
      expect(r.prestigeCount, r.archetype).toBeGreaterThanOrEqual(2);
      expect(r.prestigeCount, r.archetype).toBeLessThanOrEqual(8);
    }
  });

  it('Seasons arrive in order and none is skipped', () => {
    for (const r of results) {
      expect(r.seasonStartHours.length, r.archetype).toBe(4);
      for (let i = 1; i < r.seasonStartHours.length; i++) {
        expect(r.seasonStartHours[i]!).toBeGreaterThan(r.seasonStartHours[i - 1]!);
      }
    }
  });
});

describe('the archetype spread fits the target band at all', () => {
  // The band 6-10h permits a x1.67 spread. If idle-vs-active ever exceeds that,
  // NO value of K can put all three inside, and the band or Frenzy's uptime
  // range has to change. Worth failing loudly rather than discovering it in a
  // sweep months later.
  it('slowest / fastest stays under the band ratio', () => {
    const hours = results.map((r) => r.totalHours);
    const spread = Math.max(...hours) / Math.min(...hours);
    const bandRatio = TARGET_CAMPAIGN_HOURS.max / TARGET_CAMPAIGN_HOURS.min;
    expect(spread).toBeLessThan(bandRatio);
  });
});

describe('the simulation is deterministic', () => {
  it('produces byte-identical results across runs', () => {
    const a = simulateCampaign(ARCHETYPES[0]!);
    const b = simulateCampaign(ARCHETYPES[0]!);
    expect(a).toEqual(b);
  });

  it('responds monotonically to K — higher K is never slower', () => {
    const slow = simulateCampaign(ARCHETYPES[1]!, { prestigeCoefficient: 20 });
    const fast = simulateCampaign(ARCHETYPES[1]!, { prestigeCoefficient: 60 });
    expect(fast.totalHours).toBeLessThan(slow.totalHours);
  });
});

describe('D2 — the Kitchen Garden stays bounded at every build-out', () => {
  it('lands inside its income-share target at full Season 4 build-out', () => {
    const share = kitchenGardenIncomeShare(FULL_BUILD_OUT);
    expect(share).toBeGreaterThanOrEqual(KITCHEN_GARDEN_TARGET_INCOME_SHARE.min);
    expect(share).toBeLessThanOrEqual(KITCHEN_GARDEN_TARGET_INCOME_SHARE.max);
  });

  it('never claims 100% of Garden Plot income, at any configuration', () => {
    for (let slots = 0; slots <= KG_MAX_SLOTS; slots++) {
      for (const capacityPerSlot of [1, 3, 5]) {
        for (const surfaceYieldMult of [0.85, 1, 1.1, 1.2, 1.5]) {
          const m = kitchenGardenMultiplier({
            slots,
            capacityPerSlot,
            surfaceYieldMult,
            activeFraction: 1,
          });
          expect(m).toBeLessThan(1);
          expect(Number.isFinite(m)).toBe(true);
        }
      }
    }
  });

  it('clamps slots above the cap rather than scaling past it', () => {
    const capped = kitchenGardenMultiplier({ ...FULL_BUILD_OUT, slots: 1000 });
    expect(capped).toBe(kitchenGardenMultiplier(FULL_BUILD_OUT));
  });

  it('contributes nothing with no slots', () => {
    expect(kitchenGardenMultiplier({ ...FULL_BUILD_OUT, slots: 0 })).toBe(0);
  });
});
