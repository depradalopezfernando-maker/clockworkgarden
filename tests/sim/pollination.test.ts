import { describe, it, expect } from 'vitest';
import {
  FLOWERS,
  GOLDEN_CHAIN,
  activeBloom,
  bloomForChain,
  bloomMultiplier,
  expectedDroneMultiplier,
  initialPollination,
  isGoldenBloomActive,
  isPollinationUnlocked,
  pollinate,
  runDrone,
  tickPollination,
  type FlowerType,
  type PollinationState,
} from '@sim/pollination';
import {
  POLLINATION_CHAIN_WINDOW_SECONDS,
  POLLINATION_DRONE_ATTEMPT_SECONDS,
  POLLINATION_DRONE_SUCCESS_RATE,
  POLLINATION_TIERS,
} from '@content/balance';

/** Click flowers in rotation, so every click is a different type. */
function chain(links: number, from = initialPollination()): PollinationState {
  let p = from;
  for (let i = 0; i < links; i++) {
    p = pollinate(p, FLOWERS[i % FLOWERS.length] as FlowerType).pollination;
  }
  return p;
}

describe('§6.1 — the chain', () => {
  it('extends on a DIFFERENT flower within the window', () => {
    const p = chain(2);
    expect(p.chain).toBe(2);
  });

  it('breaks on the SAME flower twice in a row', () => {
    let p = pollinate(initialPollination(), 'sunflower').pollination;
    p = pollinate(p, 'lavender').pollination;
    expect(p.chain).toBe(2);
    // The repeat resets to 0 and then lands as the first link of a new chain.
    p = pollinate(p, 'lavender').pollination;
    expect(p.chain).toBe(1);
    expect(p.lastFlower).toBe('lavender');
  });

  it('breaks when the window lapses', () => {
    let p = chain(2);
    p = tickPollination(p, POLLINATION_CHAIN_WINDOW_SECONDS + 0.01);
    expect(p.chain).toBe(0);
    expect(p.lastFlower).toBeNull();
  });

  it('survives right up to the edge of the window', () => {
    let p = chain(2);
    p = tickPollination(p, POLLINATION_CHAIN_WINDOW_SECONDS - 0.01);
    expect(p.chain).toBe(2);
    expect(pollinate(p, 'poppy').pollination.chain).toBe(3);
  });

  it('honours the Insight tree widening the window', () => {
    let p = pollinate(initialPollination(), 'sunflower', { windowBonusSeconds: 2 }).pollination;
    p = tickPollination(p, POLLINATION_CHAIN_WINDOW_SECONDS + 1);
    expect(p.chain).toBe(1);
  });

  it('records the longest chain ever landed, and never lowers it', () => {
    let p = chain(6);
    expect(p.bestChain).toBe(6);
    p = tickPollination(p, 60);
    p = chain(2, p);
    expect(p.bestChain).toBe(6);
  });
});

describe('§6.1 — the Blooms', () => {
  it('grants each tier at exactly the chain length the spec tabulates', () => {
    for (const tier of POLLINATION_TIERS) {
      const p = chain(tier.chain);
      expect(activeBloom(p)?.name, `chain ${tier.chain}`).toBe(tier.name);
    }
  });

  it('grants nothing at a chain length between the milestones', () => {
    expect(bloomForChain(2)).toBe(-1);
    expect(bloomForChain(4)).toBe(-1);
    expect(bloomForChain(7)).toBe(-1);
  });

  it('multiplies Mana by 1 + the tier bonus, and by 1 when nothing is up', () => {
    expect(bloomMultiplier(initialPollination())).toBe(1);
    const golden = POLLINATION_TIERS[POLLINATION_TIERS.length - 1];
    expect(bloomMultiplier(chain(GOLDEN_CHAIN))).toBeCloseTo(1 + (golden?.bonus ?? 1), 10);
  });

  it('adds the Insight tree bonus to the BONUS, not to the multiplier', () => {
    // A node reading "+10% Bloom strength" must add the same ten points to a
    // Bronze and a Golden, not four times more to the Golden.
    const bronze = bloomMultiplier(chain(3), 0.1) - bloomMultiplier(chain(3));
    const golden = bloomMultiplier(chain(GOLDEN_CHAIN), 0.1) - bloomMultiplier(chain(GOLDEN_CHAIN));
    expect(bronze).toBeCloseTo(0.1, 10);
    expect(golden).toBeCloseTo(0.1, 10);
  });

  it('expires after its stated duration', () => {
    const tier = POLLINATION_TIERS[0];
    let p = chain(3);
    p = tickPollination(p, (tier?.durationSeconds ?? 15) - 0.01);
    expect(activeBloom(p)).not.toBeNull();
    p = tickPollination(p, 0.02);
    expect(activeBloom(p)).toBeNull();
    expect(bloomMultiplier(p)).toBe(1);
  });

  it('never DOWNGRADES an active Bloom', () => {
    // Landing a Bronze while a Golden still has time on it must not halve the
    // player's multiplier as a reward for starting a fresh chain.
    let p = chain(GOLDEN_CHAIN);
    expect(isGoldenBloomActive(p)).toBe(true);
    p = tickPollination(p, 1);
    p = chain(3, p);
    expect(isGoldenBloomActive(p)).toBe(true);
  });

  it('pays a Seed for a Golden Bloom and nothing for the lesser tiers', () => {
    let seeds = 0;
    let p = initialPollination();
    for (let i = 0; i < GOLDEN_CHAIN; i++) {
      const result = pollinate(p, FLOWERS[i % FLOWERS.length] as FlowerType);
      p = result.pollination;
      seeds += result.seeds;
    }
    expect(seeds).toBe(POLLINATION_TIERS[POLLINATION_TIERS.length - 1]?.seeds ?? 1);
  });

  it('SCATTERS the chain when the Golden Bloom lands', () => {
    // Otherwise the peak of the Season is either permanent (if a long chain
    // keeps paying) or the optimal play is to stop clicking (if it does not).
    const p = chain(GOLDEN_CHAIN);
    expect(p.chain).toBe(0);
    expect(p.lastFlower).toBeNull();
    expect(p.bestChain).toBe(GOLDEN_CHAIN);
  });
});

describe('§6.1 — the Tier 8 drone', () => {
  const enabled = { enabled: true };

  it('does nothing when Tier 8 is unowned', () => {
    const p = initialPollination();
    expect(runDrone(p, 60, { enabled: false }).pollination).toBe(p);
  });

  it('NEVER touches a chain the player is driving', () => {
    // A 60%-likely drone failure that broke a human's eight-link chain would
    // invert §6.1's own guardrail: automation would be sabotaging active play.
    const player = chain(8);
    const after = runDrone(player, 30, enabled).pollination;
    expect(after.chain).toBe(8);
    expect(after.driver).toBe('player');
  });

  it('picks up a chain the player has let lapse', () => {
    let p = tickPollination(chain(4), POLLINATION_CHAIN_WINDOW_SECONDS + 1);
    expect(p.chain).toBe(0);
    for (let i = 0; i < 400; i++) {
      p = runDrone(p, POLLINATION_DRONE_ATTEMPT_SECONDS, enabled).pollination;
    }
    expect(p.driver).toBe('drone');
    expect(p.bestChain).toBeGreaterThan(4);
  });

  it('is deterministic — the same seed replays the same luck', () => {
    const a = runDrone(initialPollination(), 300, enabled).pollination;
    const b = runDrone(initialPollination(), 300, enabled).pollination;
    expect(a).toEqual(b);
  });

  it('makes one attempt per interval however long the step is', () => {
    // Offline catch-up and slow frames hand this steps far longer than the
    // interval; a drone that made one attempt per call would stall on a laggy
    // machine and behave differently on a fast one.
    const long = runDrone(initialPollination(), 20, enabled).pollination;
    let short = initialPollination();
    for (let i = 0; i < 200; i++) short = runDrone(short, 0.1, enabled).pollination;
    expect(long.droneSeed).toBe(short.droneSeed);
  });

  it('lands roughly the success rate it advertises', () => {
    // 3000 attempts. The LCG is fixed, so this is a regression on the sampler
    // rather than a statistical test that could flake.
    let p = initialPollination();
    let attempts = 0;
    let landed = 0;
    for (let i = 0; i < 3000; i++) {
      const before = p.chain;
      p = runDrone(p, POLLINATION_DRONE_ATTEMPT_SECONDS, enabled).pollination;
      attempts++;
      if (p.chain > before) landed++;
    }
    expect(landed / attempts).toBeGreaterThan(POLLINATION_DRONE_SUCCESS_RATE - 0.05);
    expect(landed / attempts).toBeLessThan(POLLINATION_DRONE_SUCCESS_RATE + 0.05);
  });

  it('essentially never reaches a Golden Bloom on its own', () => {
    // Nine straight successes at 40% is 0.026%. This is the property that makes
    // D4b's capstone a test of the PLAYER rather than of Tier 8 ownership.
    let p = initialPollination();
    for (let i = 0; i < 2000; i++) {
      p = runDrone(p, POLLINATION_DRONE_ATTEMPT_SECONDS, enabled).pollination;
      expect(isGoldenBloomActive(p)).toBe(false);
    }
  });
});

describe('the closed-form drone value matches the drone that actually runs', () => {
  it('agrees with a long simulated run', () => {
    // The balance harness prices the drone analytically rather than rolling it,
    // so the two must not be allowed to drift. Measure the real thing's average
    // multiplier over an hour of unattended play and compare.
    const dt = POLLINATION_DRONE_ATTEMPT_SECONDS / 4;
    let p = initialPollination();
    let total = 0;
    let steps = 0;
    for (let i = 0; i < 60 * 60 * (1 / dt); i++) {
      p = tickPollination(p, dt);
      p = runDrone(p, dt, { enabled: true }).pollination;
      total += bloomMultiplier(p);
      steps++;
    }
    const measured = total / steps;
    expect(measured).toBeCloseTo(expectedDroneMultiplier(), 1);
  });

  it('rises with the success rate, steeply', () => {
    // The rate enters the payoff at the chain length's power, which is why the
    // Insight nodes that raise it are worth 5 points and not 15.
    const bonusAt = (rate: number) => expectedDroneMultiplier(rate) - 1;
    expect(bonusAt(0.5)).toBeGreaterThan(bonusAt(0.4) * 1.5);
    expect(bonusAt(0.7)).toBeGreaterThan(bonusAt(0.5) * 2);
  });

  it('never claims more than a permanently-held Golden Bloom', () => {
    const ceiling = 1 + (POLLINATION_TIERS[POLLINATION_TIERS.length - 1]?.bonus ?? 1);
    for (const rate of [0.4, 0.6, 0.8, 0.95, 1]) {
      expect(expectedDroneMultiplier(rate), `rate ${rate}`).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe('PHASE 7 EXIT — §6.1’s guardrail: active play beats the drone', () => {
  it('an engaged player out-earns full automation by a wide margin', () => {
    // §6.1: "idle players still benefit, but a player actively managing the
    // pattern reliably outperforms it". A player holding the Golden Bloom is at
    // the ceiling; the drone, even with BOTH Insight nodes bought, is not close.
    const engaged = 1 + (POLLINATION_TIERS[POLLINATION_TIERS.length - 1]?.bonus ?? 1);
    const droneFullyUpgraded = expectedDroneMultiplier(POLLINATION_DRONE_SUCCESS_RATE + 0.1);

    expect(droneFullyUpgraded).toBeGreaterThan(1); // the drone is worth something
    expect(engaged).toBeGreaterThan(droneFullyUpgraded * 1.5);
  });
});

describe('the Season gate', () => {
  it('is inert before Season 2 and live from Season 2', () => {
    expect(isPollinationUnlocked(1)).toBe(false);
    for (const season of [2, 3, 4]) expect(isPollinationUnlocked(season)).toBe(true);
  });
});
