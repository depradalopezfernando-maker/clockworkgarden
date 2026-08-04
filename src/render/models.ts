/**
 * models.ts — load Kenney GLBs and make them look like one game.
 *
 * Three things happen to every model on the way in, and all three are §11's
 * "silhouette treatment" made mechanical:
 *
 *   1. RECOLOUR. Each material's name is looked up in `MATERIAL_ROLES` and
 *      repainted with the Season's colour for that role. Nothing keeps the
 *      pack's own palette.
 *   2. FLAT SHADE. `flatShading` on, metalness off — the faceted low-poly read
 *      the spec asks for, and it makes the recolour legible.
 *   3. OUTLINE. An inverted hull: a slightly inflated copy of the mesh rendered
 *      back-faces-only in the outline colour. Cheap, needs no post-processing
 *      pass, and survives instancing.
 *
 * Loaded geometry is cached by file, because twenty Watering Cans are one model
 * drawn twenty times.
 */

import {
  BackSide,
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MATERIAL_ROLES, MODEL_DIR, type MaterialRole } from '@content/diorama';
import { EDGE_TREATMENT } from '@content/palette';

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

export interface InstanceOptions {
  /** Uniform scale, applied after any normalisation. */
  readonly scale?: number;
  /**
   * Scale the model so its largest HORIZONTAL extent is this many world units.
   *
   * The pack's models range from a 0.16-unit flower to a 1.7-unit tree, so
   * placing them at natural size puts a Watering Can two pixels tall next to a
   * ground tile. Normalising by footprint makes a pot and a statue read as
   * comparable objects on the same board, which is what a diorama wants, and it
   * keeps working when a model is swapped in the registry.
   */
  readonly footprint?: number;
}

/** A scene-ready copy of a template, repainted for this Season. */
export function instantiate(
  template: Group,
  palette: RolePalette,
  options: InstanceOptions = {}
): Group {
  const root = template.clone(true);
  // Collected during the walk and attached after it: adding children mid-
  // traverse would walk into the shells and outline the outlines.
  const shells: { host: Mesh; shell: Mesh }[] = [];

  root.traverse((node: Object3D) => {
    if (!(node instanceof Mesh)) return;

    const source = Array.isArray(node.material) ? node.material[0] : node.material;
    const name = source?.name ?? '';

    node.material = new MeshStandardMaterial({
      color: new Color(colourFor(name, palette)),
      flatShading: EDGE_TREATMENT.flatShaded,
      metalness: 0,
      roughness: 0.85,
    });
    node.castShadow = true;
    node.receiveShadow = true;

    shells.push({ host: node, shell: buildOutline(node.geometry) });
  });

  // Parented to the mesh they outline, so they inherit every transform it gets.
  for (const { host, shell } of shells) host.add(shell);

  let scale = options.scale ?? 1;
  if (options.footprint) {
    const size = new Box3().setFromObject(root).getSize(new Vector3());
    const widest = Math.max(size.x, size.z);
    if (widest > 0) scale *= options.footprint / widest;
  }
  root.scale.setScalar(scale);
  return root;
}

/**
 * Inverted-hull outline: the same geometry, grown, drawn back-faces-only. It
 * reads as a hand-drawn line and costs one extra draw call per mesh rather than
 * a full-screen post pass.
 *
 * The hull is grown by a constant WORLD distance, not a constant ratio. A ratio
 * gives a thick line on a tree and a sub-pixel one on a flower, which is the
 * opposite of §11's "consistent outline treatment" - the whole point is that
 * every prop is drawn with the same pen.
 */
function buildOutline(geometry: BufferGeometry): Mesh {
  const shell = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: new Color(EDGE_TREATMENT.outlineColor),
      side: BackSide,
      // The outline must not be lit, or it picks up the key light and stops
      // reading as a line.
      emissive: new Color(EDGE_TREATMENT.outlineColor),
      emissiveIntensity: 1,
      metalness: 0,
      roughness: 1,
    })
  );
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;
  shell.scale.setScalar(1 + EDGE_TREATMENT.outlineWidth / Math.max(radius, 0.01));
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.userData['outline'] = true;
  return shell;
}
