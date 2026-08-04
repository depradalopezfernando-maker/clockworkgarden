# Open Design Questions

Findings from a numerical audit of `clockwork-garden-design-spec.md`. Reproduce
with `node tools/spec-audit.mjs`.

Each item states what the spec says, what the audit found, and a recommended
resolution. Items 1, 2, 3 and 6 were **decided by the designer on 2026-08-02** and
are recorded in "Decisions taken" below — those four blocked Phase 1, which is now
unblocked. The rest remain open but block only later phases.

| #   | Severity    | Area   | One-line                                                                | Status                       |
| --- | ----------- | ------ | ----------------------------------------------------------------------- | ---------------------------- |
| 1   | **BLOCKER** | §6.2   | Barn Capacity deadlocks 9 of 9 Season 3–4 purchases                     | **RESOLVED**                 |
| 2   | **BLOCKER** | §2a    | Kitchen Garden yield is self-referential and diverges                   | **RESOLVED**                 |
| 3   | Major       | §4     | Prestige spans 1.18× → 368,000×; first prestige is worthless            | **RESOLVED**                 |
| 4   | Major       | §2     | Season 1 and Season 2 capstones are referenced but never designed       | open — blocks Phase 5        |
| 5   | Medium      | §2     | "Insight skill unlock" gates are unmapped to specific nodes             | **RESOLVED** (Phase 3)       |
| 6   | Medium      | §2/§8  | Nothing defines what actually advances a Season                         | **RESOLVED**                 |
| 7   | Medium      | §2a/§7 | Kitchen Garden behaviour while offline is unspecified                   | open — Phase 4               |
| 8   | Minor       | §2a    | Slot cost curve is too shallow to be a real decision late               | open — Phase 4               |
| 9   | Minor       | —      | Save/load, versioning, and migration are absent from the spec           | **RESOLVED** (ADR-0004)      |
| 10  | Medium      | §4     | "in-progress Insight" is ambiguous — does prestige wipe banked Insight? | open — decide before Phase 5 |

---

## Decisions taken — 2026-08-02 (D1–D6), 2026-08-04 (D7)

These are authoritative. They override the spec text where they conflict, and
Phase 1 implements them. Constants marked _sim-fitted_ are starting values for the
Phase 1 balance harness to tune against the 6–10 hr and 4–5 reset targets; the
**shape** of each formula is fixed, the coefficient is not.

### D1 — Barn Capacity (§6.2)

```
BarnCapacity = max( 500 × TotalManaPerSec ,  2.5 × CostOfNextUnpurchasedTier )
```

`TotalManaPerSec` is total production, not per-unit yield. The second term is a
structural safety rail: it makes the audited deadlock impossible regardless of
future retuning. Accepted cost — the cap can never itself be the thing blocking a
purchase, which slightly softens §6.2's banking tension.

**Invariant test:** `BarnCapacity > nextTierCost` at every tier, all Seasons.

### D2 — Kitchen Garden yield (§2a)

Non-recursive. The base is Garden Plot income only:

```
PlotContribution = BaseFraction × SurfaceYieldMult × PerfectPlantingMult
                                × AutomationYieldMult × GardenPlotManaPerSec
TotalManaPerSec  = GardenPlotManaPerSec + Σ PlotContribution
```

```
BaseFraction = 0.004        // 0.4%, sim-fitted
```

**Target:** the Kitchen Garden supplies **~⅓ of total income** at full Season 4
build-out (20 slots × 5 plants × 1.2 yield = 120 plant-units → +48% → 32% share).
Unmistakably worth engaging with; never eclipses the Garden Plot backbone.

Note the scope consequence, deliberately accepted: keeping the Kitchen Garden at
roughly a third of income preserves the §7 escape hatch — a 32% subsystem can
still be cut to "Light integration"; a 55% one cannot.

**Invariant test:** total Mana/sec is finite and non-recursive for every
configuration up to 20 Clockwork Trellis slots.

### D3 — Prestige (§4)

Log-shaped, computed **absolutely** from all-time lifetime Mana (the Cookie Clicker
model), never summed across resets:

```
TotalSQP           = max( 0, floor( K × log10( LifetimeMana / REFERENCE ) ) )
SQPGainedThisReset = TotalSQP_now − TotalSQP_at_last_reset
PrestigeMultiplier = 1 + 0.02 × TotalSQP

K         = 35     // FITTED in Phase 1
REFERENCE = 5e4    // FITTED in Phase 1 — the spec's 1e6 was wrong, see below
```

**Phase 1 correction (2026-08-02).** The spec's reference of 1e6 sits _above_ the
lifetime Mana a player holds when prestige unlocks at the Season 1 capstone
(~9e5, measured). `log10` goes negative, SQP clamps to zero, and the first
prestige is worth **exactly ×1.00** — worse than the ×1.18 this decision existed
to fix. Fitted to 5e4, which makes it ×1.88. Full detail in
`docs/06-phase-1-balance-report.md` §2.

Also established: **K controls campaign length and provably cannot control reset
count** (SQP is linear in K, so the ratio a player compares against is
K-independent). §4's "4–5 natural resets" is a behavioural prediction, not
something tuning can guarantee.

**`LifetimeMana` is all-time and does NOT reset on prestige.** The spec was silent
on this and it matters: computing SQP fresh each reset and _adding_ it would
double-count badly (×27 instead of ×12.6 by the fourth reset).

**Measured** (`npm run simulate`, K = 35, REFERENCE = 5e4). These are simulated
step-ups from a full playthrough, replacing an earlier hand projection whose
lifetime-Mana estimates were ~100x too high:

| Archetype | First prestige offered | Step-ups thereafter       | Resets |
| --------- | ---------------------: | ------------------------- | -----: |
| idle      |                  ×1.88 | ×2.00 ×2.00               |      3 |
| casual    |                  ×1.88 | ×1.61 ×1.60 ×1.60         |      4 |
| active    |                  ×1.88 | ×1.40 ×1.41 ×1.41 ×1.40 … |      5 |

Two properties this shape buys, both wanted for a _bounded_ game:

- **Every reset is felt.** The first is ×1.88, not the spec's ×1.18 — and not the
  ×1.00 that the un-fitted reference produced.
- **Over-banking is self-limiting.** Because gain scales with the log of lifetime
  Mana, grinding twice as long adds a fixed small amount (exactly K SQP per order
  of magnitude, by construction). §4's "reset cap by design, not by code".

Prestige remains **optional and speedup-flavoured**, per §4 — but it is far from
cosmetic: never resetting stretches the campaign from ~9.5h to ~25h for an idle
player. It accelerates; it does not gate.

### D6 — Season advancement (§2/§8)

Season advancement is **capstone-clear, exclusively.** §8's timeline (0:15–1:30,
1:30–3:15, …) is a **prediction the balance simulation validates**, never a
trigger. Time-gating would block fast players and push slow players into content
they are not ready for, and would make §8 a constraint on tuning rather than a
consequence of it.

**The prestige action is renamed** to break the collision with Season
advancement — "Season Change" currently means two different things, one of which
wipes your generators, at the exact moment the player is deciding whether to do
it. Working name: **"Turn the Soil"** (final name is the designer's call; it is a
string, changeable at any time).

### D7 — the archetype spread against §8's band (2026-08-04)

**§8's 6–10 hour target applies to the idle and casual archetypes. The `active`
archetype is allowed to finish faster.**

§8's band has a ratio of 1.67 (10 ÷ 6). After the playtest revisions in
`docs/09` the simulated archetype spread is ×1.65, driven mostly by Growth
Frenzy uptime — ×1.05 for the idle archetype against ×1.60 for the active one.
A 2× Frenzy at 5–60% uptime consumes almost the entire band on its own, so no
pair of pacing constants puts all three archetypes inside it while keeping §4's
first prestige felt. A 2D sweep of K and REFERENCE confirmed there is no such
point (`docs/09` §6).

The `active` archetype is a deliberately extreme stress model — 240 clicks a
minute, 60% Frenzy uptime, constant Kitchen Garden work. A player sustaining
that finishing in ~5 hours is the design working, not failing: §9 requires that
active play out-earn automation, and this is what that requirement costs at the
top of the range.

**Consequences.** `npm run simulate` reports `active` as `[KNOWN]` rather than
`[FAIL]` and prints the spread against the band every run. The campaign-length
test asserts the band for idle and casual, and pins `active` between 4.5 hours
and the 6-hour floor so a regression still fails loudly. Neither hides the
number.

**What would reopen this:** the spread rising above ×1.67, at which point idle
and casual can no longer both fit either. That is the assertion to watch.

---

## 1. BLOCKER — Barn Capacity deadlocks Season 3 and 4 progression

**Spec (§6.2):** "Mana storage gets a **Barn Capacity** cap (a large number, e.g.
500× current best generator's per-second output)."

**The ambiguity:** "current best generator's per-second output" has two readings.

- **Reading A** — 500 × the _per-unit_ yield of your best generator tier.
- **Reading B** — 500 × your _total_ mana/sec from that tier (owned × yield).

**Audit result:** Reading A blocks **all 9** tier purchases from Tier 12 through
Tier 20. The cap sits below the next tier's _base_ cost in every single case:

| Transition | Cap (Reading A) | Next tier cost | Result            |
| ---------- | --------------: | -------------: | ----------------- |
| T11 → T12  |         2.00e10 |        4.80e10 | **cannot afford** |
| T14 → T15  |         6.50e12 |        1.60e13 | **cannot afford** |
| T19 → T20  |         1.00e17 |        2.50e17 | **cannot afford** |

Under Reading A the player physically cannot bank enough Mana to buy the next
tier, and since Mana above the cap decays at 5%/min, they never will. The game
becomes unwinnable at Tier 11. Reading B blocks nothing.

**Recommendation:** Adopt **Reading B**, and state it as a formula rather than
prose. Additionally, floor the cap against the next tier's cost so the deadlock
cannot reappear under any future retune:

```
BarnCapacity = max( 500 × TotalManaPerSec , 2.5 × CostOfNextUnpurchasedTier )
```

The second term is a safety rail that makes the deadlock structurally impossible,
independent of balance changes. Add a regression test asserting
`BarnCapacity > nextTierCost` at every tier.

**DECIDED — see D1.** Reading B adopted, with the safety floor.

---

## 2. BLOCKER — Kitchen Garden yield is self-referential

**Spec (§2a):**

```
PlotContribution = (BaseFraction × SurfaceYieldMult × PerfectPlantingMult
                    × AutomationYieldMult) × CurrentTotalManaPerSec
```

with `BaseFraction ≈ 1%` "of current total Mana/sec per plot."

**The problem:** Kitchen Garden output _is part of_ total Mana/sec. If
`CurrentTotalManaPerSec` includes it, the definition is recursive — plot output
feeds total, which feeds plot output.

**Audit result:** with the spec's own late-game numbers, the loop diverges.

| Configuration                                | KG claims % of total | Behaviour               |
| -------------------------------------------- | -------------------: | ----------------------- |
| S1: 4 Bare Soil, 1 plant                     |                   4% | converges (×1.04)       |
| S2: 10 Raised Box, 3 plants                  |                  30% | converges (×1.43)       |
| **S4: 20 Clockwork Trellis, 5 plants, 1.2×** |             **120%** | **diverges — infinite** |

At 20 slots × 5 capacity × 1% × 1.2 the Kitchen Garden claims 120% of total
production. A self-referential system claiming >100% of itself has no fixed point;
production goes to infinity within seconds.

**Recommendation:** Define the base explicitly as Garden-Plot-only, which the
spec's own design intent in §2a already implies ("layers a genuine bonus _on top_"):

```
PlotContribution = BaseFraction × mods × GardenPlotManaPerSec
TotalManaPerSec  = GardenPlotManaPerSec + Σ PlotContribution
```

This is non-recursive by construction. Note the consequence: at full Season 4
build-out the Kitchen Garden adds **+120%** — it more than doubles production.
That may be more than intended for a subsystem framed as a bonus layer.

**DECIDED — see D2.** Non-recursive, `BaseFraction = 0.4%`, targeting ~⅓ of total
income at full build-out. This resolves §10's item 10 placeholder.

---

## 3. Major — Prestige rewards are wildly non-uniform across the campaign

**Spec (§4):**

```
SQP = floor( sqrt( LifetimeMana / 1,000,000 ) )
PrestigeMultiplier = 1 + (0.02 × TotalSQP)
```

**Audit result** (lifetime Mana estimated as 10× the cost of 25 units of each
Season's capstone tier):

| Prestige at end of | Est. lifetime Mana |        SQP | Cumulative multiplier |
| ------------------ | -----------------: | ---------: | --------------------: |
| Season 1           |              8.7e7 |          9 |             **×1.18** |
| Season 2           |             1.3e12 |      1,153 |                   ×24 |
| Season 3           |             2.1e16 |    146,000 |                ×2,950 |
| Season 4           |             3.3e20 | 18,300,000 |          **×368,000** |

The problem is the **first** one. §4 unlocks prestige after the Season 1 capstone
and the reward is **+18%** — for wiping all your generators. Players learn
"prestige is a trap" at the exact moment the game is teaching them the mechanic,
and the spec's target of 4–5 natural resets will not happen.

The root cause is shape: `sqrt` of an exponentially-growing currency, fed into a
_linear_ multiplier, gives a reward that is nearly flat early and explosive late.

**Recommendation:** Normalise against progress rather than raw Mana. Anchor the
divisor to the current Season so each prestige is worth a comparable amount:

```
SQP = floor( 10 × sqrt( LifetimeMana / SeasonAnchor[currentSeason] ) )
SeasonAnchor = [ 1e6, 1e10, 1e14, 1e18 ]
```

This targets a **~2–3× multiplier per prestige** consistently, which matches the
genre convention the spec cites (Cookie Clicker's first Heavenly Chip is felt
immediately). Exact constants are for Phase 1's simulation to fit — the sim can
sweep them against the "4–5 natural resets" target directly.

**DECIDED — see D3.** Log-shaped, computed absolutely from non-resetting lifetime
Mana. Consistently-felt resets; prestige stays optional and speedup-flavoured.

---

## 4. Major — Season 1 and Season 2 capstones do not exist

**Spec:** The §2 tier table gates Tier 5 on "Season 1 capstone clear" and Tier 10
on "Season 2 capstone clear". §6 designs a new mechanic for Seasons 2, 3, and 4,
and §6.3 designs _The Long Night_ as Season 4's capstone event. §8 promises "a
capstone challenge" every Season.

**But:** no capstone is ever designed for Season 1 or Season 2. Season 3's
Harvest Festival is a _recurring_ event, not a capstone either — so arguably three
of four are missing.

This is a genuine content gap, not an ambiguity. It gates Tiers 5, 10, and 15, and
it is the emotional punctuation at the end of each Season.

**Recommendation:** Design three capstones, each a payoff for that Season's own
mechanic — mirroring how The Long Night tests Season 4's Frost systems:

- **Season 1 — "First Bloom":** a timed Growth Frenzy challenge. Reach a target
  Mana/sec within one Frenzy window. Tests §5, the only mechanic the player has.
- **Season 2 — "The Great Pollination":** sustain a Pollination Chain of 9+
  (Golden Bloom) _during_ a Frenzy. Tests §6.1 and explicitly rewards the
  stacking the spec calls "the Season's peak moment".
- **Season 3 — "The Grand Harvest":** enter a Harvest Festival with the Barn at
  ≥90% capacity and convert a target overflow into Seeds. Tests §6.2's banking
  decision directly.

**Decision needed:** Approve, replace, or defer these. They are ~1 session of
implementation each and can slot into Phases 5, 7, and 8 respectively.

---

## 5. Medium — "Insight skill unlock" gates are unmapped

**Spec:** Tiers 3, 4, 8, 9, 13, 14, 18, 19 unlock via "Insight skill unlock."

Which node? At what Insight cost? What are its prerequisites? §3 describes the
tree's _categories_ but never enumerates its nodes, so eight of twenty generator
unlock gates currently point at nothing.

**Recommendation:** Author the full ~50-node tree as a data file in Phase 3, with
explicit `unlocks: ['generator.tier8']` edges, so the gate and the node are the
same object. Until then, Phase 1's simulation should model these gates as
"available at the Season's midpoint" — sufficient for pacing maths, replaced by
real data in Phase 3.

**Decision needed:** None blocking. Flagged so it does not surprise anyone in
Phase 3, where it is the bulk of the work.

---

## 6. Medium — Nothing defines what advances a Season

The tier table gates Tier 6 on "Season 2 start" and Tier 5 on "Season 1 capstone
clear", implying capstone-clear advances the Season. But §8 presents Seasons on a
_time_ axis (0:15–1:30, 1:30–3:15…), which implies elapsed play. And prestige
("Season Change", §4) shares the Season vocabulary while explicitly _not_ being
Season advancement — a naming collision worth resolving in the UI.

**Recommendation:** Make Season advancement **exclusively** capstone-clear;
treat §8's timings as _predictions_ the balance simulation should validate, not as
triggers. Rename the prestige action in-game (e.g. **"Turn the Soil"**) so
"Season Change" does not mean two different things to the player.

**DECIDED — see D6.** Capstone-gated exclusively; prestige action renamed.

---

## 7. Medium — Offline behaviour of the Kitchen Garden is undefined

§7 specifies offline efficiency for Mana. §2a never says what happens to the
Kitchen Garden while away. Open sub-questions:

- Do planted crops continue growing offline? (§2a says plants grow through Night
  in real time, which suggests yes.)
- Does Day Time refill while offline? Since it "only depletes when _you_ perform an
  action," it should simply be untouched — but that means a returning player always
  finds a full Day, which is fine and probably intended.
- Do Seeds regenerate offline (+1/10s, capped at Satchel capacity)? At 20 capacity
  that is 200 seconds to fill — so effectively "always full on return."

**Recommendation:** Crops grow offline at the same tapered efficiency as §7. Day
Time is untouched. Seeds regenerate offline, capped — which naturally means a
returning player finds a full Satchel and a full Day, a deliberately generous
"welcome back" state consistent with §9's anti-friction stance.

**Decision needed:** Confirm, particularly whether crop growth should be tapered
by §7's curve or run at full rate.

---

## 8. Minor — Kitchen Garden slot costs go trivial late

**Spec (§2a):** `SlotCost(n) = 3 × (Season Tier-1 cost) × 1.15^(n−5)`, n = 5..20.

**Audit result:** because the anchor jumps ~7× per _tier_ but the multiplier only
compounds at 1.15 per _slot_, the final slot costs ~24× a Season-4 Tier-1
generator — which by Season 4 is pocket change. Slot 20 is effectively free.

| Slot | Season |   Cost | × that Season's Tier-1 |
| ---- | ------ | -----: | ---------------------: |
| 5    | 1      |  4.5e1 |                   ×3.0 |
| 12   | 3      | 5.6e10 |                   ×8.0 |
| 20   | 4      | 2.7e15 |                  ×24.4 |

Not broken — just not a decision. If slot expansion is meant to be a meaningful
investment, raise the exponent (~1.35) or anchor to a mid-tier generator instead of
Tier 1.

**Decision needed:** Whether slots should be a real cost or a soft
progression-pacing gate. Low stakes either way.

---

## 9. Minor — Save/load is entirely absent from the spec

Not a defect in the design, but a gap in the build plan. A 6–10 hour game with
offline progress needs, from Phase 2 onward:

- A **versioned** save schema with forward migrations.
- Autosave cadence and crash-safety.
- Export/import, so playtesters can hand you a broken state.
- A defined stance on tampering (recommendation: don't fight it — single-player,
  one-time purchase, no leaderboards; obfuscation costs effort and buys nothing).

**Recommendation:** Build the save layer in Phase 2 with migration tests from the
first version. Retrofitting versioning after playtesters have saves is
significantly more expensive.

**Decision needed:** Confirm no anti-tamper requirement.

---

## 10. Medium — does prestige wipe banked Insight?

**Spec (§4):** "What resets: current Mana, Garden Plots owned, **in-progress
Insight**."

**The ambiguity:** "in-progress Insight" has two readings.

- **Reading A** — unspent Insight is wiped on every reset.
- **Reading B** — only _progress toward the next milestone_ is lost; banked
  Insight survives. (Under the current model there is no such partial progress
  to lose, so this reading makes the clause a no-op.)

**Currently implemented: Reading B.** Banked Insight survives a reset.

**Why:** wiping savings punishes exactly the planning the tree is meant to
reward — a player holding 20 Insight for an expensive node loses it for taking
the reset the game is nudging them toward. That runs against §9's anti-frustration
guardrails. Reading A would also make the optimal play "always spend down before
resetting", which is busywork rather than a decision.

**Related and NOT ambiguous:** claimed milestones and purchased nodes must
survive a reset. If claims reset, every prestige re-pays the same Insight and
§3's "not just buy everything eventually" design collapses into an Insight farm.
Guarded by a test.

**Decision needed:** confirm Reading B, or ask for A and accept the consequence.

---

## D4a — Season 1 capstone: "First Bloom" (decided 2026-08-02)

**Shape.** A timed Growth Frenzy challenge. Reach a target Mana/sec _during a
single Frenzy window_. This follows §6's pattern — each Season's capstone tests
that Season's own mechanic, as The Long Night tests Frost — and Frenzy (§5) is
the only mechanic Season 1 has.

**Target: 1,200 Mana/sec, measured during Frenzy.**

Calibrated against the simulation rather than picked. At the moment the capstone
becomes available, every archetype sits at the _same_ production, because the
gate is own-count based and they all arrive in the same build state — only the
clock differs:

| Archetype | Reaches capstone at | Mana/sec | During Frenzy (×2) |
| --------- | ------------------: | -------: | -----------------: |
| idle      |               1.41h |      893 |              1,787 |
| casual    |               1.01h |      893 |              1,787 |
| active    |               0.65h |      885 |              1,770 |

1,200 sits **above** the ~890 a player holds passively and **below** the ~1,780 a
Frenzy delivers. Two consequences, both wanted:

- You **cannot** clear it by idling — the Frenzy is what carries you, so the
  capstone genuinely tests §5 rather than being a production threshold wearing a
  costume.
- A player who has bought generators at a normal pace clears it **first try**,
  with roughly 45% headroom.

One number serves all three archetypes, which is a happy consequence of the
own-count gate.

**On failure: retry immediately, no penalty, no cooldown.** §9 lists enforced
waits as a known genre failure mode, and §6.3 frames capstones as difficulty
spikes rather than hard gates. A player who misses keeps playing, grows stronger,
and clears it next attempt.

**Difficulty stance:** clearable first try by an idle player who has built
normally. The capstone is a ceremony marking the Season's end, not a wall.

**Implementation notes for Phase 5:**

- `S1_CAPSTONE_TARGET_RATE = 1200` goes in `balance.ts` tagged **HUMAN** — it is
  a feel number and the Phase 5 playtest is the only place it can honestly be
  judged.
- Replaces the Phase 1 placeholder in `src/content/generators.ts`
  (`CAPSTONE_GATE_TIER` / `CAPSTONE_GATE_COUNT`), which gates on owning 10 of the
  Season's fourth tier.
- The capstone is _available_ on the existing own-count gate and _cleared_ by
  hitting the rate target — so the challenge cannot be attempted before the
  player has the generators to stand a chance.
- Re-run `npm run simulate` afterwards: changing what clears Season 1 moves every
  downstream Season boundary.

**Still open:** the Season 2 and Season 3 capstones. Proposals in item 4 below
("The Great Pollination" and "The Grand Harvest") remain unreviewed, and Season 2
blocks Phase 7 rather than Phase 5.

---

## Decision status

| #   | Decision                                           | Blocks  | Status                     |
| --- | -------------------------------------------------- | ------- | -------------------------- |
| 1   | Barn Capacity = total output + safety floor        | Phase 1 | **decided 2026-08-02**     |
| 2   | Non-recursive KG yield; `BaseFraction` 0.4%        | Phase 1 | **decided 2026-08-02**     |
| 3   | Log-shaped prestige on non-resetting lifetime Mana | Phase 1 | **decided 2026-08-02**     |
| 6   | Capstone-gated Seasons; prestige renamed           | Phase 1 | **decided 2026-08-02**     |
| 4   | Approve/replace the three proposed capstones       | Phase 5 | open                       |
| 5   | Map "Insight skill unlock" gates to real nodes     | Phase 3 | open (authored in Phase 3) |
| 7   | Offline crop growth tapered or full-rate           | Phase 4 | open                       |
| 8   | Should slot cost be a real decision                | Phase 4 | open                       |
| 9   | Confirm no anti-tamper requirement                 | Phase 2 | open                       |

**Phase 1 is unblocked.** The next decision that gates real work is item 4 — the
Season 1 and 2 capstones — which blocks Phase 5, the vertical-slice go/no-go.
