/**
 * ThreeGardenView.ts — the WebGL diorama.
 *
 * A fixed isometric camera (§11 Style A) over a tiled ground plane. Generator
 * tiers stand in rows behind; Kitchen Garden plots sit in a grid at the front,
 * one per slot, showing the stage that plot is actually in.
 *
 * PERFORMANCE. The scene is reconciled, never rebuilt: `update` diffs the
 * snapshot against what is already standing and adds or removes only the
 * difference. Props are capped per tier (`MAX_PROPS_PER_TIER`) because a player
 * with 400 Watering Cans does not want 400 draw calls, and cannot see 400 pots
 * at this camera angle anyway — the count is on the HUD, the diorama is a mood.
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
import { instantiate, loadTemplate, type RolePalette } from './models';
import type { GardenSnapshot, GardenView } from './GardenView';

/** Above this the diorama stops adding props; the HUD carries the real count. */
const MAX_PROPS_PER_TIER = 5;

/** Ground tiles are exactly 1x1 in the pack, so they tile at 1.0 with no seam. */
const TILE = 1;

/** Half-width of the ground plane, in tiles. 4 gives a 9x9 board. */
const BOARD = 4;

/** How wide a prop is drawn, so a pot and a statue read as comparable objects. */
const PROP_FOOTPRINT = 0.62;
const PLOT_FOOTPRINT = 0.8;

export class ThreeGardenView implements GardenView {
  readonly active = true;

  private renderer: WebGLRenderer | null = null;
  private scene = new Scene();
  private camera: OrthographicCamera | null = null;
  private container: HTMLElement | null = null;
  private frame = 0;
  private resizeObserver: ResizeObserver | null = null;

  private readonly props = new Group();
  private readonly plots = new Group();
  private readonly scenery = new Group();

  private key: DirectionalLight | null = null;
  private palette: RolePalette | null = null;

  /** What is currently standing, so `update` can diff rather than rebuild. */
  private standing = new Map<number, number>();
  private plotStages: string[] = [];
  private season = 0;

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

    this.scene.add(this.props, this.plots, this.scenery);

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
      this.palette = materialPalette(SEASON_PALETTES[seasonKeyFor(snapshot.season)]);
      this.applySeason(snapshot.season);
      // Every standing prop is the wrong colour now. Drop and let the diff
      // below rebuild them in the new Season's palette.
      this.clear(this.props);
      this.clear(this.plots);
      this.standing.clear();
      this.plotStages = [];
    }

    if (this.key) this.key.intensity = snapshot.frenzied ? 3.1 : 2.1;

    void this.reconcileTiers(snapshot.owned);
    void this.reconcilePlots(snapshot.plotStages);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.clear(this.props);
    this.clear(this.plots);
    this.clear(this.scenery);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
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

  private applySeason(season: number): void {
    const palette = SEASON_PALETTES[seasonKeyFor(season)];
    this.scene.background = new Color(palette.sky);
    this.scene.fog = new Fog(new Color(palette.sky), 34, 62);
    this.clear(this.scenery);
    void this.buildScenery(season);
  }

  private async buildScenery(season: number): Promise<void> {
    const palette = this.palette;
    if (!palette) return;

    const ground = await this.spawn(GROUND_MODEL, palette);
    if (ground) {
      for (let x = -BOARD; x <= BOARD; x++) {
        for (let z = -BOARD; z <= BOARD; z++) {
          const tile = x === -BOARD && z === -BOARD ? ground : ground.clone(true);
          tile.position.set(x * TILE, 0, z * TILE);
          this.scenery.add(tile);
        }
      }
    }

    // Trees line the BACK rim only. Ringing the board puts them between the
    // camera and the plots, and the plots are the part the player is reading.
    const trees = SEASON_SCENERY[season] ?? [];
    for (let i = 0; i < 7; i++) {
      const entry = trees[i % trees.length];
      if (!entry) continue;
      const tree = await this.spawn(entry, palette, { footprint: 0.95 });
      if (!tree) continue;
      // Deterministic placement - no RNG, so the same state is the same picture.
      const t = Math.PI + (i / 6) * Math.PI;
      tree.position.set(Math.cos(t) * (BOARD - 0.9), 0, Math.sin(t) * (BOARD - 0.9) - 0.6);
      tree.rotation.y = t;
      this.scenery.add(tree);
    }
  }

  private async reconcileTiers(owned: readonly number[]): Promise<void> {
    const palette = this.palette;
    if (!palette) return;

    for (let tier = 1; tier <= owned.length; tier++) {
      const want = Math.min(owned[tier - 1] ?? 0, MAX_PROPS_PER_TIER);
      const have = this.standing.get(tier) ?? 0;
      if (want === have) continue;

      if (want < have) {
        for (const child of [...this.props.children]) {
          if (child.userData['tier'] === tier && (child.userData['index'] as number) >= want) {
            this.props.remove(child);
          }
        }
        this.standing.set(tier, want);
        continue;
      }

      const entry = TIER_MODELS[tier];
      if (!entry) continue;
      for (let index = have; index < want; index++) {
        const prop = await this.spawn(entry, palette, { footprint: PROP_FOOTPRINT });
        if (!prop) continue;
        // Four rows of five tiers, running back from the plots. Each tier owns
        // a cell; its copies cluster inside that cell rather than spreading.
        const row = Math.floor((tier - 1) / 5);
        const column = (tier - 1) % 5;
        prop.position.set(
          (column - 2) * 1.5 + ((index % 3) - 1) * 0.32,
          0,
          -1.1 - row * 1.05 - Math.floor(index / 3) * 0.32
        );
        prop.rotation.y = ((tier * 37 + index * 53) % 360) * (Math.PI / 180);
        prop.userData['tier'] = tier;
        prop.userData['index'] = index;
        this.props.add(prop);
      }
      this.standing.set(tier, want);
    }
  }

  private async reconcilePlots(stages: readonly string[]): Promise<void> {
    const palette = this.palette;
    if (!palette) return;

    const unchanged =
      stages.length === this.plotStages.length && stages.every((s, i) => s === this.plotStages[i]);
    if (unchanged) return;

    this.clear(this.plots);
    this.plotStages = [...stages];

    for (let i = 0; i < stages.length; i++) {
      const entry = PLOT_STAGE_MODELS[stages[i] ?? 'bare'];
      if (!entry) continue;
      const plot = await this.spawn(entry, palette, { footprint: PLOT_FOOTPRINT });
      if (!plot) continue;
      const column = i % 5;
      const row = Math.floor(i / 5);
      plot.position.set((column - 2) * TILE, 0, 1.3 + row * TILE);
      this.plots.add(plot);
    }
  }

  private async spawn(
    entry: DioramaModel,
    palette: RolePalette,
    options: { footprint?: number } = {}
  ): Promise<Group | null> {
    try {
      const template = await loadTemplate(entry.model);
      return instantiate(template, palette, { scale: entry.scale ?? 1, ...options });
    } catch {
      // A missing model must never take the game down with it. The staging
      // script and a test both guard against this; the catch is for the case
      // where someone runs a dev build without staging.
      return null;
    }
  }

  private clear(group: Group): void {
    for (const child of [...group.children]) group.remove(child);
  }
}
