import { describe, it, expect, beforeEach } from 'vitest';
import { GameStore, type Clock } from '@game/store';
import { SAVE_KEY, serialize } from '@game/save';
import { initialState } from '@sim/state';
import { totalManaPerSecond } from '@sim/economy';
import { offlineManaEarned } from '@sim/offline';
import { costOfNext } from '@sim/economy';

/** Minimal in-memory Storage, so tests never depend on a real DOM. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

class FakeClock implements Clock {
  constructor(private ms = 1_000_000) {}
  now() {
    return this.ms;
  }
  advance(seconds: number) {
    this.ms += seconds * 1000;
  }
  set(ms: number) {
    this.ms = ms;
  }
}

let storage: MemoryStorage;
let clock: FakeClock;
let store: GameStore;

beforeEach(() => {
  storage = new MemoryStorage();
  clock = new FakeClock();
  store = new GameStore(clock, storage);
});

const withTierOne = (count: number) => {
  const base = initialState();
  return { ...base, owned: [count, ...base.owned.slice(1)] };
};

describe('the snapshot contract (ADR-0003)', () => {
  it('returns a STABLE reference when nothing changed', () => {
    // A fresh object per call makes useSyncExternalStore loop forever. This is
    // the footgun the ADR calls out, so it gets a test.
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('returns a new reference after a change', () => {
    const before = store.getSnapshot();
    store.ringBell();
    expect(store.getSnapshot()).not.toBe(before);
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.ringBell();
    expect(calls).toBe(1);
    unsubscribe();
    store.ringBell();
    expect(calls).toBe(1);
  });
});

describe('player actions', () => {
  it('ringing the Bell earns Mana', () => {
    store.ringBell();
    expect(store.getSnapshot().mana).toBeGreaterThan(0);
  });

  it('buying is refused when unaffordable and leaves state untouched', () => {
    const before = store.getSnapshot();
    expect(store.buy(1)).toBe(false);
    expect(store.getSnapshot()).toBe(before);
  });

  it('buying succeeds when affordable', () => {
    store.replaceState({ ...initialState(), mana: 1000 });
    expect(store.buy(1)).toBe(true);
    expect(store.getSnapshot().owned[0]).toBe(1);
    expect(store.getSnapshot().mana).toBeCloseTo(1000 - costOfNext(1, 0), 6);
  });
});

describe('the loop', () => {
  it('advances the sim in fixed steps as wall-clock time passes', () => {
    store.replaceState(withTierOne(10));
    const before = store.getSnapshot().mana;

    clock.advance(1);
    store.step(clock.now());

    expect(store.getSnapshot().mana).toBeGreaterThan(before);
    expect(store.getSnapshot().elapsedSeconds).toBeCloseTo(1, 1);
  });

  it('BOUNDS catch-up so a long-backgrounded tab cannot freeze the page', () => {
    // The classic incremental bug: restore a tab after an hour and the loop
    // tries to run 36,000 ticks in one frame. Offline progress handles long
    // gaps; the loop must not.
    store.replaceState(withTierOne(10));

    clock.advance(3600);
    const start = Date.now();
    store.step(clock.now());
    const wallMs = Date.now() - start;

    expect(wallMs).toBeLessThan(500);
    // Only the bounded window is simulated, not the full hour.
    expect(store.getSnapshot().elapsedSeconds).toBeLessThanOrEqual(6);
  });

  it('ignores time going backwards', () => {
    store.replaceState(withTierOne(10));
    clock.advance(1);
    store.step(clock.now());
    const after = store.getSnapshot();

    clock.set(0);
    store.step(clock.now());
    expect(store.getSnapshot().elapsedSeconds).toBe(after.elapsedSeconds);
  });
});

describe('saving and loading', () => {
  it('persists and restores across a reload', () => {
    store.replaceState({ ...withTierOne(7), mana: 555 });
    expect(store.save()).toBe(true);

    const reloaded = new GameStore(clock, storage);
    const status = reloaded.load();

    expect(status.loadedFromSave).toBe(true);
    expect(reloaded.getSnapshot().owned[0]).toBe(7);
    expect(reloaded.getSnapshot().mana).toBeCloseTo(555, 6);
  });

  it('treats a first run as a clean start, not a failure', () => {
    const status = store.load();
    expect(status.loadedFromSave).toBe(false);
    expect(status.loadFailure).toBeNull();
    expect(store.getSnapshot()).toEqual(initialState());
  });

  it('surfaces a genuinely corrupt save rather than silently resetting', () => {
    storage.setItem(SAVE_KEY, '{broken');
    const status = store.load();
    expect(status.loadFailure).toBe('unparseable');
  });

  it('keeps running when storage refuses writes', () => {
    const hostile = new (class extends MemoryStorage {
      override setItem(): void {
        throw new Error('QuotaExceededError');
      }
    })();
    const resilient = new GameStore(clock, hostile);
    expect(resilient.save()).toBe(false);
    expect(() => resilient.ringBell()).not.toThrow();
  });

  it('works with storage entirely unavailable', () => {
    const none = new GameStore(clock, null);
    expect(none.save()).toBe(false);
    expect(none.load().loadedFromSave).toBe(false);
    expect(() => none.ringBell()).not.toThrow();
  });

  it('hard reset clears both state and storage', () => {
    store.replaceState({ ...withTierOne(9), mana: 100 });
    store.save();
    store.hardReset();
    expect(store.getSnapshot()).toEqual(initialState());
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});

describe('offline progress on load (§7)', () => {
  it('credits time away at the tapered rate', () => {
    const state = withTierOne(10);
    const savedAt = clock.now();
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(state, savedAt)));

    const awaySeconds = 4 * 3600;
    clock.advance(awaySeconds);

    const fresh = new GameStore(clock, storage);
    const status = fresh.load();

    const expected = offlineManaEarned(totalManaPerSecond(state), awaySeconds);
    expect(status.offline).not.toBeNull();
    expect(status.offline?.manaEarned).toBeCloseTo(expected, 6);
    expect(fresh.getSnapshot().mana).toBeCloseTo(state.mana + expected, 6);
  });

  it('reports 100% efficiency inside the full-rate window', () => {
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(withTierOne(10), clock.now())));
    clock.advance(3600);
    const status = new GameStore(clock, storage).load();
    expect(status.offline?.averageEfficiency).toBeCloseTo(1, 6);
  });

  it('reports reduced efficiency past the taper', () => {
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(withTierOne(10), clock.now())));
    clock.advance(24 * 3600);
    const status = new GameStore(clock, storage).load();
    expect(status.offline?.averageEfficiency).toBeLessThan(0.9);
    expect(status.offline?.averageEfficiency).toBeGreaterThan(0.5);
  });

  it('grants nothing for a save from the future (clock skew)', () => {
    const state = withTierOne(10);
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(state, clock.now() + 5_000_000)));
    const fresh = new GameStore(clock, storage);
    const status = fresh.load();
    expect(status.offline).toBeNull();
    expect(fresh.getSnapshot().mana).toBe(state.mana);
  });

  it('grants nothing when the player produces nothing', () => {
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(initialState(), clock.now())));
    clock.advance(10 * 3600);
    expect(new GameStore(clock, storage).load().offline).toBeNull();
  });
});

describe('§6.1 Pollination through the store', () => {
  const enterSummer = () =>
    store.replaceState({ ...initialState(), season: 2, capstonesCleared: [1] });

  it('refuses to pollinate before Season 2', () => {
    expect(store.pollinate('sunflower')).toBeNull();
    expect(store.getSnapshot().pollination.chain).toBe(0);
  });

  it('builds a chain and publishes each link', () => {
    enterSummer();
    let published = 0;
    store.subscribe(() => published++);

    store.pollinate('sunflower');
    store.pollinate('lavender');
    expect(store.getSnapshot().pollination.chain).toBe(2);
    expect(published).toBe(2);
  });

  it('returns the Bloom it landed, and nothing on an ordinary link', () => {
    enterSummer();
    expect(store.pollinate('sunflower')).toBeNull();
    expect(store.pollinate('lavender')).toBeNull();
    expect(store.pollinate('poppy')?.name).toBe('Bronze Bloom');
  });
});
