# Technical Architecture (Proposed)

Stack decision: **TypeScript + React + Three.js, browser-first.** This document
proposes the shape of the codebase. It is a starting point for Phase 0, not a
finished design — but the load-bearing choices below are the ones that are
expensive to change later, so they are argued rather than asserted.

---

## 1. Why this stack fits

- **No server.** Single-player, one-time purchase, offline-capable. A static
  bundle plus `localStorage` is the entire infrastructure.
- **Deployment breadth.** Ships to web immediately; wraps to desktop (Tauri) and
  mobile (Capacitor) later without a rewrite. Matches §Monetization's one-time
  purchase model on any store.
- **Agent-verifiable end to end.** The whole thing runs headlessly under Node for
  simulation, and under Playwright + Chromium (both pre-installed here) for visual
  checks. Compare with Unity or Godot, where scene graphs live in GUI-authored
  files an agent edits blind — a difference worth several sessions of friction per
  phase.

---

## 2. The one decision that shapes everything: separate the sim from the view

```
┌──────────────────────────────────────────────────────┐
│  src/sim/         PURE. No DOM. No React. No Three.  │
│                   Deterministic. Runs under Node.    │
└──────────────────────────────────────────────────────┘
                          │  state snapshots
                          ▼
┌──────────────────────────────────────────────────────┐
│  src/game/        Runtime: loop, save, offline, RNG  │
└──────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌────────────────────┐        ┌────────────────────────┐
│  src/ui/  (React)  │        │  src/render/ (Three.js)│
│  HUD, panels, tree │        │  iso scene, dioramas   │
└────────────────────┘        └────────────────────────┘
```

**`src/sim` must never import from `game`, `ui`, or `render`.** Enforce it with an
ESLint boundary rule in Phase 0, not by convention.

This single constraint is what makes Phase 1 possible: the entire economy can be
simulated for 10 hours of game time in under a second, thousands of times, with no
browser. It is also what makes the game testable, tunable, and refactorable
afterwards. If one architectural rule survives from this document, make it this
one.

`src/render` is deliberately optional and swappable — the 2D placeholder build
from Phase 2 stays runnable throughout as a fallback and a fast test target.

---

## 3. Layout

```
src/
  sim/                 # pure, deterministic, Node-runnable
    economy.ts         # §2 generator cost/yield
    prestige.ts        # §4
    offline.ts         # §7
    frenzy.ts          # §5
    pollination.ts     # §6.1
    harvest.ts         # §6.2
    frost.ts           # §6.3
    kitchenGarden/     # §2a — its own folder; it is a subsystem
    state.ts           # GameState type + reducers
    selectors.ts       # derived values (totalManaPerSec, …)
  game/
    loop.ts            # fixed-timestep tick driver
    save/              # versioned schema + migrations
    rng.ts             # seeded — determinism matters for replayable sims
  content/             # DATA ONLY, no logic
    generators.ts      # the 20-tier table
    insightTree.ts     # ~50 nodes
    milestones.ts
    surfaces.ts        # §2a's six surfaces
    palette.ts         # §11 consistency guardrail, as data
    balance.ts         # EVERY tunable constant, single file
  ui/                  # React
  render/              # Three.js (optional layer)
tools/
  spec-audit.mjs       # spec numerical audit (exists)
  simulate.ts          # Phase 1 balance harness
  sweep.ts             # parameter sweeps
tests/
assets/vendor/         # committed CC0 packs (see docs/05)
```

**`content/` exists for token economy as much as for cleanliness.** Roughly 30% of
this project is data; keeping it out of logic files means a session working on
Frost mechanics never loads 50 tree nodes.

**`content/balance.ts` holds every tunable constant** — Frenzy duration, Perfect
Planting window, chain window, Day Length, Festival cadence, BaseFraction. Phase
11 then never needs to read game code. §10's ten open questions are ten constants
in one file.

---

## 4. Numbers: plain `number`, no big-number library

Audit 5 (`node tools/spec-audit.mjs`) measured worst-case magnitude across the
whole campaign — 400 units of Tier 20 with a generous prestige multiplier — at
**~1e44**, against float64's ceiling of 1.8e308. That is 14% of the exponent
range.

**Consequences:**

- No `break_infinity.js`. One fewer dependency, faster ticks, and no serialization
  edge cases.
- Values exceed `MAX_SAFE_INTEGER` (9e15), so **nothing may assume integer
  exactness**. Never `===` a Mana total; never round-trip through anything that
  assumes integers. Relevant to saves, not gameplay.
- Formatting is a real module: suffix notation (K/M/B/T/Qa…) with a scientific
  fallback. Underestimated every time; budget for it in Phase 2.

Record this as an ADR in Phase 0 — it is a decision future sessions will otherwise
re-litigate.

---

## 5. The tick loop

**Fixed timestep, accumulator-driven, decoupled from render.**

- Sim tick: **10 Hz**. Generous for an incremental and keeps sub-second mechanics
  (Perfect Planting's 2s window, Frenzy meter drain) crisp.
- Render: `requestAnimationFrame`, interpolating between sim states.
- Catch-up: on tab-refocus, advance in bounded chunks — never a single enormous
  delta, and never an unbounded loop that freezes the tab. This is the classic
  incremental-game bug.
- **Offline (§7) is computed analytically, not by ticking.** Eight hours at 10 Hz
  is 288,000 ticks; closed-form integration over the taper curve is instant and
  exact. It also makes offline progress unit-testable without simulating time.

Determinism is a requirement, not a nicety: the same seed and the same input
sequence must produce the same state, or Phase 1's sweeps and Phase 11's
regression tests are meaningless.

---

## 6. Save format

Not in the spec (`docs/04` item 9), needed from Phase 2.

```ts
interface SaveFile {
  version: number;        // integer, monotonic
  savedAt: number;        // epoch ms — offline progress depends on it
  state: GameState;
}
```

- **Versioned from v1**, with a migration chain `v1→v2→v3…`. Each migration gets a
  test with a frozen fixture of the old format. Retrofitting this after playtesters
  have saves is far more expensive than doing it now.
- Autosave every 10s and on `visibilitychange`.
- Export/import as base64 — playtesters need to hand you broken states, and you
  need to hand them repro states.
- **No anti-tamper.** Single-player, no leaderboards, no IAP. Obfuscation costs
  real effort and protects nothing. (Confirm in `docs/04` item 9.)
- Clock-skew: if `savedAt` is in the future, clamp offline progress to zero rather
  than granting it. Cheap guard against a common support headache.

---

## 7. Rendering, and how an agent verifies it

`src/render` sits behind a narrow interface:

```ts
interface Presenter {
  mount(el: HTMLElement): void;
  sync(state: GameState, alpha: number): void;   // alpha = interpolation factor
  dispose(): void;
}
```

Two implementations: `NullPresenter` (Phase 2's 2D placeholder, and the test
target forever) and `IsoPresenter` (Phase 6's Three.js scene). Tests run against
the null presenter and stay fast; the 2D build remains a working fallback if the
3D work slips.

**Verification loop, which is what makes the 3D phase tractable at all:**

1. Playwright drives the running game to a known state.
2. Screenshot.
3. Claude *reads the image* and checks composition, overflow, contrast, empty
   panels, z-order.
4. Iterate.

This genuinely catches layout and rendering bugs without a human. It does not
catch "this doesn't feel good" — that is Phase 6's human art gate, and no amount
of tooling replaces it.

Budget targets for Phase 6: ≤150 draw calls, ≤50k triangles, 60fps on mid-range
mobile. Instance the Kitchen Garden tiles; they are the obvious hot spot at 20
slots × 5 capacity.

---

## 8. Testing strategy

| Layer | Tool | What it protects |
|---|---|---|
| Formulas | Vitest | §2/§4/§7 arithmetic, exactly as specified |
| **Invariants** | Vitest | The properties below — the highest-value tests here |
| Balance | `tools/simulate.ts` | Campaign lands in 6–10 hrs, 4–5 prestiges |
| Saves | Vitest + fixtures | Every migration, from every old version |
| UI | Playwright + Chromium | Smoke flows, screenshots |

**Invariant tests are where the real value is.** Each is a genuine failure mode
this design has, drawn from the audit and the spec's own guardrails:

- Tier payback time stays flat (~150–180s) across all 20 tiers — the property that
  makes the economy readable, and the one most likely to be broken by tuning.
- Barn Capacity always exceeds the next tier's cost (`docs/04` item 1 — the found
  deadlock can never return).
- Total Mana/sec is finite and non-recursive for every Kitchen Garden
  configuration up to 20 Clockwork Trellis slots (`docs/04` item 2).
- Night never gates the Bell, Garden Plots, Frenzy, Pollination, or Festival
  (§2a's narrow blast radius — easy to regress, invisible when it does).
- Active play out-earns full automation (§9's guardrail).
- Cost multipliers stay inside 1.07–1.12 for all core generators (§9).

These encode the design's promises as executable assertions. When a future tuning
session breaks one, CI says which promise was broken and why it mattered.
