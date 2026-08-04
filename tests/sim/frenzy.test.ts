import { describe, it, expect } from 'vitest';
import {
  CLICKS_TO_FILL,
  addFrenzyClick,
  frenzyMultiplier,
  initialFrenzy,
  isFrenzyActive,
  tickFrenzy,
} from '@sim/frenzy';
import { advance, clickBell } from '@sim/tick';
import { initialState, type GameState } from '@sim/state';
import {
  FRENZY_DURATION_SECONDS,
  FRENZY_METER_DRAIN_PER_SECOND,
  FRENZY_MULTIPLIER,
} from '@content/balance';

const fillMeter = () => {
  let frenzy = initialFrenzy();
  for (let i = 0; i < CLICKS_TO_FILL; i++) frenzy = addFrenzyClick(frenzy);
  return frenzy;
};

describe('§5 — the meter fills by clicking', () => {
  it('starts empty and inactive', () => {
    const frenzy = initialFrenzy();
    expect(frenzy.meter).toBe(0);
    expect(isFrenzyActive(frenzy)).toBe(false);
    expect(frenzyMultiplier(frenzy)).toBe(1);
  });

  it('triggers a Frenzy exactly when the meter fills', () => {
    let frenzy = initialFrenzy();
    for (let i = 0; i < CLICKS_TO_FILL - 1; i++) {
      frenzy = addFrenzyClick(frenzy);
      expect(isFrenzyActive(frenzy)).toBe(false);
    }
    frenzy = addFrenzyClick(frenzy);
    expect(isFrenzyActive(frenzy)).toBe(true);
    expect(frenzy.remainingSeconds).toBe(FRENZY_DURATION_SECONDS);
  });

  it('empties the meter when the Frenzy starts', () => {
    expect(fillMeter().meter).toBe(0);
  });

  it('applies 2x while active', () => {
    expect(frenzyMultiplier(fillMeter())).toBe(FRENZY_MULTIPLIER);
  });
});

describe('§5 — it rewards bursts, not sustained clicking', () => {
  it('does NOT refill the meter during an active Frenzy', () => {
    // Otherwise a fast clicker chains Frenzies back to back, which §5
    // explicitly does not want.
    let frenzy = fillMeter();
    for (let i = 0; i < 50; i++) frenzy = addFrenzyClick(frenzy);
    expect(frenzy.meter).toBe(0);
    expect(frenzy.remainingSeconds).toBe(FRENZY_DURATION_SECONDS);
  });

  it('drains the meter while idle', () => {
    let frenzy = initialFrenzy();
    for (let i = 0; i < 10; i++) frenzy = addFrenzyClick(frenzy);
    const before = frenzy.meter;
    frenzy = tickFrenzy(frenzy, 1);
    expect(frenzy.meter).toBeCloseTo(before - FRENZY_METER_DRAIN_PER_SECOND, 9);
  });

  it('never drains below empty', () => {
    let frenzy = initialFrenzy();
    frenzy = tickFrenzy(frenzy, 10_000);
    expect(frenzy.meter).toBe(0);
  });

  it('expires after exactly the configured duration', () => {
    let frenzy = fillMeter();
    frenzy = tickFrenzy(frenzy, FRENZY_DURATION_SECONDS - 0.1);
    expect(isFrenzyActive(frenzy)).toBe(true);
    frenzy = tickFrenzy(frenzy, 0.1);
    expect(isFrenzyActive(frenzy)).toBe(false);
  });

  it('does not go negative on an overlong tick', () => {
    const frenzy = tickFrenzy(fillMeter(), 10_000);
    expect(frenzy.remainingSeconds).toBe(0);
  });

  it('ignores non-positive time steps', () => {
    const frenzy = fillMeter();
    expect(tickFrenzy(frenzy, 0)).toBe(frenzy);
    expect(tickFrenzy(frenzy, -5)).toBe(frenzy);
  });
});

describe('the Bell', () => {
  const producing = (): GameState => {
    const base = initialState();
    return { ...base, owned: [10, ...base.owned.slice(1)] };
  };

  it('grants Mana and counts toward lifetime', () => {
    const { state, gained } = clickBell(initialState());
    expect(gained).toBeGreaterThan(0);
    expect(state.mana).toBe(gained);
    expect(state.lifetimeMana).toBe(gained);
  });

  it('reports the click that triggered the Frenzy', () => {
    let state = initialState();
    for (let i = 0; i < CLICKS_TO_FILL - 1; i++) {
      const result = clickBell(state);
      state = result.state;
      expect(result.triggeredFrenzy).toBe(false);
    }
    const last = clickBell(state);
    expect(last.triggeredFrenzy).toBe(true);
  });

  it('pays the triggering click at the Frenzy rate', () => {
    let state = initialState();
    for (let i = 0; i < CLICKS_TO_FILL - 1; i++) state = clickBell(state).state;
    const normal = clickBell(initialState()).gained;
    const triggering = clickBell(state).gained;
    expect(triggering).toBeCloseTo(normal * FRENZY_MULTIPLIER, 9);
  });

  it('does not mutate the input state', () => {
    const before = initialState();
    clickBell(before);
    expect(before.mana).toBe(0);
    expect(before.frenzy.meter).toBe(0);
  });

  it('doubles passive production during a Frenzy (§5: click AND auto)', () => {
    const base = producing();
    const calm = advance(base, 1);

    let frenzied = base;
    for (let i = 0; i < CLICKS_TO_FILL; i++) frenzied = clickBell(frenzied).state;
    const clickMana = frenzied.mana;
    frenzied = advance(frenzied, 1);

    const passiveCalm = calm.mana;
    const passiveFrenzied = frenzied.mana - clickMana;
    expect(passiveFrenzied).toBeCloseTo(passiveCalm * FRENZY_MULTIPLIER, 6);
  });
});

describe('advance()', () => {
  it('accrues Mana, lifetime Mana and elapsed time together', () => {
    const base = { ...initialState(), owned: [10, ...initialState().owned.slice(1)] };
    const after = advance(base, 2);
    expect(after.elapsedSeconds).toBe(2);
    expect(after.mana).toBeGreaterThan(0);
    expect(after.lifetimeMana).toBe(after.mana);
  });

  it('is a no-op for non-positive dt', () => {
    const base = initialState();
    expect(advance(base, 0)).toBe(base);
    expect(advance(base, -1)).toBe(base);
  });

  it('is additive — one 2s step equals two 1s steps', () => {
    const base = { ...initialState(), owned: [10, ...initialState().owned.slice(1)] };
    const once = advance(base, 2);
    const twice = advance(advance(base, 1), 1);
    expect(twice.mana).toBeCloseTo(once.mana, 9);
  });
});
