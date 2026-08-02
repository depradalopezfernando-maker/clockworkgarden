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

**Phases 0 and 1 are complete** (2026-08-02). `npm run ci` is green, 114 tests
pass, and the economy has been simulated end to end: **all three player
archetypes finish inside §8's 6–10 hour target** (9.50h / 8.11h / 6.40h). Full
numbers and caveats in [06 — Phase 1 Balance Report](06-phase-1-balance-report.md).

The simulation found a defect no amount of reading would have caught: the first
prestige was worth **×1.00 — nothing** — because the spec's SQP reference sat
above the lifetime Mana a player holds when prestige unlocks. Now ×1.88.

Next steps, in order:

1. **Build the minimum playable loop** (Phase 2, ~3–4 sessions). React shell,
   Bell, generator list, Growth Frenzy, versioned saves, offline on the real
   clock. Deliberately plain 2D.
2. **Design the Season 1 and 2 capstones** before Phase 5. They are gated on but
   never designed; three are proposed in [doc 04](04-spec-open-questions.md) item 4.
   This blocks the vertical-slice go/no-go, not Phase 1.
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
