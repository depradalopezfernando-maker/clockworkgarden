import { describe, it, expect } from 'vitest';
import {
  armCapstone,
  capstoneTargetRate,
  clearPlaceholderCapstone,
  hasDesignedChallenge,
  initialCapstone,
  isCapstoneReady,
  progressCapstone,
} from '@sim/capstone';
import { advance, clickBell, pollinateFlower } from '@sim/tick';
import { FLOWERS, GOLDEN_CHAIN, isGoldenBloomActive, type FlowerType } from '@sim/pollination';
import { totalManaPerSecond } from '@sim/economy';
import { CLICKS_TO_FILL, initialFrenzy } from '@sim/frenzy';
import { canPrestige } from '@sim/prestige';
import { initialState, type GameState } from '@sim/state';
import { CAPSTONE_GATE_COUNT, CAPSTONE_GATE_TIER, TIER_COUNT } from '@content/generators';
import { FRENZY_DURATION_SECONDS, S1_CAPSTONE_TARGET_RATE } from '@content/balance';

/** A Season 1 state that has met the readiness gate (10x Tier 4). */
function ready(extra: Partial<GameState> = {}): GameState {
  const base = initialState();
  const owned = new Array<number>(TIER_COUNT).fill(0);
  owned[(CAPSTONE_GATE_TIER[1] ?? 4) - 1] = CAPSTONE_GATE_COUNT;
  return { ...base, owned, ...extra };
}

/** Ring the Bell until a Frenzy is running. */
function withFrenzy(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < CLICKS_TO_FILL; i++) s = clickBell(s).state;
  return s;
}

describe('D4a — readiness is separate from clearing', () => {
  it('is not ready before the gate is met', () => {
    expect(isCapstoneReady(initialState())).toBe(false);
  });

  it('becomes ready once the Season’s gate tier is owned', () => {
    expect(isCapstoneReady(ready())).toBe(true);
  });

  it('is not ready again once the Season is cleared', () => {
    expect(isCapstoneReady(ready({ capstonesCleared: [1], season: 2 }))).toBe(false);
  });

  it('readiness alone does NOT clear Season 1 — the challenge must be played', () => {
    // The whole point of D4a. If readiness cleared it, the capstone would be a
    // production threshold wearing a costume.
    const state = ready();
    expect(clearPlaceholderCapstone(state)).toBe(state);
    expect(state.capstonesCleared).toEqual([]);
  });

  it('Seasons 1 and 2 have designed challenges; 3 and 4 do not yet', () => {
    expect(hasDesignedChallenge(1)).toBe(true);
    expect(hasDesignedChallenge(2)).toBe(true);
    for (const season of [3, 4]) {
      expect(hasDesignedChallenge(season), `season ${season}`).toBe(false);
    }
  });
});

describe('D4a — arming an attempt', () => {
  it('refuses to arm before the player is ready', () => {
    const state = initialState();
    expect(armCapstone(state)).toBe(state);
  });

  it('arms once ready, and counts the attempt', () => {
    const armed = armCapstone(ready());
    expect(armed.capstone.armed).toBe(true);
    expect(armed.capstone.attempts).toBe(1);
    expect(armed.capstone.lastFailed).toBe(false);
  });

  it('is idempotent while an attempt is running', () => {
    const armed = armCapstone(ready());
    expect(armCapstone(armed)).toBe(armed);
  });

  it('does not mutate the input state', () => {
    const before = ready();
    armCapstone(before);
    expect(before.capstone.armed).toBe(false);
  });
});

describe('D4a — the challenge is a Frenzy test, not a threshold', () => {
  const target = S1_CAPSTONE_TARGET_RATE;

  it('does not clear on a rate reached OUTSIDE a Frenzy', () => {
    // Idling past the target must not count. Only the Frenzy window does.
    const armed = armCapstone(ready());
    expect(armed.frenzy.remainingSeconds).toBe(0);
    const result = progressCapstone(armed, target * 10);
    expect(result.justCleared).toBe(false);
    expect(result.state.capstonesCleared).toEqual([]);
  });

  it('clears when the target is reached during a Frenzy', () => {
    const armed = withFrenzy(armCapstone(ready()));
    const result = progressCapstone(armed, target);
    expect(result.justCleared).toBe(true);
    expect(result.state.capstonesCleared).toEqual([1]);
    expect(result.state.season).toBe(2);
  });

  it('does not clear below the target', () => {
    const armed = withFrenzy(armCapstone(ready()));
    expect(progressCapstone(armed, target - 1).justCleared).toBe(false);
  });

  it('tracks the peak reached, so a brief spike counts', () => {
    let state = withFrenzy(armCapstone(ready()));
    state = progressCapstone(state, target * 0.8).state;
    expect(state.capstone.attemptPeakRate).toBeCloseTo(target * 0.8, 6);
    // A lower reading afterwards must not erase the peak.
    state = progressCapstone(state, target * 0.3).state;
    expect(state.capstone.attemptPeakRate).toBeCloseTo(target * 0.8, 6);
  });

  it('fails when the Frenzy ends without the target, and disarms', () => {
    let state = withFrenzy(armCapstone(ready()));
    state = progressCapstone(state, target * 0.5).state;
    // Burn the whole Frenzy window.
    state = advance(state, FRENZY_DURATION_SECONDS + 1);

    const result = progressCapstone(state, 0);
    expect(result.state.capstone.armed).toBe(false);
    expect(result.state.capstone.lastFailed).toBe(true);
    expect(result.state.capstonesCleared).toEqual([]);
  });

  it('retries immediately with no penalty (§9, D4a)', () => {
    let state = withFrenzy(armCapstone(ready()));
    state = advance(state, FRENZY_DURATION_SECONDS + 1);
    state = progressCapstone(state, 0).state;
    expect(state.capstone.lastFailed).toBe(true);

    // No cooldown, no cost, nothing lost.
    const again = armCapstone(state);
    expect(again.capstone.armed).toBe(true);
    expect(again.capstone.attempts).toBe(2);
    expect(again.mana).toBe(state.mana);
  });

  it('does nothing at all when not armed', () => {
    const state = ready();
    expect(progressCapstone(state, 1e9).state).toBe(state);
  });

  it('returns the SAME reference when nothing changed', () => {
    // Called every tick; a fresh object would republish to React needlessly.
    const armed = { ...armCapstone(ready()), frenzy: initialFrenzy() };
    const first = progressCapstone(armed, 0).state;
    expect(progressCapstone(first, 0).state).toBe(first);
  });
});

describe('D4a — the target is calibrated, not arbitrary', () => {
  // MEASURED from a simulated playthrough, not from a synthetic state: a real
  // player arriving at the readiness gate owns Tiers 1-4 and several Insight
  // nodes, not ten Tier-4 generators alone. All three archetypes land on the
  // same figure because the gate is own-count based. See docs/04 D4a.
  //
  // RE-MEASURED after the docs/09 playtest changes: 890 -> 1205. The old target
  // of 1200 had fallen BELOW the passive rate, so a playtester cleared First
  // Bloom without ever needing a Frenzy. These bounds are what catch that.
  const MEASURED_RATE_AT_READINESS = 1205;
  const MEASURED_FRENZIED = MEASURED_RATE_AT_READINESS * 2;

  it('sits above what a ready player produces passively', () => {
    // Otherwise idling clears it and the capstone tests nothing.
    expect(S1_CAPSTONE_TARGET_RATE).toBeGreaterThan(MEASURED_RATE_AT_READINESS);
  });

  it('sits below what one Frenzy delivers, so it clears first try', () => {
    expect(S1_CAPSTONE_TARGET_RATE).toBeLessThan(MEASURED_FRENZIED);
  });

  it('leaves meaningful headroom rather than scraping the ceiling', () => {
    expect(MEASURED_FRENZIED / S1_CAPSTONE_TARGET_RATE).toBeGreaterThan(1.25);
  });

  it('a bare readiness state alone does NOT clear it', () => {
    // Ten Tier-4 generators and nothing else is far below target even frenzied.
    // Reaching it requires the whole Season 1 build, which is the point.
    expect(totalManaPerSecond(ready()) * 2).toBeLessThan(S1_CAPSTONE_TARGET_RATE);
  });

  it('CANNOT be cleared by idling — the failure the playtest found', () => {
    // The capstone must test §5, not production. If the target ever drops below
    // what a ready player makes passively, the Frenzy becomes a formality and
    // D4a is dead: "a production threshold wearing a costume".
    expect(S1_CAPSTONE_TARGET_RATE).toBeGreaterThan(MEASURED_RATE_AT_READINESS * 1.2);
  });

  it('Season 2 carries no rate floor — D4b is a skill test, not a build test', () => {
    expect(capstoneTargetRate(2)).toBe(0);
  });

  it('undesigned Seasons have no reachable target, and are marked as such', () => {
    expect(capstoneTargetRate(3)).toBe(Number.POSITIVE_INFINITY);
    expect(capstoneTargetRate(4)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Seasons 3-4 keep the placeholder until designed', () => {
  it('readiness alone advances them', () => {
    const base = initialState();
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[(CAPSTONE_GATE_TIER[3] ?? 14) - 1] = CAPSTONE_GATE_COUNT;
    const state: GameState = { ...base, owned, season: 3, capstonesCleared: [1, 2] };

    expect(isCapstoneReady(state)).toBe(true);
    const cleared = clearPlaceholderCapstone(state);
    expect(cleared.season).toBe(4);
  });

  it('does NOT clear Season 2 — D4b must be played', () => {
    const base = initialState();
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[(CAPSTONE_GATE_TIER[2] ?? 9) - 1] = CAPSTONE_GATE_COUNT;
    const state: GameState = { ...base, owned, season: 2, capstonesCleared: [1] };

    expect(isCapstoneReady(state)).toBe(true);
    expect(clearPlaceholderCapstone(state)).toBe(state);
  });

  it('never advances past Season 4', () => {
    const base = initialState();
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[(CAPSTONE_GATE_TIER[4] ?? 19) - 1] = CAPSTONE_GATE_COUNT;
    const state: GameState = { ...base, owned, season: 4, capstonesCleared: [1, 2, 3] };
    expect(clearPlaceholderCapstone(state).season).toBe(4);
  });
});

describe('the capstone unlocks prestige (§4)', () => {
  it('prestige is unavailable until Season 1 is cleared', () => {
    expect(canPrestige(ready())).toBe(false);
  });

  it('clearing First Bloom unlocks it', () => {
    const armed = withFrenzy(armCapstone(ready()));
    const cleared = progressCapstone(armed, S1_CAPSTONE_TARGET_RATE).state;
    expect(canPrestige(cleared)).toBe(true);
  });

  it('an attempt in progress is wiped by clearing, not carried forward', () => {
    const armed = withFrenzy(armCapstone(ready()));
    const cleared = progressCapstone(armed, S1_CAPSTONE_TARGET_RATE).state;
    expect(cleared.capstone.armed).toBe(false);
    expect(cleared.capstone.attemptPeakRate).toBe(0);
  });
});

describe('initial state', () => {
  it('starts with no attempt and no history', () => {
    expect(initialCapstone()).toEqual({
      armed: false,
      attemptPeakRate: 0,
      attempts: 0,
      lastFailed: false,
      sawFrenzy: false,
    });
  });
});

// ---------------------------------------------------------------------------
// DECISION D4b — Season 2's capstone, "Both Blooms"
// ---------------------------------------------------------------------------
//
// §6.1 already names its own peak moment: a Golden Bloom landed during a Growth
// Frenzy. D4b makes that moment the capstone rather than inventing a second one,
// so the Season is finished by doing the thing the Season taught.

describe('D4b — Both Blooms', () => {
  /** A Season 2 state that has met the readiness gate (10x Tier 9). */
  function readyForSeason2(extra: Partial<GameState> = {}): GameState {
    const base = initialState();
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[(CAPSTONE_GATE_TIER[2] ?? 9) - 1] = CAPSTONE_GATE_COUNT;
    return { ...base, owned, season: 2, capstonesCleared: [1], ...extra };
  }

  function goldenChain(state: GameState): GameState {
    let s = state;
    for (let i = 0; i < GOLDEN_CHAIN; i++) {
      s = pollinateFlower(s, FLOWERS[i % FLOWERS.length] as FlowerType).state;
    }
    return s;
  }

  it('needs BOTH: a Frenzy alone does not clear it', () => {
    let state = armCapstone(readyForSeason2());
    expect(state.capstone.armed).toBe(true);
    state = withFrenzy(state);
    // Rate is astronomically above zero, and Season 2 has no rate floor - so if
    // the Golden Bloom were not required this would clear on the next tick.
    state = advance(state, 0.1);
    expect(state.capstonesCleared).toEqual([1]);
    expect(state.season).toBe(2);
  });

  it('needs BOTH: a Golden Bloom outside a Frenzy does not clear it', () => {
    let state = armCapstone(readyForSeason2());
    state = goldenChain(state);
    expect(isGoldenBloomActive(state.pollination)).toBe(true);
    state = advance(state, 0.1);
    expect(state.capstonesCleared).toEqual([1]);
  });

  it('clears on a Golden Bloom landed during a Frenzy, and advances the Season', () => {
    let state = armCapstone(readyForSeason2());
    state = withFrenzy(state);
    state = goldenChain(state);
    state = advance(state, 0.1);
    expect(state.capstonesCleared).toEqual([1, 2]);
    expect(state.season).toBe(3);
  });

  it('fails without penalty when the Frenzy runs out, and re-arms instantly', () => {
    // D4a's anti-frustration rule, inherited: no cooldown, no cost, try again.
    let state = armCapstone(readyForSeason2());
    state = withFrenzy(state);
    state = advance(state, FRENZY_DURATION_SECONDS + 1);
    // The step the Frenzy expires in still counts as frenzied; the attempt ends
    // on the first step that is not.
    state = advance(state, 0.1);
    expect(state.capstone.armed).toBe(false);
    expect(state.capstone.lastFailed).toBe(true);
    expect(state.capstonesCleared).toEqual([1]);

    const again = armCapstone(state);
    expect(again.capstone.armed).toBe(true);
    expect(again.capstone.attempts).toBe(2);
  });

  it('cannot be cleared by the drone alone — it is a test of the PLAYER', () => {
    // Nine straight successes at 40% is 0.026%. Ten simulated minutes of a
    // fully-automated Season 2, armed and frenzied, must not clear it.
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[(CAPSTONE_GATE_TIER[2] ?? 9) - 1] = CAPSTONE_GATE_COUNT;
    owned[7] = 50; // fifty Pollinator Drone Swarms
    let state = armCapstone({
      ...initialState(),
      owned,
      season: 2,
      capstonesCleared: [1],
    });
    for (let i = 0; i < 6000; i++) {
      state = { ...state, frenzy: { meter: 0, remainingSeconds: 30 } };
      state = advance(state, 0.1);
    }
    expect(state.capstonesCleared).toEqual([1]);
  });
});
