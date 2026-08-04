import { describe, it, expect } from 'vitest';
import { advance, clickBell, pollinateFlower } from '@sim/tick';
import {
  FLOWERS,
  GOLDEN_CHAIN,
  bloomMultiplier,
  runDrone,
  tickPollination,
  type FlowerType,
  type PollinationState,
} from '@sim/pollination';
import { totalManaPerSecond } from '@sim/economy';
import { satchelCapacity } from '@sim/kitchenGarden';
import { prestige } from '@sim/prestige';
import { initialState, type GameState } from '@sim/state';
import { CLICKS_TO_FILL } from '@sim/frenzy';
import { FRENZY_MULTIPLIER, POLLINATION_TIERS } from '@content/balance';
import { TIER_COUNT } from '@content/generators';

/** A Season 2 garden that produces something measurable. */
function summer(extra: Partial<GameState> = {}): GameState {
  const owned = new Array<number>(TIER_COUNT).fill(0);
  owned[0] = 40;
  owned[1] = 20;
  return { ...initialState(), owned, season: 2, capstonesCleared: [1], ...extra };
}

function chainTo(state: GameState, links: number): GameState {
  let s = state;
  for (let i = 0; i < links; i++) {
    s = pollinateFlower(s, FLOWERS[i % FLOWERS.length] as FlowerType).state;
  }
  return s;
}

describe('§6.1 Blooms in the economy', () => {
  it('multiply production while one is up', () => {
    const base = summer();
    const rate = totalManaPerSecond(base);

    const bloomed = chainTo(base, 3);
    const earned = advance(bloomed, 1).mana - bloomed.mana;
    const bronze = POLLINATION_TIERS[0];
    expect(earned).toBeCloseTo(rate * (1 + (bronze?.bonus ?? 0.25)), 6);
  });

  it('STACK with a Growth Frenzy — §6.1’s stated peak moment', () => {
    // Multiplicative, not additive: a Golden Bloom inside a Frenzy is x4.
    let state = summer();
    for (let i = 0; i < CLICKS_TO_FILL; i++) state = clickBell(state).state;
    const rate = totalManaPerSecond(state);

    state = chainTo(state, GOLDEN_CHAIN);
    const golden = POLLINATION_TIERS[POLLINATION_TIERS.length - 1];
    const earned = advance(state, 1).mana - state.mana;

    expect(earned).toBeCloseTo(rate * FRENZY_MULTIPLIER * (1 + (golden?.bonus ?? 1)), 6);
  });

  it('lift the Bell’s yield too, so the two verbs agree', () => {
    const plain = summer();
    const bloomed = chainTo(plain, 3);
    const plainGain = clickBell(plain).gained;
    const bloomedGain = clickBell(bloomed).gained;
    expect(bloomedGain / plainGain).toBeCloseTo(bloomMultiplier(bloomed.pollination), 10);
  });

  it('do nothing at all before Season 2', () => {
    const spring = { ...summer(), season: 1, capstonesCleared: [] };
    const clicked = pollinateFlower(spring, 'sunflower');
    expect(clicked.state).toBe(spring);
    expect(clicked.landed).toBeNull();
  });
});

describe('§6.1 Seeds', () => {
  it('bank a Golden Bloom’s Seed into the Kitchen Garden', () => {
    const state = { ...summer(), kitchenGarden: { ...summer().kitchenGarden, seeds: 0 } };
    const after = chainTo(state, GOLDEN_CHAIN);
    expect(after.kitchenGarden.seeds).toBe(POLLINATION_TIERS[POLLINATION_TIERS.length - 1]?.seeds);
  });

  it('respect §2a’s Satchel cap rather than overfilling it', () => {
    const capacity = satchelCapacity(0);
    const state = {
      ...summer(),
      kitchenGarden: { ...summer().kitchenGarden, seeds: capacity },
    };
    const after = chainTo(state, GOLDEN_CHAIN);
    expect(after.kitchenGarden.seeds).toBe(capacity);
  });
});

describe('§6.1 and prestige', () => {
  it('keeps the record and the drone seed, and drops the chain', () => {
    // `bestChain` feeds milestones. If it reset, every Turn of the Soil would
    // re-pay the chain milestones and the Insight tree would become free - the
    // same failure `claimedMilestones` exists to prevent.
    let state = summer({ lifetimeMana: 1e9, capstonesCleared: [1] });
    state = chainTo(state, GOLDEN_CHAIN);
    const seed = state.pollination.droneSeed;

    const after = prestige(state);
    expect(after.pollination.bestChain).toBe(GOLDEN_CHAIN);
    expect(after.pollination.droneSeed).toBe(seed);
    expect(after.pollination.chain).toBe(0);
    expect(after.pollination.bloomRemaining).toBe(0);
  });
});

describe('the drone in the running game', () => {
  it('stays out of the way until Tier 8 is owned', () => {
    let state = summer();
    for (let i = 0; i < 600; i++) state = advance(state, 0.1);
    expect(state.pollination.bestChain).toBe(0);
  });

  it('works the chain once Tier 8 is owned', () => {
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[0] = 40;
    owned[7] = 1;
    let state = summer({ owned });
    for (let i = 0; i < 3000; i++) state = advance(state, 0.1);
    expect(state.pollination.bestChain).toBeGreaterThanOrEqual(3);
    expect(state.pollination.driver).toBe('drone');
  });

  it('attempts at the advertised cadence, not twice it', () => {
    // `tickPollination` and `runDrone` both used to decrement the cooldown, and
    // `advance` calls them back to back - so the drone ran at double speed.
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[7] = 1;
    let live = summer({ owned });
    for (let i = 0; i < 1200; i++) live = advance(live, 0.1);

    let raw = summer({ owned }).pollination;
    for (let i = 0; i < 1200; i++) {
      raw = advanceDroneOnly(raw);
    }
    expect(live.pollination.droneSeed).toBe(raw.droneSeed);
  });
});

/** The drone alone, stepped at the sim tick, with no economy attached. */
function advanceDroneOnly(p: PollinationState): PollinationState {
  return runDrone(tickPollination(p, 0.1), 0.1, { enabled: true }).pollination;
}
