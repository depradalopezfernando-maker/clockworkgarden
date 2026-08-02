/**
 * frenzy.ts — §5 Growth Frenzy.
 *
 * "Clicking the Bell fills a Frenzy Meter. At full: 2x all production (click
 * AND auto) for 20 seconds. The meter drains slowly if idle, so it rewards short
 * bursts of attention rather than sustained clicking."
 *
 * Pure and time-as-a-parameter, per ADR-0002. Phase 1 modelled Frenzy as an
 * average uptime, which was fine for pacing; this is the real meter.
 *
 * Phase 1 established that Frenzy uptime is the single largest determinant of
 * campaign length - the whole idle-to-active spread comes from here, not from
 * clicking. Treat these constants as balance, not just feel.
 * See docs/06-phase-1-balance-report.md §5.
 */

import {
  FRENZY_DURATION_SECONDS,
  FRENZY_METER_DRAIN_PER_SECOND,
  FRENZY_METER_GAIN_PER_CLICK,
  FRENZY_MULTIPLIER,
} from '@content/balance';

export interface FrenzyState {
  /** 0-1. Reaching 1 triggers a Frenzy and empties the meter. */
  readonly meter: number;
  /** Seconds of Frenzy left. 0 when inactive. */
  readonly remainingSeconds: number;
}

export function initialFrenzy(): FrenzyState {
  return { meter: 0, remainingSeconds: 0 };
}

export function isFrenzyActive(frenzy: FrenzyState): boolean {
  return frenzy.remainingSeconds > 0;
}

/** §5: 2x during a Frenzy, applied to click AND auto production alike. */
export function frenzyMultiplier(frenzy: FrenzyState): number {
  return isFrenzyActive(frenzy) ? FRENZY_MULTIPLIER : 1;
}

/**
 * Register a Bell click.
 *
 * The meter does not fill during an active Frenzy - otherwise sustained
 * clicking would chain Frenzies back to back, which §5 explicitly does not want
 * ("rewards short bursts of attention rather than sustained clicking").
 */
export function addFrenzyClick(frenzy: FrenzyState, bonusSeconds = 0): FrenzyState {
  if (isFrenzyActive(frenzy)) return frenzy;

  const meter = frenzy.meter + FRENZY_METER_GAIN_PER_CLICK;
  if (meter >= 1) {
    return { meter: 0, remainingSeconds: FRENZY_DURATION_SECONDS + bonusSeconds };
  }
  return { ...frenzy, meter };
}

/** Advance by `dt` seconds: burn Frenzy time, or drain the idle meter. */
export function tickFrenzy(frenzy: FrenzyState, dt: number): FrenzyState {
  if (dt <= 0) return frenzy;

  if (isFrenzyActive(frenzy)) {
    const raw = frenzy.remainingSeconds - dt;
    // Snap a hair's-breadth remainder to zero. Accumulated float error otherwise
    // leaves ~1e-17 seconds on the clock, which reads as "active" while the HUD
    // shows 0.0s - a one-frame flicker and a 2x multiplier the player did not
    // earn.
    const remainingSeconds = raw < 1e-9 ? 0 : raw;
    return { ...frenzy, remainingSeconds };
  }

  const meter = Math.max(0, frenzy.meter - FRENZY_METER_DRAIN_PER_SECOND * dt);
  return { ...frenzy, meter };
}

/** Clicks needed to fill an empty meter. Used by the UI to explain itself. */
export const CLICKS_TO_FILL = Math.ceil(1 / FRENZY_METER_GAIN_PER_CLICK);
