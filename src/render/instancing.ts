/**
 * instancing.ts — draw many copies of one model in two draw calls.
 *
 * The diorama repeats itself by design: 81 ground tiles, up to five copies of
 * each generator tier, twenty plots showing five distinct stages. Drawn as
 * individual meshes that was ~670 draw calls at full build-out, and 162 of them
 * were the ground — one flat plane costing more than everything standing on it.
 *
 * A `PropPool` holds one `InstancedMesh` per part of a model (plus one for that
 * part's outline shell) and moves instances around inside it. Adding a prop
 * writes a matrix; it does not touch the scene graph.
 *
 * Two things make this fit the rest of the renderer:
 *
 *   - Every instance of a model shares a material, which is exactly true here
 *     because recolouring is per-SEASON, not per-prop.
 *   - The outline is a scale about the part's own origin, so it composes as
 *     `prop x part x scale` and survives instancing untouched. That is why §11's
 *     silhouette treatment was built as an inverted hull rather than a
 *     post-processing pass.
 */

import {
  BackSide,
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { EDGE_TREATMENT } from '@content/palette';
import { colourFor, type RolePalette } from './models';

/** One drawable piece of a model, with its transform relative to the model root. */
export interface PropPart {
  readonly geometry: BufferGeometry;
  readonly materialName: string;
  /** Part transform relative to the template root, baked once. */
  readonly local: Matrix4;
  /** Uniform scale that grows this part into its outline shell. */
  readonly outlineScale: number;
}

/**
 * Flatten a loaded template into parts.
 *
 * The pack nests meshes under transform nodes, so a part's placement has to be
 * resolved against the root once, here, rather than rediscovered per instance.
 */
export function describeTemplate(template: Group): PropPart[] {
  template.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(template.matrixWorld).invert();
  const parts: PropPart[] = [];

  template.traverse((node: Object3D) => {
    if (!(node instanceof Mesh)) return;
    const source = Array.isArray(node.material) ? node.material[0] : node.material;
    node.geometry.computeBoundingSphere();
    const radius = node.geometry.boundingSphere?.radius ?? 1;
    parts.push({
      geometry: node.geometry,
      materialName: source?.name ?? '',
      local: new Matrix4().multiplyMatrices(rootInverse, node.matrixWorld),
      // A constant WORLD thickness, not a ratio: see `buildOutline` in models.ts.
      outlineScale: 1 + EDGE_TREATMENT.outlineWidth / Math.max(radius, 0.01),
    });
  });

  return parts;
}

/** Where one copy of a prop stands. The pool turns these into matrices. */
export interface Placement {
  readonly x: number;
  readonly z: number;
  /** Radians. Rotation is only ever about Y — the camera is fixed. */
  readonly rotationY?: number;
}

/**
 * A fixed-capacity pool of one model, recoloured for one Season.
 *
 * `capacity` is allocated up front because `InstancedMesh` cannot grow. Pools
 * are per model and per Season, so they are cheap to throw away and rebuild when
 * the Season turns — which is exactly when every colour changes anyway.
 */
export class PropPool {
  private readonly bodies: InstancedMesh[] = [];
  private readonly shells: InstancedMesh[] = [];
  private readonly scratch = new Matrix4();
  private readonly outline = new Matrix4();

  constructor(
    private readonly parts: readonly PropPart[],
    palette: RolePalette,
    readonly capacity: number,
    parent: Group,
    /** Uniform scale every instance is drawn at, from footprint normalisation. */
    private readonly scale = 1
  ) {
    for (const part of parts) {
      const body = new InstancedMesh(
        part.geometry,
        new MeshStandardMaterial({
          color: new Color(colourFor(part.materialName, palette)),
          flatShading: EDGE_TREATMENT.flatShaded,
          metalness: 0,
          roughness: 0.85,
        }),
        capacity
      );
      body.instanceMatrix.setUsage(DynamicDrawUsage);
      body.castShadow = true;
      body.receiveShadow = true;
      body.count = 0;

      const shell = new InstancedMesh(
        part.geometry,
        new MeshStandardMaterial({
          color: new Color(EDGE_TREATMENT.outlineColor),
          side: BackSide,
          // Unlit, or the outline picks up the key light and stops reading as a line.
          emissive: new Color(EDGE_TREATMENT.outlineColor),
          emissiveIntensity: 1,
          metalness: 0,
          roughness: 1,
        }),
        capacity
      );
      shell.instanceMatrix.setUsage(DynamicDrawUsage);
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.count = 0;

      this.bodies.push(body);
      this.shells.push(shell);
      parent.add(body, shell);
    }
  }

  /**
   * Place every copy of this prop. Any previous placement is replaced.
   *
   * Placements beyond `capacity` are dropped rather than throwing: a diorama
   * quietly showing five of something instead of six is a far better failure
   * than a crash, and the count the player reads is on the HUD regardless.
   */
  place(placements: readonly Placement[]): void {
    const count = Math.min(placements.length, this.capacity);
    const prop = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3(this.scale, this.scale, this.scale);

    for (let p = 0; p < this.parts.length; p++) {
      const part = this.parts[p]!;
      const body = this.bodies[p]!;
      const shell = this.shells[p]!;

      for (let i = 0; i < count; i++) {
        const at = placements[i]!;
        position.set(at.x, 0, at.z);
        rotation.setFromEuler(new Euler(0, at.rotationY ?? 0, 0));
        prop.compose(position, rotation, scale);

        this.scratch.multiplyMatrices(prop, part.local);
        body.setMatrixAt(i, this.scratch);

        // The shell grows about the PART's origin, so it composes on the right
        // of the part transform. Scaling the whole prop instead would move the
        // part away from where it belongs.
        this.outline.makeScale(part.outlineScale, part.outlineScale, part.outlineScale);
        this.outline.premultiply(this.scratch);
        shell.setMatrixAt(i, this.outline);
      }

      body.count = count;
      shell.count = count;
      body.instanceMatrix.needsUpdate = true;
      shell.instanceMatrix.needsUpdate = true;
      body.computeBoundingSphere();
      shell.computeBoundingSphere();
    }
  }

  /** Draw calls this pool costs when full. Two per part: body and outline. */
  get drawCalls(): number {
    return this.parts.length * 2;
  }

  dispose(): void {
    for (const mesh of [...this.bodies, ...this.shells]) {
      mesh.removeFromParent();
      mesh.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    this.bodies.length = 0;
    this.shells.length = 0;
  }
}
