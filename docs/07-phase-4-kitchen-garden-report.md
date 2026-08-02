# Phase 4 — Kitchen Garden Report

**Date:** 2026-08-02 · **Status:** built and playable; **one design question needs you**
**Reproduce:** `npm run simulate` · **Re-fit:** `npm run fit`

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
