# Feasibility Analysis — Building _Clockwork Garden_ with Claude Code

**Analysed document:** `clockwork-garden-design-spec.md` (341 lines, 11 sections)
**Date:** 2026-08-02
**Assumed stack:** TypeScript + React + Three.js, browser-first
**Verdict:** **Feasible — high confidence on systems, medium confidence on presentation.**

---

## 1. Executive summary

_Clockwork Garden_ is close to a best-case project for Claude Code. It is a
**deterministic, numerically-specified, single-player, offline-capable simulation
with no server, no multiplayer, no physics, and no real-time input latency
requirements.** Almost the entire game is state transitions over a fixed tick,
which is code Claude Code writes accurately and — critically — can **verify
itself** by running headless simulations and asserting on the results.

The spec is unusually good. It is written at the right altitude: concrete formulas
with named constants, explicit guardrails (§9), and an honest list of what it does
_not_ yet know (§10). That is exactly the input that makes agentic implementation
work, because it converts most decisions into transcription rather than invention.

The risk is not in the systems. It is in three places:

1. **Presentation.** Claude cannot judge whether a game _feels_ good. Juice, game
   feel, animation timing, and art-direction cohesion (§11's "consistency
   guardrail") need a human in the loop.
2. **Balance beyond what a sim can prove.** A simulation can prove that Season 3
   takes 2.1 hours. It cannot prove that Season 3 is _fun_.
3. **Asset acquisition, which is blocked in this environment.** See §5 below —
   this is a concrete, present-tense obstacle, not a hypothetical.

None of these make the project infeasible. All three are managed by putting human
review gates at specific phase boundaries rather than at the end.

---

## 2. What was found in the spec

A numerical audit (`tools/spec-audit.mjs`, runnable with `node tools/spec-audit.mjs`)
evaluated the spec's own formulas against its own tier table. Summary:

### 2.1 The economy backbone is excellent

The 20-tier generator table is better constructed than the spec claims. §2 says
tiers land "roughly 7–10×" apart; in fact **every one of the 20 tiers falls inside
that band**, and more importantly the derived quantity that actually governs
pacing — **payback time** (cost ÷ yield, i.e. seconds for one unit to repay
itself) — is essentially **flat at ~150–180 seconds across all 20 tiers**.

That is a strong, deliberate-looking property. It means every tier purchase feels
the same regardless of whether the number on screen is 15 or 250 quadrillion,
which is the core trick that makes a bounded incremental readable. This part of
the spec needs no work; it should be transcribed as-is and protected by a
regression test.

### 2.2 Three defects would block implementation

| #   | Severity    | Issue                                                                                                               |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | **Blocker** | §6.2 Barn Capacity, read literally, deadlocks progression on **9 of 9** Season 3–4 tier purchases                   |
| 2   | **Blocker** | §2a Kitchen Garden yield is **self-referential** and diverges to infinity at 20 Clockwork Trellis slots             |
| 3   | **Major**   | §4 prestige multiplier spans **1.18× → 368,000×** across four resets — the first prestige is functionally worthless |

Plus four content gaps (Season 1 and 2 capstones are referenced but never
designed; Season transition triggers undefined; "Insight skill unlock" gates
unmapped; offline behaviour of the Kitchen Garden unspecified).

Full detail and recommended resolutions: **`docs/04-spec-open-questions.md`**.

**These must be resolved before Phase 1, not during it.** They are design
decisions, not implementation details, and guessing at them would build the wrong
economy.

### 2.3 One useful simplification

Peak magnitude across the whole campaign — including a generous prestige
multiplier and 400 units of Tier 20 — lands around **1e44**, which is 14% of
float64's exponent range. **No big-number library is needed.** Plain JavaScript
`number` covers the entire game.

This is worth stating explicitly because incremental games reflexively reach for
`break_infinity.js`, and skipping it removes a dependency, removes a whole class
of serialization bugs, and makes the tick loop meaningfully faster. The single
caveat: values exceed `MAX_SAFE_INTEGER`, so nothing may assume integer
exactness — relevant only to save-file round-tripping, not to gameplay.

---

## 3. Complexity inventory

Scored for _agentic_ implementation difficulty, which is not the same as human
difficulty. Things Claude Code finds hard are things it cannot verify.

| System                              | Spec §  | Difficulty   | Why                                                                                                                              |
| ----------------------------------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Mana / click / generator tick       | §2      | **Low**      | Pure arithmetic, fully specified, trivially testable                                                                             |
| Generator content tables (20 tiers) | §2      | **Low**      | Transcription. Data, not logic                                                                                                   |
| Prestige (Season Change)            | §4      | **Low**      | One formula; needs a design decision first (§2.2)                                                                                |
| Offline progress                    | §7      | **Low**      | Piecewise function over elapsed time                                                                                             |
| Growth Frenzy                       | §5      | **Low-Med**  | Meter fill/drain tuning is feel-dependent                                                                                        |
| Save / load / migration             | —       | **Medium**   | Not in spec at all; needs versioned schema from day one                                                                          |
| Insight tree (45–55 nodes)          | §3      | **Medium**   | Logic is simple; _content authoring_ is the bulk, and the tree UI is fiddly                                                      |
| Milestone / achievement engine      | §3      | **Medium**   | Many small predicates; easy to get subtly wrong, easy to test                                                                    |
| Pollination Combo                   | §6.1    | **Medium**   | Timing windows; the 40% drone auto-attempt needs care                                                                            |
| Harvest Festival + Barn             | §6.2    | **Medium**   | Blocked on defect #1; soft-cap decay is stateful                                                                                 |
| Frost Dormancy + Long Night         | §6.3    | **Med-High** | Most interacting parts: cycles, insulation, Stoke meter, capstone gates                                                          |
| **Kitchen Garden**                  | §2a     | **High**     | Largest single subsystem. Per-plot state machine × 6 surfaces × 3 automation tracks × Day/Night budget × capacity × season decay |
| React UI shell / HUD / panels       | —       | **Medium**   | Volume, not difficulty. Verifiable via Playwright screenshots                                                                    |
| **Three.js isometric presentation** | §11     | **High**     | Claude cannot art-direct. Screenshot loop helps but does not replace taste                                                       |
| Tutorial / onboarding               | §8      | **Medium**   | Cheap to build, expensive to get right; needs playtesting                                                                        |
| Balance tuning to 6–10 hrs          | §8, §10 | **Medium**   | _Simulation_ is easy and Claude excels at it; _judgement_ is not                                                                 |
| Audio                               | —       | **Medium**   | Not in spec. Claude cannot evaluate sound at all                                                                                 |

---

## 4. Where Claude Code is strong here

**Headless balance simulation is the standout.** §10 lists ten open balance
questions. Nine of the ten are answerable by running the economy forward without
any UI — "does the campaign land in 6–10 hours", "do 4–5 natural prestiges
happen", "is the Kitchen Garden's 1% BaseFraction meaningful against Garden Plot
income". Claude Code can build that harness in one session and then answer those
questions in minutes each, sweeping parameters across thousands of simulated
runs. A human designer with a spreadsheet would take days per question.

This inverts the usual order of work and it is the single most valuable structural
recommendation in this analysis: **validate the economy numerically before
building any UI.** See Phase 1 in the roadmap.

Also strong:

- **Deterministic, testable logic.** Every formula in §2/§4/§7 becomes a unit test.
  A regression suite over the tier table protects the flat-payback property found
  in §2.1 from being silently broken during tuning.
- **Content volume.** 20 generators, ~50 tree nodes, milestones, flavour text.
  Tedious for a human, cheap for an agent, and mechanically low-risk because it is
  data.
- **Refactoring under test.** Once the sim harness exists, large restructures are
  safe.
- **Visual verification is possible in this environment.** Chromium and Playwright
  are pre-installed. Claude can drive the running game, screenshot it, and _look at
  the image_. This is a genuine step up from writing UI blind — it catches layout
  breakage, overflow, contrast failures, and "the panel is empty" bugs without a
  human. It does **not** catch "this doesn't feel satisfying."

---

## 5. Where Claude Code is weak here — and the environment constraint

### 5.1 Game feel (unfixable, must be managed)

Frenzy's 20-second window, the 2-second Perfect Planting tolerance, the 3-second
Pollination chain window, the 6-second Night transition — §10 correctly flags all
of these as needing playtesting. Claude can implement them as configurable
constants and can tell you the _consequences_ of a value. It cannot tell you which
value is fun. **Mitigation:** every timing constant lives in one tunable config
file, hot-reloadable, so a human can dial it in a single sitting without a rebuild.

### 5.2 Art direction (partially fixable)

§11's consistency guardrail — "fix a palette and a silhouette treatment before
sourcing more than one pack" — is exactly the kind of judgement Claude executes
poorly unattended. **Mitigation:** lock the palette as data (a committed
`palette.ts` with four Season ramps) _before_ any asset work, so asset integration
becomes a mechanical recolour-to-target rather than an aesthetic choice.

### 5.3 Asset acquisition is **currently blocked** in this environment

Verified live, not assumed:

| Source               | Status                                            |
| -------------------- | ------------------------------------------------- |
| `registry.npmjs.org` | **200 — reachable** (allowlisted, bypasses proxy) |
| `kenney.nl`          | **403 at gateway — blocked by network policy**    |
| `game-icons.net`     | **403 at gateway — blocked by network policy**    |

This directly affects the "source CC0 packs early" decision. The Kenney
_Isometric Miniature Farm_ and _Nature Kit_ packs recommended in §11 **cannot be
downloaded from this environment as configured.**

Good news on the UI icons: **game-icons.net is fully available via npm** as
`@iconify-json/game-icons`, which ships the same CC BY 3.0 set as JSON. That
resolves §11's UI-iconography need with no policy change.

For the 3D packs there are three routes, in order of preference:

1. **Widen the environment's network policy** to allow `kenney.nl` (and
   `itch.io` for KayKit). Cleanest fix; a one-time settings change.
2. **Commit the packs to the repository yourself.** Download locally, drop them in
   `assets/vendor/`, commit. They are CC0, so redistribution is unrestricted.
   Adds repo weight but is fully self-contained and reproducible.
3. **Procedural placeholder geometry** generated in code, with a clean swap seam.
   Requires no assets at all and keeps Phases 1–5 unblocked regardless.

Route 3 is the default the roadmap assumes so that **no phase before Phase 6 is
blocked on this**, but you asked to source CC0 packs early, so route 1 or 2 should
be actioned before Phase 6 begins. Full detail: **`docs/05-asset-pipeline.md`**.

### 5.4 Audio (out of scope until a human is involved)

Claude cannot hear. The spec does not mention audio, but an incremental game
without click feedback feels dead. Treat audio as an explicitly human-owned
workstream, scheduled in the polish phase.

---

## 6. Risk register

| Risk                                                       | Likelihood            | Impact   | Mitigation                                                                                                      |
| ---------------------------------------------------------- | --------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| Unresolved spec defects get implemented as written         | High if skipped       | High     | Resolve `docs/04` before Phase 1. Blockers #1 and #2 make the game unshippable                                  |
| Kitchen Garden (§2a) balloons in scope                     | Medium                | High     | §7 of the spec already sanctions cutting it to "Light integration". Keep that escape hatch live through Phase 4 |
| Balance drifts from the 6–10 hr target during content work | High                  | Medium   | CI-run simulation asserting campaign length after every phase                                                   |
| 3D presentation looks incoherent                           | Medium                | Medium   | Lock palette as data first; human art review gate at Phase 6                                                    |
| Asset sources unreachable                                  | **Confirmed present** | Medium   | See §5.3. Placeholder-first keeps it off the critical path                                                      |
| Save-format churn breaks playtester saves                  | Medium                | Medium   | Versioned schema + migration tests from Phase 2, not retrofitted                                                |
| Context thrash across sessions                             | Medium                | Medium   | Small modules, data separated from logic, `CLAUDE.md` as the standing brief                                     |
| The game is balanced but not fun                           | Medium                | **High** | Human playtest gates at Phases 5, 9, 11 — the only real defence                                                 |

---

## 7. Recommendation

**Build it, in this order:**

1. **Resolve the seven open design questions first** (`docs/04`). ~1 session of
   your time, mostly decisions only you can make. Nothing else should start until
   defects #1 and #2 have answers.
2. **Prove the economy headlessly before building any UI** (Phase 1). This is the
   highest-leverage inversion available and it costs ~3 sessions.
3. **Stop at the vertical slice and actually play it** (end of Phase 5, ~13
   sessions). That is the decision point for committing to Seasons 2–4. If Season 1
   is not fun, no amount of Season 4 content fixes it.
4. **Treat art and audio as human-gated workstreams**, not agent deliverables.

Estimated effort: **`docs/01-effort-estimate.md`**. Phase breakdown:
**`docs/02-phase-roadmap.md`**.
