# ADR-0003 — Authoritative state lives outside React; no state library

**Status:** Accepted · **Date:** 2026-08-02 · **Phase:** 0

## Context

The simulation ticks at 10 Hz (`SIM_TICK_HZ`). Every tick mutates Mana, generator
output, meters, and timers. A naive React implementation — game state in
`useState`, updated each tick — would trigger a full render tree reconciliation
ten times a second, forever, for a game that is meant to run for hours in a
background tab on a phone.

There is also an ordering problem. The authoritative game state must advance
identically whether or not anything is rendering: during offline catch-up, in a
headless simulation, and in tests. Making React the owner of that state couples
correctness to the view layer, which ADR-0002 exists to prevent.

## Decision

- **`src/sim` owns state as plain data.** `GameState` is a serializable object;
  reducers are pure functions from `(state, input, dt) -> state`.
- **`src/game` owns the loop.** A plain module-level store holds the current
  state, advances it on a fixed timestep, and notifies subscribers.
- **React subscribes, it does not own.** Components read via
  `useSyncExternalStore` — the React 18+ primitive built for exactly this: an
  external mutable source rendering into React safely under concurrent mode.
- **UI notifications are throttled** independently of the sim tick. The sim runs
  at 10 Hz; the HUD does not need to re-render more often than the display
  refreshes, and most panels need far less.
- **No Redux, Zustand, Jotai, or MobX.**

## Why no state library

Those libraries solve _shared mutable state across a component tree_ — which is a
real problem in CRUD applications with many independent writers. This game has
exactly one writer (the tick loop) and one source of truth. `useSyncExternalStore`
plus a ~30-line store covers it completely.

Adding a library here would mean a dependency, a second idiom for state, and
pressure to move game logic into store actions — straight across the ADR-0002
boundary. The genre's own reference implementations (Cookie Clicker, most
open-source incrementals) run a plain object and a `setInterval`; the modern part
worth keeping is the safe subscription primitive, not the ceremony.

## Consequences

**Good:**

- Sim ticks cost nothing in React unless something visible changed.
- Headless simulation, offline catch-up, and tests all drive the same code path.
- Save/load is `JSON.stringify(state)` — no library-specific hydration.

**Bad / accepted:**

- Selector granularity is hand-rolled. If the HUD becomes re-render-heavy, that is
  solved with narrower `useSyncExternalStore` selectors, not a library.
- `useSyncExternalStore` requires a stable `getSnapshot`. Returning a fresh object
  each call causes an infinite loop — a real footgun. Snapshots must be memoized
  and only replaced when the underlying data changes.

## Revisit if

The UI grows genuinely independent writers (e.g. a settings layer with its own
persistence), or profiling shows selector overhead dominating frame time.
