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
*gameplay*, not on how it looks.

---

## Phase 0 — Foundations & Decisions
**Sessions: 1–2** · Entry: design questions answered

- Resolve `docs/04-spec-open-questions.md` items **1, 2, 3, 6** (your decisions).
- Scaffold: Vite + TypeScript strict + React + Vitest + ESLint + Prettier.
- CI: typecheck, lint, test, build on every push.
- `CLAUDE.md` (the standing brief for every future session).
- **Lock the palette as data** — `src/content/palette.ts`, four Season ramps. This
  is §11's consistency guardrail turned into something enforceable, and it must
  exist before any asset touches the repo.
- ADRs for the load-bearing choices: plain `number` over big-number lib
  (justified by audit 5), state management, save schema versioning.

**Exit:** `npm run ci` green on an empty project. Palette committed. No blocking
design questions remain.

---

## Phase 1 — Headless Economy & Balance Simulation ⭐
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
- Answer §10's questions 1, 2, 3, 10 numerically. Fit the Phase-0 prestige decision
  to the "4–5 natural resets" target by parameter sweep.

**Exit:** a report showing simulated campaign length inside **6–10 hours** across
at least three player archetypes (idle / casual / active), and 4–5 natural
prestiges occurring. **If it does not land, tune here — this is the cheapest place
it will ever be.**

---

## Phase 2 — Minimum Playable Loop
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

## Phase 3 — Insight Tree & Milestones
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

## Phase 4 — Kitchen Garden (§2a)
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

## Phase 5 — Prestige, Season 1 Capstone → **VERTICAL SLICE** ⭐
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
drone auto-attempt at ~40%, stacking with Frenzy. Season 2 capstone ("The Great
Pollination"). Tiers 6–10.

**Exit:** sim confirms an actively-playing player reliably beats the 40% drone
(§6.1's stated guardrail). §10 item 5 — window forgiveness — flagged for Phase 11.

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

**Exit:** sim proves an under-invested player *can still clear* The Long Night,
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
human playtester agrees each Season *feels* distinct (§10 item 4 — the one no
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

| Phase | Sessions | Human gate |
|---|---:|---|
| 0 Foundations | 1–2 | design decisions |
| 1 **Economy + sim** ⭐ | 3–4 | |
| 2 Playable loop | 3–4 | |
| 3 Insight tree | 2–3 | |
| 4 Kitchen Garden | 4–6 | scope decision at entry |
| 5 **Vertical slice** ⭐ | 2–3 | **GO / NO-GO** |
| 6 3D presentation | 4–6 | art review; **asset access blocked** |
| 7 Season 2 | 2–3 | |
| 8 Season 3 | 2–3 | |
| 9 Season 4 | 3–4 | |
| 10 Ending + sandbox | 2 | |
| 11 Balance tuning | 3–5 | playtest |
| 12 Polish & ship | 4–6 | playtest, audio |
| **Total** | **35–51** | |

**Two moments matter more than the rest:** Phase 1's exit (the economy works on
paper) and Phase 5's gate (it works in your hands). Everything after Phase 5 is
execution against a validated design; everything before it is the risk.
