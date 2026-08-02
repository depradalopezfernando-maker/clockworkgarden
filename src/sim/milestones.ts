/**
 * milestones.ts — the engine that turns progress into Insight (§3).
 *
 * Pure (ADR-0002). Definitions are data in `src/content/milestones.ts`.
 *
 * §3: Insight is "**not** earned by spending Mana directly — earned from
 * milestones". So this runs on every tick, awards each milestone exactly once,
 * and never takes anything back.
 */

import { MILESTONES, type Milestone, type MilestoneCondition } from '@content/milestones';
import { ownedOf, type GameState } from './state';

export function isConditionMet(state: GameState, condition: MilestoneCondition): boolean {
  switch (condition.kind) {
    case 'own-count':
      return ownedOf(state, condition.tier) >= condition.count;
    case 'lifetime-mana':
      return state.lifetimeMana >= condition.amount;
    case 'capstone-cleared':
      return state.capstonesCleared.includes(condition.season);
    case 'prestige-count':
      return state.prestigeCount >= condition.count;
    case 'played-seconds':
      return state.elapsedSeconds >= condition.seconds;
  }
}

export function isClaimed(state: GameState, milestoneId: string): boolean {
  return state.claimedMilestones.includes(milestoneId);
}

/** Milestones whose condition holds but which have not yet paid out. */
export function newlyEarned(state: GameState): Milestone[] {
  return MILESTONES.filter((m) => !isClaimed(state, m.id) && isConditionMet(state, m.condition));
}

export interface ClaimResult {
  readonly state: GameState;
  /** Milestones awarded by this call, for UI notification. */
  readonly awarded: readonly Milestone[];
}

/**
 * Award every newly-earned milestone.
 *
 * Called on every tick, so the common path — nothing new — returns the SAME
 * state reference. That matters: the store publishes on reference change, and a
 * fresh object ten times a second would re-render the whole tree for nothing.
 */
export function claimMilestones(state: GameState): ClaimResult {
  const awarded = newlyEarned(state);
  if (awarded.length === 0) return { state, awarded: [] };

  const gained = awarded.reduce((sum, m) => sum + m.reward, 0);

  return {
    state: {
      ...state,
      insight: state.insight + gained,
      lifetimeInsight: state.lifetimeInsight + gained,
      claimedMilestones: [...state.claimedMilestones, ...awarded.map((m) => m.id)],
    },
    awarded,
  };
}

/** Progress toward an unclaimed milestone, 0-1. Drives the UI's progress bars. */
export function milestoneProgress(state: GameState, milestone: Milestone): number {
  const c = milestone.condition;
  const ratio = (current: number, target: number) =>
    target <= 0 ? 1 : Math.min(1, Math.max(0, current / target));

  switch (c.kind) {
    case 'own-count':
      return ratio(ownedOf(state, c.tier), c.count);
    case 'lifetime-mana':
      return ratio(state.lifetimeMana, c.amount);
    case 'capstone-cleared':
      return state.capstonesCleared.includes(c.season) ? 1 : 0;
    case 'prestige-count':
      return ratio(state.prestigeCount, c.count);
    case 'played-seconds':
      return ratio(state.elapsedSeconds, c.seconds);
  }
}
