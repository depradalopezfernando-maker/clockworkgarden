# 05 — Asset Pipeline

**Updated 2026-08-04:** the network constraint is GONE. `kenney.nl` and
`game-icons.net` were 403'd at the gateway; the environment's network policy was
widened and both now resolve. Nothing about assets is blocked.

---

## How to get them

```bash
npm run assets:fetch          # Nature Kit only — the one Phase 6 needs
npm run assets:fetch -- --all # plus the two optional 2D packs
```

`tools/fetch-assets.mjs` pins every pack by **URL and SHA-256**, extracts to
`assets/vendor/`, and is idempotent — a pack already present with a matching
checksum is skipped. A mismatch fails loudly and extracts nothing.

**The packs are not committed.** 13MB of binary would sit in git history forever
and never diff usefully. The checksum buys the reproducibility that committing
them was meant to buy; the repository stays small.

`assets/vendor/` is gitignored. After a fresh clone, run the fetch.

> **Gotcha, already handled:** Node's built-in `fetch` does not read
> `HTTPS_PROXY`, so every request 403s at the gateway while `curl` to the same
> URL succeeds. The npm script sets `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21). If a
> future tool hits the same wall, `/root/.ccr/README.md` lists the per-tool fix —
> and never work around it by disabling TLS verification.

## The palette is locked (2026-08-04)

**Enamel** for the four Seasons, **Slate** for the UI chrome — chosen by a human
from four worked-through candidates, each previewed on a mock diorama rather
than as swatches. Recorded in `src/content/palette.ts`; §11's review is done.

Enamel is a painted-tin-toy reading: higher chroma than the original draft, clean
edges, holds up at phone size. Slate is a cool, neutral chrome that leaves the
Seasons room to be the colour on screen — which matters most in Winter, where the
warm ember accent has to be the only warmth in the frame.

Every sourced model is recoloured to the nearest entry at import time, so this is
now expensive to revisit. Reopen deliberately.

## What we have

| Pack                      |   Size | Contents          | Status       |
| ------------------------- | -----: | ----------------- | ------------ |
| **Kenney Nature Kit 2.1** | 10.5MB | 329 `.glb` models | **required** |
| Kenney Foliage Pack 1.0   |  2.2MB | 113 2D sprites    | optional     |
| Kenney Tiny Farm 1.0      |  0.2MB | 136 2D tiles      | optional     |

All three are **CC0** — free for commercial use, credit appreciated but not
required. Verified by reading each pack's `License.txt`, not by trusting the
store page.

UI icons come from npm instead: `@iconify-json/game-icons`. No download, no
licence question, and it tree-shakes.

### Nature Kit, by family

61 trees · 56 cliffs · 30 stones · 30 rocks · 29 grounds · **17 crops** ·
16 bridges · **12 fences** · **9 flowers** · **8 plants** · 7 stumps · 7 paths ·
6 statues · 6 mushrooms · **4 grasses**

GLTF-binary (`.glb`) is exactly what three.js's `GLTFLoader` wants — no
conversion step.

### The crops have growth stages

Worth knowing before Phase 6 designs anything:

```
crops_wheatStageA   crops_wheatStageB
crops_cornStageA    crops_cornStageB   crops_cornStageC   crops_cornStageD
crops_leafsStageA   crops_leafsStageB
crops_bambooStageA  crops_bambooStageB
crops_dirtRow  crops_dirtSingle  crops_dirtDoubleRow  (+ corner/end pieces)
```

That maps **directly** onto §2a's plot state machine — `dirt` for dug, `StageA`
for planted, later stages for growing, the final stage for grown. The Kitchen
Garden's five stages already have art without anyone drawing anything, and the
`dirtRow`/`Corner`/`End` pieces tile a 20-slot grid.

Flowers come in three colours × three shapes, which is enough to distinguish the
six surfaces (§2a) by sight.

---

## 2. Palette lock — do this before sourcing anything

§11's consistency guardrail is the most important instruction in that section:

> fix a palette and a silhouette treatment **before** sourcing more than one pack
> — this is the single most common way indie clicker games end up looking
> inconsistent, even when every individual asset is technically "low poly."

This is also precisely the kind of judgement an agent executes badly unattended.
The fix is to convert it from a matter of taste into a matter of data.

**Phase 0 deliverable — `src/content/palette.ts`:**

```ts
export const SEASON_PALETTES = {
  spring: { primary, secondary, accent, shadow, ground, sky },  // 6 locked hexes
  summer: { … },
  autumn: { … },
  winter: { … },
} as const;

export const EDGE_TREATMENT = { outlineWidth, outlineColor, flatShaded: true };
```

Every sourced asset is then **recoloured to the nearest palette entry** at import
time. Asset integration becomes mechanical (a transform an agent performs
reliably) rather than aesthetic (a judgement it does not). The Season structure in
§6/§8 already justifies four distinct ramps, so this costs nothing in design terms.

Pick the four ramps with a human eye in Phase 0. It is an hour of your time and it
protects the whole art direction.

---

## 3. Pack inventory (§11 Style A — the recommended direction)

| Pack                                 | Source                             | Licence             | Attribution  | Use                                   |
| ------------------------------------ | ---------------------------------- | ------------------- | ------------ | ------------------------------------- |
| Isometric Miniature Farm (60 assets) | kenney.nl                          | **CC0**             | not required | Kitchen Garden tiles, farm structures |
| Nature Kit (330 assets)              | kenney.nl                          | **CC0**             | not required | Season environment dressing           |
| Game Icons (4,170+)                  | **npm** `@iconify-json/game-icons` | **CC BY 3.0**       | **required** | Insight tree nodes, badges, buttons   |
| KayKit Forest Nature Pack            | itch.io                            | varies — **verify** | verify       | Optional; §11 Style B supplement      |

**Maintain `assets/vendor/LICENSES.md`** listing every pack, its source URL, its
licence, and its attribution requirement. CC0 needs none; CC BY 3.0 does, and
missing it at ship time is a real (if small) legal problem. One file, written once,
checked at Phase 10.

Per §11's own advice, treat every pack as **raw material to be recoloured into the
locked palette**, never as drop-in art.

---

## 4. Import pipeline (Phase 6)

```
assets/vendor/<pack>/*.glb
        │
        ▼  tools/process-assets.ts   (agent-runnable, deterministic)
   ┌────────────────────────────────────────┐
   │ 1. Load glTF                           │
   │ 2. Recolour materials → palette.ts     │
   │ 3. Apply EDGE_TREATMENT (flat shade)   │
   │ 4. Decimate above triangle budget      │
   │ 5. Merge/instance repeated geometry    │
   │ 6. Emit optimised .glb + manifest      │
   └────────────────────────────────────────┘
        │
        ▼
public/assets/*.glb  +  src/content/assetManifest.ts
```

Steps 2–6 are deterministic transforms — exactly the kind of work an agent does
well. The pipeline is a committed script, so re-running it after a palette change
is one command rather than a manual re-export.

**Budgets:** ≤150 draw calls, ≤50k triangles on screen, 60fps mid-range mobile.
The Kitchen Garden grid (20 slots × up to 5 plants) is the obvious hot spot and
should be GPU-instanced from the start rather than optimised later.

---

## 5. Asset needs by phase

| Phase | Needs                                                                     |
| ----- | ------------------------------------------------------------------------- |
| 0     | **Palette locked.** No assets                                             |
| 1     | None (headless)                                                           |
| 2–5   | Placeholder geometry / CSS. UI icons via npm — available now              |
| 6     | **Full 3D packs required.** Route 1 or 2 must be resolved                 |
| 7–9   | Season-specific dressing; per-Season props from Nature Kit                |
| 10    | §11 Style C hero pieces — Clockwork Heart, four capstones. Human-authored |
| 12    | Credits screen with CC BY 3.0 attribution                                 |

§11's advice to reserve the papercraft Style C for hero pieces "once the core game
is playable" maps cleanly onto Phase 10, and it is the right call — it is the one
part of the art direction that cannot be sourced, only made.

---

## 6. Summary

1. **UI icons are solved today** — `npm install @iconify-json/game-icons`.
2. **3D packs need a decision before Phase 6** — widen the network policy
   (cleanest) or commit the packs to `assets/vendor/` (most self-contained).
3. **Lock the palette in Phase 0**, before any asset enters the repo. This is the
   difference between asset integration being mechanical and being a matter of
   taste, and it is what makes the rest of this pipeline agent-runnable.
4. **Nothing before Phase 6 is blocked** by any of the above.
