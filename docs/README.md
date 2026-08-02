# Clockwork Garden — Planning Documents

Feasibility analysis and build plan for the game described in
[`../clockwork-garden-design-spec.md`](../clockwork-garden-design-spec.md).

**Verdict: feasible.** ~35–51 Claude Code sessions to a full game, ~13–19 to a
playable vertical slice. Systems are high-confidence; presentation, art direction,
and game feel need human gates.

---

## Read in this order

| Doc | What it answers |
|---|---|
| [00 — Feasibility Analysis](00-feasibility-analysis.md) | Can this be built with Claude Code? Where does it help, where does it not, what did the spec audit find? |
| [01 — Effort Estimate](01-effort-estimate.md) | How many sessions and tokens, derived bottom-up with assumptions stated |
| [02 — Phase Roadmap](02-phase-roadmap.md) | Thirteen phases with entry/exit criteria and human gates |
| [03 — Technical Architecture](03-technical-architecture.md) | Proposed codebase shape, the sim/view split, saves, testing |
| [04 — Open Design Questions](04-spec-open-questions.md) | **Answer these before building.** Two are blockers |
| [05 — Asset Pipeline](05-asset-pipeline.md) | CC0 sourcing, the palette lock, and a live network constraint |

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

| # | Severity | Finding |
|---|---|---|
| 1 | **Blocker** | §6.2 Barn Capacity, read literally, deadlocks **9 of 9** Season 3–4 tier purchases — the game becomes unwinnable at Tier 11 |
| 2 | **Blocker** | §2a Kitchen Garden yield is self-referential; at 20 Clockwork Trellis slots it claims 120% of total production and diverges to infinity |
| 3 | Major | §4 prestige spans ×1.18 → ×368,000 across four resets. The first prestige — the one that teaches the mechanic — is worth +18% |

Plus content gaps: Season 1 and 2 capstones are gated on but never designed;
Season advancement is undefined; eight generator unlock gates point at Insight
nodes that do not exist yet.

All have recommended resolutions in [doc 04](04-spec-open-questions.md).

---

## The three things worth acting on first

1. **Answer `docs/04` items 1, 2, 3 and 6.** Mostly your decisions. Nothing should
   be built until items 1 and 2 have answers, because both make the game
   unshippable as written.
2. **Prove the economy headlessly before building any UI** (Phase 1, ~3–4
   sessions). Nine of the spec's own ten playtest questions (§10) are answerable by
   simulation without a browser. This is the single highest-leverage inversion in
   the plan.
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
