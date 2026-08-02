# Effort Estimate — Sessions and Tokens

**Scope:** _Clockwork Garden_ as specified, on TypeScript + React + Three.js.
**Confidence:** Medium. Read the assumptions in §1 before quoting any number here.

---

## 1. How these numbers are derived (and how wrong they can be)

Estimating agent effort is less mature than estimating human effort, so this uses
a bottom-up model with the assumptions stated openly rather than a single figure.

**Unit definitions:**

- **Session** = one Claude Code conversation running to natural completion or
  context exhaustion. Roughly **1.5–3 hours** of agent work. With auto-compaction a
  session can run longer; this model assumes compaction happens once or twice.
- **Tokens** = total billed input + output for a session. Input dominates heavily
  and is mostly _cache reads_, because every tool call re-sends conversation
  context. A dense implementation session on a codebase this size runs **~0.8–1.5M
  tokens**, of which output is only ~40–80k.

**The throughput assumption that matters most:** an implementation session lands
roughly **600–1,200 lines of kept, tested, reviewed code**. Not lines typed —
lines that survive. The gap between those two figures is exploration, debugging,
and rework, and it is where estimates usually go wrong. Sessions that are purely
data authoring go much faster (2,000+ lines); sessions doing 3D or UI polish go
much slower (200–400 lines) because they are iteration-bound rather than
typing-bound.

**Known biases in this estimate:**

- _Optimistic_ about content authoring — data tables are genuinely fast.
- _Optimistic_ about the Three.js phases; screenshot-driven iteration is slower in
  practice than it looks on paper.
- _Pessimistic_ about the core economy — it is well-specified and may go faster.
- **Excludes your time entirely.** Playtesting, design decisions, art review, and
  audio are human workstreams not counted below.

---

## 2. Bottom-up size estimate

| Area                                        | Est. LOC (incl. tests) | Notes                                                     |
| ------------------------------------------- | ---------------------: | --------------------------------------------------------- |
| Core economy engine (state, tick, formulas) |                  1,200 | Plus ~600 LOC of tests                                    |
| Generator + content data tables             |                    800 | Mostly data; 20 tiers, flavour text                       |
| Insight tree (data + logic + UI)            |                  1,500 | ~50 nodes; tree layout UI is the cost                     |
| Milestone / achievement engine              |                    500 | Many small predicates                                     |
| **Kitchen Garden (§2a)**                    |                  2,000 | Largest subsystem; grid UI + state machine                |
| Season mechanics (§5, §6.1–6.3)             |                  1,600 | Four distinct systems                                     |
| Prestige + offline + save/load/migration    |                    900 | Save layer is not in the spec                             |
| React UI shell, HUD, panels, tutorial       |                  3,000 | Volume-driven                                             |
| Three.js presentation layer                 |                  2,500 | Loader, iso camera, tile/diorama registry, season env, FX |
| Balance simulation harness                  |                    800 | High value per line                                       |
| Test suite (unit + sim + Playwright)        |                  2,500 |                                                           |
| Build tooling, CI, deploy                   |                    400 |                                                           |
| **Total**                                   |            **~17,700** | Call it **15,000–20,000 LOC**                             |

That is a medium-sized project — comparable to a well-built open-source
incremental game, which is the right reference class.

---

## 3. Session estimate by phase

Phases are defined in `docs/02-phase-roadmap.md`.

| Phase | Name                                        |  Sessions | Token est. | Character of the work             |
| ----- | ------------------------------------------- | --------: | ---------: | --------------------------------- |
| 0     | Foundations & decisions                     |       1–2 |       1–2M | Scaffold, CI, ADRs, palette lock  |
| 1     | **Headless economy + balance sim**          |       3–4 |       3–5M | Pure logic. High confidence       |
| 2     | Minimum playable loop (2D placeholder)      |       3–4 |       3–5M | First actually-playable build     |
| 3     | Insight tree + milestones                   |       2–3 |       2–4M | Content-heavy, low risk           |
| 4     | **Kitchen Garden (§2a)**                    |       4–6 |       5–8M | Largest single chunk              |
| 5     | Prestige + S1 capstone → **vertical slice** |       2–3 |       2–4M | **Human playtest gate**           |
| 6     | 3D presentation + CC0 assets                |       4–6 |       5–9M | Iteration-bound; slowest per line |
| 7     | Season 2 — Pollination Combo                |       2–3 |       2–4M |                                   |
| 8     | Season 3 — Harvest Festival                 |       2–3 |       2–4M |                                   |
| 9     | Season 4 — Frost / Long Night               |       3–4 |       3–5M | Most interacting systems          |
| 10    | Full Bloom ending + endless sandbox         |         2 |       2–3M |                                   |
| 11    | Balance tuning against real playtest        |       3–5 |       3–6M | Many short cheap sessions         |
| 12    | Polish, a11y, perf, mobile, ship            |       4–6 |       4–8M | Audio is human-owned              |
|       | **Total**                                   | **35–51** | **37–67M** |                                   |

### Headline figures

| Milestone                                 |  Sessions |      Tokens | Wall-clock (at ~4 sessions/wk) |
| ----------------------------------------- | --------: | ----------: | ------------------------------ |
| Economy proven headlessly (end Phase 1)   |   **4–6** |       ~4–7M | ~1–1.5 weeks                   |
| **Playable vertical slice (end Phase 5)** | **13–19** | **~16–28M** | ~3–5 weeks                     |
| Full game, all 4 Seasons, shippable       | **35–51** | **~37–67M** | ~9–13 weeks                    |

The wall-clock column assumes a fairly committed cadence and includes no time for
your own playtesting, which is a real and non-trivial addition — the game is
6–10 hours long and needs to be played more than once.

---

## 4. What moves these numbers most

**Downward (cheaper):**

- **Cutting the Kitchen Garden to "Light integration."** The spec explicitly
  sanctions this in its §7 scope note. Saves ~4–5 sessions in Phase 4 and knocks
  ~10 nodes off the Insight tree in Phase 3. This is the single biggest available
  lever, and it stays available until Phase 4 starts.
- **Shipping 2D instead of 3D.** Removes Phase 6 almost entirely (~5 sessions) and
  most of the asset-pipeline risk. Costs the §11 art direction.
- **Endless sandbox mode deferred.** Half of Phase 10.

**Upward (more expensive):**

- **Skipping Phase 1.** Building UI before the economy is proven means retuning
  through the UI, which is far more expensive than retuning a headless sim. The
  most likely way this project overruns.
- **Design decisions arriving late.** Every unresolved question in `docs/04` that
  gets answered mid-implementation costs rework, not just delay.
- **Mobile as a first-class target.** Touch input, viewport handling, and
  performance on low-end devices are a real workstream, not a CSS pass. Add 3–5
  sessions if it is a launch requirement rather than a later port.
- **Art direction iteration.** Phase 6's estimate assumes assets are recoloured
  to a locked palette mechanically. If the look is being explored rather than
  executed, it is unbounded.

---

## 5. Practices that materially reduce token spend

These are not general advice; they are specific to this codebase's shape.

1. **Separate data from logic.** Put the 20-tier table, the ~50 tree nodes, and all
   tunable constants in dedicated files. Sessions working on logic then never need
   to load content, and vice versa. On a project that is ~30% content data, this is
   the largest single saving.
2. **Make tests the verification loop, not file re-reads.** `npm test` output is a
   few hundred tokens; re-reading four modules to check a change is tens of
   thousands. This is why Phase 1 pays for itself.
3. **One tunable config file.** Balance iteration should never require reading
   game code.
4. **Keep `CLAUDE.md` current.** Every session re-derives project context from
   scratch otherwise. It is the cheapest token investment in the repo.
5. **Use sub-agents for search, not for building.** Fan-out exploration returns
   conclusions instead of file dumps; but a sub-agent building a feature starts
   cold and re-derives everything, which costs more than doing it inline.
6. **One phase per session where possible.** Cross-phase sessions carry both
   phases' context for the whole conversation.

---

## 6. Honest confidence statement

The **session counts** are more trustworthy than the **token counts**. Sessions
are bounded by context windows, which are a hard constraint; token consumption
varies by a factor of two or more depending on how tightly each session is scoped
and how much debugging is needed.

Treat **35–51 sessions** as the planning figure and the token range as
directional. The Phase 1–5 estimate (**13–19 sessions to a playable vertical
slice**) is the most reliable number here, because it covers the best-specified
part of the game. Everything after Phase 6 has wider error bars, and the Phase 11
balance-tuning estimate is the least reliable of all — it depends entirely on how
close the spec's starting values turn out to be, which is unknowable until the
game is played.
