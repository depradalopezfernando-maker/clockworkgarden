/**
 * offline.ts — §7 offline progress, computed analytically.
 *
 * §7's table:
 *
 *   0-8 hrs    100%
 *   8-24 hrs   tapers 100% -> 50%
 *   24 hrs+    flat 50%
 *
 * Efficiency is INSTANTANEOUS - the rate decays as you stay away, rather than
 * one flat multiplier chosen by total duration. So the reward for being away T
 * hours is the integral of the efficiency curve over [0, T], which this module
 * evaluates in closed form.
 *
 * That is deliberate and load-bearing (CLAUDE.md rule 5): eight hours at the
 * 10 Hz sim tick would be 288,000 iterations, and simulating them would be slow,
 * imprecise, and untestable. The integral is exact, instant, and one assertion.
 */

import {
  OFFLINE_FULL_RATE_HOURS,
  OFFLINE_MAX_SECONDS,
  OFFLINE_MIN_EFFICIENCY,
  OFFLINE_TAPER_END_HOURS,
} from '@content/balance';

const SECONDS_PER_HOUR = 3600;

/**
 * Efficiency at a single instant, `hours` into being away. Piecewise-linear and
 * continuous: 1.0 up to the full-rate cutoff, linear down to the floor, flat
 * thereafter.
 */
export function offlineEfficiencyAt(hours: number): number {
  if (hours <= OFFLINE_FULL_RATE_HOURS) return 1;
  if (hours >= OFFLINE_TAPER_END_HOURS) return OFFLINE_MIN_EFFICIENCY;

  const taperSpan = OFFLINE_TAPER_END_HOURS - OFFLINE_FULL_RATE_HOURS;
  const into = hours - OFFLINE_FULL_RATE_HOURS;
  return 1 - (1 - OFFLINE_MIN_EFFICIENCY) * (into / taperSpan);
}

/**
 * Productive-hours equivalent of being away for `hours`. This is
 * `integral of offlineEfficiencyAt from 0 to hours`, evaluated exactly.
 *
 * Example: 24 hours away yields 20 productive hours - 8 at full rate plus 16
 * tapering, which average 75%.
 */
export function effectiveOfflineHours(hours: number): number {
  if (!(hours > 0)) return 0;

  const full = OFFLINE_FULL_RATE_HOURS;
  const end = OFFLINE_TAPER_END_HOURS;
  const min = OFFLINE_MIN_EFFICIENCY;
  const taperSpan = end - full;

  if (hours <= full) return hours;

  // Area under the linear taper, from `full` up to min(hours, end).
  const taperHours = Math.min(hours, end) - full;
  const taperArea = taperHours - ((1 - min) * taperHours * taperHours) / (2 * taperSpan);

  if (hours <= end) return full + taperArea;

  return full + taperArea + min * (hours - end);
}

/** Average efficiency across the whole away period. Useful for UI copy. */
export function averageOfflineEfficiency(hours: number): number {
  if (!(hours > 0)) return 0;
  return effectiveOfflineHours(hours) / hours;
}

/**
 * Mana earned while away.
 *
 * `awaySeconds` is clamped to a sane range first: negative values (a save from
 * the future - clock skew, or a player fiddling with the system clock) grant
 * nothing rather than a negative or enormous amount, per ADR-0004.
 */
export function offlineManaEarned(manaPerSecond: number, awaySeconds: number): number {
  if (!(awaySeconds > 0) || !(manaPerSecond > 0)) return 0;
  const clamped = Math.min(awaySeconds, OFFLINE_MAX_SECONDS);
  const hours = clamped / SECONDS_PER_HOUR;
  return manaPerSecond * effectiveOfflineHours(hours) * SECONDS_PER_HOUR;
}
