/**
 * models.ts — load Kenney GLBs and make them look like one game.
 *
 * Loading and the two decisions that make a pack look like this game: which
 * palette colour a material becomes, and how big a model is drawn. The scene
 * graph that uses them lives in `instancing.ts`, which turns a template into
 * pooled `InstancedMesh`es.
 *
 * Geometry is cached by file, because twenty Watering Cans are one model drawn
 * twenty times.
 */

import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MATERIAL_ROLES, MODEL_DIR, type MaterialRole } from '@content/diorama';

export type RolePalette = Readonly<Record<MaterialRole, string>>;

const loader = new GLTFLoader();
const cache = new Map<string, Promise<Group>>();

/**
 * Load a model, once. The returned Group is a shared TEMPLATE and must never be
 * added to a scene directly — call `instantiate` for a recoloured copy.
 */
export function loadTemplate(name: string, base = ''): Promise<Group> {
  const cached = cache.get(name);
  if (cached) return cached;

  const url = `${base}${MODEL_DIR}/${name}.glb`;
  const pending = new Promise<Group>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => reject(new Error(`could not load model "${name}" from ${url}`))
    );
  });
  cache.set(name, pending);
  return pending;
}

/** Drop every cached template. Tests and hot-reload need this; the game does not. */
export function clearModelCache(): void {
  cache.clear();
}

/**
 * Which colour a Kenney material should become.
 *
 * An unmapped name falls back to `pale` rather than keeping the pack's own
 * colour: a stray original colour is exactly the "three asset packs" look §11
 * warns about, and it is far easier to notice a prop that has gone flat than
 * one that is subtly off-palette. A test keeps the table complete regardless.
 */
export function colourFor(materialName: string, palette: RolePalette): string {
  const role = MATERIAL_ROLES[materialName];
  return palette[role ?? 'pale'];
}

/**
 * Uniform scale that draws a model at a given horizontal footprint.
 *
 * The pack ranges from a 0.16-unit flower to a 1.7-unit tree, so placing models
 * at natural size puts a Watering Can two pixels tall beside a ground tile.
 * Normalising by footprint makes a pot and a statue read as comparable objects
 * on the same board, and keeps the composition stable when a model is swapped
 * in the registry.
 */
export function footprintScale(template: Group, footprint: number): number {
  if (!(footprint > 0)) return 1;
  const size = new Box3().setFromObject(template).getSize(new Vector3());
  const widest = Math.max(size.x, size.z);
  return widest > 0 ? footprint / widest : 1;
}
