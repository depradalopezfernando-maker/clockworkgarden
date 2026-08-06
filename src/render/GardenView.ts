/**
 * GardenView.ts — the interface the game talks to, and the null implementation.
 *
 * The roadmap requires the 2D build stay runnable as a fallback and a test
 * target, so nothing outside `src/render/` may import three.js. The UI holds a
 * `GardenView`; whether that is WebGL or nothing at all is decided in one place
 * (`index.ts`) and changes no caller.
 *
 * This also keeps the smoke suite honest: `NullGardenView` is a real
 * implementation, so a headless or WebGL-less environment exercises the same
 * code path rather than a special case.
 */

/**
 * Everything the diorama needs, and nothing else.
 *
 * Deliberately NOT `GameState`: the renderer should not be able to reach into
 * the economy, and a narrow snapshot means a change to the scene cannot
 * accidentally depend on something the sim was not going to keep offering.
 */
export interface GardenSnapshot {
  readonly season: number;
  /** Units owned per tier, index 0 = tier 1. Drives how many props stand. */
  readonly owned: readonly number[];
  /** Kitchen Garden plot stages, in slot order. */
  readonly plotStages: readonly string[];
  /** True while a Growth Frenzy is running — the scene brightens. */
  readonly frenzied: boolean;
}

/** What the renderer actually cost on the last frame. */
export interface GardenStats {
  /** Draw calls. The number the perf budget is written against. */
  readonly calls: number;
  readonly triangles: number;
  /** Distinct instanced pools resident. */
  readonly pools: number;
}

export interface GardenView {
  /** Attach to a container. Safe to call once. */
  mount(container: HTMLElement): Promise<void>;
  /** Reconcile the scene with new state. Called on every publish, so cheap. */
  update(snapshot: GardenSnapshot): void;
  /** Release GPU resources. The renderer leaks without it. */
  dispose(): void;
  /** False when nothing is actually being drawn, so the UI can say so. */
  readonly active: boolean;
  /**
   * Live render cost, or null when nothing is drawn.
   *
   * Exists so the draw-call budget can be MEASURED rather than asserted from a
   * count of what the code meant to create. `tools/smoke.mjs` reads it through
   * the debug handle in `GardenCanvas`.
   */
  stats(): GardenStats | null;
  /**
   * Models the renderer asked for and could not load. Empty when all is well.
   *
   * Distinct from `active`, which answers "is anything drawn at all" — a browser
   * without WebGL and a checkout without staged models are different problems
   * with different remedies, and a single flag would tell the player the wrong
   * one. Rule 8 keeps the models out of git, so the second case is what anyone
   * who skips `npm run assets` actually hits.
   */
  missingModels(): readonly string[];
}

/** Does nothing, successfully. The 2D build and any WebGL-less browser use it. */
export class NullGardenView implements GardenView {
  readonly active = false;
  // Nothing was asked for, so nothing is missing. A WebGL-less browser must not
  // also be told to go and stage assets it would have no use for.
  missingModels(): readonly string[] {
    return [];
  }
  async mount(): Promise<void> {}
  update(): void {}
  dispose(): void {}
  stats(): GardenStats | null {
    return null;
  }
}
