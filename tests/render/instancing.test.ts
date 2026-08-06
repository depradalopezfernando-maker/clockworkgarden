import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describeTemplate, PropPool, type Placement } from '@render/instancing';
import { materialPalette } from '@render/materialPalette';
import { SEASON_PALETTES } from '@content/palette';

const palette = materialPalette(SEASON_PALETTES.spring);

/** A template shaped like the pack's: meshes nested under a transform node. */
function template(): Group {
  const root = new Group();
  const offset = new Group();
  offset.position.set(0.5, 0, 0);

  const leaf = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ name: 'grass' }));
  const trunk = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ name: 'woodBark' }));
  trunk.position.set(0, 1, 0);

  offset.add(leaf, trunk);
  root.add(offset);
  return root;
}

describe('describeTemplate flattens a model into parts', () => {
  it('finds every mesh, whatever it is nested under', () => {
    expect(describeTemplate(template())).toHaveLength(2);
  });

  it('keeps each material name, so recolouring still has something to look up', () => {
    const names = describeTemplate(template()).map((p) => p.materialName);
    expect(names).toContain('grass');
    expect(names).toContain('woodBark');
  });

  it('bakes the nested transform into the part, relative to the root', () => {
    // The pack nests meshes under transform nodes. Resolving that once here is
    // what lets an instance be a single matrix rather than a subtree.
    const parts = describeTemplate(template());
    const trunk = parts.find((p) => p.materialName === 'woodBark');
    const position = new Vector3().setFromMatrixPosition(trunk!.local);
    expect(position.x).toBeCloseTo(0.5, 6); // from the offset node
    expect(position.y).toBeCloseTo(1, 6); // from the mesh itself
  });

  it('gives a bigger part a SMALLER outline ratio — the pen stays one width', () => {
    // A ratio-based hull draws a bold line on a tree and a sub-pixel one on a
    // flower. Constant world thickness means the ratio has to fall as the part
    // grows, which is the property worth pinning.
    const parts = describeTemplate(template());
    const small = parts.find((p) => p.materialName === 'grass')!;
    const large = parts.find((p) => p.materialName === 'woodBark')!;
    expect(large.outlineScale).toBeLessThan(small.outlineScale);
    expect(small.outlineScale).toBeGreaterThan(1);
  });
});

describe('PropPool draws many copies in a fixed number of calls', () => {
  const build = (capacity = 8) => {
    const parent = new Group();
    return { parent, pool: new PropPool(describeTemplate(template()), palette, capacity, parent) };
  };

  it('costs two draw calls per part regardless of how many copies stand', () => {
    const { pool } = build();
    expect(pool.drawCalls).toBe(4); // 2 parts x (body + outline)
    pool.place([{ x: 0, z: 0 }]);
    expect(pool.drawCalls).toBe(4);
    pool.place(Array.from({ length: 8 }, (_, i) => ({ x: i, z: 0 })));
    expect(pool.drawCalls).toBe(4);
  });

  it('adds one InstancedMesh pair per part to the scene, and no more', () => {
    const { parent } = build();
    expect(parent.children).toHaveLength(4);
  });

  it('shows exactly as many copies as it was given', () => {
    const { parent, pool } = build();
    pool.place([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
    ]);
    for (const child of parent.children) {
      expect((child as { count: number }).count).toBe(3);
    }
  });

  it('clamps to capacity rather than throwing', () => {
    // A diorama quietly showing five of something instead of six is a far
    // better failure than a crash, and the real count is on the HUD.
    const { parent, pool } = build(2);
    const spots: Placement[] = Array.from({ length: 10 }, (_, i) => ({ x: i, z: 0 }));
    expect(() => pool.place(spots)).not.toThrow();
    for (const child of parent.children) {
      expect((child as { count: number }).count).toBe(2);
    }
  });

  it('places an instance where it was asked to, scale included', () => {
    const parent = new Group();
    const pool = new PropPool(describeTemplate(template()), palette, 4, parent, 2);
    pool.place([{ x: 3, z: -1 }]);

    const body = parent.children[0] as unknown as {
      getMatrixAt: (i: number, m: Matrix4) => void;
    };
    const matrix = new Matrix4();
    body.getMatrixAt(0, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);

    // The part sits at local x=0.5; at scale 2 that lands 1.0 from the prop.
    expect(position.x).toBeCloseTo(3 + 1, 6);
    expect(position.z).toBeCloseTo(-1, 6);
  });

  it('empties cleanly, so a Season change leaves nothing behind', () => {
    const { parent, pool } = build();
    pool.place([{ x: 0, z: 0 }]);
    pool.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
