import { describe, it, expect } from 'vitest';
import { CURRENT_SAVE_VERSION, decodeSave, deserialize, encodeSave, serialize } from '@game/save';
import { initialState } from '@sim/state';
import { initialCapstone } from '@sim/capstone';
import { canPrestige } from '@sim/prestige';
import { TIER_COUNT } from '@content/generators';
import v1Fixture from '../fixtures/saves/v1.json';
import v2Fixture from '../fixtures/saves/v2.json';
import v3Fixture from '../fixtures/saves/v3.json';
import v4Fixture from '../fixtures/saves/v4.json';

/**
 * ADR-0004. Every version ships with a FROZEN fixture of that format and a test
 * that migrates it to current. Fixtures are never edited after the fact - that
 * is the entire point. When v2 arrives, add `v2.json`, leave `v1.json` alone.
 */

describe('round-tripping the current version', () => {
  it('preserves every field', () => {
    const state = {
      ...initialState(),
      mana: 12345.678,
      lifetimeMana: 9.87e20,
      owned: new Array<number>(TIER_COUNT).fill(3),
      season: 3,
      capstonesCleared: [1, 2],
      appliedSqp: 240,
      prestigeCount: 2,
      elapsedSeconds: 4321,
    };

    const result = deserialize(JSON.stringify(serialize(state, 1_700_000_000_000)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.save.savedAt).toBe(1_700_000_000_000);
    expect(result.save.state).toEqual(state);
  });

  it('survives values past MAX_SAFE_INTEGER without pretending to be exact', () => {
    // ADR-0001: nothing may assume integer exactness above 9e15. Compare with a
    // relative tolerance, never ===.
    const state = { ...initialState(), lifetimeMana: 1.234e28 };
    const result = deserialize(JSON.stringify(serialize(state, 0)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.lifetimeMana / 1.234e28).toBeCloseTo(1, 12);
  });
});

describe('the frozen v4 fixture still loads after the v5 migration', () => {
  it('remaps the renamed generator nodes instead of dropping them', () => {
    // v5 turned the eight `unlock-generator` nodes into per-tier production
    // nodes and renamed them. Dropping the old ids as "unknown" would silently
    // confiscate every Insight point a player had spent on them.
    const result = deserialize(JSON.stringify(v4Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(4);
    expect(result.save.state.purchasedNodes).toEqual([
      's1-click-1',
      's1-yield-3',
      's1-yield-4',
      's2-yield-8',
    ]);
  });

  it('keeps the rest of the save untouched', () => {
    const result = deserialize(JSON.stringify(v4Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.mana).toBe(41200);
    expect(result.save.state.capstone.attempts).toBe(2);
    expect(result.save.state.capstone.lastFailed).toBe(true);
    expect(result.save.state.capstone.armed).toBe(false);
  });
});

describe('the frozen v3 fixture still loads after the v4 migration', () => {
  it('keeps every plot mid-cycle — a growing crop is not reset by the migration', () => {
    const result = deserialize(JSON.stringify(v3Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(3);

    const plots = result.save.state.kitchenGarden.plots;
    expect(plots).toHaveLength(5);
    expect(plots.map((p) => p.stage)).toEqual(['growing', 'grown', 'dug', 'bare', 'planted']);
    expect(plots[0]?.grownAt).toBe(5446);
    expect(plots[0]?.surface).toBe('raised-garden-box');
    expect(plots[1]?.plantedSeason).toBe(1);
    expect(result.save.state.kitchenGarden.seeds).toBe(3);
    expect(result.save.state.kitchenGarden.dayTimeRemaining).toBe(18);
  });

  it('adds a capstone with no attempt in progress', () => {
    // v3 predates the capstone entirely. A returning player must not resume into
    // an armed attempt they never started.
    const result = deserialize(JSON.stringify(v3Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.capstone).toEqual(initialCapstone());
  });

  it('does not make the player re-fight a Season they already cleared', () => {
    const result = deserialize(JSON.stringify(v3Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.capstonesCleared).toEqual([1]);
    expect(result.save.state.season).toBe(2);
    // Season 1 cleared means prestige stays unlocked across the migration.
    expect(canPrestige(result.save.state)).toBe(true);
  });
});

describe('the frozen v2 fixture still loads after the v3 migration', () => {
  it('keeps the Insight tree state and reports the migration', () => {
    const result = deserialize(JSON.stringify(v2Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(2);
    expect(result.save.state.insight).toBe(3);
    expect(result.save.state.lifetimeInsight).toBe(8);
    // s1-gen-3 was renamed s1-yield-3 in v5; the migration remaps it rather
    // than dropping it, so the player keeps the Insight they spent.
    expect(result.save.state.purchasedNodes).toEqual(['s1-click-1', 's1-yield-3']);
    expect(result.save.state.claimedMilestones).toHaveLength(4);
  });

  it('converts the old abstract build-out into real plots, keeping the count', () => {
    const result = deserialize(JSON.stringify(v2Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // v2 stored {slots: 4}; v3 stores four bare plots.
    expect(result.save.state.kitchenGarden.plots).toHaveLength(4);
    expect(result.save.state.kitchenGarden.plots.every((p) => p.stage === 'bare')).toBe(true);
  });
});

describe('the frozen v1 fixture still loads after the v2 migration', () => {
  it('migrates forward without losing the pre-Insight progress', () => {
    const result = deserialize(JSON.stringify(v1Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.save.state.mana).toBe(1500);
    expect(result.save.state.lifetimeMana).toBe(42000);
    expect(result.save.state.owned[0]).toBe(12);
    expect(result.save.state.owned[1]).toBe(4);
    expect(result.save.state.season).toBe(1);
    expect(result.save.state.frenzy.meter).toBeCloseTo(0.35, 6);
  });

  it('reports that it came from version 1', () => {
    const result = deserialize(JSON.stringify(v1Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(1);
  });

  it('starts the Insight tree empty — v1 predates it entirely', () => {
    const result = deserialize(JSON.stringify(v1Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.insight).toBe(0);
    expect(result.save.state.purchasedNodes).toEqual([]);
    expect(result.save.state.claimedMilestones).toEqual([]);
  });
});

describe('unknown ids in a save are dropped, not trusted', () => {
  it('discards node and milestone ids this build does not know', () => {
    const result = deserialize(
      JSON.stringify({
        version: 2,
        savedAt: 0,
        state: {
          purchasedNodes: ['s1-click-1', 'renamed-in-a-later-build', 's1-click-1'],
          claimedMilestones: ['m-water-10', 'no-such-milestone'],
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Also de-duplicated: a doubled id would pay a milestone twice.
    expect(result.save.state.purchasedNodes).toEqual(['s1-click-1']);
    expect(result.save.state.claimedMilestones).toEqual(['m-water-10']);
  });
});

describe('bad input degrades instead of throwing', () => {
  it('treats a missing save as a first run, not an error', () => {
    const result = deserialize(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty');
  });

  it('rejects malformed JSON', () => {
    const result = deserialize('{not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unparseable');
  });

  it('rejects a non-object save', () => {
    const result = deserialize('42');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('corrupt');
  });

  it('REFUSES a save from a newer build rather than mangling it', () => {
    // Silently downgrading would destroy progress irrecoverably.
    const result = deserialize(
      JSON.stringify({ version: CURRENT_SAVE_VERSION + 5, savedAt: 0, state: {} })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('future-version');
  });

  it('defaults every missing field rather than producing undefined', () => {
    const result = deserialize(JSON.stringify({ version: 1, savedAt: 0, state: {} }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state).toEqual(initialState());
  });

  it('repairs wrong-typed and out-of-range fields', () => {
    const result = deserialize(
      JSON.stringify({
        version: 1,
        savedAt: 0,
        state: {
          mana: 'lots',
          lifetimeMana: -5,
          owned: ['x', 2.7, null],
          season: 99,
          capstonesCleared: [1, 'two', 7],
          frenzy: { meter: 5, remainingSeconds: -3 },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const s = result.save.state;
    expect(s.mana).toBe(0);
    expect(s.lifetimeMana).toBe(0);
    expect(s.owned[0]).toBe(0);
    expect(s.owned[1]).toBe(2);
    expect(s.owned).toHaveLength(TIER_COUNT);
    expect(s.season).toBe(4);
    expect(s.capstonesCleared).toEqual([1]);
    expect(s.frenzy.meter).toBe(1);
    expect(s.frenzy.remainingSeconds).toBe(0);
  });

  it('pads a short owned array to the full tier count', () => {
    const result = deserialize(JSON.stringify({ version: 1, savedAt: 0, state: { owned: [5] } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.owned).toHaveLength(TIER_COUNT);
    expect(result.save.state.owned[0]).toBe(5);
    expect(result.save.state.owned[TIER_COUNT - 1]).toBe(0);
  });
});

describe('export / import (the bug-report path)', () => {
  it('round-trips through base64', () => {
    const save = serialize({ ...initialState(), mana: 777 }, 12345);
    const result = decodeSave(encodeSave(save));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.state.mana).toBe(777);
    expect(result.save.savedAt).toBe(12345);
  });

  it('tolerates surrounding whitespace from a copy-paste', () => {
    const encoded = encodeSave(serialize(initialState(), 0));
    expect(decodeSave(`\n  ${encoded}  \n`).ok).toBe(true);
  });

  it('fails cleanly on garbage rather than throwing', () => {
    const result = decodeSave('!!!not base64!!!');
    expect(result.ok).toBe(false);
  });
});
