# CLAUDE.md — Clockwork Garden

Standing brief for any session working in this repository. Read this first.

---

## Current state

**Planning only. No game code exists yet.** The repository contains the design
spec, a numerical audit of it, and a build plan.

```
clockwork-garden-design-spec.md   the design (source of truth for WHAT)
docs/                             feasibility, estimate, roadmap, architecture
tools/spec-audit.mjs              numerical audit of the spec's own formulas
```

Start here: `docs/README.md`.

---

## Before writing any game code

Four design questions block implementation. They are decisions for the designer,
not defaults to guess at — building on a guess means rebuilding.

- **`docs/04-spec-open-questions.md` items 1, 2, 3, 6 must be answered.**
- Items 1 and 2 are blockers: as literally specified, Barn Capacity deadlocks
  progression at Tier 11, and Kitchen Garden yield diverges to infinity.

If a session is asked to start building and these are unresolved, **ask** rather
than assume.

---

## Project shape

- **Genre:** bounded incremental, 6–10 hrs, 4 Seasons, 20 generator tiers, plus a
  hand-tended Kitchen Garden subsystem (§2a).
- **Stack:** TypeScript + React + Three.js, browser-first. No server.
- **Scale:** ~15–20k LOC, 35–51 sessions to a full game; 13–19 to a vertical slice.

---

## Rules that matter

**1. `src/sim` stays pure.** No DOM, no React, no Three.js. Deterministic, runnable
under Node. It must never import from `game/`, `ui/`, or `render/`. This is what
makes the balance simulation — and therefore the whole tuning strategy — possible.
Enforce with an ESLint boundary rule.

**2. Data lives in `src/content/`, logic does not.** The 20-tier table, the ~50
tree nodes, the six surfaces, the palette, and **every tunable constant**
(`balance.ts`). Roughly 30% of this project is data; keeping it separate means a
session working on Frost mechanics never loads the Insight tree.

**3. Plain `number`. No big-number library.** Peak magnitude across the whole
campaign is ~1e44 vs float64's 1.8e308 (`node tools/spec-audit.mjs`, audit 5).
Values exceed `MAX_SAFE_INTEGER`, so never assume integer exactness in saves.

**4. Saves are versioned from v1**, with a migration test per version and a frozen
fixture of each old format. Retrofitting this after playtesters have saves is
expensive.

**5. Offline progress is computed analytically**, never by ticking. Eight hours at
10 Hz is 288,000 ticks; closed-form integration over §7's taper is instant and
testable.

**6. Protect the invariants.** These encode the design's promises. Full list and
rationale in `docs/03-technical-architecture.md` §8:
   - tier payback time stays flat (~150–180s) across all 20 tiers
   - Barn Capacity always exceeds the next tier's cost
   - total Mana/sec stays finite for every Kitchen Garden configuration
   - Night never gates the Bell, Garden Plots, Frenzy, Pollination, or Festival
   - active play out-earns full automation
   - core cost multipliers stay inside 1.07–1.12

---

## What this environment can and cannot do

- **Chromium + Playwright are pre-installed** (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
  Never run `playwright install`. Drive the game, screenshot it, and read the image
  — this catches layout, overflow, contrast, and empty-panel bugs without a human.
- **npm is reachable. Most of the web is not.** `kenney.nl` and `game-icons.net`
  are blocked by the environment's network policy (403 at the gateway). UI icons
  are available via npm as `@iconify-json/game-icons`; the 3D packs need either a
  policy change or committing to `assets/vendor/`. See `docs/05-asset-pipeline.md`.
- **Never disable TLS verification or unset `HTTPS_PROXY`.** If a tool fails TLS
  or gets a 403/405/407, see `/root/.ccr/README.md`.

---

## What Claude cannot judge here

Say so plainly rather than guessing:

- **Game feel.** Frenzy's 20s window, Perfect Planting's 2s tolerance, the 3s
  Pollination window. Implement them as constants in `content/balance.ts` and
  report consequences; a human decides the values.
- **Art direction.** Screenshots verify correctness, not taste.
- **Audio.** Cannot be evaluated at all. Human-owned workstream.

Phases 5, 6, 11, and 12 have human gates for exactly these reasons.

---

## Working style for this repo

- One phase per session where possible — cross-phase sessions carry both phases'
  context for the whole conversation.
- Use `npm test` as the verification loop, not file re-reads. Test output is
  hundreds of tokens; re-reading modules is tens of thousands.
- Update this file when a phase completes or an architectural decision changes.
- Branch: `claude/game-feasibility-analysis-rfct2r` unless told otherwise.
