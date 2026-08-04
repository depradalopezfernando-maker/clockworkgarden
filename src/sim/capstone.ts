/**
 * capstone.ts — Season capstones (§2, §8), starting with Season 1's.
 *
 * Pure (ADR-0002).
 *
 * Decision D6: Seasons advance on capstone-clear ONLY, never on elapsed time.
 * Decision D4a: Season 1's capstone is "First Bloom" — reach a target Mana/sec
 * during a single Growth Frenzy.
 *
 * Season 2's challenge is DECIDED but not BUILT (D4b, "Both Blooms": land a
 * Golden Bloom during a Growth Frenzy). It cannot be implemented here until
 * Pollination Combo exists in Phase 7 — and it must be the LAST thing that phase
 * builds, because the target has to be calibrated against a harness that models
 * the mechanic. Season 3's is still open; Season 4's is specified by §6.3 as The
 * Long Night.
 *
 * Until then all three keep the Phase 1 placeholder: readiness alone clears
 * them. `hasDesignedChallenge` marks which is which so a later phase cannot
 * mistake a placeholder for a finished capstone.
 */

import { S1_CAPSTONE_TARGET_RATE } from '@content/balance';
import { CAPSTONE_GATE_COUNT, CAPSTONE_GATE_TIER } from '@content/generators';
import { isFrenzyActive } from './frenzy';
import { ownedOf, type GameState } from './state';

export interface CapstoneState {
  /** The player has begun an attempt; the next Frenzy is the challenge. */
  readonly armed: boolean;
  /** Best Mana/sec reached during the current attempt. */
  readonly attemptPeakRate: number;
  /** Attempts made this Season, for UI copy. */
  readonly attempts: number;
  /** True when the last attempt ended without clearing. Drives "Try again". */
  readonly lastFailed: boolean;
  /** Whether a Frenzy has been seen during the current attempt. */
  readonly sawFrenzy: boolean;
}

export function initialCapstone(): CapstoneState {
  return { armed: false, attemptPeakRate: 0, attempts: 0, lastFailed: false, sawFrenzy: false };
}

/** Seasons whose capstone has a real designed challenge rather than a stand-in. */
export function hasDesignedChallenge(season: number): boolean {
  return season === 1;
}

export function capstoneTargetRate(season: number): number {
  return season === 1 ? S1_CAPSTONE_TARGET_RATE : Number.POSITIVE_INFINITY;
}

/**
 * Whether the player has built enough to attempt this Season's capstone.
 *
 * Readiness is deliberately separate from clearing: the challenge cannot be
 * attempted before the player has the generators to stand a chance, so a failed
 * attempt is always a skill or timing miss rather than an impossible ask.
 */
export function isCapstoneReady(state: GameState): boolean {
  if (state.capstonesCleared.includes(state.season)) return false;
  const gateTier = CAPSTONE_GATE_TIER[state.season];
  if (gateTier === undefined) return false;
  return ownedOf(state, gateTier) >= CAPSTONE_GATE_COUNT;
}

/** Begin an attempt. The next Growth Frenzy is the challenge window. */
export function armCapstone(state: GameState): GameState {
  if (!isCapstoneReady(state)) return state;
  if (state.capstone.armed) return state;
  return {
    ...state,
    capstone: {
      armed: true,
      attemptPeakRate: 0,
      attempts: state.capstone.attempts + 1,
      lastFailed: false,
      sawFrenzy: false,
    },
  };
}

export interface CapstoneProgress {
  readonly state: GameState;
  /** Set on the tick that cleared the capstone, for celebration in the UI. */
  readonly justCleared: boolean;
  /** Set on the tick the attempt ran out of Frenzy without reaching the target. */
  readonly justFailed: boolean;
}

/**
 * Advance an in-progress capstone attempt.
 *
 * `currentRate` is total Mana/sec INCLUDING the Frenzy multiplier — the number
 * the player sees. Called every tick from `advance`.
 */
export function progressCapstone(
  state: GameState,
  currentRate: number,
  frenziedDuringStep?: boolean
): CapstoneProgress {
  const capstone = state.capstone;
  if (!capstone.armed) return { state, justCleared: false, justFailed: false };

  // `frenziedDuringStep` exists because a Frenzy can begin AND end inside one
  // step - `advance` ticks the meter before the capstone sees it, so a window
  // that closes mid-step is otherwise invisible and the attempt hangs armed
  // forever. Rare at 10 Hz; routine on the catch-up path, which uses far larger
  // steps. Callers pass whether a Frenzy was live at any point in the step.
  const frenzied = frenziedDuringStep ?? isFrenzyActive(state.frenzy);
  const target = capstoneTargetRate(state.season);
  const peak = Math.max(capstone.attemptPeakRate, frenzied ? currentRate : 0);

  if (frenzied && peak >= target) {
    return {
      state: {
        ...state,
        capstonesCleared: [...state.capstonesCleared, state.season],
        season: Math.min(state.season + 1, 4),
        capstone: { ...initialCapstone(), attempts: capstone.attempts },
      },
      justCleared: true,
      justFailed: false,
    };
  }

  // The attempt ends when the Frenzy that carried it ends. §9's anti-frustration
  // stance and D4a: no penalty, no cooldown, re-arm and go again.
  if (capstone.sawFrenzy && !frenzied) {
    return {
      state: {
        ...state,
        capstone: { ...capstone, armed: false, lastFailed: true, attemptPeakRate: peak },
      },
      justCleared: false,
      justFailed: true,
    };
  }

  if (peak === capstone.attemptPeakRate && frenzied === capstone.sawFrenzy) {
    // Nothing changed - return the same reference so the store does not publish.
    return { state, justCleared: false, justFailed: false };
  }

  return {
    state: {
      ...state,
      capstone: { ...capstone, attemptPeakRate: peak, sawFrenzy: capstone.sawFrenzy || frenzied },
    },
    justCleared: false,
    justFailed: false,
  };
}

/**
 * Clear a capstone that has no designed challenge yet (Seasons 2-4).
 *
 * PLACEHOLDER. Readiness alone advances the Season, exactly as Phase 1 did.
 * Delete this the moment those capstones are designed.
 */
export function clearPlaceholderCapstone(state: GameState): GameState {
  if (hasDesignedChallenge(state.season)) return state;
  if (!isCapstoneReady(state)) return state;
  return {
    ...state,
    capstonesCleared: [...state.capstonesCleared, state.season],
    season: Math.min(state.season + 1, 4),
  };
}
