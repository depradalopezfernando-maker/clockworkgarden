import { describe, it, expect } from 'vitest';
import {
  addSlot,
  applySurface,
  canPerform,
  clearPlot,
  dayLengthSeconds,
  effectiveLevel,
  emptyPlot,
  fullBuildOut,
  initialKitchenGarden,
  kitchenGardenMultiplier,
  performStep,
  plotUnits,
  satchelCapacity,
  slotCap,
  slotCost,
  stepCostSeconds,
  tickKitchenGarden,
  type KitchenGardenState,
  type PlotStep,
} from '@sim/kitchenGarden';
import { advance, clickBell } from '@sim/tick';
import type { AutomationLevels } from '@sim/insight';
import { totalManaPerSecond, clickYield } from '@sim/economy';
import { frenzyMultiplier } from '@sim/frenzy';
import { initialState, type GameState } from '@sim/state';
import {
  AUTOMATION_STEP_SECONDS,
  DAY_LENGTH_SECONDS_BY_UPGRADE,
  KG_BASE_GROW_SECONDS,
  KG_MAX_SLOTS,
  KG_STARTING_SLOTS,
  NIGHT_DURATION_SECONDS,
  PERFECT_PLANTING_MULTIPLIER,
  SEASON_TRANSITION_LEGACY_FRACTION,
  SEED_REGEN_SECONDS,
  SEED_SATCHEL_BASE_CAPACITY,
} from '@content/balance';
import { TIER_COUNT } from '@content/generators';

const MANUAL = { dig: 0, plant: 0, cover: 0 } as const;
const LEVEL_1 = { dig: 1, plant: 1, cover: 1 } as const;
const LEVEL_2 = { dig: 2, plant: 2, cover: 2 } as const;

const ctx = (nowSeconds = 0, levels: AutomationLevels = MANUAL, season = 1) => ({
  levels,
  season,
  nowSeconds,
});
const tickCtx = (nowSeconds = 0) => ({
  dayLengthStep: 0,
  hasShortNight: false,
  satchelBonus: 0,
  nowSeconds,
});

const CYCLE: readonly PlotStep[] = ['dig', 'plant', 'cover'];

/** Run a full Dig/Plant/Cover on plot 0, all at `now`. */
function runCycle(kg: KitchenGardenState, now = 0, levels: AutomationLevels = MANUAL, season = 1) {
  let current = kg;
  let perfect = false;
  for (const step of CYCLE) {
    const outcome = performStep(current, 0, step, ctx(now, levels, season));
    current = outcome.kg;
    perfect = outcome.perfect || perfect;
  }
  return { kg: current, perfect };
}

describe('the starting garden', () => {
  it('opens with four slots, a full Satchel and a full Day', () => {
    const kg = initialKitchenGarden();
    expect(kg.plots).toHaveLength(KG_STARTING_SLOTS);
    expect(kg.seeds).toBe(SEED_SATCHEL_BASE_CAPACITY);
    expect(kg.dayTimeRemaining).toBe(DAY_LENGTH_SECONDS_BY_UPGRADE[0]);
    expect(kg.nightRemaining).toBe(0);
  });

  it('every plot starts bare and contributes nothing', () => {
    expect(kitchenGardenMultiplier(initialKitchenGarden(), ctx())).toBe(0);
  });
});

describe('§2a — the Dig → Plant → Cover sequence', () => {
  it('advances one stage per step, in order', () => {
    let kg = initialKitchenGarden();
    expect(kg.plots[0]!.stage).toBe('bare');
    kg = performStep(kg, 0, 'dig', ctx()).kg;
    expect(kg.plots[0]!.stage).toBe('dug');
    kg = performStep(kg, 0, 'plant', ctx()).kg;
    expect(kg.plots[0]!.stage).toBe('planted');
    kg = performStep(kg, 0, 'cover', ctx()).kg;
    expect(kg.plots[0]!.stage).toBe('growing');
  });

  it('refuses steps taken out of order', () => {
    const kg = initialKitchenGarden();
    expect(canPerform(kg, 0, 'plant', ctx())).toBe(false);
    expect(canPerform(kg, 0, 'cover', ctx())).toBe(false);
    expect(performStep(kg, 0, 'cover', ctx()).performed).toBe(false);
  });

  it('a full manual cycle costs 6 seconds of Day Time (§2a)', () => {
    const before = initialKitchenGarden();
    const { kg } = runCycle(before);
    expect(before.dayTimeRemaining - kg.dayTimeRemaining).toBe(6);
    expect(AUTOMATION_STEP_SECONDS[0] * 3).toBe(6);
  });

  it('consumes exactly one Seed per cycle', () => {
    const before = initialKitchenGarden();
    const { kg } = runCycle(before);
    expect(kg.seeds).toBe(before.seeds - 1);
  });

  it('cannot plant without a Seed', () => {
    let kg: KitchenGardenState = { ...initialKitchenGarden(), seeds: 0 };
    kg = performStep(kg, 0, 'dig', ctx()).kg;
    expect(canPerform(kg, 0, 'plant', ctx())).toBe(false);
  });

  it('refuses an out-of-range plot rather than throwing', () => {
    const kg = initialKitchenGarden();
    expect(() => performStep(kg, 99, 'dig', ctx())).not.toThrow();
    expect(performStep(kg, 99, 'dig', ctx()).performed).toBe(false);
  });

  it('does not mutate the input state', () => {
    const before = initialKitchenGarden();
    performStep(before, 0, 'dig', ctx());
    expect(before.plots[0]!.stage).toBe('bare');
    expect(before.dayTimeRemaining).toBe(DAY_LENGTH_SECONDS_BY_UPGRADE[0]);
  });
});

describe('§2a — Perfect Planting', () => {
  it('triggers when all three steps land inside the window', () => {
    expect(runCycle(initialKitchenGarden(), 0).perfect).toBe(true);
  });

  it('does NOT trigger when the cycle is taken slowly', () => {
    let kg = initialKitchenGarden();
    kg = performStep(kg, 0, 'dig', ctx(0)).kg;
    kg = performStep(kg, 0, 'plant', ctx(1)).kg;
    // Cover lands 5 seconds after the Dig — well past the 2s window.
    expect(performStep(kg, 0, 'cover', ctx(5)).perfect).toBe(false);
  });

  it('is never a penalty — a slow cycle still yields baseline (§2a)', () => {
    // "A 'no' on Perfect Planting just means baseline yield, never a penalty."
    let slow = initialKitchenGarden();
    slow = performStep(slow, 0, 'dig', ctx(0)).kg;
    slow = performStep(slow, 0, 'plant', ctx(1)).kg;
    slow = performStep(slow, 0, 'cover', ctx(5)).kg;
    slow = tickKitchenGarden(slow, KG_BASE_GROW_SECONDS + 10, tickCtx(200));
    expect(plotUnits(slow.plots[0]!, ctx(200))).toBe(1);
  });

  it('doubles the plot for its first productive minutes, then settles', () => {
    let kg = runCycle(initialKitchenGarden(), 0).kg;
    kg = tickKitchenGarden(kg, KG_BASE_GROW_SECONDS + 1, tickCtx(KG_BASE_GROW_SECONDS + 1));

    const plot = kg.plots[0]!;
    expect(plot.stage).toBe('grown');
    expect(plotUnits(plot, ctx(KG_BASE_GROW_SECONDS + 1))).toBe(PERFECT_PLANTING_MULTIPLIER);
    // Well past the bonus window.
    expect(plotUnits(plot, ctx(1e9))).toBe(1);
  });

  it('is forfeited by full automation, which is what keeps active play ahead', () => {
    // §2a: Level 2 "matches manual's baseline output, just without the skill
    // ceiling". If automation could also land Perfect Plantings, §9's "active
    // play beats automation" guardrail would be gone.
    expect(runCycle(initialKitchenGarden(), 0, LEVEL_2).perfect).toBe(false);
  });
});

describe('§2a — automation', () => {
  it('Level 1 halves the time cost', () => {
    const before = initialKitchenGarden();
    const { kg } = runCycle(before, 0, LEVEL_1);
    expect(before.dayTimeRemaining - kg.dayTimeRemaining).toBe(3);
  });

  it('Level 2 costs no Day Time at all — the plot becomes passive', () => {
    const before = initialKitchenGarden();
    const { kg } = runCycle(before, 0, LEVEL_2);
    expect(kg.dayTimeRemaining).toBe(before.dayTimeRemaining);
  });

  it('Level 1 trades a modest yield cost for the speed', () => {
    let manual = runCycle(initialKitchenGarden(), 0, MANUAL).kg;
    let assisted = runCycle(initialKitchenGarden(), 0, LEVEL_1).kg;
    const t = KG_BASE_GROW_SECONDS + 1;
    manual = tickKitchenGarden(manual, t, tickCtx(t));
    assisted = tickKitchenGarden(assisted, t, tickCtx(t));

    // Compare settled yield, past the Perfect Planting window.
    const late = 1e9;
    expect(plotUnits(assisted.plots[0]!, ctx(late, LEVEL_1))).toBeCloseTo(0.9, 6);
    expect(plotUnits(manual.plots[0]!, ctx(late, MANUAL))).toBe(1);
  });

  it('a Clockwork Trellis tends itself regardless of what the tree has bought', () => {
    const plot = emptyPlot('clockwork-trellis');
    expect(effectiveLevel(plot, 'dig', MANUAL)).toBe(2);
    expect(stepCostSeconds(plot, 'dig', MANUAL)).toBe(0);
  });

  it('never downgrades a surface that already automates', () => {
    const plot = emptyPlot('clockwork-trellis');
    expect(effectiveLevel(plot, 'cover', LEVEL_1)).toBe(2);
  });
});

describe('§2a — the Day/Night budget', () => {
  it('Day Time is SPEND-ONLY: it never ticks down on its own', () => {
    // This is the whole point of §2a's design and §9 lists the alternative -
    // a real-time energy gate - as a known failure mode by name.
    const kg = initialKitchenGarden();
    const idled = tickKitchenGarden(kg, 3600, tickCtx(3600));
    expect(idled.dayTimeRemaining).toBe(kg.dayTimeRemaining);
    expect(idled.nightRemaining).toBe(0);
  });

  it('Night falls only once Day Time is spent, and resolves itself', () => {
    let kg: KitchenGardenState = { ...initialKitchenGarden(), dayTimeRemaining: 0 };
    kg = tickKitchenGarden(kg, 0.1, tickCtx(0.1));
    expect(kg.nightRemaining).toBeGreaterThan(0);

    kg = tickKitchenGarden(kg, NIGHT_DURATION_SECONDS, tickCtx(10));
    expect(kg.nightRemaining).toBe(0);
    expect(kg.dayTimeRemaining).toBe(DAY_LENGTH_SECONDS_BY_UPGRADE[0]);
  });

  it('Night blocks new Kitchen Garden actions', () => {
    const kg: KitchenGardenState = { ...initialKitchenGarden(), nightRemaining: 3 };
    expect(canPerform(kg, 0, 'dig', ctx())).toBe(false);
  });

  it('crops already growing keep growing through Night (§2a)', () => {
    let kg = runCycle(initialKitchenGarden(), 0).kg;
    kg = { ...kg, dayTimeRemaining: 0 };
    kg = tickKitchenGarden(kg, 1, tickCtx(1));
    expect(kg.nightRemaining).toBeGreaterThan(0);

    const t = KG_BASE_GROW_SECONDS + 5;
    kg = tickKitchenGarden(kg, t, tickCtx(t));
    expect(kg.plots[0]!.stage).toBe('grown');
  });

  it('the Day Length ladder follows §2a', () => {
    expect(DAY_LENGTH_SECONDS_BY_UPGRADE).toEqual([30, 45, 60, 90, 120]);
    expect(dayLengthSeconds(0)).toBe(30);
    expect(dayLengthSeconds(3)).toBe(90);
    expect(dayLengthSeconds(99)).toBe(120);
  });
});

describe('INVARIANT — Night never gates anything outside the Kitchen Garden', () => {
  // §2a: "Critically: Night only pauses new Kitchen Garden actions. The
  // Greenhouse Bell, Garden Plot production, Growth Frenzy, Pollination Combo
  // and Harvest Festival all keep running exactly as normal through Night."
  //
  // A deliberately narrow blast radius, and exactly the kind of thing a later
  // phase regresses without noticing.
  const producing = (): GameState => {
    const base = initialState();
    const owned = new Array<number>(TIER_COUNT).fill(0);
    owned[0] = 25;
    return {
      ...base,
      owned,
      kitchenGarden: { ...base.kitchenGarden, nightRemaining: 5, dayTimeRemaining: 0 },
    };
  };

  it('Garden Plot production is unaffected by Night', () => {
    const night = producing();
    const day: GameState = {
      ...night,
      kitchenGarden: { ...night.kitchenGarden, nightRemaining: 0, dayTimeRemaining: 30 },
    };
    expect(totalManaPerSecond(night)).toBe(totalManaPerSecond(day));
  });

  it('the Bell still pays out during Night', () => {
    const result = clickBell(producing());
    expect(result.gained).toBeGreaterThan(0);
  });

  it('Growth Frenzy still fills and fires during Night', () => {
    let state = producing();
    for (let i = 0; i < 25; i++) state = clickBell(state).state;
    expect(frenzyMultiplier(state.frenzy)).toBe(2);
  });

  it('click yield is identical day or night', () => {
    const night = producing();
    const day: GameState = {
      ...night,
      kitchenGarden: { ...night.kitchenGarden, nightRemaining: 0 },
    };
    expect(clickYield(night)).toBe(clickYield(day));
  });

  it('the world keeps advancing through Night', () => {
    const before = producing();
    const after = advance(before, 1);
    expect(after.mana).toBeGreaterThan(before.mana);
  });
});

describe('§2a — Seeds', () => {
  it('regenerate on real time, capped at Satchel capacity', () => {
    let kg: KitchenGardenState = { ...initialKitchenGarden(), seeds: 0 };
    kg = tickKitchenGarden(kg, SEED_REGEN_SECONDS * 3, tickCtx(30));
    expect(kg.seeds).toBe(3);
  });

  it('never exceed capacity', () => {
    let kg = initialKitchenGarden();
    kg = tickKitchenGarden(kg, 100_000, tickCtx(100_000));
    expect(kg.seeds).toBe(SEED_SATCHEL_BASE_CAPACITY);
  });

  it('capacity rises with the Insight tree', () => {
    expect(satchelCapacity(10)).toBe(SEED_SATCHEL_BASE_CAPACITY + 10);
  });

  it('carry fractional progress rather than losing it to rounding', () => {
    let kg: KitchenGardenState = { ...initialKitchenGarden(), seeds: 0 };
    for (let i = 0; i < SEED_REGEN_SECONDS * 10; i++) {
      kg = tickKitchenGarden(kg, 1, tickCtx(i));
    }
    expect(kg.seeds).toBe(10);
  });
});

describe('§2a — slots and surfaces', () => {
  it('Insight raises the cap; Mana breaks the ground', () => {
    expect(slotCap(0)).toBe(KG_STARTING_SLOTS);
    expect(slotCap(16)).toBe(KG_MAX_SLOTS);
    expect(slotCap(999)).toBe(KG_MAX_SLOTS);
  });

  it('refuses to add a slot past the cap', () => {
    const kg = initialKitchenGarden();
    expect(addSlot(kg, KG_STARTING_SLOTS)).toBe(kg);
    expect(addSlot(kg, KG_STARTING_SLOTS + 1).plots).toHaveLength(KG_STARTING_SLOTS + 1);
  });

  it('slot cost follows §2a and rises with each slot', () => {
    expect(slotCost(5, 15)).toBeCloseTo(45, 6);
    expect(slotCost(6, 15)).toBeGreaterThan(slotCost(5, 15));
  });

  it('changing a surface resets the plot — §2a requires replanting', () => {
    const grownPlot = runCycle(initialKitchenGarden(), 0).kg;
    const swapped = applySurface(grownPlot, 0, 'stone-parterre');
    expect(swapped.plots[0]!.surface).toBe('stone-parterre');
    expect(swapped.plots[0]!.stage).toBe('bare');
  });

  it('a faster surface really does grow faster', () => {
    const fast = runCycle(
      { ...initialKitchenGarden(), plots: [emptyPlot('terracotta-pot')] },
      0
    ).kg;
    const slow = runCycle(
      { ...initialKitchenGarden(), plots: [emptyPlot('stone-parterre')] },
      0
    ).kg;
    expect(fast.plots[0]!.grownAt).toBeLessThan(slow.plots[0]!.grownAt);
  });

  it('clearing a plot keeps its surface', () => {
    const kg = runCycle({ ...initialKitchenGarden(), plots: [emptyPlot('greenhouse-bed')] }, 0).kg;
    expect(clearPlot(kg, 0).plots[0]!.surface).toBe('greenhouse-bed');
    expect(clearPlot(kg, 0).plots[0]!.stage).toBe('bare');
  });
});

describe('§2a — Season transitions', () => {
  it('last Season’s planting decays to a legacy share until refreshed', () => {
    let kg = runCycle(initialKitchenGarden(), 0, MANUAL, 1).kg;
    const t = KG_BASE_GROW_SECONDS + 1;
    kg = tickKitchenGarden(kg, t, tickCtx(t));

    const plot = kg.plots[0]!;
    // Same Season, past the Perfect window: full value.
    expect(plotUnits(plot, ctx(1e9, MANUAL, 1))).toBe(1);
    // A Season later: decayed, but never zero — §3's no-hard-obsolescence rule.
    expect(plotUnits(plot, ctx(1e9, MANUAL, 2))).toBeCloseTo(SEASON_TRANSITION_LEGACY_FRACTION, 6);
    expect(plotUnits(plot, ctx(1e9, MANUAL, 2))).toBeGreaterThan(0);
  });
});

describe('D2 — yield stays bounded and non-recursive', () => {
  it('full Season 4 build-out matches the intended plant-unit count', () => {
    // 20 slots x capacity 5 x yield 1.2 = 120 units.
    const kg = fullBuildOut(4, 0);
    expect(kitchenGardenMultiplier(kg, ctx(1e9, MANUAL, 4)) / 0.004).toBeCloseTo(120, 4);
  });

  it('a growing plot contributes nothing until it is grown', () => {
    const growing = runCycle(initialKitchenGarden(), 0).kg;
    expect(plotUnits(growing.plots[0]!, ctx(0))).toBe(0);
  });

  it('never reads total production, so the loop cannot close', () => {
    // The regression the original audit found: at 20 Clockwork Trellis slots a
    // self-referential formula claims 120% of a number it feeds into.
    const kg = fullBuildOut(4, 0);
    const m = kitchenGardenMultiplier(kg, ctx(1e9, MANUAL, 4));
    expect(Number.isFinite(m)).toBe(true);
    expect(m).toBeLessThan(1);
  });
});
