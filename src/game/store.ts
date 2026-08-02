/**
 * store.ts — the runtime. Owns the authoritative game state and the tick loop.
 *
 * Per ADR-0003 the state lives OUTSIDE React: one writer (the loop), one source
 * of truth, and React subscribes via `useSyncExternalStore`. No state library.
 *
 * This is also the only place allowed to read the clock. `src/sim` receives time
 * as a parameter and stays deterministic.
 */

import { MAX_CATCHUP_SECONDS, OFFLINE_MIN_EFFICIENCY, SIM_TICK_SECONDS } from '@content/balance';
import { advance, clickBell, type ClickResult } from '@sim/tick';
import { buy as buyGenerator } from '@sim/economy';
import { purchaseNode as purchaseInsightNode } from '@sim/insight';
import { effectsOf } from '@sim/insight';
import { totalManaPerSecond } from '@sim/economy';
import { offlineManaEarned } from '@sim/offline';
import { initialState, type GameState } from '@sim/state';
import { CURRENT_SAVE_VERSION, SAVE_KEY, deserialize, serialize, type LoadFailure } from './save';

/** How often React is told something changed. Independent of the sim tick. */
const PUBLISH_INTERVAL_MS = 100;
const AUTOSAVE_INTERVAL_MS = 10_000;

export interface OfflineReport {
  readonly awaySeconds: number;
  readonly manaEarned: number;
  readonly averageEfficiency: number;
}

export interface StoreStatus {
  readonly loadedFromSave: boolean;
  readonly loadFailure: LoadFailure | null;
  readonly migratedFrom: number | null;
  readonly offline: OfflineReport | null;
}

type Listener = () => void;

export interface Clock {
  now(): number;
}

const systemClock: Clock = { now: () => Date.now() };

export class GameStore {
  private state: GameState;
  private published: GameState;
  private listeners = new Set<Listener>();
  private status: StoreStatus;

  private rafHandle: number | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastFrameMs: number;
  private accumulator = 0;
  private sincePublishMs = 0;
  private sinceSaveMs = 0;

  constructor(
    private readonly clock: Clock = systemClock,
    private readonly storage: Storage | null = safeLocalStorage()
  ) {
    this.state = initialState();
    this.published = this.state;
    this.status = {
      loadedFromSave: false,
      loadFailure: null,
      migratedFrom: null,
      offline: null,
    };
    this.lastFrameMs = this.clock.now();
  }

  // -------------------------------------------------------------------------
  // React integration (useSyncExternalStore)
  // -------------------------------------------------------------------------

  /**
   * Snapshot getter. MUST return a stable reference when nothing changed -
   * returning a fresh object each call makes useSyncExternalStore loop forever.
   * `published` is only reassigned when the loop decides to publish.
   */
  readonly getSnapshot = (): GameState => this.published;

  readonly getStatus = (): StoreStatus => this.status;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(): void {
    this.published = this.state;
    for (const listener of this.listeners) listener();
  }

  // -------------------------------------------------------------------------
  // Loading and offline progress
  // -------------------------------------------------------------------------

  load(): StoreStatus {
    const raw = this.storage?.getItem(SAVE_KEY) ?? null;
    const result = deserialize(raw);

    if (!result.ok) {
      this.status = {
        loadedFromSave: false,
        // A missing save is the normal first-run path, not a failure worth
        // surfacing to the player.
        loadFailure: result.reason === 'empty' ? null : result.reason,
        migratedFrom: null,
        offline: null,
      };
      this.publish();
      return this.status;
    }

    this.state = result.save.state;

    const nowMs = this.clock.now();
    const awaySeconds = (nowMs - result.save.savedAt) / 1000;
    const rate = totalManaPerSecond(this.state);
    // The Insight tree can raise §7's floor, so offline pays out at the rate
    // this particular build earned.
    const floor = OFFLINE_MIN_EFFICIENCY + effectsOf(this.state).offlineFloorBonus;
    const manaEarned = offlineManaEarned(rate, awaySeconds, floor);

    if (manaEarned > 0) {
      this.state = {
        ...this.state,
        mana: this.state.mana + manaEarned,
        lifetimeMana: this.state.lifetimeMana + manaEarned,
      };
    }

    this.status = {
      loadedFromSave: true,
      loadFailure: null,
      migratedFrom: result.migratedFrom,
      offline:
        manaEarned > 0
          ? {
              awaySeconds,
              manaEarned,
              averageEfficiency: manaEarned / (rate * awaySeconds),
            }
          : null,
    };

    this.lastFrameMs = nowMs;
    this.publish();
    return this.status;
  }

  // -------------------------------------------------------------------------
  // The loop
  // -------------------------------------------------------------------------

  start(): void {
    if (this.rafHandle !== null || this.intervalHandle !== null) return;
    this.lastFrameMs = this.clock.now();

    if (typeof requestAnimationFrame === 'function') {
      const frame = () => {
        this.step(this.clock.now());
        this.rafHandle = requestAnimationFrame(frame);
      };
      this.rafHandle = requestAnimationFrame(frame);
    } else {
      // Headless (tests, SSR). rAF does not exist; a timer is equivalent here
      // because nothing is being painted.
      this.intervalHandle = setInterval(() => this.step(this.clock.now()), PUBLISH_INTERVAL_MS);
    }
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Advance to wall-clock time `nowMs`. Exposed for tests, which drive it with a
   * fake clock instead of waiting in real time.
   */
  step(nowMs: number): void {
    const elapsedMs = nowMs - this.lastFrameMs;
    this.lastFrameMs = nowMs;
    if (elapsedMs <= 0) return;

    // Bound catch-up. A tab restored after an hour must not try to run 36,000
    // ticks in one frame and lock the page - that is the classic incremental
    // freeze. Anything longer is offline progress' job, not the loop's.
    const deltaSeconds = Math.min(elapsedMs / 1000, MAX_CATCHUP_SECONDS);
    this.accumulator += deltaSeconds;

    let ticks = 0;
    while (this.accumulator >= SIM_TICK_SECONDS && ticks < 1000) {
      this.state = advance(this.state, SIM_TICK_SECONDS);
      this.accumulator -= SIM_TICK_SECONDS;
      ticks++;
    }

    this.sincePublishMs += elapsedMs;
    if (this.sincePublishMs >= PUBLISH_INTERVAL_MS) {
      this.sincePublishMs = 0;
      this.publish();
    }

    this.sinceSaveMs += elapsedMs;
    if (this.sinceSaveMs >= AUTOSAVE_INTERVAL_MS) {
      this.sinceSaveMs = 0;
      this.save();
    }
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  ringBell(): ClickResult {
    const result = clickBell(this.state);
    this.state = result.state;
    this.publish();
    return result;
  }

  buy(tier: number): boolean {
    const next = buyGenerator(this.state, tier);
    if (next === this.state) return false;
    this.state = next;
    this.publish();
    return true;
  }

  purchaseNode(nodeId: string): boolean {
    const next = purchaseInsightNode(this.state, nodeId);
    if (next === this.state) return false;
    this.state = next;
    this.publish();
    return true;
  }

  // -------------------------------------------------------------------------
  // Saving
  // -------------------------------------------------------------------------

  save(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(serialize(this.state, this.clock.now())));
      return true;
    } catch {
      // Quota exceeded, private-mode restrictions, disabled storage. Losing an
      // autosave must never take the running game down with it.
      return false;
    }
  }

  hardReset(): void {
    this.state = initialState();
    this.storage?.removeItem(SAVE_KEY);
    this.status = {
      loadedFromSave: false,
      loadFailure: null,
      migratedFrom: null,
      offline: null,
    };
    this.publish();
  }

  /** Test/debug seam. Not used by the UI. */
  replaceState(state: GameState): void {
    this.state = state;
    this.publish();
  }

  currentVersion(): number {
    return CURRENT_SAVE_VERSION;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Touch it: Safari private mode throws on write, not on access.
    const probe = '__cg_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

/** The singleton the UI binds to. Tests construct their own instances. */
export const gameStore = new GameStore();
