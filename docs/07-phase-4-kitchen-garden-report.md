# Phase 4 — Kitchen Garden Report

**Date:** 2026-08-02 · **Status:** built and playable; **one design question needs you**
**Reproduce:** `npm run simulate` · **Re-fit:** `npm run fit`

> **Update, 2026-08-03 — §2 is resolved.** Option (c) was chosen and applied, and
> applying it turned up the real cause: a **deadlock that froze the Kitchen
> Garden permanently**, plus two harness defects that hid it. The garden now
> realises **8.1% of income across the run and 32.4% at the end**, up from 2.9%
> and 3.5%. See [§5](#5-the-fix-2026-08-03). The rest of this document is the
> original Phase 4 report, left as written.

§2a is implemented in full — no scope cut taken. Grid and slots, the per-plot
Dig → Plant → Cover state machine, Perfect Planting, six surfaces, the Seed
Satchel, the spend-only Day/Night budget, and three automation steps at two
levels each.

---

## 1. Where the campaign landed

| Archetype | Campaign | Season 2 | Season 3 | Season 4 | Resets | KG share |
| --------- | -------: | -------: | -------: | -------: | -----: | -------: |
| idle      |    9.88h |    1.41h |    4.50h |    8.19h |      2 |     3.5% |
| casual    |    8.15h |    1.02h |    4.06h |    7.07h |      3 |     3.5% |
| active    |    6.22h |    0.67h |    3.61h |    5.72h |      4 |     3.5% |

Still inside §8's 6–10 hours. `PRESTIGE_SQP_COEFFICIENT` re-fitted 20 → 26.

---

## 2. The finding: the Kitchen Garden supplies ~3.5% of income, not ~⅓

This is §10 item 10 — "does the 1% BaseFraction make the Kitchen Garden a
meaningful strategic layer or a forgettable side-mechanic?" — answered with a
simulated playthrough rather than an opinion.

**As currently costed, forgettable.**

Decision D2 set `BaseFraction` so that a **full Season 4 build-out** yields ~⅓ of
income. That target is met exactly — `fullBuildOut()` measures 32.4%, and a test
holds it there. The problem is that no simulated player ever reaches full
build-out, because it requires all of:

| Requirement                         | Cost                                        |
| ----------------------------------- | ------------------------------------------- |
| 20 slots (16 bought with Mana)      | ~1.8e16 Mana at Season 4 prices             |
| Slot-cap nodes to raise 4 → 20      | 22 Insight                                  |
| Clockwork Trellis (capacity 5)      | 16 Insight, behind 18 more of prerequisites |
| Replanting all 20 plots in Season 4 | 20 cycles, 120s growth each                 |

The Trellis and the last slot nodes are Season 4 content. The campaign ends
shortly after Season 4 begins, so the high-capacity garden exists for minutes,
not hours. What a player actually holds for most of the run is four to eight
Bare Soil plots, which is **1.6%–3.5%**.

### Why tuning alone does not fix it

Three attempts, all measured:

1. **Cheaper Kitchen Garden nodes.** Re-costed the branch 166 → ~100 Insight and
   moved the Raised Garden Box earlier. Moved the needle from ~2% to ~3.5%.
2. **A harness that buys Kitchen Garden nodes at all.** Phase 3's policy skipped
   them (their systems did not exist). Turning them on with cheapest-first
   spending starved the generator unlocks so badly that **no archetype finished
   inside 60 hours** — the unlock chain costs 96 Insight and gates content
   outright.
3. **Spending only surplus while saving for the next unlock.** No change: the
   surplus never materialises, because the next unlock always costs more than
   what is spare.

The two branches genuinely compete, and progression wins every time because it
gates content. That is a structural relationship, not a coefficient.

### Options, for you to choose between

- **(a) Accept it.** The Kitchen Garden becomes a small flavour layer with a
  late-game spike. Cheapest; contradicts D2's ~⅓ target, which would need
  restating.
- **(b) Give the Kitchen Garden its own currency.** Seeds already exist and are
  nearly free. Funding slots and surfaces from Seeds rather than Insight removes
  the competition entirely. The largest change, and the one most likely to make
  the subsystem feel like its own thing.
- **(c) Move capacity earlier.** Bring the Raised Garden Box (×3) into Season 1
  and the Trellis (×5) into Season 3. Keeps one currency; makes the garden matter
  during the hours a player is actually there.
- **(d) Raise `BaseFraction` and lower the ceiling.** Make a _small_ garden matter
  by scaling per-plot yield up and capping total plant-units. Changes D2.
- **(e) Take the §7 scope cut.** "Light integration" — a one-time planting
  ceremony per Season. Still available; the systems built here would largely be
  discarded.

**My read: (c), then reconsider (b) if it is still thin.** It is the smallest
change that puts the garden in front of the player while they can still use it,
and it does not touch a decision already taken.

**Chosen: (c).** Applied 2026-08-03 — see [§5](#5-the-fix-2026-08-03). It is no
longer thin, so (b) is not needed.

---

## 3. Also worth knowing

- **Night's blast radius is tested.** §2a promises Night pauses _only_ new
  Kitchen Garden actions. Five tests assert that Garden Plot production, the
  Bell, Growth Frenzy, click yield and world advancement are all identical during
  Night. This is the promise most likely to be broken silently by a later phase.
- **Day Time is spend-only, and proven so.** A test idles for a simulated hour
  and asserts Day Time has not moved. §9 lists real-time energy gates as a known
  failure mode by name.
- **Slots reconcile two sections.** §2a buys slots with Mana; §3 lists
  "plot-slot capacity" as an Insight branch. Implemented as **Insight raises the
  cap, Mana breaks the ground** — both readings satisfied.
- **Automation yield uses the worst step, not the product.** §2a gives one yield
  modifier per level, not per step. Multiplying three Level-1 steps would compound
  0.9 into 0.73, which is not the "modest yield cost" the spec describes.

---

## 4. Still open

- **`docs/04` item 7 — offline Kitchen Garden behaviour.** Crops currently grow on
  **engaged-play seconds**, so they do not advance while the tab is closed. A
  returning player finds the garden exactly as they left it. This is defensible
  (it keeps the hand-tended layer hand-tended) but it is not what §2a's "real
  time" wording implies, and it is a decision, not an accident.
- **Season 1 and 2 capstones** (`docs/04` item 4) — now blocking Phase 5, the
  vertical-slice go/no-go.
- **`docs/04` item 8 — slot costs go trivial late.** Unchanged from the original
  audit; the 1.15 curve is too shallow to be a real decision by Season 4.

---

## 5. The fix (2026-08-03)

Option (c) was chosen. Applying it uncovered why §2's numbers were so low: the
subsystem was not merely under-tuned, it was **broken in three separate ways**,
and the balance harness could not see any of them.

### 5.1 What (c) itself did

The two capacity surfaces moved a Season earlier. Yields and capacities are
untouched — only the gate.

| Surface           | Capacity | Was      | Now      |
| ----------------- | -------: | -------- | -------- |
| Raised Garden Box |       ×3 | Season 2 | Season 1 |
| Clockwork Trellis |       ×5 | Season 4 | Season 3 |

The Trellis previously hung off the Greenhouse Bed, which is a Frost-immunity
node with nothing to do with capacity. It now hangs off Automatic Digging, which
is what its built-in Level 2 automation actually extends.

On its own, (c) moved the realised share from **2.9% to 4.1%**. Worth doing, and
nowhere near a fix. That gap is what prompted looking harder.

### 5.2 The deadlock — a real, shipped, player-facing bug

**Day Time is spend-only, and Night began only at exactly zero.** Steps cost a
whole number of seconds, so a Day can strand a remainder smaller than anything
the player can buy. That remainder never drained, so Night never came, so the
Day never refilled, and **the Kitchen Garden froze permanently** — with the HUD
cheerfully reporting the leftover second or two of Day.

It is not a corner case. It is the ordinary Season 1 build:

```
Longer Mornings, no automation:  45s Day ÷ 2s per step = 22 steps, 1s stranded
```

A player who bought one Day Length node and no automation would lose their
Kitchen Garden for the rest of the run. In the simulated campaign the garden
locked up part-way through Season 3 and never recovered — which is most of what
the original "~3.5%" was measuring.

The rule is now: **a Day that cannot pay for a single pending action is over.**
Plots that are growing or grown are not pending anything, so a garden with
nothing to do does not force Night on itself. `dayIsSpent` in
`src/sim/kitchenGarden.ts`; six tests, including a property sweep over every Day
length × automation mix that asserts a garden is still workable an hour later.

### 5.3 Two harness defects that hid it

Neither is a game bug, but both made the simulation flatter the design's
problems by measuring a player nobody would recognise:

1. **Plots were never re-surfaced once grown.** The upgrade policy only touched
   plots in stage `bare`, and a plot that has been cycled is never bare again.
   So every plot a player owned _before_ unlocking a better surface stayed Bare
   Soil forever, and only newly-broken ground got the upgrade. This is why (c)
   looked so weak: moving the Raised Garden Box to Season 1 does nothing if the
   plots that exist in Season 1 can never receive it.
2. **A half-worked plot stalled the whole garden.** The tend loop took the first
   non-grown plot, always started its cycle at `dig`, and gave up on the entire
   garden if that plot could not progress. A plot left `dug` failed the stage
   check on its first step and was never touched again — while nineteen workable
   plots sat beside it.

### 5.4 Where it lands

| Measure              | Before | After |
| -------------------- | -----: | ----: |
| Seasons 1–2          |   2.5% |  4.3% |
| Whole run (time-avg) |   2.9% |  8.1% |
| At the end           |   3.5% | 32.4% |
| Full S4 build-out    |  32.4% | 32.4% |

D2's ~⅓ target is now **actually reached in play** rather than only in a
synthetic full build-out — casual and active both finish at 32.4%. The idle
archetype ends at 19.4%, because it never buys the Trellis; that is a build
choice, which is what a strategic layer is supposed to produce.

The early game is still modest at ~4%, and that is honest: a Season 1 player has
four plots. The garden grows into significance rather than starting there.

### 5.5 Consequences

- **`PRESTIGE_SQP_COEFFICIENT` re-fitted 26 → 24.** A Kitchen Garden that pays
  what it was designed to pay shortens every campaign; the active archetype fell
  to 5.88h, just under §8's floor. K is the pacing knob, so K absorbed it.
  Campaigns are now 9.68h / 7.96h / 6.19h.
- **`npm run simulate` now reports the realised share and gates on it.** Full
  build-out alone is a flattering number — it was the only one being checked,
  and it passed throughout, while the garden was frozen solid. Two new checks:
  ≥5% across the run, ≥15% at the end.
- **`CampaignResult` gained `kitchenGardenShareTimeAverage` and
  `kitchenGardenShareEarly`.** The absence of a time-weighted measure is what
  let a subsystem hit its target on paper while being worth ~2% in play.

### 5.6 Still open after this

`docs/04` item 7 — **offline Kitchen Garden behaviour** — is unchanged and still
yours. Crops grow on engaged-play seconds only.
