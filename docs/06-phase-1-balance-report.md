# Phase 1 — Balance Report

**Date:** 2026-08-02 · **Status:** exit criteria met
**Reproduce:** `npm run simulate` · **Re-fit:** `npm run fit`

The headless economy is built and the campaign has been simulated end to end for
three player archetypes. This is the phase that answers "does the economy work?"
before any UI exists.

---

## 1. Result

| Archetype | Campaign | Season 2 | Season 3 | Season 4 | Resets |
| --------- | -------: | -------: | -------: | -------: | -----: |
| idle      |    9.50h |    1.48h |    5.11h |    8.37h |      3 |
| casual    |    8.11h |    1.11h |    4.77h |    7.11h |      4 |
| active    |    6.40h |    0.76h |    3.25h |    5.67h |      5 |

**All three land inside §8's 6–10 hour target.** All three reach the Full Bloom
ending. The Kitchen Garden supplies 32.4% of income at full build-out, inside its
28–38% target from decision D2.

Fitted constants:

```
PRESTIGE_SQP_COEFFICIENT   = 35     (was 40)
PRESTIGE_SQP_REFERENCE     = 5e4    (was 1e6 — see §2)
KITCHEN_GARDEN_BASE_FRACTION = 0.004  (unchanged; already correct)
```

---

## 2. The defect the simulation found

**The first prestige was worth exactly ×1.00 — nothing at all.**

Decision D3 was made to fix the spec's original first prestige of ×1.18. The
simulation revealed that D3 as written was _worse_: at the Season 1 capstone, the
moment §4 unlocks prestige, a player holds around **9×10⁵ lifetime Mana** — below
`PRESTIGE_SQP_REFERENCE = 1e6`. `log10` of a number below the reference is
negative, SQP clamps to zero, and the reward is nil.

This is not visible on paper. It depends on _when the capstone actually fires_,
which depends on the tier table, the purchase policy, and the player's income
curve. The earlier hand-estimate put lifetime Mana at the Season 1 capstone near
8.7×10⁷ — nearly a hundred times too high, because it assumed the player had
bought 25 units of the Season's capstone tier rather than reaching the capstone
gate.

Lowering the reference to `5e4` makes the first prestige worth **×1.88**.

This is the clearest argument for Phase 1 existing at all: the bug was introduced
by a decision _intended to fix exactly this class of bug_, survived review, and
was only caught by running the game.

---

## 3. What K can and cannot do

`PRESTIGE_SQP_COEFFICIENT` (K) controls campaign **length**. It provably cannot
control reset **count**.

SQP is linear in K, so the ratio between successive prestige multipliers — which
is what a player's reset decision actually compares against — is K-independent.
The sweep confirms it: at any K, a given player threshold produces the same reset
count (6/6/6, then 5/5/5, then 4/4/4 as the threshold rises).

**Consequence for the designer:** §4's "4–5 natural resets" is not reachable by
tuning. It is a prediction about player behaviour — specifically about how much
of a boost someone demands before accepting a reset. The observed counts (3/4/5)
straddle the target, which is about as close as tuning can get.

If hitting 4–5 reliably matters, the lever is not K. It is making the reset
decision less free — a nudge in the UI, a milestone that suggests it, or content
gated behind a reset.

---

## 4. Prestige is worth taking (an early read of mine was wrong)

An intermediate sweep showed campaign length rising with reset count and I read
that as "prestige costs time". Isolating the variable disproved it:

| Archetype | Never reset | Eager (1.4) | Reluctant (2.0) |
| --------- | ----------: | ----------: | --------------: |
| idle      |      24.99h |      11.73h |           9.32h |
| casual    |      20.88h |       9.45h |           7.65h |
| active    |      16.22h |       6.99h |           5.72h |

Prestige roughly **halves** the campaign. The real effect is subtler: resetting
_too eagerly_ wastes time, because each reset carries a fixed rebuild cost. Few
large resets beat many small ones. §4's framing — "a permanent production bonus
and a faster next loop" — holds.

---

## 5. The tuning margin is thin, and Growth Frenzy is why

| Measure                                   | Value |
| ----------------------------------------- | ----: |
| Spread, slowest (idle) : fastest (active) | ×1.48 |
| Spread the 6–10h band permits             | ×1.67 |
| Margin                                    |   18% |

The spread is driven **almost entirely by Growth Frenzy uptime** — ×1.05 for an
idle player versus ×1.60 for an active one. It is not driven by clicking: against
quadrillion-per-second late-game production, click income is a rounding error.

That has a design consequence worth stating plainly. **Growth Frenzy's uptime is
the single biggest determinant of how long the game takes.** §10 item 3 asks
whether the 20-second window feels right; the answer also sets the campaign's
length spread. If Frenzy becomes easier to keep up, active players finish faster
and the spread widens past what the band allows — at which point _no_ value of K
puts everyone inside.

`tests/sim/campaign.test.ts` asserts the spread stays under the band ratio, so
this fails loudly rather than silently.

---

## 6. Confirmed as designed

- **Payback flatness holds.** 150s–180s across all 20 tiers, 30s spread. The
  property that makes the economy read identically at 15 and at 250 quadrillion.
  Locked by three regression tests.
- **§9's cost-multiplier band holds** — every tier inside 1.07–1.12.
- **Offline (§7) integrates exactly.** The closed-form result matches 200,000-step
  numeric integration to four decimals. 24h away yields 20 productive hours.
- **D2's Kitchen Garden is bounded** at every configuration up to 20 Clockwork
  Trellis slots — the divergence found in the original audit cannot recur.
- **Season pacing tracks §8 well** at the start: Season 2 at 1.48h for an idle
  player against §8's predicted 1:30.

---

## 7. Caveats — what this simulation does not prove

Stated plainly, because a green report is easy to over-read.

- **Season 1 and 2 capstones do not exist yet** (`docs/04` item 4). The harness
  gates on "own 10 of the Season's fourth tier" as a stand-in. Real capstones will
  shift Season boundaries, and Season 1's timing is the most sensitive.
- **Insight gates are approximated.** Eight tiers unlock on "Insight skill
  unlock", which Phase 3 turns into real tree nodes. Until then the harness treats
  them as owning 10 of the previous tier.
- **The Kitchen Garden is modelled at build-out level only.** Dig/Plant/Cover,
  Perfect Planting, the Day/Night budget and the automation tracks are Phase 4.
  What is validated is its _income share_, not its feel.
- **Frenzy is an average, not a meter.** Fine for pacing; useless for judging
  whether chasing it is fun.
- **Seasons 2–4 mechanics are absent.** Pollination, Harvest Festival and Frost
  will all move these numbers.
- **Player archetypes are invented.** Three plausible profiles, not measured
  humans. The prestige threshold in particular is a guess, and §3 above shows the
  reset count depends on it entirely.
- **None of this says the game is fun.** That is Phase 5's human gate.

---

## 8. Recommended follow-ups

1. **Design the Season 1 and 2 capstones** (`docs/04` item 4). Now the largest
   source of error in these numbers, and it blocks Phase 5 regardless.
2. **Decide whether 4–5 resets is a real requirement.** If it is, it needs a
   design mechanism, not a constant (§3).
3. **Treat Frenzy uptime as a balance parameter, not just a feel parameter**
   (§5). It is the dominant term in campaign-length spread.
4. **Re-run `npm run simulate` after every content phase.** It is in CI and takes
   under five seconds.
