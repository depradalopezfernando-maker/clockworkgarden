# CLAUDE.md — Clockwork Garden

Standing brief for any session working in this repository. Read this first.

---

## Current state

**Phase 1 complete. Phase 2 is next — the minimum playable loop.**
The economy is built, simulated, and lands in 6-10 hours. No UI exists yet.

```
clockwork-garden-design-spec.md   the design (source of truth for WHAT)
docs/                             feasibility, estimate, roadmap, architecture
docs/adr/                         load-bearing technical decisions
tools/spec-audit.mjs              numerical audit of the spec's own formulas
tools/screenshot.mjs              drive the app, capture it, report layout problems
src/content/balance.ts            EVERY tunable constant, with provenance tags
src/content/palette.ts            locked palette (§11) — HUMAN REVIEW PENDING
src/content/generators.ts         the 20-tier table (§2), transcribed
src/sim/                          pure economy: costs, prestige, offline, harness
tools/simulate.ts                 the balance report. Run it after any content change
tools/fit.ts                      sweeps constants against the pacing targets
```

Start here: `docs/README.md`. Verify with `npm run ci`.
Latest balance numbers: `docs/06-phase-1-balance-report.md`.

**Phase 2's job:** React shell, Bell, generator list, Growth Frenzy, versioned
save/load with migrations, offline wired to the real clock, number formatting.
Deliberately plain 2D - the 3D layer is Phase 6.

---

## Design decisions already taken

The four questions that blocked implementation were decided on 2026-08-02.
**Phase 1 is unblocked.** Full rationale in `docs/04-spec-open-questions.md`
("Decisions taken"); these override the spec text where they conflict.

```
D1  BarnCapacity = max(500 × TotalManaPerSec, 2.5 × CostOfNextUnpurchasedTier)
D2  PlotContribution = BaseFraction × mods × GardenPlotManaPerSec   // NOT total
    BaseFraction = 0.004      // sim-fitted; target ~1/3 of income at full build
D3  TotalSQP = max(0, floor(K × log10(LifetimeMana / REF)))  // K = 35, REF = 5e4
    PrestigeMultiplier = 1 + 0.02 × TotalSQP
    LifetimeMana is ALL-TIME and does not reset. SQP is absolute, never summed.
D6  Seasons advance on capstone-clear only. §8's timeline is a prediction the
    simulation validates, not a trigger. Prestige is renamed ("Turn the Soil").
```

K and REF were **fitted in Phase 1** (`npm run fit`). REF is not the spec's 1e6:
the simulation found a player holds only ~9e5 lifetime Mana when prestige
unlocks, so 1e6 made the first reset worth exactly nothing. See
`docs/06-phase-1-balance-report.md` §2.

**Still open, and they gate later phases — ask, do not guess:** Season 1 and 2
capstones are undesigned (blocks Phase 5, the vertical-slice go/no-go); offline
Kitchen Garden behaviour (Phase 4); anti-tamper stance (Phase 2).

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

## Commands

```
npm run ci          typecheck + lint + format:check + test + build   (the gate)
npm test            vitest run
npm run dev         vite dev server
npm run audit:spec  re-derive the economy's properties from the tier table
npm run screenshot  drive a running preview, capture it, report layout problems
```

`npm run screenshot` needs a server: `npm run build && npx vite preview --port 4173 &`
then `node tools/screenshot.mjs http://localhost:4173/ out.png`. Read the PNG.
Note: never `pkill -f "vite preview"` — the pattern matches its own shell and
kills the session. Use `fuser -k 4173/tcp`.

## Working style for this repo

- One phase per session where possible — cross-phase sessions carry both phases'
  context for the whole conversation.
- Use `npm test` as the verification loop, not file re-reads. Test output is
  hundreds of tokens; re-reading modules is tens of thousands.
- Prettier formats everything except `clockwork-garden-design-spec.md`, which is
  the designer's source of truth and must never be reformatted.
- Update this file when a phase completes or an architectural decision changes.
- Branch: `claude/game-feasibility-analysis-rfct2r` unless told otherwise.
