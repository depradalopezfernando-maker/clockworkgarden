# Clockwork Garden — Progression & Systems Spec

**Genre:** Bounded incremental with a light farming-sim layer (Kitchen Garden, §2a) grafted onto a Nodebuster/Tower Wizard-scale core
**Target length:** 6–10 hrs to full completion, optional endless sandbox after
**Monetization:** One-time purchase, no IAP (or F2P + cosmetic-only skins)
**Visual style:** low poly, isometric-diorama direction recommended — see §11 for style options and free asset sources
**Scope note:** the Kitchen Garden subsystem (§2a) is a real addition to development scope — grid UI, planting animations, a second automation track — beyond the original bounded design. It's built to be self-contained and additive rather than a rewrite, so it *can* be cut or simplified to "Light integration" (a one-time planting ceremony per Tier, see prior discussion) without breaking anything else in this doc if scope becomes a concern.

---

## 1. Core Loop

1. Click the **Greenhouse Bell** (or tap plants directly) → generates **Mana**.
2. Spend Mana on **Garden Plots** (auto-generators) that produce Mana/sec — this is the game's core passive backbone, unchanged from the original design.
3. In parallel, tend your **Kitchen Garden** (§2a): dig, plant a Seed, and cover it in a small grid of plots, spending a limited daily time budget — a hands-on layer that adds a meaningful bonus on top of the Garden Plot economy, not a replacement for it.
4. Hit milestones → earn **Insight**, spent on a skill tree for permanent unlocks.
5. Every ~1.5–2.5 hrs of engaged play, a new **Season** unlocks: new generators, one new mechanic twist, and a capstone challenge.
6. Optionally **prestige** ("Season Change") for a permanent production bonus and a faster next loop.
7. After Season 4's capstone, the "Full Bloom" ending triggers — endless sandbox mode unlocks separately, clearly framed as optional.

---

## 2. Primary Currency: Mana

**Click yield formula:**
```
ClickYield = BaseClick × (1 + Σ upgrade bonuses) × PrestigeMultiplier × FrenzyMultiplier
```
- `BaseClick` starts at 1.
- `FrenzyMultiplier` = 2.0 during **Growth Frenzy** (see §5), else 1.0.

**Generator (Garden Plot) formula, per tier:**
```
Cost(n) = BaseCost × (CostMult ^ n)      // n = number currently owned
Output   = BaseYield × OwnedCount × PrestigeMultiplier
```
- `CostMult` stays inside the **1.07–1.12** guardrail band for every tier — no cliffs.

### Full generator table — all 4 Seasons, 20 tiers

Each tier's base yield lands **roughly 7–10× the previous tier's**, and cost scales at a similar ratio — this keeps the cost-per-output efficiency slowly improving (so newer tiers feel rewarding) without ever making older tiers worthless. Treat these as starting values to tune in playtesting, not final balance.

**Season 1 — Spring** *(introduces Growth Frenzy, §5)*

| Tier | Name | Base Cost | Cost Mult | Base Yield (Mana/s) | Unlock Gate |
|---|---|---:|---:|---:|---|
| 1 | Watering Can | 15 | 1.10 | 0.1 | Start |
| 2 | Sprout Bed | 150 | 1.10 | 1 | Own 10× Tier 1, or 500 lifetime Mana |
| 3 | Butterfly Swarm | 1,200 | 1.11 | 8 | Insight skill unlock |
| 4 | Garden Gnome Crew | 9,000 | 1.11 | 55 | Insight skill unlock |
| 5 | Sunbeam Lattice | 65,000 | 1.12 | 380 | Season 1 capstone clear |

**Season 2 — Summer** *(introduces Pollination Combo, §6.1)*

| Tier | Name | Base Cost | Cost Mult | Base Yield (Mana/s) | Unlock Gate |
|---|---|---:|---:|---:|---|
| 6 | Beehive Outpost | 450,000 | 1.10 | 2,600 | Season 2 start |
| 7 | Sunflower Field | 3,200,000 | 1.10 | 18,000 | Own 10× Tier 6 |
| 8 | Pollinator Drone Swarm | 22,000,000 | 1.11 | 125,000 | Insight skill unlock |
| 9 | Nectar Refinery | 150,000,000 | 1.11 | 850,000 | Insight skill unlock |
| 10 | Solar Bloom Array | 1,000,000,000 | 1.12 | 5,800,000 | Season 2 capstone clear |

**Season 3 — Autumn** *(introduces Harvest Festival, §6.2)*

| Tier | Name | Base Cost | Cost Mult | Base Yield (Mana/s) | Unlock Gate |
|---|---|---:|---:|---:|---|
| 11 | Harvest Cart Brigade | 7 billion | 1.10 | 40 million | Season 3 start |
| 12 | Grain Silo Complex | 48 billion | 1.10 | 275 million | Own 10× Tier 11 |
| 13 | Cider Press Guild | 330 billion | 1.11 | 1.9 billion | Insight skill unlock |
| 14 | Scarecrow Sentinel Network | 2.3 trillion | 1.11 | 13 billion | Insight skill unlock |
| 15 | Harvest Moon Shrine | 16 trillion | 1.12 | 90 billion | Season 3 capstone clear |

**Season 4 — Winter** *(introduces Frost Dormancy & The Long Night, §6.3)*

| Tier | Name | Base Cost | Cost Mult | Base Yield (Mana/s) | Unlock Gate |
|---|---|---:|---:|---:|---|
| 16 | Frost Lantern Ring | 110 trillion | 1.10 | 620 billion | Season 4 start |
| 17 | Insulated Greenhouse Wing | 750 trillion | 1.10 | 4.3 trillion | Own 10× Tier 16 |
| 18 | Ember Furnace Core | 5.2 quadrillion | 1.11 | 29 trillion | Insight skill unlock |
| 19 | Aurora Conduit | 36 quadrillion | 1.11 | 200 trillion | Insight skill unlock |
| 20 | The Clockwork Heart | 250 quadrillion | 1.12 | 1.4 quadrillion | Season 4 capstone clear — final tier |

Tier 20, **The Clockwork Heart**, is the game's namesake finale piece — buying it is what triggers the "Full Bloom" ending sequence.

---

## 2a. Kitchen Garden — Planting Subsystem

> **Design call, stated plainly:** my first instinct was to have this *replace* the abstract "OwnedCount" model in §2 — physical plots standing in for owned generators. Working through the actual math, that doesn't hold up: Garden Plots rely on **unbounded exponential ownership** (hundreds of units) to reach quadrillion-scale numbers, while a hand-tended grid is naturally **bounded** (you can't sensibly hand-plant hundreds of individual plots). Forcing one system to do both jobs would either break the big-number payoff of §2 or make the Kitchen Garden absurdly large. So instead: **Garden Plots stay exactly as speced in §2, untouched.** The Kitchen Garden is a separate, smaller, hand-tended system that layers a genuine bonus on top. This delivers everything you described — surfaces, automation-as-progression, a Day/Night rhythm — without requiring a rewrite of the balanced economy we already have.

### Grid & Plot Slots

- Start with **4 Plot Slots** (Bare Soil, free) in Season 1.
- Expand up to **20 total slots** by end of Season 4, roughly one new slot every 20–30 min of engaged play.
- Slot cost (paid in Mana) scales relative to the *current Season's* cheapest Garden Plot generator, not as its own absolute number — this keeps it meaningful at every stage without needing separate quadrillion-scale tuning:
```
SlotCost(n) = 3 × (current Season's Tier-1 generator cost) × 1.15^(n − 5)     // n = 5..20
```
  Note the 1.15 multiplier deliberately sits *above* the 1.07–1.12 guardrail band from §2 — that band governs the game's core repeating economy loop; slot purchases are a rarer, one-off capacity investment, not something you buy dozens of in a row.

### Surfaces (per-plot upgrade, purchased with Insight to unlock + a small Mana fee to apply)

| Surface | Unlocks | Grow Time | Yield | Capacity | Special |
|---|---|---|---|---|---|
| Bare Soil Plot | Start | Baseline | Baseline | 1 plant | Free forever — the "hands-on" default |
| Terracotta Pot | S1 Insight | 0.75× (faster) | 0.85× (lower) | 1 plant | Good for rapid early cycling |
| Stone Parterre | S2 Insight | 1.3× (slower) | 1.5× (higher) | 1 plant | Rewards patience |
| Raised Garden Box | S2 Insight | Baseline | Baseline | 3 plants | One dig-cover cycle plants all 3 |
| Greenhouse Bed | S4 Insight | Baseline | 1.1× | 1 plant | **Immune to Frost Dormancy's output penalty** |
| Clockwork Trellis | S4 Insight, expensive | Baseline | 1.2× | 5 plants | Ships with Level-2 automation pre-installed |

Capacity (via Raised Garden Box / Clockwork Trellis) is how the Kitchen Garden reaches meaningful late-game scale without needing 100+ physical plots — a handful of maxed-out high-capacity plots carries most of the late-game weight.

### The Dig → Plant → Cover Sequence

Three clicks per plot cycle: **Dig**, **Plant** (consumes 1 Seed from your Satchel), **Cover**. Completing all three within **2 seconds** of each other triggers **Perfect Planting**: that plot's yield contribution doubles for its first 5 minutes of growth before settling to baseline. This rewards attentive play without punishing anyone who takes it slower — a "no" on Perfect Planting just means baseline yield, never a penalty.

**Seed Satchel:** Seeds regenerate passively (+1 every ~10s, capped at a Satchel capacity that starts at 20 and is Insight-upgradable), plus a small chance (~10%) of 1–3 bonus Seeds on every harvest. The Harvest Festival event (§6.2) also converts excess banked Mana into bulk Seeds during its window — no separate system needed, it just plugs into the existing mechanic.

### Day / Night Time Budget

This is the part worth being careful with — a hard "wait for your energy to refill" system is exactly the kind of mobile-game friction that draws the most negative sentiment in this genre (see the earlier research on energy systems). So the Day/Night cycle here works differently:

- **Day Time is a spend-only budget, not a real-time clock.** It only depletes when *you* choose to perform a manual Dig/Plant/Cover action. If you never touch the Kitchen Garden, Day never ends — nothing is ever waiting on a timer.
- **Day Length** starts at **30 seconds** of Day Time, upgradable via Insight: 30s → 45s → 60s → 90s → 120s (one upgrade roughly every Season).
- When Day Time hits 0, **Night** falls — a short, mostly cosmetic transition (**6 seconds**, reducible to 3s via a cheap Insight node) before a fresh Day begins automatically. No player input required to advance it.
- **Critically: Night only pauses new Kitchen Garden actions.** The Greenhouse Bell, Garden Plot production, Growth Frenzy, Pollination Combo, and Harvest Festival all keep running exactly as normal through Night. This is a deliberate, narrow blast radius — the Day/Night rhythm adds texture to the *new* subsystem without ever gating the core game.
- Plants already mid-growth keep growing through Night in real time regardless of Day state; only *starting new* Dig/Plant/Cover cycles is time-gated.

### Automation: Three Steps, Two Levels Each

This is where "add automation earlier, at lower efficiency" becomes concrete. Each of the three steps (Dig, Plant, Cover) has its own 2-level automation track, purchased with Insight, **universal across all surfaces** (not per-surface — keeping the tree from exploding to 30+ redundant nodes):

| Automation Level | Time Cost per Step | Yield Modifier | Flavor |
|---|---|---|---|
| **Level 0 — Manual** | 2s (base) | 100%, eligible for Perfect Planting | You do it yourself |
| **Level 1 — Assisted** *(cheap, early)* | 1s (−50%) | 90% | A helper tool speeds you up but does the step slightly worse — the explicit "lower efficiency, available early" tier |
| **Level 2 — Automated** *(pricier, later)* | 0s (instant) | 100%, no Perfect Planting bonus | Fully hands-off; matches manual's baseline output, just without the skill ceiling |

Full manual cycle costs **6s** of Day Time. A fully Level-2-automated plot costs **0s** — meaning once you've maxed automation, that plot effectively converges to a passive generator, exactly like the original §2 model, and stops consuming Day Time at all. This preserves the genre-standard rule that **committed active play still beats full automation** (100% + Perfect Planting's temporary 2× > flat 100%), while giving time-strapped or idle-preferring players a real, non-punishing path to the same baseline output.

Level 1 is intentionally a *stepping stone*, not a permanent strategy — it's the cheap, early option that lets you cover more ground before Level 2 is affordable, at a modest yield cost. Rational late-game play upgrades past it, which is fine; it's done its job by then.

### Yield & Season Transitions

Each grown, active Kitchen Garden plot contributes:
```
PlotContribution = (BaseFraction × SurfaceYieldMult × PerfectPlantingMult × AutomationYieldMult) × CurrentTotalManaPerSec
```
`BaseFraction` ≈ **1%** of current total Mana/sec per plot (before surface/capacity modifiers) — deliberately expressed as a percentage of the player's *current* production rather than its own absolute number line, so it stays relevant whether you're in Season 1 or Season 4 without needing separate quadrillion-scale balancing.

**Replanting, not endless grinding:** once grown, a plot keeps producing passively — you don't need to repeat Dig/Plant/Cover on a timer. You *do* need to replant when: a Season transitions (each Season's flowers are thematically different, so last Season's planting decays to a small legacy % until refreshed — same "no hard obsolescence" philosophy as §3), you upgrade a plot's surface, or you choose to swap what's planted there. This keeps the ritual meaningful without turning it into per-plot busywork on a loop.

---

## 3. Secondary Currency: Insight (skill tree)

> **Naming note:** this currency was originally called "Seeds" in early drafts of this spec. It's renamed to **Insight** here specifically to free up "Seeds" for its more literal meaning in the new Kitchen Garden subsystem (§2a) — the thing you physically plant. Two currencies both called "Seeds" would be confusing in the UI and in this doc.

- **Not** earned by spending Mana directly — earned from **milestones** (e.g. "Own 25 Watering Cans," "1M lifetime Mana," "Clear Season 1"). This keeps the tree from becoming "just buy everything eventually."
- Spent on a **~45–55 node tree** (revised up from the original ~30–40 estimate now that Kitchen Garden adds its own branch — see §2a), covering:
  - New plant/generator types (content gates)
  - Click-power multipliers
  - Auto-collect / offline efficiency boosts
  - Kitchen Garden unlocks: plot-slot capacity, surfaces, automation levels, Day Length
  - Cosmetic garden decorations (no mechanical effect — pure expression)
- **No hard obsolescence:** early-season generators should keep contributing (even if a small %) rather than becoming worthless, avoiding the "cursor stops mattering" complaint seen in older clickers.

---

## 4. Prestige: "Season Change"

- **Available:** any time after the Season 1 capstone; never required, always optional.
- **What resets:** current Mana, Garden Plots owned, in-progress Insight.
- **What's kept:** unlocked plant *types*, cosmetic unlocks, story progress, and — importantly — the **Kitchen Garden stays fully intact**: plot slots, surfaces, automation levels, and Day Length upgrades all persist through a Season Change. Resetting hand-dug, hand-planted progress on every prestige would punish exactly the players engaging most with the new mechanic, which runs against the whole point of adding it.

**Reward formula:**
```
SoilQualityPoints (SQP) = floor( sqrt( LifetimeMana / 1,000,000 ) )
PrestigeMultiplier = 1 + (0.02 × TotalSQP)     // +2% all Mana production per SQP
```
This is the same square-root-diminishing-returns shape used by Cookie Clicker's prestige and Clicker Heroes' Ancient Souls — meaningful but not runaway.

- **Reset cap by design, not by code:** because total playtime is bounded, natural play produces **4–5 resets** across the whole campaign. No need for a hard cap or soft-cap taper — the game just ends before it could get out of hand.
- **Single layer only** — per the baseline guardrail, this is the one and only reset currency. No second "meta-meta" layer for this option.

---

## 5. Active-Play Mechanic: Growth Frenzy

- Clicking the Bell fills a **Frenzy Meter**.
- At full: **2× all production** (click *and* auto) for 20 seconds.
- Meter drains slowly if idle, so it rewards short bursts of attention rather than sustained clicking — active players get a real, felt advantage without idle players being penalized for playing "correctly."

---

## 6. Season-Specific Advanced Mechanics

Growth Frenzy (§5) is the game's baseline active mechanic, present from minute one. Each later Season adds **one additional system on top of it** — not a replacement, so the skills a player builds early keep mattering, but the *texture* of play changes each Season. This is the concrete version of the "one new mechanical twist per Season" pacing rule.

### 6.1 — Season 2 (Summer): Pollination Combo

A **pattern/rhythm** mechanic — rewards click *variety*, distinct from Frenzy's reward for raw click *speed*.

- Three flower types are unlocked at the start of Season 2: **Sunflower, Lavender, Poppy** (each a clickable icon near the Bell).
- Clicking a **different** flower type than the last one, within a **3-second window**, extends a **Pollination Chain**. Clicking the *same* type twice in a row, or waiting past 3 seconds, resets the chain to 0.
- Chain milestones grant temporary boosts:

| Chain length | Reward | Duration |
|---|---|---|
| 3 | Bronze Bloom: +25% Mana | 15s |
| 6 | Silver Bloom: +50% Mana | 15s |
| 9 | Golden Bloom: +100% Mana, +1 Seed | 20s |

- **Automation catch-up:** the Tier 8 generator, *Pollinator Drone Swarm*, auto-attempts chains at a lower success rate (~40%) once unlocked — so idle players still benefit, but a player actively managing the pattern reliably outperforms it. This preserves the "active always beats pure idle" guardrail while giving automation a real, if lesser, role.
- **Stacks with Frenzy:** a Golden Bloom window during an active Frenzy is the Season's peak moment — intentional, since it rewards mastery of both systems together.

### 6.2 — Season 3 (Autumn): Harvest Festival

A **resource-timing/strategy** mechanic — shifts the skill test from reflexes to planning, giving Season 3 a different feel again.

- Starting in Season 3, Mana storage gets a **Barn Capacity** cap (a large number, e.g. 500× current best generator's per-second output). Mana produced above the cap decays slowly (5%/min) instead of being lost outright — a soft cap, not a hard wall.
- Every **~20–30 minutes of playtime** (or once lifetime Mana since the last Festival crosses a threshold), a **Harvest Festival** triggers automatically:
  - Lasts **60 seconds.**
  - All production **×2**.
  - Any Mana currently stored **above** Barn Capacity converts into bonus **Seeds** instead of decaying.
- This creates a real decision: **spend down early** for steady safe progress, or **let the Barn fill toward capacity** and time purchases around the Festival for a bigger payout. Neither approach is "wrong" — both are viable playstyles, which is the point.
- Barn Capacity itself is upgradable via the Season 3 Insight-tree branch, so strategic players can raise their own ceiling for banking.

### 6.3 — Season 4 (Winter): Frost Dormancy & The Long Night

A **preparation/payoff** mechanic — this is where investment from earlier Seasons (Insulation upgrades, banked Mana, Barn strategy) visibly pays off, making Season 4 feel earned rather than just "harder."

- Periodic **Frost Cycles** (roughly every 5–8 minutes) reduce all generator output to **60%** for 45 seconds, unless offset.
- Two ways to offset a Frost Cycle:
  1. **Insulation** — a Season 4 Insight-tree upgrade that permanently raises the Frost-Cycle floor (60% → 70% → 80%, in three purchasable steps).
  2. **Stoke the Furnace** — actively clicking during a Frost Cycle fills a separate meter; filling it fully cancels the penalty early. This is the Season's answer to Growth Frenzy: instead of granting a bonus, active play here *removes a penalty*, which keeps the active-play payoff feeling fresh rather than repeating the exact same reward shape three Seasons in a row.
- **The Long Night** (capstone event, immediately before Tier 20 unlocks): one extended Frost Cycle, **2–3 minutes long**, at a harsher **25% output floor**. Clearing it well (i.e., ending it with a healthy Mana buffer) is gated behind:
  - At least 2 of 3 Insulation upgrades purchased, **and**
  - A minimum banked-Mana buffer (encouraging the Season 3 Barn-strategy habit to carry forward).
  - Players who under-invested can still clear it — just more slowly, and by leaning hard on Stoke the Furnace — so it's a difficulty spike, not a hard skill/build gate.
- Clearing The Long Night unlocks Tier 20 (**The Clockwork Heart**) and the Full Bloom ending sequence.

---

## 7. Offline Progress

| Time away | Efficiency |
|---|---|
| 0–8 hrs | 100% |
| 8–24 hrs | tapers 100% → 50% |
| 24 hrs+ | flat 50% |

Rewards checking in; never makes the game feel obligatory to leave running 24/7.

---

## 8. Pacing Timeline (target 6–10 hrs total)

| Time | Content |
|---|---|
| 0:00–0:15 | Tutorial, first generator, Frenzy intro |
| 0:15–1:30 | **Season 1 – Spring:** 5 generators, first Insight branch, prestige unlocked |
| 1:30–3:15 | **Season 2 – Summer:** Pollination Combo (§6.1), 5 more generators |
| 3:15–5:30 | **Season 3 – Autumn:** Harvest Festival (§6.2), 5 more generators |
| 5:30–8:00 | **Season 4 – Winter:** Frost Dormancy & The Long Night (§6.3), final tiers |
| 8:00–10:00 | "Full Bloom" ending + endless sandbox unlock (opt-in) |

Each Season = one new mechanical twist, not just bigger numbers — this is what keeps a bounded incremental from feeling like padding (the complaint leveled at Cell to Singularity's late game).

---

## 9. Guardrail Checklist (confirming fixes to known genre issues)

| Known issue | How this design avoids it |
|---|---|
| Pay-to-win currency | None exists; cosmetics only if any IAP at all |
| Cost-curve cliffs | 1.07–1.12× multiplier band, enforced tier-by-tier |
| Automation trivializes play | Growth Frenzy makes active play meaningfully better |
| No visible ending | Full Bloom finale at ~8–10 hrs, endless mode opt-in |
| Prestige-layer bloat | One single reset currency (SQP), no stacking layers |
| Real-money-tradeable loot | All rewards are in-game currency only |
| Offline punishment/obligation | Capped, tapering offline efficiency, not a hard wall |
| Mobile-style energy/wait gate (new, from Day/Night) | Day Time only depletes on player action, never on a real-time timer; Night is a short auto-resolving beat, not a wall; core loop (Bell, Garden Plots, Frenzy) is never gated by it |
| Manual-action busywork at scale (new, from Kitchen Garden) | Grid capped at 20 plots; plants produce passively once grown instead of needing repeat cycling; automation gives a real, felt time-savings via Day Time cost reduction |

---

## 10. What to Playtest First

The formulas above are **starting points, not final balance** — the things most likely to need adjustment after a first playable build:
1. Whether the 7–10× yield jump between generator tiers feels exciting or grindy in the first 30 minutes.
2. Whether 4–5 natural prestige resets actually happens, or whether players prestige too early/late.
3. Whether Growth Frenzy's 20-second window is long enough to feel worth chasing without feeling mandatory.
4. Whether each Season's new mechanic actually reads as "new" or just as "more of the same with a coat of paint."
5. Whether the 3-second Pollination Combo window is forgiving enough for casual players without trivializing it for fast clickers.
6. Whether the Harvest Festival's 20–30 min trigger cadence lines up with natural play sessions, or interrupts them awkwardly.
7. Whether The Long Night's difficulty gate feels fair to players who skipped Insulation upgrades, or reads as a punishing gotcha.
8. **Whether a starting Day Length of 30s (≈5 manual cycles) feels satisfying or frustratingly short** in the first Kitchen Garden session — this is the single number most likely to need retuning.
9. Whether Level 1 "Assisted" automation actually gets used as a stepping stone, or gets skipped entirely in favor of saving Insight for Level 2.
10. Whether the 1% BaseFraction yield makes the Kitchen Garden feel like a meaningful strategic layer or like a forgettable side-mechanic — this ratio is a placeholder pending real playtesting against Garden Plot income.

---

## 11. Visual Art Style & Asset Sourcing

**Brief:** low poly, nothing too fancy, but visually interesting. Three concrete directions, each with a recommended free starting point. All three fit the brief — the difference is which part of the game they serve best.

### Style A — Isometric Miniature Diorama *(recommended starting point)*

Small chunky 3D scenes viewed from a fixed 30–45° angle, like a dollhouse. This is a natural fit now that the Kitchen Garden (§2a) is a literal grid of plots — each Plot Slot can just *be* one isometric tile, and it gives Garden Plot tiers (§2) a consistent way to be represented as little dioramas too.

- **Starting point:** [Kenney — Isometric Miniature Farm](https://kenney.nl/assets/isometric-miniature-farm) (60 assets, farm-themed: walls, floors, farm props) + [Kenney — Nature Kit](https://kenney.nl/assets/nature-kit) (330 assets: trees, plants, rocks) for dressing each Season's zone.
- **License:** CC0 (public domain) — free for commercial use, no attribution required.
- **Why this is the pick:** zero cost, zero license friction, directly tile-shaped to match the Kitchen Garden grid, and one source covers most of what the game needs (nature props, farm structures) in a consistent hand.

### Style B — Chunky Geometric Low-Poly (classic "faceted" 3D look)

Flat-shaded polygons, rounded proportions, no textures — the most generic "low poly" look, and the safest choice for keeping 20+ generators visually consistent.

- **Starting point:** **KayKit — Forest Nature Pack** (search "KayKit Forest Nature Pack" on itch.io; name-your-price/free tier) for trees, bushes, rocks — pairs well with Kenney's Nature Kit since the two studios have directly collaborated before. Also worth checking itch.io's low-poly + nature tag for **"Retro low poly nature pack with different seasons"** — a seasonal-variant pack that maps directly onto the Spring/Summer/Autumn/Winter structure.
- **License:** varies by pack — check each one individually (most itch.io low-poly packs are CC0 or "free for commercial use, no resale of raw assets").

### Style C — Papercraft / Folded-Paper Low-Poly *(most distinctive, best brand fit)*

Same faceted geometry as A/B, but art-directed to read as cut-and-folded paper — soft pastels, visible "fold" edges instead of smooth shading. This is the option that would make Clockwork Garden look like *itself* rather than "a Kenney game," at the cost of not being a drag-and-drop asset pack.

- **Starting point:** no single asset gallery nails this — it's a direction to apply consistently to custom or AI-generated pieces (see the earlier AI-generation discussion: Meshy, Tripo, Luma Genie). Blender Studio's public devlog for *Project DogWalk* is a genuinely useful reference for building this look on an indie budget, even though it's not a downloadable pack.
- **Best use:** reserve for hero pieces once the core game is playable — Tier 20's Clockwork Heart, the four Season capstones — layered on top of an A/B backbone rather than replacing it everywhere.

### UI Iconography (separate from the above)

None of the three styles above are built for flat UI icon work (Insight-tree node icons, achievement badges, button glyphs).

- **Starting point:** [game-icons.net](https://game-icons.net/) — 4,170+ SVG/PNG icons, purpose-built for exactly this use case.
- **License:** CC BY 3.0 — free commercial use, attribution required (a credits-page mention is sufficient).

### Consistency Guardrail

Whichever style is chosen, **fix a palette and a silhouette treatment before sourcing more than one pack** — this is the single most common way indie clicker games end up looking inconsistent, even when every individual asset is technically "low poly." Concretely: lock a limited color palette per Season (already justified by the Season structure in §6/§8) and a consistent outline/edge treatment, and treat every sourced pack as raw material to be recolored/retouched into that palette rather than used as-is.
