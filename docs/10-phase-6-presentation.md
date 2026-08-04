# 10 — Phase 6: 3D Presentation

**Date:** 2026-08-04 · **Session 1 of 4–6** · **Status:** the pipeline works end to end
**Run it:** `npm run assets && npm run dev` · **Verify:** `npm run ci && npm run smoke`

The garden renders. Generator tiers stand in rows, Kitchen Garden plots show the
stage they are actually in, the Season changes the palette _and_ the silhouettes,
and a Growth Frenzy brightens the scene.

---

## 1. The shape of it

```
src/content/diorama.ts     DATA: game concept -> model, material name -> palette role
src/render/materialPalette.ts   derive 14 material roles from the 6 locked colours
src/render/models.ts       load, recolour, flat-shade, outline
src/render/ThreeGardenView.ts   the scene: camera, lights, reconciliation
src/render/GardenView.ts   the interface + the null implementation
src/render/index.ts        the ONE place that decides whether 3D happens
src/ui/GardenCanvas.tsx    React mount; owns the view's lifecycle
tools/stage-models.ts      copy only referenced models into public/
```

**Nothing outside `src/render/` imports three.js.** The UI holds a `GardenView`
and does not know or care what draws it. That is what keeps the roadmap's "2D
build stays runnable as a fallback and a test target" an actual tested claim —
`npm run smoke` runs headless with no GPU, so it exercises `NullGardenView`
every time.

three.js is **dynamically imported**, so a browser without WebGL never downloads
it:

```
dist/assets/index.js            250 KB   (gzip  77 KB)   always
dist/assets/ThreeGardenView.js  570 KB   (gzip 145 KB)   only with WebGL
```

## 2. Why recolouring turned out to be easy

§11 says to fix a palette before sourcing more than one pack, and `palette.ts`
promised "every sourced pack is recoloured at import time, so integration
becomes a mechanical transform rather than an aesthetic judgement". That was a
hope when it was written. It turned out to be true, for a reason worth recording:

**The Nature Kit has no textures.** Every model carries a few named materials
with a flat `baseColorFactor`, and across all 329 models there are only **23
distinct names** — `grass`, `dirt`, `leafsDark`, `woodBark`, `colorRed`, and so
on. So recolouring is not nearest-colour guesswork. It is a lookup from a name
that already means something to a role the palette defines.

The six locked colours cannot fill 23 names directly, so `materialPalette()`
derives fourteen roles from them by fixed transforms — bark is the ground gone
woody, stone is the ground pulled toward the sky and drained of chroma. **Nothing
new was chosen.** Adding palette entries would have meant re-opening a decision a
human had just signed off, to answer a question nobody asked.

A test asserts the table covers all 23 names, because an unmapped material keeps
Kenney's own colour and that is precisely the "looks like three asset packs"
failure §11 exists to prevent.

## 3. Two bugs worth naming

**The outlines were never drawn.** `buildOutline` returned a fresh `Mesh` and the
caller did `outline.parent?.add(outline)` — but a fresh mesh has no parent, so
that line was a silent no-op on every prop in the scene. It rendered perfectly
and looked wrong in a way that is hard to name until you see the fix. Shells are
now parented to the mesh they outline.

**The outline was scaled by a ratio, not a distance.** The inverted hull grew by
1.5% of each model, which on a 1.7-unit tree is a bold line and on a 0.16-unit
flower is a third of a pixel — the opposite of §11's "consistent outline
treatment", where the whole point is that every prop is drawn with the same pen.
It now grows by a constant _world_ distance, computed per mesh from its bounding
sphere.

Models also range from 0.16 to 1.7 units, so props are **normalised by footprint**
rather than placed at natural size: a Watering Can and a statue read as
comparable objects on the same board, and swapping a model in the registry does
not silently change the composition.

## 4. Assets

`npm run assets` fetches the CC0 packs (pinned by URL and SHA-256) and stages
**only what the registry references** into the gitignored `public/models/`:

```
329 models, 10.5MB   in the pack
 37 models,  0.42MB  actually shipped
```

Nothing binary is committed. A missing model cannot take the game down — `spawn`
catches and skips — but a test and the staging script both fail loudly instead,
so it never gets that far.

## 5. What this session did NOT do

Honest list, because "it renders" is easy to mistake for "it is finished":

- **No instancing yet.** Every prop is its own `Group` with its own draw calls.
  Props are capped at five per tier, so the scene is currently ~120 objects and
  runs fine — but the roadmap's draw-call ceiling and 60fps-on-mid-range-mobile
  budget have not been measured, and instancing is how that gets met.
- **No UI icons.** `@iconify-json/game-icons` is still not installed, and there
  is no credits screen for the CC BY 3.0 attribution it needs.
- **No interaction.** The diorama is a display. Clicking a plot in the 3D view
  does nothing; the Kitchen Garden panel is still the only way to work a plot.
- **No animation.** Growth is a stage change, not a transition. Frenzy brightens
  the key light and nothing moves.
- **The Kitchen Garden's six surfaces are not represented.** A plot shows its
  stage; it does not show whether it is Bare Soil or a Clockwork Trellis.
- **Season 4's ground reads as frozen field, not snow.** The grass tile takes
  the Winter primary, which is a cool blue-grey. Defensible, and a taste call —
  worth a human eye before it is treated as settled.

## 6. The exit criterion is still ahead

> **Exit:** human art review. Does it look like one game, or like three asset packs?

One pack is in. The recolour and the outline treatment are doing their job, and
Winter in particular lands the palette's intent — the warm ember accent really is
the only warmth in the frame. But §11's question is specifically about what
happens when a _second_ pack arrives, and that has not been tested.
