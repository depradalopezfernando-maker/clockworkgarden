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

export const CURRENT_SAVE_VERSION = 1;
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
 * Loading a v1 save into a v4 build runs 1->2, 2->3, 3->4 in order.
 *
 * Never edit a migration once it has shipped - players' saves depend on the
 * exact transformation. Add a new one instead.
 */
const MIGRATIONS: Readonly<Record<number, (raw: unknown) => unknown>> = {
  // 1: (raw) => ({ ...raw, state: { ...raw.state, newField: default } }),
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
    season: Math.min(4, Math.max(1, Math.floor(num(r['season'], 1)))),
    capstonesCleared,
    appliedSqp: Math.max(0, num(r['appliedSqp'], 0)),
    prestigeCount: Math.max(0, Math.floor(num(r['prestigeCount'], 0))),
    elapsedSeconds: Math.max(0, num(r['elapsedSeconds'], 0)),
    kitchenGarden: {
      slots: Math.max(0, num(kgRaw['slots'], kgBase.slots)),
      capacityPerSlot: Math.max(1, num(kgRaw['capacityPerSlot'], kgBase.capacityPerSlot)),
      surfaceYieldMult: Math.max(0, num(kgRaw['surfaceYieldMult'], kgBase.surfaceYieldMult)),
      activeFraction: Math.min(1, Math.max(0, num(kgRaw['activeFraction'], kgBase.activeFraction))),
    },
    frenzy: {
      meter: Math.min(1, Math.max(0, num(frenzyRaw['meter'], 0))),
      remainingSeconds: Math.max(0, num(frenzyRaw['remainingSeconds'], 0)),
    },
  };
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
