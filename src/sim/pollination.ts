/**
 * pollination.ts — §6.1 Pollination Combo, Season 2's mechanic.
 *
 * A pattern/rhythm layer on top of Growth Frenzy: click a DIFFERENT flower than
 * the last one within the chain window and the chain extends; repeat a flower or
 * let the window lapse and it breaks. Chains of 3, 6 and 9 grant timed Blooms
 * that multiply Mana, and a Bloom STACKS with a Frenzy — §6.1 names that
 * combination the Season's peak moment, so the two multipliers multiply.
 *
 * Pure (ADR-0002). Time arrives as `dt`; nothing here reads a clock.
 *
 * THE DRONE. §6.1's automation catch-up is the Tier 8 Pollinator Drone Swarm,
 * which auto-attempts chains at ~40%. Two decisions make that safe to model:
 *
 *   1. The drone only ever works an IDLE chain. It cannot touch a chain the
 *      player is driving, so a 60%-likely drone failure can never break a chain
 *      a human is nine clicks into. Automation that could sabotage active play
 *      would invert §6.1's own guardrail.
 *   2. Its coin flips come from an LCG seeded IN STATE, not `Math.random`. Same
 *      save, same sequence — the sim boundary holds, saves stay reproducible,
 *      and the balance harness measures the drone the players actually get.
 */

import {
  POLLINATION_CHAIN_WINDOW_SECONDS,
  POLLINATION_DRONE_ATTEMPT_SECONDS,
  POLLINATION_DRONE_SUCCESS_RATE,
  POLLINATION_SEASON,
  POLLINATION_TIERS,
} from '@content/balance';

/** SPEC §6.1. The three clickable flowers. Order is the UI's reading order. */
export const FLOWERS = ['sunflower', 'lavender', 'poppy'] as const;
export type FlowerType = (typeof FLOWERS)[number];

export interface PollinationState {
  /** Links in the chain right now. 0 means no chain is running. */
  readonly chain: number;
  /** The flower that landed the last link. Clicking it again breaks the chain. */
  readonly lastFlower: FlowerType | null;
  /** Seconds left to land the next link before the chain lapses. */
  readonly windowRemaining: number;
  /**
   * Who is working the chain. The drone never takes a chain away from a player,
   * and a player may always take one over from the drone.
   */
  readonly driver: 'player' | 'drone';
  /** Index into `POLLINATION_TIERS`, or -1 when no Bloom is up. */
  readonly bloomTier: number;
  readonly bloomRemaining: number;
  /** Longest chain ever landed. Survives prestige; feeds milestones and the UI. */
  readonly bestChain: number;
  /** Seconds until the drone's next unattended attempt. */
  readonly droneCooldown: number;
  /** LCG state for the drone's coin flips. Serialized, so a save replays exactly. */
  readonly droneSeed: number;
}

/**
 * Any 32-bit value works; this one is arbitrary. It is a CONSTANT rather than
 * something derived from the player's progress on purpose — a seed that moved
 * with state would make the drone's luck depend on when Season 2 happened to
 * start, and two identical saves would then diverge.
 */
const DRONE_SEED_INITIAL = 0x5eed1e55;

export function initialPollination(): PollinationState {
  return {
    chain: 0,
    lastFlower: null,
    windowRemaining: 0,
    driver: 'player',
    bloomTier: -1,
    bloomRemaining: 0,
    bestChain: 0,
    droneCooldown: POLLINATION_DRONE_ATTEMPT_SECONDS,
    droneSeed: DRONE_SEED_INITIAL,
  };
}

/** §6.1: "Three flower types are unlocked at the start of Season 2." */
export function isPollinationUnlocked(season: number): boolean {
  return season >= POLLINATION_SEASON;
}

export type PollinationTier = (typeof POLLINATION_TIERS)[number];

export function activeBloom(p: PollinationState): PollinationTier | null {
  if (p.bloomRemaining <= 0) return null;
  return POLLINATION_TIERS[p.bloomTier] ?? null;
}

/**
 * The Mana multiplier from an active Bloom, or 1.
 *
 * `bonusBoost` is the Insight tree's additive top-up: 0.1 turns a Bronze Bloom's
 * +25% into +35%. It scales the BONUS, not the multiplier, so a node that reads
 * "+10% Bloom strength" adds the same ten points to every tier rather than
 * quietly being worth four times more on a Golden.
 */
export function bloomMultiplier(p: PollinationState, bonusBoost = 0): number {
  const tier = activeBloom(p);
  return tier ? 1 + tier.bonus + bonusBoost : 1;
}

/** True while a Golden Bloom is up — the condition D4b's capstone tests. */
export function isGoldenBloomActive(p: PollinationState): boolean {
  return activeBloom(p)?.name === 'Golden Bloom';
}

/** The Bloom a chain of exactly `chain` links earns, or -1 for none. */
export function bloomForChain(chain: number): number {
  return POLLINATION_TIERS.findIndex((tier) => tier.chain === chain);
}

/** The chain length §6.1's top Bloom needs. Landing it scatters the chain. */
export const GOLDEN_CHAIN = POLLINATION_TIERS[POLLINATION_TIERS.length - 1]?.chain ?? 9;

export interface PollinateOptions {
  /** Added to `POLLINATION_CHAIN_WINDOW_SECONDS` by the Insight tree. */
  readonly windowBonusSeconds?: number;
}

export interface PollinateResult {
  readonly pollination: PollinationState;
  /** Seeds this click earned (§6.1: a Golden Bloom pays 1). */
  readonly seeds: number;
  /** The Bloom this click landed, if any — for celebration in the UI. */
  readonly landed: PollinationTier | null;
}

/**
 * Click a flower.
 *
 * §6.1 says a repeat or a lapse "resets the chain to 0". It does — and then this
 * click lands as the first link of the new one, so the chain reads 1 rather than
 * leaving the player with a dead click they have to spend again to get going.
 * Both readings agree on the punishment; this one does not also make the UI show
 * a 0 that the very next frame contradicts.
 */
export function pollinate(
  p: PollinationState,
  flower: FlowerType,
  options: PollinateOptions = {}
): PollinateResult {
  const alive = p.windowRemaining > 0 && p.chain > 0;
  const extends_ = alive && p.lastFlower !== flower;
  const chain = extends_ ? p.chain + 1 : 1;

  return land(p, chain, flower, 'player', options.windowBonusSeconds ?? 0);
}

/** Shared by the player and the drone: record a link and grant any Bloom. */
function land(
  p: PollinationState,
  chain: number,
  flower: FlowerType,
  driver: 'player' | 'drone',
  windowBonusSeconds: number
): PollinateResult {
  const earned = bloomForChain(chain);
  const tier = earned >= 0 ? POLLINATION_TIERS[earned] : undefined;

  // A new Bloom never DOWNGRADES an active one: landing a Bronze while a Golden
  // still has ten seconds on it must not cut the player's multiplier in half for
  // starting a fresh chain.
  const replaces = tier !== undefined && (p.bloomRemaining <= 0 || earned >= p.bloomTier);

  // The Golden Bloom SCATTERS the chain that earned it. §6.1's table stops at
  // nine and says nothing about ten, which leaves two bad readings: a chain that
  // keeps paying past nine makes the Season's peak trivially permanent, and one
  // that pays nothing past nine makes the optimal play "stop clicking". Cashing
  // the chain in restores the rhythm the mechanic is named for — build nine,
  // bloom, build nine again — and puts a real ceiling on Golden uptime at nine
  // clicks per twenty seconds.
  const scatters = chain >= GOLDEN_CHAIN;

  return {
    pollination: {
      ...p,
      chain: scatters ? 0 : chain,
      lastFlower: scatters ? null : flower,
      windowRemaining: scatters ? 0 : POLLINATION_CHAIN_WINDOW_SECONDS + windowBonusSeconds,
      driver,
      bloomTier: replaces && tier ? earned : p.bloomTier,
      bloomRemaining: replaces && tier ? tier.durationSeconds : p.bloomRemaining,
      bestChain: Math.max(p.bestChain, chain),
    },
    seeds: replaces && tier ? tier.seeds : 0,
    landed: replaces && tier ? tier : null,
  };
}

/** Advance Bloom and window timers by `dt` seconds. */
export function tickPollination(p: PollinationState, dt: number): PollinationState {
  if (!(dt > 0)) return p;

  const bloomRemaining = Math.max(0, p.bloomRemaining - dt);
  const windowRemaining = Math.max(0, p.windowRemaining - dt);

  // A lapsed window ends the chain. `lastFlower` clears with it, so the flower
  // that ended one chain is not also barred from starting the next.
  const lapsed = windowRemaining <= 0;

  return {
    ...p,
    chain: lapsed ? 0 : p.chain,
    lastFlower: lapsed ? null : p.lastFlower,
    windowRemaining,
    bloomTier: bloomRemaining > 0 ? p.bloomTier : -1,
    bloomRemaining,
    // `droneCooldown` is NOT ticked here. `runDrone` owns it and decrements it
    // by the same `dt`; doing it in both places made the drone attempt twice as
    // often as `POLLINATION_DRONE_ATTEMPT_SECONDS` says, because `advance` calls
    // them back to back on one step.
  };
}

export interface DroneOptions {
  /** False when Tier 8 is unowned, or the Season has not started. */
  readonly enabled: boolean;
  /** Added to `POLLINATION_DRONE_SUCCESS_RATE` by the Insight tree. */
  readonly successBonus?: number;
  readonly windowBonusSeconds?: number;
}

/**
 * Run the Tier 8 drone swarm for `dt` seconds.
 *
 * Attempts are made on a fixed cadence and each is an independent coin flip. A
 * failure resets the drone's chain, which is why 40% is worth so much less than
 * it sounds: reaching nine links needs nine straight successes, or 0.026%.
 */
export function runDrone(p: PollinationState, dt: number, options: DroneOptions): PollinateResult {
  if (!options.enabled || !(dt > 0)) return { pollination: p, seeds: 0, landed: null };

  // The player owns any chain they are currently working. The drone only picks
  // up a chain that has gone quiet.
  const playerIsDriving = p.driver === 'player' && p.windowRemaining > 0 && p.chain > 0;
  if (playerIsDriving) return { pollination: p, seeds: 0, landed: null };

  let state = p;
  let seeds = 0;
  let landed: PollinationTier | null = null;
  let cooldown = p.droneCooldown - dt;

  // A loop, not a single check: offline catch-up and slow frames hand this
  // function steps far longer than the attempt interval, and a drone that made
  // one attempt per call would quietly stop working on a laggy machine.
  // Bounded so a pathological `dt` cannot spin here.
  const rate = POLLINATION_DRONE_SUCCESS_RATE + (options.successBonus ?? 0);
  for (let attempts = 0; cooldown <= 0 && attempts < 64; attempts++) {
    cooldown += POLLINATION_DRONE_ATTEMPT_SECONDS;

    const seed = nextSeed(state.droneSeed);
    const succeeded = seed / 0x1_0000_0000 < rate;
    state = { ...state, droneSeed: seed };

    if (!succeeded) {
      state = { ...state, chain: 0, lastFlower: null, windowRemaining: 0, driver: 'drone' };
      continue;
    }

    // Deterministic flower choice: whichever is not the last one. The drone is
    // not being tested on variety, only on landing the attempt.
    const flower = nextFlower(state.lastFlower);
    const result = land(state, state.chain + 1, flower, 'drone', options.windowBonusSeconds ?? 0);
    state = result.pollination;
    seeds += result.seeds;
    landed = result.landed ?? landed;
  }

  return { pollination: { ...state, droneCooldown: Math.max(0, cooldown) }, seeds, landed };
}

/** Numerical Recipes' LCG. Small, fast, and adequate for a 40% coin flip. */
function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function nextFlower(last: FlowerType | null): FlowerType {
  const index = last === null ? 0 : (FLOWERS.indexOf(last) + 1) % FLOWERS.length;
  return FLOWERS[index] ?? 'sunflower';
}

// ---------------------------------------------------------------------------
// Analytic drone value — for the balance harness and the §6.1 guardrail test
// ---------------------------------------------------------------------------

/**
 * The average Mana multiplier an unattended drone is worth.
 *
 * Simulating the drone inside the balance harness would work but would make a
 * campaign's length depend on the LCG's luck over six hours, which is not a
 * property anyone wants to tune against. The closed form is exact enough and
 * costs nothing.
 *
 * Derivation. Attempts arrive every `attemptSeconds`; each succeeds with
 * probability `p`, a failure resets the chain, and reaching `GOLDEN_CHAIN`
 * scatters it. That is a Markov chain over lengths 0..GOLDEN_CHAIN-1 whose
 * stationary distribution is geometric: the chain stands at `n` with
 * probability `p^n (1-p) / (1 - p^GOLDEN_CHAIN)`. A chain of length `n` is
 * therefore LANDED at that same probability per attempt. Multiply by each
 * Bloom's duration for its uptime, and by its bonus for its contribution.
 *
 * Overlap is handled, not ignored. Only the HIGHEST Bloom running applies, so
 * each tier's contribution is discounted by the chance a better one is up. At
 * the stock 40% that correction is worth about a point; with the Insight tree's
 * drone nodes bought the Bronze uptime alone passes 45% and ignoring overlap
 * would inflate the drone by half, which is exactly where the §6.1 guardrail
 * would stop meaning anything.
 */
export function expectedDroneMultiplier(
  successRate = POLLINATION_DRONE_SUCCESS_RATE,
  attemptSeconds = POLLINATION_DRONE_ATTEMPT_SECONDS
): number {
  if (!(successRate > 0) || !(attemptSeconds > 0)) return 1;

  const golden = POLLINATION_TIERS[POLLINATION_TIERS.length - 1];
  // A drone that never misses holds the top Bloom permanently — and the
  // geometric normaliser below divides by zero there.
  if (successRate >= 1) return 1 + (golden?.bonus ?? 1);

  const normaliser = 1 - Math.pow(successRate, GOLDEN_CHAIN);

  const uptimes = POLLINATION_TIERS.map((tier) => {
    const perAttempt = (Math.pow(successRate, tier.chain) * (1 - successRate)) / normaliser;
    return Math.min(1, (perAttempt / attemptSeconds) * tier.durationSeconds);
  });

  let bonus = 0;
  for (let index = 0; index < POLLINATION_TIERS.length; index++) {
    const tier = POLLINATION_TIERS[index];
    if (!tier) continue;
    // Discount by the chance a HIGHER Bloom is masking this one.
    let exposed = uptimes[index] ?? 0;
    for (let above = index + 1; above < uptimes.length; above++)
      exposed *= 1 - (uptimes[above] ?? 0);
    bonus += tier.bonus * exposed;
  }

  return 1 + bonus;
}
