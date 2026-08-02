/**
 * tick.ts — the canonical way a game advances.
 *
 * Everything that moves the game forward goes through here: the live 10 Hz loop,
 * offline catch-up, and tests. One code path means the browser and the harness
 * cannot disagree about what a second of play is worth.
 *
 * Pure. `dt` arrives as a parameter; nothing here reads a clock (ADR-0002).
 */

import { totalManaPerSecond, clickYield } from './economy';
import { addFrenzyClick, frenzyMultiplier, tickFrenzy } from './frenzy';
import { claimMilestones } from './milestones';
import { effectsOf } from './insight';
import type { GameState } from './state';

/** Advance the world by `dt` seconds of engaged play. */
export function advance(state: GameState, dt: number): GameState {
  if (!(dt > 0)) return state;

  const frenzy = tickFrenzy(state.frenzy, dt);

  // Production uses the frenzy state AFTER ticking, so a window that expires
  // partway through a step does not pay out for the whole step. At 10 Hz the
  // error is bounded by one tick; simulating the boundary exactly would cost
  // more complexity than it buys.
  const earned = totalManaPerSecond(state) * frenzyMultiplier(frenzy) * dt;

  const advanced: GameState = {
    ...state,
    frenzy,
    mana: state.mana + earned,
    lifetimeMana: state.lifetimeMana + earned,
    elapsedSeconds: state.elapsedSeconds + dt,
  };

  // Milestones are checked every tick. The common case awards nothing and
  // returns the same reference, so this costs one array scan and no allocation.
  return claimMilestones(advanced).state;
}

export interface ClickResult {
  readonly state: GameState;
  /** Mana this click produced, for floating-number feedback in the UI. */
  readonly gained: number;
  /** True when this click was the one that triggered a Frenzy. */
  readonly triggeredFrenzy: boolean;
}

/**
 * Ring the Greenhouse Bell.
 *
 * The click that fills the meter benefits from the Frenzy it starts - the
 * multiplier is computed from the post-click state. Deliberately generous: the
 * alternative is a click that visibly triggers a Frenzy while paying out at 1x,
 * which reads as a bug to a player.
 */
export function clickBell(state: GameState): ClickResult {
  const frenzy = addFrenzyClick(state.frenzy, effectsOf(state).frenzyBonusSeconds);
  const triggeredFrenzy = frenzy.remainingSeconds > state.frenzy.remainingSeconds;
  const gained = clickYield(state, 0, frenzyMultiplier(frenzy));

  const clicked: GameState = {
    ...state,
    frenzy,
    mana: state.mana + gained,
    lifetimeMana: state.lifetimeMana + gained,
  };

  return { state: claimMilestones(clicked).state, gained, triggeredFrenzy };
}
