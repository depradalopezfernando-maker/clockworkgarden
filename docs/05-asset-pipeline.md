# Asset Pipeline — CC0 Sourcing Plan

Implements §11 of the design spec, with the decision to **source CC0 packs early**.

**Read §1 first: the recommended 3D sources are currently unreachable from this
environment.** That is a live constraint with three fixes, not a reason to change
the art direction.

---

## 1. Network reality check (verified 2026-08-02)

Tested live from this environment, not assumed:

| Source               | What it provides                                  | Status                                            |
| -------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `registry.npmjs.org` | npm packages                                      | **200 — reachable** (allowlisted, bypasses proxy) |
| `kenney.nl`          | §11 Style A: Isometric Miniature Farm, Nature Kit | **403 at gateway — BLOCKED**                      |
| `game-icons.net`     | §11 UI iconography                                | **403 at gateway — BLOCKED**                      |
| `itch.io`            | §11 Style B: KayKit Forest Nature Pack            | untested, assume blocked                          |

The environment's network policy allowlists package registries (npm, PyPI,
crates.io, Go proxy) and denies general web hosts. Confirmed via
`curl -sS "$HTTPS_PROXY/__agentproxy/status"`, which logs the gateway's 403 CONNECT
rejections for both hosts by name.

### 1.1 UI icons — already solved

game-icons.net's set is published to npm and needs no policy change:

```bash
npm install @iconify-json/game-icons
```

Same CC BY 3.0 corpus (4,000+ icons) as the website, as JSON, tree-shakeable.
Attribution requirement is unchanged — a credits-screen mention, added in Phase 10.

### 1.2 3D packs — three routes

**Route 1 — Widen the network policy (recommended).** Allow `kenney.nl` and
`itch.io` in the environment settings. One-time change; makes asset work fully
self-service and reproducible for every future session. See
https://code.claude.com/docs/en/claude-code-on-the-web for environment
configuration.

**Route 2 — Commit the packs yourself.** Download locally, place under
`assets/vendor/<pack-name>/`, commit with the licence file. Kenney's packs are
**CC0**, so redistribution inside the repo is unrestricted. Fully self-contained
and version-pinned; costs repo weight (the two recommended packs are tens of MB).
This is the pragmatic choice if changing the policy is awkward.

**Route 3 — Procedural placeholders.** Generate low-poly geometry in code. Needs
no external assets at all and keeps Phases 1–5 unblocked regardless of which route
you pick. **The roadmap assumes this as the default through Phase 5**, so nothing
before Phase 6 is on the critical path for this decision.

**Action:** pick Route 1 or 2 before Phase 6 begins. Nothing earlier is blocked.

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
