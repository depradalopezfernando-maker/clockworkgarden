# Clockwork Garden — Planning Documents

Feasibility analysis and build plan for the game described in
[`../clockwork-garden-design-spec.md`](../clockwork-garden-design-spec.md).

**Verdict: feasible.** ~35–51 Claude Code sessions to a full game, ~13–19 to a
playable vertical slice. Systems are high-confidence; presentation, art direction,
and game feel need human gates.

---

## Read in this order

| Doc                                                         | What it answers                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [00 — Feasibility Analysis](00-feasibility-analysis.md)     | Can this be built with Claude Code? Where does it help, where does it not, what did the spec audit find? |
| [01 — Effort Estimate](01-effort-estimate.md)               | How many sessions and tokens, derived bottom-up with assumptions stated                                  |
| [02 — Phase Roadmap](02-phase-roadmap.md)                   | Thirteen phases with entry/exit criteria and human gates                                                 |
| [03 — Technical Architecture](03-technical-architecture.md) | Proposed codebase shape, the sim/view split, saves, testing                                              |
| [04 — Open Design Questions](04-spec-open-questions.md)     | Audit findings, and the four decisions taken on 2026-08-02                                               |
| [05 — Asset Pipeline](05-asset-pipeline.md)                 | CC0 sourcing, the palette lock, and a live network constraint                                            |
| [06 — Phase 1 Balance Report](06-phase-1-balance-report.md) | Simulated campaign length, the fitted constants, and what the sim does not prove                         |
| [07 — Phase 4 Report](07-phase-4-kitchen-garden-report.md)  | The Kitchen Garden as built, why it contributed far less than intended, and the fix (§5)                 |
| [08 — The Vertical Slice](08-vertical-slice.md)             | **How to play it and what to look for.** The human gate                                                  |
| [09 — Playtest Revisions](09-playtest-revisions.md)         | **What the first real play session changed** — the soft-lock fix, and decision D7                        |
| [10 — Phase 6 Presentation](10-phase-6-presentation.md)     | The 3D diorama: what renders, what does not yet                                                          |
| [11 — Phase 7 Pollination](11-phase-7-pollination.md)       | §6.1 as built, the drone guardrail measured, and **the reopened D7 a human must settle** (§3)            |

Plus [`../CLAUDE.md`](../CLAUDE.md) — the standing brief for future sessions.

---

## The spec audit

`tools/spec-audit.mjs` evaluates the spec's own formulas against its own tier
table. Run it:

```bash
node tools/spec-audit.mjs
```

**Good news.** The 20-tier generator table is better than the spec claims. All 20
tiers sit inside the stated 7–10× band, and payback time (cost ÷ yield) is
essentially **flat at ~150–180 seconds across the entire campaign** — the property
that makes a bounded incremental readable at any scale. Transcribe it as-is and
protect it with a regression test.

**Also good news.** Peak magnitude is ~1e44 against float64's 1.8e308, so **no
big-number library is needed** — unusual for this genre and a real simplification.

**Three defects found.**

| #   | Severity    | Finding                                                                                                                                 |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Blocker** | §6.2 Barn Capacity, read literally, deadlocks **9 of 9** Season 3–4 tier purchases — the game becomes unwinnable at Tier 11             |
| 2   | **Blocker** | §2a Kitchen Garden yield is self-referential; at 20 Clockwork Trellis slots it claims 120% of total production and diverges to infinity |
| 3   | Major       | §4 prestige spans ×1.18 → ×368,000 across four resets. The first prestige — the one that teaches the mechanic — is worth +18%           |

Plus content gaps: Season 1 and 2 capstones are gated on but never designed;
Season advancement is undefined; eight generator unlock gates point at Insight
nodes that do not exist yet.

**All three are now resolved** — see "Decisions taken" in
[doc 04](04-spec-open-questions.md). Barn Capacity uses total output plus a
structural safety floor; Kitchen Garden yield is non-recursive at ~⅓ of income;
prestige is log-shaped on non-resetting lifetime Mana, so every reset is felt and
over-banking is self-limiting.

---

## Where things stand

**Phases 0–5 are complete** (2026-08-02). **The vertical slice is ready to play — see [08](08-vertical-slice.md).** The game is playable in a browser —
Bell, generators, Growth Frenzy, the Insight tree, milestones, the full Kitchen
Garden, versioned saves and offline progress — verified end to end in real
Chromium by `npm run smoke`.

`npm run ci` is green with **341 tests plus 36 browser smoke checks**, and the
economy has been simulated end to end: **all three player archetypes finish
inside §8's 6–10 hour target** (9.68h / 7.96h / 6.19h). Method and caveats in
[06 — Phase 1 Balance Report](06-phase-1-balance-report.md); the latest numbers
and the Kitchen Garden finding are in
[07 — Phase 4 Report](07-phase-4-kitchen-garden-report.md).

The simulation found a defect no amount of reading would have caught: the first
prestige was worth **×1.00 — nothing** — because the spec's SQP reference sat
above the lifetime Mana a player holds when prestige unlocks. Now ×1.94.

It later found a second one the same way: the Kitchen Garden could **deadlock
permanently** on an unspendable remainder of Day Time. See
[07](07-phase-4-kitchen-garden-report.md) §5.2.

Next steps, in order:

1. **Play the vertical slice for ninety minutes** and decide go/no-go on Seasons
   2–4. [Doc 08](08-vertical-slice.md) lists the four questions.
2. ~~Decide how the Kitchen Garden should matter.~~ **Done (2026-08-03)** —
   option (c). Applying it exposed a Day Time deadlock that had been freezing the
   garden outright; realised income share went 2.9% → 8.1% across the run and
   3.5% → 32.4% at the end. [07](07-phase-4-kitchen-garden-report.md) §5.
3. **Resolve 3D asset access before Phase 6.** `kenney.nl` is currently blocked by
   this environment's network policy — either widen it or commit the CC0 packs to
   `assets/vendor/`. UI icons are already available via npm. Nothing before Phase 6
   is blocked. See [doc 05](05-asset-pipeline.md).

---

## Two moments matter more than the rest

**Phase 1's exit** — the economy lands in 6–10 hours across player archetypes, on
paper, cheaply.

**Phase 5's gate** — you play the vertical slice for ninety minutes and decide
whether to commit to Seasons 2–4. Roughly 13–19 sessions in: the right place to
find out the design does not work, if it does not.
