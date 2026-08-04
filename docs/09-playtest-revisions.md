# 09 — Playtest Revisions

**Date:** 2026-08-04 · **Source:** first real play session
**Reproduce:** `npm run simulate` · **Verify:** `npm run ci && npm run smoke`

Six changes, from playing the game rather than simulating it. Five are
straightforward improvements. The sixth exposed a structural conflict in the
pacing targets that **needs a design decision** — §6.

---

## 1. Insight can no longer soft-lock the game

> "if you use wrongly the insight points you are soft locked"

Correct, and it was the most serious thing found. Eight generator tiers gated on
Insight nodes. Insight comes only from milestones, milestones come from owning
generators — so a player who spent their Insight on click power and the Kitchen
Garden could reach a tier they could not open and had no way to earn back the
Insight for.

**Tiers now gate on owning ten of the previous tier** (`GENERATOR_UNLOCK_OWNED`).
Mana always accrues, so the gate always opens. The `insight-node` gate kind is
deleted outright — not merely unused — so it cannot come back by accident.

Two tests hold the line: no tier's unlock gate mentions Insight in any form, and
buying _every node in the tree_ unlocks exactly the same tiers as buying none.

**Prestige needed a fix to match.** A reset zeroes `owned`, and the new gates
read `owned`, so a reset would have re-locked every tier the player had opened.
`GameState.tiersUnlocked` is a high-water mark that never decreases and survives
prestige: access, once earned, is permanent — only the units are lost.

Locked rows now say **"Own 10 Sprout Beds"** rather than "Locked". Worth doing
only now: when the gate was an Insight node, "Locked" was about all that could
honestly be said.

## 2. More Insight, and more to spend it on

> "There should be more Insight points earned and more ways to spend them (maybe
> to increase specific garden plots production, several levels instead of the
> generic 8% more overall input)"

The eight freed `unlock-generator` nodes became **per-tier production ladders**,
and each got a second level:

|                   | before | after |
| ----------------- | -----: | ----: |
| Insight nodes     |     51 |    59 |
| Insight available |    281 |   420 |
| Tree cost         |    415 |   543 |
| Coverage          |    68% |   77% |

Milestone rewards were scaled with the weight on the **early game**, where they
were 1s and 2s — ×3 below 3 Insight, ×2 to 5, ×1.3 to 10, ×1.1 above. Six new
count-25 milestones on the early and mid tiers make the Insight arrive as a drip
rather than one payment per tier. A new player now holds 3 Insight ten seconds
in, where they used to hold 1.

`tier-production` is a new effect kind: additive within a tier, applied before
the global multipliers, so two levels of one ladder read as "+25% then +30%"
rather than compounding into something unstateable.

## 3. The Kitchen Garden is worth building

> "what it provides is negligible should increase some to make it worth it"

This is option **(d)** from `docs/07` §2 — raise per-plot yield, cap the total.

The old rate was linear and fitted so that a _full 20-slot Clockwork Trellis
build-out_ hit D2's ~⅓ target. A Season 1 player has four Bare Soil plots, which
that rate valued at 1.6%.

`BaseFraction` rose 0.004 → 0.0314, and yield now passes through a harmonic soft
cap (`CAP·raw/(CAP+raw)`, CAP 0.55) — steep for small gardens, saturating at the
same ceiling:

| plant-units          | old share | new share |
| -------------------- | --------: | --------: |
| 4 (Season 1 start)   |      1.6% |  **9.3%** |
| 30 (mid-run)         |     10.7% | **25.8%** |
| 120 (full build-out) |     32.4% |     32.4% |

Realised across a whole campaign: **25–26%**, up from 8%. In Seasons 1–2, where
the complaint was sharpest: **19–22%**, up from ~4%.

The cap also _strengthens_ the boundedness invariant. Total Mana/sec used to stay
finite because the formula was linear and slots were capped at 20; it now stays
finite because the curve saturates, which survives a future surface with capacity 50. The test sweeps to 20,000 slots.

## 4. The Mana/s counter during a Frenzy

> "does not seem to update properly when in a frenzy to show current rate"

A real bug. The HUD called `totalManaPerSecond(state)`, which does not include
the Frenzy multiplier — so during a Frenzy the counter showed **half** the rate
Mana was actually accruing at. It now reads `× frenzyMultiplier`, and says so:
**"2.6/s Mana · Frenzy ×2"**, in the Frenzy colour. A number that doubles with no
explanation reads as a glitch.

## 5. The Kitchen Garden shows what it produces

> "should visible show the amount is producing so it is obvious something happens"

Shipped just before this batch, and worth restating because it was the same root
cause as "only one plot produces": each plot was worth 0.4% of income, and at HUD
precision `5.00/s`, `5.02/s` and `5.04/s` all render as `5/s`.

The panel now states its own worth — **"4 plots producing · +3.2% to Garden
Plots · +0.04/s"** — and every grown plot shows its own share. With change 3 the
numbers behind it are ten times larger, so it is legible now as well as present.

---

## 6. What this cost, and the decision taken (D7)

> "the progress also feels really slow and unrewarding"

Changes 1–3 together roughly **doubled income**, which shortened every campaign
by about 40%. `PRESTIGE_SQP_COEFFICIENT` is the pacing knob, so it absorbed the
change — except that it could not absorb all of it.

**K and REFERENCE pull against each other.** Lowering K lengthens the campaign
but shrinks the first prestige, which is the one thing decision D3 exists to make
felt. A 2D sweep of both (35 combinations, `tools/` scratch) found **no point
that satisfies all three of**:

- §8: every archetype inside 6–10 engaged hours
- §4: the first prestige clearly felt (≥ ×1.75)
- every archetype completing at all

The fitted pair, K = 10 and REFERENCE = 1e2, gives:

| archetype |     campaign | first prestige | resets |
| --------- | -----------: | -------------: | -----: |
| idle      |     8.46h ✅ |          ×1.78 |      1 |
| casual    |     6.28h ✅ |          ×1.78 |      2 |
| active    | **5.13h ❌** |          ×1.80 |      3 |

### Why no pair works

§8's band has a **ratio of 1.67** (10 ÷ 6). The archetype spread is now **×1.65**,
and rises above 1.67 at some settings. There is essentially no room left.

The spread is driven mostly by **Growth Frenzy uptime** — ×1.05 for the idle
archetype against ×1.60 for the active one. That is the design working as
intended: active play is supposed to pay. But a 2× Frenzy at 5%–60% uptime
consumes almost the entire band on its own, and the Kitchen Garden now mattering
consumed the rest.

Neither the test suite nor `npm run simulate` hides this. The campaign-length
assertion covers idle and casual, and pins `active` between 4.5h and the 6h floor
so a regression still fails loudly. `npm run simulate` reports it as `[KNOWN]`
with a pointer to D7, and prints the spread against the band every run.

### Also worth knowing: prestige cadence fell

Resets are now **1 / 2 / 3** against §4's target of 4–5, down from 2 / 3 / 4.
K provably cannot fix this — SQP is linear in K, so the ratio a player compares
when deciding to reset is K-independent. Reset count follows the **span of
lifetime Mana** across the campaign, and a shorter campaign spans less.

### The options

- **(a) Widen §8's band**, e.g. 5–10 hours. Cheapest. The band is a design target
  in the spec, so this is your call, not mine.
- **(b) Narrow the active-play advantage** — a shorter Frenzy window, a smaller
  multiplier, or diminishing returns on uptime. Directly attacks the cause, and
  directly contradicts "active play out-earns automation" (§9).
- **(c) Accept it.** The active archetype is deliberately extreme: 240 clicks a
  minute, 60% Frenzy uptime, constant Kitchen Garden work. A player like that
  finishing in five hours is arguably correct.
- **(d) Raise late-game costs** to lengthen only the tail. Would break the flat
  ~150–180s payback property, which is the tier table's best feature. Not
  recommended.

**Decided 2026-08-04: (c), accept it.** Recorded as **D7** in
[`04-spec-open-questions.md`](04-spec-open-questions.md). §8's 6–10 hour target
applies to the idle and casual archetypes; the `active` archetype is allowed to
finish faster, because a player sustaining 240 clicks a minute at 60% Frenzy
uptime finishing in ~5 hours is §9's "active play out-earns automation"
requirement working, not failing.

**What would reopen it:** the spread rising above ×1.67, at which point idle and
casual can no longer both fit either. `npm run simulate` checks that every run
and prints the spread against the band.

---

## Saves

`CURRENT_SAVE_VERSION` is **5**. The v4 → v5 migration remaps the eight renamed
node ids (`s1-gen-3` → `s1-yield-3`, and so on). Without it `reviveState` would
drop them as unknown and silently confiscate the Insight a player had spent.
`tests/fixtures/saves/v4.json` is frozen alongside the others.

---

## 7. Second play session (2026-08-04, later)

Five more fixes. One was a genuine regression the first batch introduced.

### 7.1 First Bloom could be cleared without a Frenzy — D4a broken

> "the target rate was achieved without the need of frenzy"

A regression caused by §§1–3. The capstone target was calibrated at 1200 Mana/sec
against a **measured** passive rate of ~890 at readiness. Making the economy more
generous raised that passive rate to **~1205** — straight past the target. The
Frenzy became a formality, and First Bloom became the production threshold in a
costume that D4a exists to prevent.

Re-calibrated **1200 → 1600**: 33% above the passive rate, comfortably under the
~2410 a Frenzy delivers. A test now asserts `target > passive × 1.2` against the
measured figure, so the next change that moves the readiness rate fails in CI
rather than in a play session.

This is the second time a measured constant has drifted out from under a balance
change. The lesson is in the test, not the number.

### 7.2 Garden Plot rates ignored Insight

> "the rate of mana is not updated after you get insights updates, should not
> update with the frenzy mode"

Each row showed `baseYield` — the raw table value, before any bonus. Buying
"Steady Drip" (+50% on Watering Cans) changed nothing on screen. New
`perUnitManaPerSecond` includes the tier's own ladder, the global production
bonus and the prestige multiplier, and **excludes Growth Frenzy**, exactly as
asked: a per-tier figure is a property of the plot, and one that silently doubles
for twenty seconds cannot be compared against its neighbour.

Watering Cans now read `0.15/s each` with Steady Drip bought, against `0.1/s`
without.

### 7.3 Kitchen Garden plots could not be re-surfaced

> "there is no way to upgrade the plots one bought"

`kitchenGardenApplySurface` existed in the store with **nothing in the UI calling
it**. The Insight tree sold you a Raised Garden Box and the only way to see one
was to break new ground.

Each plot now offers its best affordable upgrade beneath it — name and cost on
separate lines, because the cost was the half being truncated. Only strictly
better surfaces are offered, and only one at a time: six surfaces × twenty plots
would be 120 buttons, which is the busywork §2a's twenty-plot cap exists to
prevent.

### 7.4 Two nodes named plots that do not exist

> "I can not see anything about canapy"

Correct — there is no Canopy Loom, and no Loam Reactor either. Both names came
from Phase 3 and survived into the production ladders:

| node               | said            | actually boosts            |
| ------------------ | --------------- | -------------------------- |
| Loam Engineering   | "Loam Reactors" | Cider Press Guild          |
| Canopy Mathematics | "Canopy Looms"  | Scarecrow Sentinel Network |

Renamed to Cider Chemistry / Slow Pressing and Sentinel Drill / Standing Watch.
A test now checks every per-tier node's copy against the name of the tier it
boosts, comparing stems so "Nectar Refineries" still matches "Nectar Refinery".

### 7.5 The Barn nodes took Insight and did nothing

> "on the silo upgrade it mentions it holds double when should be produce double"

The wording is right — Barn Capacity is storage, so "holds" is correct. The real
problem is that **Barn Capacity is Phase 8 and does not exist**. Five nodes
(2 Barn, 3 Insulation, 72 Insight between them) were purchasable and changed no
number in the game.

`PENDING_EFFECT_KINDS` already recorded them, and a test already asserted no
effect kind goes unnoticed — but that protected the codebase, not the player.
Nodes whose systems do not exist are now **hidden** rather than sold. Hiding
rather than greying out: a disabled row invites the player to work out how to
enable it, and there is nothing they can do. They return when their phase lands,
with no save migration — visibility is derived, not stored.

Cosmetic nodes stay: having no mechanical effect is their entire point, and their
copy says so.

### 7.6 On "a bit too fast"

Season 1 runs 28–62 minutes across the archetypes in simulation, against §8's own
prediction of **0:15–1:30**, so it is inside the design's window — at the fast
end. Its length is set by the readiness gate (own ten Tier-4 plots), not by the
rate target, which is why 7.1 did not change the timings.

Nothing was changed for pacing beyond the capstone, deliberately: total campaign
length is 8.46h / 6.28h / 5.13h and moving it means moving K, which pulls against
the first prestige (§6). If Season 1 still feels rushed after 7.1 makes the
Frenzy mandatory, the cheap lever is the readiness gate — ten Tier-4 plots to
twelve or fifteen — and that is a feel judgement, not a simulated one.
