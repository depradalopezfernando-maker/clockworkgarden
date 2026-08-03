# The Vertical Slice — how to play it, and what to look for

**Phases 0–5 complete.** This is the **human gate**, and it is the decision the
whole plan has been built around: whether Seasons 2–4 are worth building.

```bash
npm install
npm run dev
```

Roughly 13–19 sessions of the 35–51 estimated are spent. Stopping here to find
out the design does not work costs a fraction of finding out at the end.

---

## What is in it

Everything through Season 1, end to end:

- The Greenhouse Bell, five generator tiers, and Growth Frenzy (§5)
- The 50-node Insight tree and 37 milestones (§3) — Insight comes only from
  milestones, never from Mana
- The full Kitchen Garden (§2a) — Dig/Plant/Cover, Perfect Planting, six
  surfaces, the Seed Satchel, the spend-only Day/Night budget, automation
- **First Bloom**, the Season 1 capstone (D4a): reach 1,200 Mana/sec during a
  single Growth Frenzy
- **Turn the Soil**, the prestige loop (§4), which First Bloom unlocks
- Onboarding for the first fifteen minutes (§8)
- Versioned saves and offline progress (§7)

Seasons 2–4 exist as content — generators, tree nodes, milestones — but their
**mechanics** (Pollination, Harvest Festival, Frost) are not built, and their
capstones clear on readiness alone. Expect the game to thin out after Season 1.

---

## The four questions

These are the ones a simulation cannot answer. Everything else has been measured.

1. **Is the core loop satisfying?** Ring, buy, watch the number climb, buy
   again. If this is not enjoyable in the first ten minutes, no amount of Season
   4 content fixes it.
2. **Does Growth Frenzy feel worth chasing?** §10 item 3 asks whether 20 seconds
   is the right window. Phase 1 also found that **Frenzy uptime is the single
   largest determinant of campaign length** — so this answer is a balance
   decision as much as a feel one.
3. **Does the Kitchen Garden read as meaningful, or as busywork?** §10 item 10.
   Be warned that the simulation already says it contributes **~3.5% of income**
   rather than the ~⅓ intended — see `docs/07` §2. Your read on whether it _feels_
   worth the attention decides which of the five fixes there is right.
4. **Does the first prestige feel like a reward?** It offers ×1.78 when it
   unlocks. The spec's original formula gave ×1.18 and an un-fitted constant
   gave ×1.00; this is the third attempt at that number.

---

## Things worth deliberately trying

- **Miss First Bloom on purpose.** Arm it, then let the Frenzy expire. It should
  read as "try again", not as a punishment.
- **Turn the Soil, then check the Kitchen Garden.** §4 promises it survives a
  reset intact. It does — but does keeping it _feel_ right?
- **Close the tab for an hour.** Offline progress should be generous rather than
  obligatory (§7).
- **Ignore the Kitchen Garden entirely.** The game should still be playable. If
  ignoring it feels obviously correct, that is question 3 answered.
- **Play on a phone.** The layout is responsive and smoke-tested at 390px, but
  thumb reach and tap targets are a judgement.

---

## What the numbers already say

| Measure                                 | Result                       |
| --------------------------------------- | ---------------------------- |
| Campaign length, idle / casual / active | 9.88h / 8.15h / 6.22h        |
| §8's target                             | 6–10 hours                   |
| Prestige resets                         | 2 / 3 / 4 (§4 hoped for 4–5) |
| First prestige, when offered            | ×1.78                        |
| Kitchen Garden share of income          | ~3.5% (D2 targets ~⅓)        |
| Tier payback flatness                   | 150–180s across all 20 tiers |

Reproduce with `npm run simulate`.

---

## After you have played

Three things need your decision, in order:

1. **Go / no-go on Seasons 2–4.** The remaining ~20–30 sessions.
2. **How the Kitchen Garden should matter** (`docs/07` §2, five options).
3. **The Season 2 capstone**, which blocks Phase 7.

Two smaller ones are waiting whenever convenient: whether prestige should wipe
banked Insight (`docs/04` item 10), and whether crops should grow while the tab
is closed (`docs/04` item 7).
