/**
 * diorama.ts — which model represents what, and how a pack's materials map onto
 * the locked palette (§11).
 *
 * DATA ONLY. The loader, the recolour maths and the scene graph live in
 * `src/render/`.
 *
 * Two tables, and the second is the one that makes §11 tractable:
 *
 *   MODELS           game concept -> Kenney model file
 *   MATERIAL_ROLES   Kenney material name -> a role the palette can fill
 *
 * The Nature Kit has no textures at all: every model carries a handful of named
 * materials with a flat `baseColorFactor`, and across all 329 models there are
 * only 23 distinct names. So recolouring is not nearest-colour guesswork — it is
 * a lookup from a name that already means something ("leafsDark", "dirt") to a
 * role the Season palette defines. That is what turns §11's "recolour everything
 * to one palette" from an aesthetic judgement into a mechanical transform, which
 * is the whole reason the palette was locked as data first.
 */

/**
 * Roles a material can play. Six come straight from `SeasonPalette`; the rest
 * are DERIVED from those six by `materialPalette()` in the render layer.
 *
 * Deriving rather than adding palette entries is deliberate. The palette was
 * reviewed and locked by a human; stone and water are not aesthetic decisions
 * anyone made, they are consequences. Adding roles would mean re-opening a
 * locked decision to answer a question nobody asked.
 */
export type MaterialRole =
  | 'foliage'
  | 'foliageDark'
  | 'foliageAccent'
  | 'soil'
  | 'soilDark'
  | 'bark'
  | 'barkDark'
  | 'barkPale'
  | 'stone'
  | 'stoneDark'
  | 'water'
  | 'bloom'
  | 'bloomDark'
  | 'pale';

/**
 * Every material name in the Nature Kit, mapped to a role.
 *
 * Regenerate with `node tools/list-materials.mjs` after adding a pack. A name
 * missing from here renders in the pack's own colour, which is exactly the
 * "looks like three asset packs" failure §11 warns about — so a test asserts
 * the table covers every material actually referenced by MODELS.
 */
export const MATERIAL_ROLES: Readonly<Record<string, MaterialRole>> = {
  // Foliage
  grass: 'foliage',
  leafsGreen: 'foliage',
  leafsDark: 'foliageDark',
  leafsFall: 'foliageAccent',
  // Earth
  dirt: 'soil',
  dirtDark: 'soilDark',
  // Wood
  woodBark: 'bark',
  wood: 'bark',
  woodBarkDark: 'barkDark',
  woodDark: 'barkDark',
  woodBirch: 'barkPale',
  woodInner: 'barkPale',
  colorTan: 'barkPale',
  // Mineral
  stone: 'stone',
  stoneDark: 'stoneDark',
  water: 'water',
  // Blooms and trims — these carry the Season accent, so they are what the eye
  // reads as "this Season is Spring".
  colorRed: 'bloom',
  colorPurple: 'bloom',
  colorYellow: 'bloom',
  corn: 'bloom',
  colorRedDark: 'bloomDark',
  colorWhite: 'pale',
  _defaultMat: 'pale',
};

/** Where a model file lives, relative to the staged model directory. */
export const MODEL_DIR = 'models';

export interface DioramaModel {
  /** File stem, without `.glb`. */
  readonly model: string;
  /** Uniform scale applied on top of the pack's own units. */
  readonly scale?: number;
}

/**
 * One model per generator tier.
 *
 * The Nature Kit has no watering cans and no garden gnomes, so several of these
 * are evocative stand-ins rather than literal matches — a Gnome Crew is a
 * cluster of red mushrooms, a Scarecrow Network is a signpost. §11's consistency
 * guardrail cares that everything shares a palette and a silhouette, not that
 * every prop is literal. Swap freely; nothing but this table needs to change.
 */
export const TIER_MODELS: Readonly<Record<number, DioramaModel>> = {
  1: { model: 'pot_small' },
  2: { model: 'crops_leafsStageB' },
  3: { model: 'flower_purpleA' },
  4: { model: 'mushroom_redGroup' },
  5: { model: 'plant_flatTall' },
  6: { model: 'pot_large' },
  7: { model: 'flower_yellowB' },
  8: { model: 'flower_purpleC' },
  9: { model: 'crop_melon' },
  10: { model: 'flower_yellowC' },
  11: { model: 'log_stack' },
  12: { model: 'crops_wheatStageB' },
  13: { model: 'crop_pumpkin' },
  14: { model: 'sign' },
  15: { model: 'statue_obelisk', scale: 0.8 },
  16: { model: 'statue_ring', scale: 0.8 },
  17: { model: 'tent_detailedClosed', scale: 0.7 },
  18: { model: 'campfire_stones' },
  19: { model: 'statue_column', scale: 0.8 },
  20: { model: 'statue_head', scale: 0.8 },
};

/**
 * Kitchen Garden plot stages.
 *
 * This is the mapping the pack was chosen for: Kenney ships crops in labelled
 * growth stages, so §2a's Dig -> Plant -> Cover -> growing -> grown sequence
 * already has art, with no one drawing anything.
 */
export const PLOT_STAGE_MODELS: Readonly<Record<string, DioramaModel>> = {
  bare: { model: 'crops_dirtSingle' },
  dug: { model: 'crops_dirtRow' },
  planted: { model: 'crops_leafsStageA' },
  growing: { model: 'crops_wheatStageA' },
  grown: { model: 'crops_wheatStageB' },
};

/**
 * Backdrop trees per Season. Kenney ships `_fall` and pine variants, so the
 * silhouette changes with the Season as well as the colour — Autumn is not just
 * Spring tinted orange.
 */
export const SEASON_SCENERY: Readonly<Record<number, readonly DioramaModel[]>> = {
  1: [{ model: 'tree_default' }, { model: 'tree_small' }, { model: 'plant_bush' }],
  2: [{ model: 'tree_oak' }, { model: 'tree_fat' }, { model: 'plant_bushLarge' }],
  3: [{ model: 'tree_default_fall' }, { model: 'tree_small_fall' }, { model: 'tree_oak_fall' }],
  4: [{ model: 'tree_pineDefaultA' }, { model: 'tree_pineSmallA' }, { model: 'tree_pineRoundA' }],
};

/** The ground tile the whole diorama stands on. */
export const GROUND_MODEL: DioramaModel = { model: 'ground_grass' };

/** Every model file the game can ask for. `tools/stage-models.ts` copies these. */
export function referencedModels(): string[] {
  const names = new Set<string>([GROUND_MODEL.model]);
  for (const entry of Object.values(TIER_MODELS)) names.add(entry.model);
  for (const entry of Object.values(PLOT_STAGE_MODELS)) names.add(entry.model);
  for (const list of Object.values(SEASON_SCENERY)) {
    for (const entry of list) names.add(entry.model);
  }
  return [...names].sort();
}
