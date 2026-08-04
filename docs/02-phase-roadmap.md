# Phase Roadmap

Thirteen phases, ordered to **retire risk as early and as cheaply as possible**.
Each has entry criteria, a concrete deliverable, and an exit test. Phases with a
**HUMAN GATE** cannot be closed by an agent — they need you to look, play, or
decide.

**Guiding principle:** the two things most likely to kill this project are (a) an
economy that is not fun, and (b) presentation that never comes together. Phase 1
tests (a) before any UI exists. Phase 5 tests it again with a human. Phase 6
front-loads (b) rather than leaving it to the end.

---

## Dependency shape

```
  0 ──▶ 1 ──▶ 2 ──▶ 3 ──▶ 4 ──▶ 5 ═══▶ [VERTICAL SLICE — GO / NO-GO]
                            │           │
                            │           ├──▶ 6 (3D presentation)
                            │           └──▶ 7 ──▶ 8 ──▶ 9 ──▶ 10
                            │                                  │
                            └──────────────────────────────────┴──▶ 11 ──▶ 12
```

Phase 6 runs in parallel with 7–9 if you want; it shares no logic with them. The
roadmap assumes it runs after Phase 5 so the vertical slice is judged on
_gameplay_, not on how it looks.

---

## Phase 0 — Foundations & Decisions ✅ COMPLETE (2026-08-02, 1 session)

- ✅ Design decisions D1/D2/D3/D6 resolved and transcribed into
  `src/content/balance.ts`, every constant tagged SPEC / SIM / HUMAN.
- ✅ Scaffold: Vite + TypeScript strict + React 19 + Vitest + ESLint 10 + Prettier.
- ✅ CI: typecheck, lint, format, test, build, spec audit on every push.
- ✅ `CLAUDE.md` standing brief.
- ✅ **Palette locked as data** — `src/content/palette.ts`, four Season ramps plus
  the §11 silhouette treatment. **Human art review still pending** (flagged in
  the file); it is a defensible starting point, not an art-directed choice.
- ✅ ADRs 0001–0004: plain `number`, sim purity, state outside React, versioned
  saves. Each carries a "revisit if" clause.
- ✅ **The `src/sim` purity boundary is lint-enforced _and_ the lint rules are
  themselves tested** (`tests/architecture/boundary.test.ts`) — a rule nobody
  verifies is a rule that silently stops working.
- ✅ `tools/screenshot.mjs` — the visual verification loop, working end to end.

**Exit met:** `npm run ci` green, 41 tests passing, app builds and renders.

**Carried forward:** the palette needs a human eye before Phase 6 sources any
asset. Nothing else is blocked.

---

## Phase 1 — Headless Economy & Balance Simulation ⭐ ✅ COMPLETE (2026-08-02, 1 session)

**Result: all three archetypes finish in 6–10h.** See `docs/06-phase-1-balance-report.md`.
Original plan follows.

**Sessions: 3–4** · Entry: Phase 0

**The highest-leverage phase in the plan. No UI is written.**

- Implement §2 (generators, costs, yields), §4 (prestige), §7 (offline) as pure,
  side-effect-free TypeScript.
- Transcribe the 20-tier table as data with a **regression test locking the flat
  ~150–180s payback property** identified in the audit, so later tuning cannot
  silently break it.
- Build the simulation harness: run the campaign forward at configurable
  clicks-per-minute and session patterns, output time-to-each-Season, prestige
  timings, and Mana curves.
- Answer §10's questions 1, 2, 3, 10 numerically.
- **Fit the sim-tuned constants** from the decisions: D3's prestige coefficient
  `K` (starting 40) against the "4–5 natural resets" target, and D2's
  `BaseFraction` (starting 0.004) against the "~⅓ of income at full build-out"
  target. Formula shapes are fixed; only these coefficients move.

**Exit:** a report showing simulated campaign length inside **6–10 hours** across
at least three player archetypes (idle / casual / active), and 4–5 natural
prestiges occurring. **If it does not land, tune here — this is the cheapest place
it will ever be.**

---

## Phase 2 — Minimum Playable Loop ✅ COMPLETE (2026-08-02, 1 session)

**Exit met.** 180 tests plus 15 browser smoke checks. The built app runs in
Chromium: ring the Bell, trigger a Frenzy, buy generators, watch production
accrue, reload with progress intact, return after 4 simulated hours away and
find offline Mana credited (1463 against 1440 expected).

Three display bugs were caught by reading a screenshot rather than by assertions:
rates floored to `0/s` for a generator producing 0.1/s, generator name and detail
ran together as one word, and a trailing-zero trim turned 550 into 55.

Original plan follows.

**Sessions: 3–4** · Entry: Phase 1 exit met

- React shell, HUD, Bell, generator purchase list. Deliberately plain 2D.
- Growth Frenzy (§5) with all timings in one tunable config.
- **Save/load with a versioned schema and migration tests** (`docs/04` item 9).
- Offline progress wired to the real clock.
- Number formatting (suffix notation) — mundane, universally underestimated.
- Playwright smoke test: load, click, buy, reload, state persists.

**Exit:** a human can play Season 1's first 15 minutes in a browser, close the
tab, return, and find correct offline progress.

---

## Phase 3 — Insight Tree & Milestones ✅ COMPLETE (2026-08-02, 1 session)

**Exit met.** 232 tests plus 21 browser smoke checks. 50 nodes, 37 milestones,
all eight "Insight skill unlock" tiers resolved to real nodes (`docs/04` item 5
closed), and the campaign still lands in 6–10 hours against the real gates
(9.12 / 7.58 / 6.08h) after re-fitting K and the reference.

Two findings: turning on real gates initially **stalled every archetype at Season
1** because the harness never claimed milestones, and the tree's production
bonuses as first authored pushed casual and active below the 6-hour floor. Both
in `docs/06-phase-1-balance-report.md` §7a.

Original plan follows.

**Sessions: 2–3** · Entry: Phase 2

- Milestone engine (§3): predicates over game state awarding Insight.
- Author the full ~50-node tree as data, resolving `docs/04` item 5 — every
  "Insight skill unlock" gate becomes a real node with real edges.
- Tree UI: layout, prerequisites, purchase, respec stance.
- Cosmetic-only nodes included (§3 calls for them; they cost almost nothing and
  carry real player expression).

**Exit:** all 20 generator unlock gates resolve to actual tree nodes. Simulation
still lands in 6–10 hrs with real gates instead of Phase 1's placeholders.

---

## Phase 4 — Kitchen Garden (§2a) ✅ COMPLETE (2026-08-02, 1 session)

**Full scope built — no cut taken.** 275 tests plus 26 browser smoke checks.
Campaign still lands in 6–10h (9.88 / 8.15 / 6.22) after re-fitting K to 26.

**The exit criterion is met but qualified.** A manual cycle costs 6s of Day Time,
a fully-automated plot costs 0s, and active play out-earns automation — all
proven. But the Kitchen Garden supplies **~3.5% of income in real play, not the
~⅓ D2 targets**, because full build-out arrives only in Season 4. That is a
design question, not a tuning slip: see
`docs/07-phase-4-kitchen-garden-report.md` §2 for five options.

Original plan follows.

**Sessions: 4–6** · Entry: Phase 3 · **Largest single phase**

- Grid + slot expansion, 4 → 20 slots.
- Per-plot state machine: Dig → Plant → Cover, with the 2s Perfect Planting window.
- Six surfaces with their yield/time/capacity modifiers.
- Seed Satchel: passive regen, harvest bonus chance, Festival bulk conversion.
- Day/Night budget — **spend-only**, per §2a. Assert in tests that Night never
  gates the Bell, Garden Plots, Frenzy, Pollination, or Festival; that narrow blast
  radius is the whole design, and it is exactly the kind of thing that regresses.
- Automation: 3 steps × 2 levels, universal across surfaces.
- Season-transition decay and replanting.

**Scope escape hatch:** the spec's §7 scope note explicitly sanctions cutting this
to "Light integration" (a one-time planting ceremony per Season). **Decide by the
start of this phase**, not during it. Cutting saves ~4 sessions.

**Exit:** full manual cycle costs 6s of Day Time; fully-automated costs 0s; active
play measurably out-earns full automation (§9's guardrail) — proven in the sim, not
asserted.

---

## Phase 5 — Prestige, Season 1 Capstone → **VERTICAL SLICE** ⭐ ✅ BUILT (2026-08-02, 1 session)

**Built and verified; the gate itself is yours.** 306 tests plus 34 browser
smoke checks, which drive a real First Bloom attempt, clear it, advance to
Season 2, unlock prestige, confirm it, reset, and check the Kitchen Garden
survived.

**→ `npm run dev`, ninety minutes. See `docs/08-vertical-slice.md`.**

One real bug found and fixed: a Frenzy that began and ended inside a single tick
left a capstone attempt armed forever, because `advance` ticks the meter before
the capstone sees it. Rare at 10 Hz, routine on the catch-up path.

Original plan follows.

**Sessions: 2–3** · Entry: Phase 4 · **HUMAN GATE**

- Prestige loop end-to-end, with the Phase-0 formula decision.
- Kitchen Garden **persists** through prestige (§4 is emphatic about this).
- Season 1 capstone — "First Bloom" per `docs/04` item 4.
- Tutorial / first-15-minutes onboarding (§8).

**Exit — you play it.** Ninety minutes, unassisted, on a real device. The
questions are: is the core loop satisfying? Does Frenzy feel worth chasing? Does
the Kitchen Garden read as meaningful or as busywork (§10 item 10)? Does the first
prestige feel like a reward?

**This is the go / no-go for Seasons 2–4.** Roughly 13–19 sessions in — the right
place to find out the design does not work, if it does not.

---

## Phase 6 — 3D Presentation & CC0 Assets

**Sessions: 4–6** · Entry: Phase 5 passed · **HUMAN GATE**

- **Prerequisite:** asset access resolved. `kenney.nl` is currently blocked by the
  environment's network policy — see `docs/05-asset-pipeline.md`. Do not start this
  phase until packs are either allowlisted or committed to `assets/vendor/`.
- Three.js layer behind a clean interface, so the 2D build stays runnable as a
  fallback and a test target.
- Isometric camera, fixed 30–45° (§11 Style A).
- glTF pipeline: import, recolour to the Phase-0 palette, atlas, budget.
- Diorama registry: 20 generator tiers + 20 Kitchen Garden tiles + 4 Season
  environments.
- Perf budget: instancing, draw-call ceiling, 60fps on mid-range mobile.
- UI icons from `@iconify-json/game-icons` — available via npm, CC BY 3.0,
  attribution added to a credits screen.

**Exit:** human art review. Does it look like one game, or like three asset packs?

---

## Phase 7 — Season 2: Pollination Combo (§6.1)

**Sessions: 2–3** · Entry: Phase 5

Three flower types, 3s chain window, Bronze/Silver/Golden Bloom tiers, Tier 8
drone auto-attempt at ~40%, stacking with Frenzy. Season 2 capstone ("Both
Blooms", D4b). Tiers 6–10.

**Exit:** sim confirms an actively-playing player reliably beats the 40% drone
(§6.1's stated guardrail). §10 item 5 — window forgiveness — flagged for Phase 11.

**DONE (2026-08-04).** Exit met with a 1.7× margin: an engaged player holds ×2.00
against a fully-upgraded drone's ×1.15. Report: `docs/11-phase-7-pollination.md`.
Window forgiveness also got a player-facing answer (the "Patient Pollen" node),
though the base 3s stays a HUMAN constant. **One decision came out of this phase
and blocks nothing yet but should be taken before Phase 8: D7 is reopened —
`docs/11` §3.**

---

## Phase 8 — Season 3: Harvest Festival (§6.2)

**Sessions: 2–3** · Entry: Phase 7

Barn Capacity **with the `docs/04` item 1 resolution and its regression test**,
5%/min soft decay, 20–30 min Festival trigger, 60s ×2 window, overflow → Seeds.
Season 3 capstone ("The Grand Harvest"). Tiers 11–15.

**Exit:** test asserts Barn Capacity exceeds the next tier's cost at every tier —
the deadlock found in the audit can never recur.

---

## Phase 9 — Season 4: Frost Dormancy & The Long Night (§6.3)

**Sessions: 3–4** · Entry: Phase 8 · Most interacting systems

Frost Cycles (5–8 min, 60% floor, 45s), three Insulation steps, Stoke the Furnace
meter, Greenhouse Bed frost immunity, and The Long Night (2–3 min at 25% floor)
with its two-of-three-Insulation + banked-Mana gates. Tiers 16–20.

**Exit:** sim proves an under-invested player _can still clear_ The Long Night,
just slower — §6.3 is explicit that it must be a difficulty spike, not a hard build
gate. This is a genuine failure mode worth testing for.

---

## Phase 10 — Full Bloom Ending & Endless Sandbox

**Sessions: 2** · Entry: Phase 9

Tier 20 purchase triggers the ending sequence; credits (game-icons.net attribution
lives here); endless mode as a clearly optional post-ending unlock, per §9's
"no visible ending" guardrail.

---

## Phase 11 — Balance Tuning Against Real Play

**Sessions: 3–5, mostly short** · Entry: Phase 10 · **HUMAN GATE**

Work through §10's ten playtest questions with real data. Sessions here are cheap
because the config is isolated and the simulation is already built — most are
"change three constants, re-run the sweep, report."

**Exit:** full campaign lands in 6–10 hrs for at least three archetypes, and the
human playtester agrees each Season _feels_ distinct (§10 item 4 — the one no
simulation can answer).

---

## Phase 12 — Polish, Accessibility, Performance, Ship

**Sessions: 4–6** · Entry: Phase 11 · **HUMAN GATE**

Mobile/touch, responsive layout, keyboard nav, reduced-motion, colourblind-safe
palette check, save export/import, error boundaries, analytics stance, build/deploy.

**Audio is human-owned** and should start well before this phase — Claude cannot
evaluate sound, and an incremental with no click feedback feels dead.

---

## Summary

| Phase                   |  Sessions | Human gate                           |
| ----------------------- | --------: | ------------------------------------ |
| 0 Foundations           |       1–2 | design decisions                     |
| 1 **Economy + sim** ⭐  |       3–4 |                                      |
| 2 Playable loop         |       3–4 |                                      |
| 3 Insight tree          |       2–3 |                                      |
| 4 Kitchen Garden        |       4–6 | scope decision at entry              |
| 5 **Vertical slice** ⭐ |       2–3 | **GO / NO-GO**                       |
| 6 3D presentation       |       4–6 | art review; **asset access blocked** |
| 7 Season 2              |       2–3 |                                      |
| 8 Season 3              |       2–3 |                                      |
| 9 Season 4              |       3–4 |                                      |
| 10 Ending + sandbox     |         2 |                                      |
| 11 Balance tuning       |       3–5 | playtest                             |
| 12 Polish & ship        |       4–6 | playtest, audio                      |
| **Total**               | **35–51** |                                      |

**Two moments matter more than the rest:** Phase 1's exit (the economy works on
paper) and Phase 5's gate (it works in your hands). Everything after Phase 5 is
execution against a validated design; everything before it is the risk.
