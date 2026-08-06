/**
 * tick.ts — the canonical way a game advances.
 *
 * Everything that moves the game forward goes through here: the live 10 Hz loop,
 * offline catch-up, and tests. One code path means the browser and the harness
 * cannot disagree about what a second of play is worth.
 *
 * Pure. `dt` arrives as a parameter; nothing here reads a clock (ADR-0002).
 */

import { recordUnlocks, totalManaPerSecond, clickYield } from './economy';
import { addFrenzyClick, frenzyMultiplier, isFrenzyActive, tickFrenzy } from './frenzy';
import { claimMilestones } from './milestones';
import { clearPlaceholderCapstone, progressCapstone } from './capstone';
import { effectsOf } from './insight';
import { satchelCapacity } from './kitchenGarden';
import {
  bloomMultiplier,
  isGoldenBloomActive,
  isPollinationUnlocked,
  pollinate,
  runDrone,
  tickPollination,
  type FlowerType,
  type PollinationTier,
} from './pollination';
import { ownedOf, type GameState } from './state';

/** §6.1: the Pollinator Drone Swarm is Tier 8. Owning one turns automation on. */
const DRONE_TIER = 8;

/** Advance the world by `dt` seconds of engaged play. */
export function advance(state: GameState, dt: number): GameState {
  if (!(dt > 0)) return state;

  const frenzy = tickFrenzy(state.frenzy, dt);
  const effects = effectsOf(state);

  // §6.1. Timers first, then the drone: a Bloom that expires inside this step
  // must not also pay out for it, and the drone must not pick up a chain that
  // is about to be declared lapsed.
  const ticked = tickPollination(state.pollination, dt);
  const drone = runDrone(ticked, dt, {
    enabled: isPollinationUnlocked(state.season) && ownedOf(state, DRONE_TIER) >= 1,
    successBonus: effects.pollinationDroneBonus,
    windowBonusSeconds: effects.pollinationWindowSeconds,
  });
  const pollination = drone.pollination;

  // Production uses the frenzy state AFTER ticking, so a window that expires
  // partway through a step does not pay out for the whole step. At 10 Hz the
  // error is bounded by one tick; simulating the boundary exactly would cost
  // more complexity than it buys.
  //
  // §6.1 is explicit that a Bloom STACKS with a Frenzy, so the two multiply
  // rather than adding — a Golden Bloom inside a Frenzy is x4, the Season's
  // stated peak moment.
  const bloom = bloomMultiplier(pollination, effects.pollinationBloomBonus);
  const earned = totalManaPerSecond(state) * frenzyMultiplier(frenzy) * bloom * dt;

  const advanced: GameState = {
    ...state,
    frenzy,
    pollination,
    mana: state.mana + earned,
    lifetimeMana: state.lifetimeMana + earned,
    elapsedSeconds: state.elapsedSeconds + dt,
    kitchenGarden: addSeeds(state, drone.seeds, effects.satchelBonus),
  };

  // Milestones are checked every tick. The common case awards nothing and
  // returns the same reference, so this costs one array scan and no allocation.
  let next = claimMilestones(advanced).state;

  // The capstone attempt watches the rate the PLAYER sees - Frenzy included.
  // Pass whether a Frenzy was live at ANY point in this step, not just at its
  // end: a window that opens and closes inside one step would otherwise leave
  // the attempt armed forever. The same applies to the Golden Bloom D4b tests.
  const frenziedDuringStep = isFrenzyActive(state.frenzy) || isFrenzyActive(frenzy);
  const goldenDuringStep =
    isGoldenBloomActive(state.pollination) || isGoldenBloomActive(pollination);
  next = progressCapstone(
    next,
    totalManaPerSecond(next) * frenzyMultiplier(frenzy) * bloom,
    frenziedDuringStep,
    goldenDuringStep
  ).state;

  // Seasons 3-4 have no designed capstone yet, so readiness alone advances them
  // (docs/04 item 4). Seasons 1 and 2 go through the real challenges above.
  // Lifetime Mana and Season gates can open a tier without a purchase, so the
  // high-water mark is refreshed on every step too.
  return recordUnlocks(clearPlaceholderCapstone(next));
}

/** Bank Seeds a Bloom paid out, honouring §2a's Satchel cap. */
function addSeeds(
  state: GameState,
  seeds: number,
  satchelBonus: number
): GameState['kitchenGarden'] {
  if (seeds <= 0) return state.kitchenGarden;
  const capacity = satchelCapacity(satchelBonus);
  const banked = Math.min(capacity, state.kitchenGarden.seeds + seeds);
  if (banked === state.kitchenGarden.seeds) return state.kitchenGarden;
  return { ...state.kitchenGarden, seeds: banked };
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
  const effects = effectsOf(state);
  const frenzy = addFrenzyClick(state.frenzy, effects.frenzyBonusSeconds);
  const triggeredFrenzy = frenzy.remainingSeconds > state.frenzy.remainingSeconds;
  const bloom = bloomMultiplier(state.pollination, effects.pollinationBloomBonus);
  const gained = clickYield(state, 0, frenzyMultiplier(frenzy) * bloom);

  const clicked: GameState = {
    ...state,
    frenzy,
    mana: state.mana + gained,
    lifetimeMana: state.lifetimeMana + gained,
  };

  return { state: claimMilestones(clicked).state, gained, triggeredFrenzy };
}

export interface PollinateOutcome {
  readonly state: GameState;
  /** The Bloom this click landed, if any. Drives the UI's celebration. */
  readonly landed: PollinationTier | null;
}

/**
 * Click one of §6.1's three flowers.
 *
 * Deliberately separate from `clickBell`: the two are different verbs with
 * different rewards, and letting a flower fill the Frenzy meter would collapse
 * §6.1's pattern mechanic back into "click faster", which is the exact thing it
 * exists to be distinct from.
 */
export function pollinateFlower(state: GameState, flower: FlowerType): PollinateOutcome {
  if (!isPollinationUnlocked(state.season)) return { state, landed: null };

  const effects = effectsOf(state);
  const result = pollinate(state.pollination, flower, {
    windowBonusSeconds: effects.pollinationWindowSeconds,
  });

  const next: GameState = {
    ...state,
    pollination: result.pollination,
    kitchenGarden: addSeeds(state, result.seeds, effects.satchelBonus),
  };

  return { state: claimMilestones(next).state, landed: result.landed };
}
