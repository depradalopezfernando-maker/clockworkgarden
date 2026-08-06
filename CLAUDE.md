# CLAUDE.md — Clockwork Garden

Standing brief for any session working in this repository. Read this first.

---

## Current state

**Phase 7 DONE — Season 2 has its mechanic.** The Pollination Combo (§6.1)
plays: three flowers under the Bell, a 3s chain window, Bronze/Silver/Golden
Blooms that MULTIPLY with a Frenzy, the Tier 8 drone auto-attempting at 40%, and
the "Both Blooms" capstone (D4b). The exit criterion is met with a 1.7x margin.
Report: `docs/11-phase-7-pollination.md`.

**One decision came out of Phase 7 and should be taken before Phase 8: D7 is
REOPENED.** The archetype spread is x2.45 against §8's band ratio of x1.67, and
it is structural rather than a mis-fit — §6.1 is an active-play multiplier, so
§9's "active play out-earns automation" and §8's band now pull against each
other. §6.2 and §6.3 will each widen it again. Three measured options in
`docs/11` §3; a human picks. `npm run simulate` reports and pins it meanwhile.

**Phase 6 IN PROGRESS — the 3D garden renders.** Session 1 of 4-6 built the
pipeline end to end: three.js behind a `GardenView` interface, a fixed isometric
camera, glTF import with palette recolour and outlines, and a live diorama that
reacts to owned counts, plot stages, Season and Frenzy. What is done and what is
not: `docs/10-phase-6-presentation.md`.

Phases 0-5 are complete and the vertical slice plays.

Everything through Season 2 works end to end: Bell, generators, Growth Frenzy,
Pollination, the Insight tree, milestones, the full Kitchen Garden (§2a), the
First Bloom and Both Blooms capstones, the prestige loop, onboarding, versioned
saves, offline progress.

**The first play session happened (2026-08-04) and changed six things — see
`docs/09-playtest-revisions.md`.** The most serious: Insight gated eight
generator tiers, so spending it wrongly could **soft-lock the game**. Tiers now
gate on owned counts; Insight buys strength, never access.

**The Kitchen Garden question is settled.** Option (c) moved the two capacity
surfaces a Season earlier and exposed a **Day Time deadlock that froze the garden
permanently**. Option (d) then raised per-plot yield behind a soft cap. It now
supplies ~25% of income across a run and 32.4% at the end, up from 2.9% and 3.5%.
See `docs/07` §5 and `docs/09` §3.

```
clockwork-garden-design-spec.md   the design (source of truth for WHAT)
docs/                             feasibility, estimate, roadmap, architecture
docs/adr/                         load-bearing technical decisions
tools/spec-audit.mjs              numerical audit of the spec's own formulas
tools/screenshot.mjs              drive the app, capture it, report layout problems
src/content/balance.ts            EVERY tunable constant, with provenance tags
src/content/palette.ts            LOCKED palette (§11): Enamel + Slate, human-picked
src/content/generators.ts         the 20-tier table (§2), transcribed
src/content/insightTree.ts        64 nodes (§3). None of them gate progression
src/content/milestones.ts         46 milestones — the ONLY source of Insight
src/content/surfaces.ts           the six Kitchen Garden surfaces (§2a)
src/sim/pollination.ts            §6.1 chain, Blooms, and the deterministic drone
src/sim/capstone.ts               First Bloom (D4a) + Both Blooms (D4b); S3-S4 are placeholders
src/sim/                          pure economy: costs, prestige, offline, frenzy, tick
src/game/                         runtime: store + loop + versioned saves
src/ui/                           React shell, HUD, formatting
src/render/                       three.js diorama behind a GardenView interface
src/content/diorama.ts            model registry + Kenney material -> palette role
tools/stage-models.ts             copies ONLY the referenced models into public/
tools/simulate.ts                 the balance report. Run it after any content change
tools/fit.ts                      sweeps constants against the pacing targets
tools/smoke.mjs                   drives the built app in Chromium end to end
tools/fetch-assets.mjs            CC0 art packs, pinned by URL + SHA-256
tests/fixtures/saves/             FROZEN old save formats. Never edit these
```

Start here: `docs/README.md`. Verify with `npm run ci`.
Latest balance numbers: `docs/11-phase-7-pollination.md`.

**D7 (2026-08-04, REOPENED same day by Phase 7): §8's 6-10h target applies to the
idle and casual archetypes only.** `active` finishes at 3.45h and that is
accepted — it is a deliberately extreme model, and §9 requires active play to
out-earn automation. The SPREAD is now x2.45 against the band's x1.67, past the
condition that was written down as reopening D7, and no pacing constant fixes it
because §6.1 pays attention by design. `npm run simulate` prints it as `[KNOWN]`
and pins it at x2.6 so a regression still fails. **Decide before Phase 8:
`docs/11` §3.**

**The gate:** play it for ninety minutes and answer four questions —
is the core loop satisfying? Does Frenzy feel worth chasing? Does the Kitchen
Garden read as meaningful or as busywork (§10 item 10)? Does the first prestige
feel like a reward? See `docs/08-vertical-slice.md`.

**Phase 6 was cleared to start on 2026-08-04, and Phase 7 shipped the same day.**
Phase 8 (Season 3, the Harvest Festival) is gated on two answers: the Season 3
capstone, and the reopened D7.

---

## Design decisions already taken

The four questions that blocked implementation were decided on 2026-08-02.
Full rationale in `docs/04-spec-open-questions.md`
("Decisions taken"); these override the spec text where they conflict.

```
D1  BarnCapacity = max(500 × TotalManaPerSec, 2.5 × CostOfNextUnpurchasedTier)
D2  PlotContribution = softCap(BaseFraction × mods × GardenPlotManaPerSec)
    BaseFraction = 0.0314, soft cap 0.55   // docs/09 §3; ~1/3 at full build-out
D3  TotalSQP = max(0, floor(K × log10(LifetimeMana / REF)))  // K = 8, REF = 2e1
    PrestigeMultiplier = 1 + 0.02 × TotalSQP
    LifetimeMana is ALL-TIME and does not reset. SQP is absolute, never summed.
D6  Seasons advance on capstone-clear only. §8's timeline is a prediction the
    simulation validates, not a trigger. Prestige is renamed ("Turn the Soil").
D4a Season 1 capstone = "First Bloom": reach 1600 Mana/sec DURING a Growth
    Frenzy. Retry instantly on failure, no penalty. Calibrated so a normally
    built player clears it first try but cannot clear it by idling.
D4b Season 2 capstone = "Both Blooms": land a Golden Bloom (Pollination chain
    of 9) DURING a Growth Frenzy — §6.1's own "peak moment". Same retry and
    difficulty rules as D4a. BUILT in Phase 7. It carries NO rate floor: the
    readiness gate (10x Tier 9) is the build test, the chain is the skill test.
D7  §8's 6-10h band applies to the idle and casual archetypes. `active` may
    finish faster. REOPENED by Phase 7: the spread is x2.45, past the band's
    x1.67, and no pacing constant fixes it. Decide from `docs/11` §3.
```

K and REF are **fitted together** (`npm run fit`, and the 2D sweep in `docs/09`
§6) — they pull against each other, because lowering K to lengthen the campaign
also shrinks the first prestige. REF is not the spec's 1e6: a player holds only
~9e5 lifetime Mana when prestige unlocks, so 1e6 made the first reset worth
exactly nothing. See `docs/06` §2 and `docs/09` §6.

Settled since: **no anti-tamper** (ADR-0004 — single-player, no leaderboards,
obfuscation costs effort and protects nothing).

**Still open, and they gate later phases — ask, do not guess:** the Season 3
capstone and the **reopened D7** (both block Phase 8; the capstone should test
the Harvest Festival, and the Barn's shape may move once it is real). Season 1
and 2 are decided (D4a, D4b) and Season 4's is specified by §6.3 — The Long
Night. Also open: whether prestige
wipes banked Insight (`docs/04` item 10 — Reading B implemented); offline Kitchen
Garden behaviour (`docs/04` item 7 — crops currently grow on engaged-play time
only). How to make the Kitchen Garden matter is **settled** — option (c),
`docs/07` §5.

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

**7. Nothing outside `src/render/` imports three.js.** The UI holds a
`GardenView`; `src/render/index.ts` decides whether that is WebGL or the null
implementation. That is what keeps the 2D build a real, runnable target - and
three.js is dynamically imported, so a player without WebGL never downloads
570KB they cannot use.

**8. Models are not committed.** `npm run assets` fetches the CC0 packs (pinned
by URL and SHA-256) and stages ONLY the models the registry references into the
gitignored `public/models/` - 37 files, 0.42MB, out of 329 and 10.5MB.

**A FRESH CLONE THEREFORE RENDERS AN EMPTY GARDEN until `npm run assets` runs.**
That is expected; what was not is that it used to happen in silence, because
`ThreeGardenView` catches every load failure so one missing prop cannot take the
game down. A playtester got a blank blue panel and a clean console. The panel now
carries a notice naming the command, `loadTemplate` records every failure in
`missingModels()`, and one console error explains it. Record the failure on the
PROMISE, not in three's `onError` callback - the loader goes through `fetch` and
a URL it cannot even parse rejects without the callback ever running.

**6. Protect the invariants.** These encode the design's promises. Full list and
rationale in `docs/03-technical-architecture.md` §8:

- tier payback time stays flat (~150–180s) across all 20 tiers
- Barn Capacity always exceeds the next tier's cost
- total Mana/sec stays finite for every Kitchen Garden configuration
- Night never gates the Bell, Garden Plots, Frenzy, Pollination, or Festival
- active play out-earns full automation
- core cost multipliers stay inside 1.07–1.12
- NO generator tier gates on Insight. Tiers open on owning ten of the previous
  tier; Insight buys strength, never access. Gating access on a spendable
  currency soft-locks players who spend it elsewhere (docs/09 §1)
- `tiersUnlocked` is a high-water mark: prestige zeroes `owned`, so without it a
  reset would re-lock every tier the player had opened
- claimed milestones survive prestige — otherwise every reset re-pays the same
  Insight and the tree becomes free
- no Insight node silently does nothing: every effect kind is applied or listed
  in `PENDING_EFFECT_KINDS`
- Night pauses ONLY new Kitchen Garden actions — never the Bell, Garden Plots,
  Frenzy, Pollination or the Festival (§2a's narrow blast radius)
- the §6.1 drone works an IDLE chain only. It must never be able to break a
  chain the player is driving — automation that can sabotage active play inverts
  §6.1's own guardrail
- active play out-earns the drone. Measured, not assumed: `expectedDroneMultiplier`
  against a held Golden Bloom, asserted in `tests/sim/pollination.test.ts`
- Day Time is spend-only and never ticks down on a timer (§9 lists real-time
  energy gates as a known failure mode)

---

## What this environment can and cannot do

- **Chromium + Playwright are pre-installed** (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
  Never run `playwright install`. Drive the game, screenshot it, and read the image
  — this catches layout, overflow, contrast, and empty-panel bugs without a human.
- **Assets are UNBLOCKED (2026-08-04).** The network policy was widened;
  `kenney.nl` and `game-icons.net` both resolve. `npm run assets:fetch` pulls
  Kenney's Nature Kit (329 CC0 `.glb` models, crops with growth stages) into
  the gitignored `assets/vendor/`, pinned by URL and SHA-256. UI icons come from
  npm as `@iconify-json/game-icons`. See `docs/05-asset-pipeline.md`.
- **Node's built-in `fetch` ignores `HTTPS_PROXY`** and 403s at the gateway while
  `curl` to the same URL works. It needs `NODE_USE_ENV_PROXY=1` (Node >= 22.21),
  and that must be set BEFORE the process starts — Node reads it at boot, so
  assigning `process.env` in the script is too late (measured). `fetch-assets.mjs`
  re-execs itself, and only when a proxy is actually configured.
- **The npm scripts must run on Windows too.** A `VAR=1 node ...` prefix is POSIX
  syntax that cmd.exe cannot parse; it broke `npm run assets` outright for a
  playtester. Nothing in `scripts` may carry an env-var prefix, and no tool may
  assume a Unix binary exists — `fetch-assets.mjs` tries tar, then unzip, then
  PowerShell rather than calling `unzip` and hoping.
- **Never disable TLS verification or unset `HTTPS_PROXY`.** If a tool fails TLS
  or gets a 403/405/407, see `/root/.ccr/README.md`.

---

## What Claude cannot judge here

Say so plainly rather than guessing:

- **Game feel.** Frenzy's 20s window, Perfect Planting's 2s tolerance, the 3s
  Pollination window. Implement them as constants in `content/balance.ts` and
  report consequences; a human decides the values.
- **Art direction.** Screenshots verify correctness, not taste. The palette was
  picked by a human on 2026-08-04 (Enamel seasons, Slate chrome) and is now
  LOCKED — assets get recoloured to it at import, so reopening is not cheap.
- **Audio.** Cannot be evaluated at all. Human-owned workstream.

Phases 5, 6, 11, and 12 have human gates for exactly these reasons.

---

## Commands

```
npm run ci          typecheck + lint + format:check + test + build   (the gate)
npm run assets      fetch the CC0 packs AND stage the models the game uses
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
