# CLAUDE.md — Clockwork Garden

Standing brief for any session working in this repository. Read this first.

---

## Current state

**Phase 5 complete. THE VERTICAL SLICE IS READY TO PLAY — the next step is a
human gate, not a phase.** `npm run dev`, then ninety minutes unassisted.

Everything through Season 1 works end to end: Bell, generators, Growth Frenzy,
the Insight tree, milestones, the full Kitchen Garden (§2a), the First Bloom
capstone, the prestige loop, onboarding, versioned saves, offline progress.

**Read `docs/07-phase-4-kitchen-garden-report.md` §2 before Phase 5.** The
Kitchen Garden supplies ~3.5% of income in real play, not the ~1/3 D2 targets,
and the fix is a design choice awaiting the designer.

```
clockwork-garden-design-spec.md   the design (source of truth for WHAT)
docs/                             feasibility, estimate, roadmap, architecture
docs/adr/                         load-bearing technical decisions
tools/spec-audit.mjs              numerical audit of the spec's own formulas
tools/screenshot.mjs              drive the app, capture it, report layout problems
src/content/balance.ts            EVERY tunable constant, with provenance tags
src/content/palette.ts            locked palette (§11) — HUMAN REVIEW PENDING
src/content/generators.ts         the 20-tier table (§2), transcribed
src/content/insightTree.ts        50 nodes (§3). Eight of them open generator tiers
src/content/milestones.ts         37 milestones — the ONLY source of Insight
src/content/surfaces.ts           the six Kitchen Garden surfaces (§2a)
src/sim/capstone.ts               First Bloom (D4a); S2-S4 are placeholders
src/sim/                          pure economy: costs, prestige, offline, frenzy, tick
src/game/                         runtime: store + loop + versioned saves
src/ui/                           React shell, HUD, formatting
tools/simulate.ts                 the balance report. Run it after any content change
tools/fit.ts                      sweeps constants against the pacing targets
tools/smoke.mjs                   drives the built app in Chromium end to end
tests/fixtures/saves/             FROZEN old save formats. Never edit these
```

Start here: `docs/README.md`. Verify with `npm run ci`.
Latest balance numbers: `docs/06-phase-1-balance-report.md`.

**The gate:** play it for ninety minutes and answer four questions —
is the core loop satisfying? Does Frenzy feel worth chasing? Does the Kitchen
Garden read as meaningful or as busywork (§10 item 10)? Does the first prestige
feel like a reward? See `docs/08-vertical-slice.md`.

**Do not start Phase 6 or 7 before that verdict.** The whole point of stopping
here is to find out the design does not work while only ~5 sessions are sunk
into Seasons 2-4 rather than all of them.

---

## Design decisions already taken

The four questions that blocked implementation were decided on 2026-08-02.
Full rationale in `docs/04-spec-open-questions.md`
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
D4a Season 1 capstone = "First Bloom": reach 1200 Mana/sec DURING a Growth
    Frenzy. Retry instantly on failure, no penalty. Calibrated so a normally
    built player clears it first try but cannot clear it by idling.
```

K and REF were **fitted in Phase 1** (`npm run fit`). REF is not the spec's 1e6:
the simulation found a player holds only ~9e5 lifetime Mana when prestige
unlocks, so 1e6 made the first reset worth exactly nothing. See
`docs/06-phase-1-balance-report.md` §2.

Settled since: **no anti-tamper** (ADR-0004 — single-player, no leaderboards,
obfuscation costs effort and protects nothing).

**Still open, and they gate later phases — ask, do not guess:** the Season 2 and
3 capstones (block Phases 7 and 8; Season 1's is decided — D4a); how to
make the Kitchen Garden matter (`docs/07` §2); whether prestige wipes banked
Insight (`docs/04` item 10 — Reading B implemented); offline Kitchen Garden
behaviour (`docs/04` item 7 — crops currently grow on engaged-play time only).

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
- every "Insight skill unlock" tier has exactly one node, and no node opens a
  tier that is not Insight-gated
- claimed milestones survive prestige — otherwise every reset re-pays the same
  Insight and the tree becomes free
- no Insight node silently does nothing: every effect kind is applied or listed
  in `PENDING_EFFECT_KINDS`
- Night pauses ONLY new Kitchen Garden actions — never the Bell, Garden Plots,
  Frenzy, Pollination or the Festival (§2a's narrow blast radius)
- Day Time is spend-only and never ticks down on a timer (§9 lists real-time
  energy gates as a known failure mode)

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
npm run simulate    the balance report (also a CI gate)
npm run fit         sweep constants against the pacing targets
npm run smoke       drive the built app in Chromium: play, reload, offline
```

`npm run smoke` needs a preview server on :4173, same as `screenshot`.

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
