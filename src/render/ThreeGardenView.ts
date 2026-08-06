/**
 * ThreeGardenView.ts — the WebGL diorama.
 *
 * A fixed isometric camera (§11 Style A) over a tiled ground plane. Generator
 * tiers stand in rows behind; Kitchen Garden plots sit in a grid at the front,
 * one per slot, showing the stage that plot is actually in.
 *
 * EVERYTHING IS INSTANCED. Each model gets one `PropPool`, and placing props
 * writes matrices rather than touching the scene graph. Drawn as individual
 * meshes the full build-out cost ~670 draw calls, 162 of them the ground alone;
 * pooled it is ~100 however much the player owns.
 *
 * Props are still capped per tier — no longer for performance, but because a
 * player with 400 Watering Cans cannot see 400 pots at this camera angle. The
 * count is on the HUD; the diorama is a mood.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import {
  GROUND_MODEL,
  PLOT_STAGE_MODELS,
  SEASON_SCENERY,
  TIER_MODELS,
  type DioramaModel,
} from '@content/diorama';
import { EDGE_TREATMENT, SEASON_PALETTES } from '@content/palette';
import { seasonKeyFor } from '@ui/theme';
import { materialPalette } from './materialPalette';
import { footprintScale, loadTemplate, missingModels, type RolePalette } from './models';
import { describeTemplate, PropPool, type Placement } from './instancing';
import type { GardenSnapshot, GardenStats, GardenView } from './GardenView';

/** Copies of one tier the diorama shows. Beyond this the HUD carries it. */
const MAX_PROPS_PER_TIER = 5;

/** Ground tiles are exactly 1x1 in the pack, so they tile at 1.0 with no seam. */
const TILE = 1;

/** Half-width of the ground plane, in tiles. 4 gives a 9x9 board. */
const BOARD = 4;

/** How wide a prop is drawn, so a pot and a statue read as comparable objects. */
const PROP_FOOTPRINT = 0.62;
const PLOT_FOOTPRINT = 0.8;
const TREE_FOOTPRINT = 0.95;

const TREE_COUNT = 7;
const MAX_PLOTS = 20;

export class ThreeGardenView implements GardenView {
  readonly active = true;

  private renderer: WebGLRenderer | null = null;
  private scene = new Scene();
  private camera: OrthographicCamera | null = null;
  private container: HTMLElement | null = null;
  private frame = 0;
  private resizeObserver: ResizeObserver | null = null;

  private readonly world = new Group();
  private key: DirectionalLight | null = null;
  private palette: RolePalette | null = null;

  /** One pool per model, rebuilt when the Season repaints everything. */
  private pools = new Map<string, PropPool>();
  private season = 0;

  /** Last placement per pool, so an unchanged snapshot writes no matrices. */
  private placed = new Map<string, string>();

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // §11 Style A: a FIXED isometric camera. Orthographic, because perspective
    // at this angle makes a tiled ground plane visibly keystone.
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const angle = (EDGE_TREATMENT.cameraAngleDegrees * Math.PI) / 180;
    const distance = 40;
    camera.position.set(
      distance * Math.cos(angle) * Math.SQRT1_2,
      distance * Math.sin(angle),
      distance * Math.cos(angle) * Math.SQRT1_2
    );
    camera.lookAt(0, 0, 0);
    this.camera = camera;

    this.scene.add(this.world);

    this.key = new DirectionalLight(0xffffff, 2.1);
    this.key.position.set(6, 12, 4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.key, new AmbientLight(0xffffff, 1.25));

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      if (this.renderer && this.camera) this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  update(snapshot: GardenSnapshot): void {
    if (!this.renderer) return;

    if (snapshot.season !== this.season) {
      this.season = snapshot.season;
      const palette = SEASON_PALETTES[seasonKeyFor(snapshot.season)];
      this.palette = materialPalette(palette);
      this.scene.background = new Color(palette.sky);
      this.scene.fog = new Fog(new Color(palette.sky), 34, 62);
      // Every pool holds materials in the old Season's colours.
      this.disposePools();
      void this.placeScenery(snapshot.season);
    }

    if (this.key) this.key.intensity = snapshot.frenzied ? 3.1 : 2.1;

    void this.placeTiers(snapshot.owned);
    void this.placePlots(snapshot.plotStages);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.disposePools();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  /**
   * What the last frame actually cost, straight from three.js.
   *
   * Measured, not derived from the pool count: the point of a perf budget is to
   * catch the case where the code creates fewer objects than it draws.
   */
  stats(): GardenStats | null {
    if (!this.renderer) return null;
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      pools: this.pools.size,
    };
  }

  missingModels(): readonly string[] {
    return missingModels();
  }

  // -------------------------------------------------------------------------

  private resize(): void {
    if (!this.renderer || !this.camera || !this.container) return;
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;

    this.renderer.setSize(w, h, false);
    // A fixed world height, so the diorama holds its size as the panel changes
    // shape rather than zooming with the window. Sized to frame the board with
    // a little air: a 9x9 board is ~6.4 units across the isometric diagonal.
    const halfHeight = 3.9;
    const halfWidth = halfHeight * (w / h);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get or build the pool for a model.
   *
   * `InstancedMesh` capacity is fixed at construction, so the key includes it —
   * asking for more copies than the pool was built for rebuilds it rather than
   * silently dropping the extras.
   */
  private async pool(
    entry: DioramaModel,
    capacity: number,
    footprint: number
  ): Promise<PropPool | null> {
    const palette = this.palette;
    if (!palette) return null;

    const key = `${entry.model}:${capacity}`;
    const existing = this.pools.get(key);
    if (existing) return existing;

    try {
      const template = await loadTemplate(entry.model);
      const scale = footprintScale(template, footprint) * (entry.scale ?? 1);
      const pool = new PropPool(describeTemplate(template), palette, capacity, this.world, scale);
      this.pools.set(key, pool);
      return pool;
    } catch {
      // A missing model must never take the game down. The staging script and a
      // test both guard against this; the catch is for a dev build run without
      // staging. `loadTemplate` records the name so the UI can say so — swallowing
      // this silently is what produced an empty blue panel with a clean console.
      return null;
    }
  }

  private async placeScenery(season: number): Promise<void> {
    const tiles: Placement[] = [];
    for (let x = -BOARD; x <= BOARD; x++) {
      for (let z = -BOARD; z <= BOARD; z++) {
        tiles.push({ x: x * TILE, z: z * TILE });
      }
    }
    const ground = await this.pool(GROUND_MODEL, tiles.length, TILE);
    if (ground) this.commit('ground', ground, tiles);

    // Trees line the BACK rim only. Ringing the board puts them between the
    // camera and the plots, and the plots are what the player is reading.
    const trees = SEASON_SCENERY[season] ?? [];
    if (trees.length === 0) return;

    const byModel = new Map<string, Placement[]>();
    for (let i = 0; i < TREE_COUNT; i++) {
      const entry = trees[i % trees.length]!;
      // Deterministic placement - no RNG, so the same state is the same picture.
      const t = Math.PI + (i / (TREE_COUNT - 1)) * Math.PI;
      const list = byModel.get(entry.model) ?? [];
      list.push({
        x: Math.cos(t) * (BOARD - 0.9),
        z: Math.sin(t) * (BOARD - 0.9) - 0.6,
        rotationY: t,
      });
      byModel.set(entry.model, list);
    }

    for (const entry of trees) {
      const spots = byModel.get(entry.model);
      if (!spots) continue;
      const pool = await this.pool(entry, TREE_COUNT, TREE_FOOTPRINT);
      if (pool) this.commit(`tree-${entry.model}`, pool, spots);
    }
  }

  private async placeTiers(owned: readonly number[]): Promise<void> {
    if (!this.palette) return;

    for (let tier = 1; tier <= owned.length; tier++) {
      const entry = TIER_MODELS[tier];
      if (!entry) continue;

      const want = Math.min(owned[tier - 1] ?? 0, MAX_PROPS_PER_TIER);
      const spots: Placement[] = [];
      for (let index = 0; index < want; index++) {
        // Four rows of five tiers, running back from the plots. Each tier owns a
        // cell; its copies cluster inside that cell rather than spreading.
        const row = Math.floor((tier - 1) / 5);
        const column = (tier - 1) % 5;
        spots.push({
          x: (column - 2) * 1.5 + ((index % 3) - 1) * 0.32,
          z: -1.1 - row * 1.05 - Math.floor(index / 3) * 0.32,
          rotationY: ((tier * 37 + index * 53) % 360) * (Math.PI / 180),
        });
      }

      // Build the pool even at zero, so the Season's models are all resident
      // before the player buys anything and a purchase never stutters.
      const pool = await this.pool(entry, MAX_PROPS_PER_TIER, PROP_FOOTPRINT);
      if (pool) this.commit(`tier-${tier}`, pool, spots);
    }
  }

  private async placePlots(stages: readonly string[]): Promise<void> {
    if (!this.palette) return;

    // One pool per STAGE, holding every plot currently in that stage. A plot
    // changing stage moves between two pools rather than rebuilding anything.
    const byStage = new Map<string, Placement[]>();
    for (const stage of Object.keys(PLOT_STAGE_MODELS)) byStage.set(stage, []);

    for (let i = 0; i < stages.length; i++) {
      const list = byStage.get(stages[i] ?? 'bare');
      if (!list) continue;
      list.push({ x: ((i % 5) - 2) * TILE, z: 1.3 + Math.floor(i / 5) * TILE });
    }

    for (const [stage, spots] of byStage) {
      const entry = PLOT_STAGE_MODELS[stage];
      if (!entry) continue;
      const pool = await this.pool(entry, MAX_PLOTS, PLOT_FOOTPRINT);
      if (pool) this.commit(`plot-${stage}`, pool, spots);
    }
  }

  /** Write matrices only when the placement actually changed. */
  private commit(key: string, pool: PropPool, spots: readonly Placement[]): void {
    const signature = spots.map((s) => `${s.x},${s.z},${s.rotationY ?? 0}`).join('|');
    if (this.placed.get(key) === signature) return;
    this.placed.set(key, signature);
    pool.place(spots);
  }

  private disposePools(): void {
    for (const pool of this.pools.values()) pool.dispose();
    this.pools.clear();
    this.placed.clear();
  }
}
