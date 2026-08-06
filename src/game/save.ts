/**
 * save.ts — versioned save files and their migrations (ADR-0004).
 *
 * Versioned from v1, with a migration chain and a frozen fixture per version.
 * There is exactly one version today; the machinery exists now because
 * retrofitting it after playtesters have saves is the expensive path, and the
 * shape of `GameState` is going to change in Phases 3, 4 and 9.
 *
 * Lives in `src/game`, not `src/sim`: it touches storage and the clock.
 */

import { initialKitchenGarden, initialState, type GameState } from '@sim/state';
import { TIER_COUNT } from '@content/generators';
import {
  DAY_LENGTH_SECONDS_BY_UPGRADE,
  KG_MAX_SLOTS,
  KG_STARTING_SLOTS,
  POLLINATION_TIERS,
  SEED_SATCHEL_BASE_CAPACITY,
} from '@content/balance';
import { DEFAULT_SURFACE, surfaceById } from '@content/surfaces';
import { emptyPlot, type KitchenGardenState, type Plot } from '@sim/kitchenGarden';
import { initialCapstone, type CapstoneState } from '@sim/capstone';
import {
  FLOWERS,
  initialPollination,
  type FlowerType,
  type PollinationState,
} from '@sim/pollination';
import { nodeById } from '@content/insightTree';
import { MILESTONES } from '@content/milestones';

export const CURRENT_SAVE_VERSION = 6;
export const SAVE_KEY = 'clockwork-garden:save';

export interface SaveFile {
  readonly version: number;
  /** Epoch ms. Offline progress is computed from this. */
  readonly savedAt: number;
  readonly state: GameState;
}

export type LoadResult =
  | { readonly ok: true; readonly save: SaveFile; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly reason: LoadFailure; readonly detail: string };

export type LoadFailure = 'empty' | 'unparseable' | 'future-version' | 'corrupt';

/**
 * Migrations, keyed by the version they upgrade FROM. Each is a pure function.
 * Loading a v1 save into a v6 build runs 1->2, 2->3, ... 5->6 in order.
 *
 * Never edit a migration once it has shipped - players' saves depend on the
 * exact transformation. Add a new one instead.
 */
const MIGRATIONS: Readonly<Record<number, (raw: unknown) => unknown>> = {
  /**
   * v1 -> v2 (Phase 3): the Insight tree arrived. v1 saves predate Insight
   * entirely, so a returning player starts the tree empty with nothing claimed.
   *
   * `reviveState` would default these anyway, but the migration is written out
   * explicitly: it is the record of WHAT CHANGED and when, and the next schema
   * change will not be defaultable.
   */
  1: (raw) => {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const state = (envelope['state'] ?? {}) as Record<string, unknown>;
    return {
      ...envelope,
      version: 2,
      state: {
        ...state,
        insight: 0,
        lifetimeInsight: 0,
        purchasedNodes: [],
        claimedMilestones: [],
      },
    };
  },
  /**
   * v2 -> v3 (Phase 4): the Kitchen Garden became a real per-plot state machine.
   *
   * v2 stored an abstract build-out ({slots, capacityPerSlot, surfaceYieldMult,
   * activeFraction}); v3 stores actual plots. The player's slot COUNT is
   * preserved and each becomes a bare plot - their crops are lost, but there
   * were no real crops in v2, only a number standing in for them. Seeds and the
   * Day budget start fresh.
   */
  2: (raw) => {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const state = (envelope['state'] ?? {}) as Record<string, unknown>;
    const oldKg = (state['kitchenGarden'] ?? {}) as Record<string, unknown>;
    const slots = typeof oldKg['slots'] === 'number' ? oldKg['slots'] : KG_STARTING_SLOTS;
    const count = Math.min(Math.max(Math.floor(slots), KG_STARTING_SLOTS), KG_MAX_SLOTS);

    return {
      ...envelope,
      version: 3,
      state: {
        ...state,
        kitchenGarden: {
          plots: Array.from({ length: count }, () => emptyPlot()),
          seeds: SEED_SATCHEL_BASE_CAPACITY,
          dayTimeRemaining: DAY_LENGTH_SECONDS_BY_UPGRADE[0] ?? 30,
          nightRemaining: 0,
          seedProgress: 0,
        },
      },
    };
  },
  /**
   * v3 -> v4 (Phase 5): Season capstones became a real challenge (D4a).
   *
   * A returning player starts with no attempt in progress. Cleared capstones
   * live in `capstonesCleared` and are untouched, so nobody re-fights a Season
   * they already finished.
   */
  3: (raw) => {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const state = (envelope['state'] ?? {}) as Record<string, unknown>;
    return {
      ...envelope,
      version: 4,
      state: { ...state, capstone: initialCapstone() },
    };
  },

  /**
   * v4 -> v5: generator tiers stopped gating on Insight.
   *
   * The eight `unlock-generator` nodes became per-tier PRODUCTION nodes and were
   * renamed with them. Without this remap `reviveState` would drop the old ids
   * as unknown and silently refund nothing - a player would lose every Insight
   * point they had spent on them. The tiers those nodes used to open stay open
   * regardless, because unlock gates now read owned counts.
   */
  4: (raw) => {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const state = (envelope['state'] ?? {}) as Record<string, unknown>;
    const nodes = Array.isArray(state['purchasedNodes'])
      ? (state['purchasedNodes'] as unknown[])
      : [];
    return {
      ...envelope,
      version: 5,
      state: {
        ...state,
        purchasedNodes: nodes.map((id) =>
          typeof id === 'string' ? (RENAMED_IN_V5[id] ?? id) : id
        ),
      },
    };
  },

  /**
   * v5 -> v6 (Phase 7): §6.1's Pollination Combo arrived.
   *
   * A returning player starts with no chain, no Bloom and a fresh drone seed.
   * Nothing is lost — there was nothing to lose — but the migration is written
   * out rather than left to `reviveState`'s defaults, because the record of WHEN
   * a field appeared is the thing that makes the next schema change safe.
   */
  5: (raw) => {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const state = (envelope['state'] ?? {}) as Record<string, unknown>;
    return {
      ...envelope,
      version: 6,
      state: { ...state, pollination: initialPollination() },
    };
  },
};

/** Old node id -> new node id, for the v4 -> v5 rename. Never edit. */
const RENAMED_IN_V5: Readonly<Record<string, string>> = {
  's1-gen-3': 's1-yield-3',
  's1-gen-4': 's1-yield-4',
  's2-gen-8': 's2-yield-8',
  's2-gen-9': 's2-yield-9',
  's3-gen-13': 's3-yield-13',
  's3-gen-14': 's3-yield-14',
  's4-gen-18': 's4-yield-18',
  's4-gen-19': 's4-yield-19',
};

export function serialize(state: GameState, nowMs: number): SaveFile {
  return { version: CURRENT_SAVE_VERSION, savedAt: nowMs, state };
}

/**
 * Rebuild a GameState from untrusted data.
 *
 * Every field is defaulted. A save file is the one input this game takes from
 * outside itself - it survives browser upgrades, manual edits, and our own past
 * mistakes - so a missing or wrong-typed field must degrade to a default rather
 * than produce `undefined` somewhere deep in the economy.
 */
function reviveState(raw: unknown): GameState {
  const base = initialState();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;

  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const ownedRaw = Array.isArray(r['owned']) ? (r['owned'] as unknown[]) : [];
  const owned = new Array<number>(TIER_COUNT)
    .fill(0)
    .map((_, i) => Math.max(0, Math.floor(num(ownedRaw[i], 0))));

  const capstonesRaw = Array.isArray(r['capstonesCleared'])
    ? (r['capstonesCleared'] as unknown[])
    : [];
  const capstonesCleared = capstonesRaw
    .filter((s): s is number => typeof s === 'number')
    .filter((s) => s >= 1 && s <= 4);

  const kgRaw = (r['kitchenGarden'] ?? {}) as Record<string, unknown>;
  const kgBase = initialKitchenGarden();

  const frenzyRaw = (r['frenzy'] ?? {}) as Record<string, unknown>;

  return {
    mana: Math.max(0, num(r['mana'], 0)),
    lifetimeMana: Math.max(0, num(r['lifetimeMana'], 0)),
    owned,
    // High-water mark. Clamped to the tier count; a corrupt value must not
    // unlock content, only fail closed.
    tiersUnlocked: Math.min(TIER_COUNT, Math.max(0, Math.floor(num(r['tiersUnlocked'], 0)))),
    season: Math.min(4, Math.max(1, Math.floor(num(r['season'], 1)))),
    capstonesCleared,
    appliedSqp: Math.max(0, num(r['appliedSqp'], 0)),
    prestigeCount: Math.max(0, Math.floor(num(r['prestigeCount'], 0))),
    elapsedSeconds: Math.max(0, num(r['elapsedSeconds'], 0)),
    kitchenGarden: reviveKitchenGarden(kgRaw, kgBase),
    frenzy: {
      meter: Math.min(1, Math.max(0, num(frenzyRaw['meter'], 0))),
      remainingSeconds: Math.max(0, num(frenzyRaw['remainingSeconds'], 0)),
    },
    pollination: revivePollination(r['pollination']),
    insight: Math.max(0, num(r['insight'], 0)),
    lifetimeInsight: Math.max(0, num(r['lifetimeInsight'], 0)),
    // Unknown ids are dropped rather than trusted: a save may name a node this
    // build has since removed or renamed.
    purchasedNodes: stringIds(r['purchasedNodes']).filter((id) => nodeById(id) !== undefined),
    claimedMilestones: stringIds(r['claimedMilestones']).filter((id) => MILESTONE_IDS.has(id)),
    capstone: reviveCapstone(r['capstone']),
  };
}

function reviveCapstone(raw: unknown): CapstoneState {
  const base = initialCapstone();
  if (typeof raw !== 'object' || raw === null) return base;
  const c = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    // An attempt never survives a reload: resuming mid-Frenzy from a save would
    // hand the player a window they did not earn.
    armed: false,
    attemptPeakRate: 0,
    sawFrenzy: false,
    attempts: Math.max(0, Math.floor(num(c['attempts'], 0))),
    lastFailed: c['lastFailed'] === true,
  };
}

/**
 * Rebuild §6.1's Pollination state.
 *
 * The chain and any active Bloom are DROPPED, exactly as a capstone attempt is:
 * reloading into a live Golden Bloom would hand back twenty seconds of x2 that
 * the player did not earn, and it is the one thing in this state worth cheating
 * for. `bestChain` is a record and survives; the drone's seed survives so a
 * reloaded save keeps replaying the same sequence rather than restarting its
 * luck every time the tab is refreshed.
 */
function revivePollination(raw: unknown): PollinationState {
  const base = initialPollination();
  if (typeof raw !== 'object' || raw === null) return base;
  const p = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

  // A ceiling on `bestChain`, because it feeds milestones and therefore Insight.
  // Generous enough that no honest chain reaches it, tight enough that a hand-
  // edited save cannot claim an unbounded record. ADR-0004 rules out anti-tamper,
  // so this is a sanity clamp, not a defence.
  const longest = (POLLINATION_TIERS[POLLINATION_TIERS.length - 1]?.chain ?? 9) * 1000;
  const flower = p['lastFlower'];

  return {
    ...base,
    // Kept only so the UI can still name the flower that ended the last chain;
    // with `chain` at 0 it has no mechanical effect.
    lastFlower: FLOWERS.includes(flower as FlowerType) ? (flower as FlowerType) : null,
    bestChain: Math.min(longest, Math.max(0, Math.floor(num(p['bestChain'], 0)))),
    droneSeed: Math.floor(num(p['droneSeed'], base.droneSeed)) >>> 0,
  };
}

function reviveKitchenGarden(
  raw: Record<string, unknown>,
  fallback: KitchenGardenState
): KitchenGardenState {
  const num = (v: unknown, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : d;

  const rawPlots = Array.isArray(raw['plots']) ? (raw['plots'] as unknown[]) : null;
  const plots: Plot[] = rawPlots
    ? rawPlots.slice(0, KG_MAX_SLOTS).map((entry) => {
        const p = (entry ?? {}) as Record<string, unknown>;
        const surface = typeof p['surface'] === 'string' ? p['surface'] : DEFAULT_SURFACE;
        const stage = typeof p['stage'] === 'string' ? p['stage'] : 'bare';
        const base = emptyPlot(surfaceById(surface).id);
        return {
          ...base,
          stage: (VALID_STAGES.has(stage) ? stage : 'bare') as Plot['stage'],
          digAt: num(p['digAt'], -1),
          plantAt: num(p['plantAt'], -1),
          coverAt: num(p['coverAt'], -1),
          grownAt: num(p['grownAt'], -1),
          perfectUntil: num(p['perfectUntil'], -1),
          plantedSeason: Math.max(0, Math.floor(num(p['plantedSeason'], 0))),
        };
      })
    : fallback.plots.slice();

  // Never fewer than the starting slots: a corrupt save must not leave a player
  // with a Kitchen Garden they cannot use.
  while (plots.length < KG_STARTING_SLOTS) plots.push(emptyPlot());

  return {
    plots,
    seeds: Math.max(0, num(raw['seeds'], fallback.seeds)),
    dayTimeRemaining: Math.max(0, num(raw['dayTimeRemaining'], fallback.dayTimeRemaining)),
    nightRemaining: Math.max(0, num(raw['nightRemaining'], 0)),
    seedProgress: Math.max(0, num(raw['seedProgress'], 0)),
  };
}

const VALID_STAGES = new Set(['bare', 'dug', 'planted', 'growing', 'grown']);

const MILESTONE_IDS = new Set(MILESTONES.map((m) => m.id));

function stringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value === 'string') seen.add(value);
  }
  return [...seen];
}

/** Parse, migrate and revive. Never throws. */
export function deserialize(json: string | null): LoadResult {
  if (!json) return { ok: false, reason: 'empty', detail: 'no save present' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return { ok: false, reason: 'unparseable', detail: String(error) };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'corrupt', detail: 'save is not an object' };
  }

  const envelope = parsed as Record<string, unknown>;
  const rawVersion = envelope['version'];
  const version = typeof rawVersion === 'number' ? rawVersion : 0;

  // Refuse a save written by a NEWER build rather than silently mangling it.
  // Overwriting someone's progress with an older schema is unrecoverable.
  if (version > CURRENT_SAVE_VERSION) {
    return {
      ok: false,
      reason: 'future-version',
      detail: `save is version ${version}, this build understands ${CURRENT_SAVE_VERSION}`,
    };
  }

  let current: unknown = envelope;
  const startedAt = version;
  for (let v = version; v < CURRENT_SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) {
      return { ok: false, reason: 'corrupt', detail: `no migration from version ${v}` };
    }
    current = migrate(current);
  }

  const final = current as Record<string, unknown>;
  const savedAt = typeof final['savedAt'] === 'number' ? final['savedAt'] : 0;

  return {
    ok: true,
    save: {
      version: CURRENT_SAVE_VERSION,
      savedAt,
      state: reviveState(final['state']),
    },
    migratedFrom: startedAt < CURRENT_SAVE_VERSION ? startedAt : null,
  };
}

// ---------------------------------------------------------------------------
// Export / import — the primary bug-report mechanism (ADR-0004)
// ---------------------------------------------------------------------------

export function encodeSave(save: SaveFile): string {
  const json = JSON.stringify(save);
  // btoa is Latin-1 only; encodeURIComponent first so any future unicode in a
  // save (a player-named garden, say) does not throw.
  return btoa(encodeURIComponent(json));
}

export function decodeSave(encoded: string): LoadResult {
  try {
    return deserialize(decodeURIComponent(atob(encoded.trim())));
  } catch (error) {
    return { ok: false, reason: 'unparseable', detail: String(error) };
  }
}
