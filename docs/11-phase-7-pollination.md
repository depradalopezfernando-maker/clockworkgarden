# Phase 7 — Season 2: the Pollination Combo (§6.1)

**Status: built and playable.** Season 2 now has its mechanic, its capstone
(D4b), its Insight branch and its automation catch-up. One thing came out of
this phase that a human has to decide, and it is in §3 below.

Everything here refers to `clockwork-garden-design-spec.md` §6.1 unless said
otherwise.

---

## 1. What was built

| Piece                                  | Where                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| Chain state machine                    | `src/sim/pollination.ts`                                      |
| Bloom multiplier in the economy        | `src/sim/tick.ts` (`advance`, `clickBell`, `pollinateFlower`) |
| Tier 8 drone auto-attempt              | `src/sim/pollination.ts` (`runDrone`)                         |
| Season 2 capstone, "Both Blooms" (D4b) | `src/sim/capstone.ts`                                         |
| Five Insight nodes                     | `src/content/insightTree.ts` (`s2-pollen-*`)                  |
| Three milestones                       | `src/content/milestones.ts` (`m-chain-3/6/9`)                 |
| The flower panel                       | `src/ui/PollinationPanel.tsx`                                 |
| Save v6 + frozen fixture               | `src/game/save.ts`, `tests/fixtures/saves/v6.json`            |
| Harness model                          | `src/sim/campaign.ts` (`pollinationMultiplier`)               |

Three flowers — Sunflower, Lavender, Poppy — sit under the Bell. A different
flower within the window extends the chain; the same flower, or a lapse, breaks
it. Chains of 3, 6 and 9 grant the Bronze, Silver and Golden Blooms from §6.1's
table. Blooms **multiply** with a Growth Frenzy, so a Golden Bloom inside a
Frenzy is ×4 — §6.1 calls that the Season's peak moment and D4b makes it the
capstone.

### Three places the spec did not say, and what was chosen

**Past nine.** §6.1's table stops at a chain of nine. Two readings were
available and both are bad: a chain that keeps paying past nine makes the peak
of the Season trivially permanent (three clicks buys twenty seconds), and one
that pays nothing past nine makes the optimal play "stop clicking". **The
Golden Bloom scatters the chain that earned it.** Build nine, bloom, build nine
again — which is the rhythm the mechanic is named for, and it puts a real
ceiling on Golden uptime at nine clicks per twenty seconds.

**"Resets the chain to 0."** A repeat or a lapse resets to zero, and then the
click that caused it lands as the first link of the new chain, so the counter
reads 1. Both readings agree on the punishment; this one does not also show the
player a 0 that the next frame contradicts.

**Who the drone competes with.** The drone only ever works an **idle** chain. It
cannot touch one the player is driving. A 60%-likely drone failure that broke a
human's eight-link chain would invert §6.1's own guardrail — automation
sabotaging active play — and it is the kind of bug that is very hard to
attribute from the player's side.

### The drone is deterministic

Its coin flips come from an LCG seeded **in state**, not `Math.random`. Same
save, same sequence. That keeps `src/sim` pure (ADR-0002), keeps saves
reproducible, and means the balance harness is measuring the drone the players
actually get. The seed survives prestige, so a reset cannot be used to reroll
its luck.

---

## 2. The §6.1 guardrail — the phase's exit criterion

> "…so idle players still benefit, but a player actively managing the pattern
> reliably outperforms it."

Measured, not asserted. `expectedDroneMultiplier()` computes the drone's average
Mana multiplier in closed form from the Markov chain over chain lengths, and
`npm run simulate` reports it per archetype.

| Who                                    | Average Mana multiplier |
| -------------------------------------- | ----------------------- |
| Drone alone, stock 40%                 | **×1.08**               |
| Drone alone, both Insight nodes bought | **×1.15**               |
| A player holding the Golden Bloom      | **×2.00**               |

The guardrail holds with a margin of 1.7× against a fully-upgraded drone. A test
(`tests/sim/pollination.test.ts`, "PHASE 7 EXIT") pins it, and a second test
cross-checks the closed form against an hour of the drone actually running.

**The two drone Insight nodes were cut from +15 points of success to +5.**
Success enters the payoff at the ninth power — a chain of nine needs nine
straight — so +15 points twice took the drone to ×1.47, which is not "a real, if
lesser, role", it is most of the mechanic for 20 Insight.

---

## 3. DECISION NEEDED — D7 is reopened

**The archetype spread is now ×2.45 against §8's band ratio of ×1.67.**

| Archetype | Before Phase 7 | After | §6.1 multiplier at end |
| --------- | -------------- | ----- | ---------------------- |
| idle      | 8.46h          | 8.46h | ×1.17                  |
| casual    | 6.28h          | 6.17h | ×1.30                  |
| active    | 5.13h          | 3.45h | ×1.65                  |

`npm run simulate` reports this every run and pins it; it does not fail the
gate, because the alternatives are a red build everyone learns to ignore or a
target widened until it passes.

**This is not a fitting problem.** §6.1 is by construction an ACTIVE-PLAY
multiplier: idle earns the drone's ×1.08, an engaged player up to ×2.00. §9
requires exactly that ("active play out-earns automation"); §8 requires the
three archetypes to fit inside a 6–10 hour band whose ratio is 1.67. Adding any
mechanic that pays attention necessarily pushes them apart. No value of K, of
REFERENCE, or of the Kitchen Garden's base fraction reconciles them — a 2D sweep
of K × REFERENCE found no point that satisfies all three archetypes AND keeps
the first prestige felt, and that was already true in docs/09 §6 before §6.1
existed.

It will get worse, predictably. §6.2's Harvest Festival and §6.3's Stoke the
Furnace are both active-play levers too. **Phases 8 and 9 will each widen this
spread again**, so the decision is better taken now than three phases from now.

### The options

1. **Scope §8's band to idle and casual, and drop the spread target.** What D7
   already does for `active`, made explicit and permanent. Cheapest, and it
   concedes that "6–10 hours" describes a normal player rather than a
   speedrunner. **Recommended.**
2. **Cut the Bloom bonuses below §6.1's table.** Halving them (+12/25/50%)
   roughly halves the spread contribution. It also makes the Season's peak
   moment noticeably less of a moment, and it is a change to the spec.
3. **Stretch the tier table.** Restores the band for everyone by making the
   whole campaign longer. It is the only lever that scales with the number of
   Seasons, so it is the honest fix if the spread target is load-bearing — but
   it touches SPEC-tagged content and invalidates the payback-flatness numbers
   until re-audited.

Until this is answered, `TARGET_CAMPAIGN_HOURS` and the pinned spread stay as
they are.

---

## 4. What re-fitting cost

K went **10 → 8** and REFERENCE **1e2 → 2e1**, because §6.1 adds income the
pacing model never had — even the drone alone, with no player input, is ~+8%
from Season 2 onward, and every archetype finished roughly a quarter faster.

The pair moves the first prestige with it (docs/09 §6): it is **×1.74**, down
from ×1.78. The check in `tools/simulate.ts` and the two tests that mirror it
came down from 1.75 to 1.65. Ten points of "felt" bought `casual` an hour and a
quarter of campaign; §8's headline promise is the more load-bearing of the two,
and ×1.74 is still plainly a reward against the ×1.18 that motivated D3.

---

## 5. Two bugs the tests caught

**The drone ran at double speed.** `tickPollination` and `runDrone` both
decremented `droneCooldown`, and `advance` calls them back to back on the same
`dt`. `runDrone` owns it now; `tests/sim/pollinationEconomy.test.ts` pins the
cadence against the drone stepped on its own.

**`expectedDroneMultiplier` ignored overlap.** Only the highest Bloom running
applies, and summing the tiers' uptimes independently is fine at 40% (worth a
point) but badly wrong once the Insight nodes are in — Bronze uptime alone
passes 45% and the drone looked 50% better than it was. That is exactly where
the §6.1 guardrail would have stopped meaning anything, so it is now discounted
by the chance a better Bloom is masking each tier.

---

## 6. What is NOT done

- **Feel.** The 3-second window, the drone's 2-second cadence, the Bloom
  durations. Constants in `balance.ts`, tagged HUMAN. §10 item 5 — window
  forgiveness — now also has a player-facing answer (the "Patient Pollen" node
  buys a fourth second), but the base value is still a human call.
- **The diorama does not react to a Bloom.** `GardenSnapshot` carries `frenzied`
  and not the Bloom; Phase 6's remaining presentation work is the place for it.
- **No icons.** The flowers are text glyphs. The `@iconify-json/game-icons` set
  is in the project and unused; swapping is a change to one table in
  `PollinationPanel.tsx`.
- **Offline.** Blooms do not accrue while away, by omission rather than by
  decision: `offlineManaEarned` takes a plain rate. That is the right default —
  §6.1 is an active mechanic — but the drone arguably should keep working, which
  is the same shape of question as `docs/04` item 7 (offline Kitchen Garden).
