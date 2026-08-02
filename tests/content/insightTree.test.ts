import { describe, it, expect } from 'vitest';
import {
  INSIGHT_TREE,
  NODE_COUNT,
  TOTAL_TREE_COST,
  nodeById,
  type NodeEffect,
} from '@content/insightTree';
import { MILESTONES, TOTAL_INSIGHT_AVAILABLE } from '@content/milestones';
import { PENDING_EFFECT_KINDS } from '@sim/insight';
import { GENERATOR_TIERS, TIER_COUNT } from '@content/generators';
import { INSIGHT_TREE_NODE_TARGET } from '@content/balance';

describe('docs/04 item 5 — every "Insight skill unlock" gate has a real node', () => {
  const insightGatedTiers = GENERATOR_TIERS.filter((t) => t.unlock.kind === 'insight-node').map(
    (t) => t.tier
  );

  const unlockNodeTiers = INSIGHT_TREE.filter((n) => n.effect.kind === 'unlock-generator').map(
    (n) => (n.effect.kind === 'unlock-generator' ? n.effect.tier : -1)
  );

  it('the spec gates exactly eight tiers on Insight', () => {
    expect(insightGatedTiers).toEqual([3, 4, 8, 9, 13, 14, 18, 19]);
  });

  it('each of those tiers has exactly one node that unlocks it', () => {
    for (const tier of insightGatedTiers) {
      const matches = unlockNodeTiers.filter((t) => t === tier);
      expect(matches, `tier ${tier}`).toHaveLength(1);
    }
  });

  it('no node unlocks a tier that is NOT Insight-gated', () => {
    // The other direction. A node opening a capstone- or Season-gated tier would
    // let a player skip content entirely.
    for (const tier of unlockNodeTiers) {
      expect(insightGatedTiers, `tier ${tier}`).toContain(tier);
    }
  });

  it('every unlocked tier exists', () => {
    for (const tier of unlockNodeTiers) {
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(TIER_COUNT);
    }
  });
});

describe('the tree is structurally sound', () => {
  it('has the node count §3 asks for', () => {
    expect(NODE_COUNT).toBeGreaterThanOrEqual(INSIGHT_TREE_NODE_TARGET.min);
    expect(NODE_COUNT).toBeLessThanOrEqual(INSIGHT_TREE_NODE_TARGET.max);
  });

  it('has unique ids', () => {
    const ids = INSIGHT_TREE.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every prerequisite refers to a node that exists', () => {
    for (const node of INSIGHT_TREE) {
      for (const required of node.requires) {
        expect(nodeById(required), `${node.id} requires ${required}`).toBeDefined();
      }
    }
  });

  it('has no dependency cycles and every node is reachable from a root', () => {
    // A cycle would make a whole branch permanently unbuyable, and nothing in
    // the UI would say why.
    const resolved = new Set<string>();
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const node of INSIGHT_TREE) {
        if (resolved.has(node.id)) continue;
        if (node.requires.every((id) => resolved.has(id))) {
          resolved.add(node.id);
          progressed = true;
        }
      }
    }
    const unreachable = INSIGHT_TREE.filter((n) => !resolved.has(n.id)).map((n) => n.id);
    expect(unreachable).toEqual([]);
  });

  it('never requires a node from a LATER Season', () => {
    // Otherwise the node is visible and permanently unbuyable.
    for (const node of INSIGHT_TREE) {
      for (const id of node.requires) {
        const prerequisite = nodeById(id);
        expect(prerequisite!.season, `${node.id} <- ${id}`).toBeLessThanOrEqual(node.season);
      }
    }
  });

  it('costs are positive and rise with Season', () => {
    for (const node of INSIGHT_TREE) {
      expect(node.cost, node.id).toBeGreaterThan(0);
    }
    const meanCost = (season: number) => {
      const nodes = INSIGHT_TREE.filter((n) => n.season === season);
      return nodes.reduce((sum, n) => sum + n.cost, 0) / nodes.length;
    };
    expect(meanCost(4)).toBeGreaterThan(meanCost(1));
  });

  it('covers all four Seasons and includes cosmetic nodes (§3 asks by name)', () => {
    for (const season of [1, 2, 3, 4]) {
      expect(
        INSIGHT_TREE.some((n) => n.season === season),
        `season ${season}`
      ).toBe(true);
    }
    expect(INSIGHT_TREE.filter((n) => n.effect.kind === 'cosmetic').length).toBeGreaterThanOrEqual(
      3
    );
  });
});

describe('the tree is a set of choices, not a shopping list (§3)', () => {
  it('a campaign cannot afford every node', () => {
    // §3: milestones exist to stop the tree becoming "just buy everything
    // eventually". If total Insight ever covers total cost, that property is
    // gone and there is no build to choose.
    expect(TOTAL_INSIGHT_AVAILABLE).toBeLessThan(TOTAL_TREE_COST);
  });

  it('but affords a substantial majority — not a token fraction', () => {
    const coverage = TOTAL_INSIGHT_AVAILABLE / TOTAL_TREE_COST;
    expect(coverage).toBeGreaterThan(0.5);
    expect(coverage).toBeLessThan(0.95);
  });

  it('affords the whole generator-unlock chain with room to spare', () => {
    // These gate progression outright. If the unlock chain alone consumed the
    // entire Insight budget, every other branch would be decorative.
    const unlockCost = INSIGHT_TREE.filter((n) => n.effect.kind === 'unlock-generator').reduce(
      (sum, n) => sum + n.cost,
      0
    );
    expect(unlockCost).toBeLessThan(TOTAL_INSIGHT_AVAILABLE * 0.6);
  });
});

describe('milestones', () => {
  it('have unique ids', () => {
    const ids = MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all award something', () => {
    for (const m of MILESTONES) expect(m.reward, m.id).toBeGreaterThan(0);
  });

  it('reference only real tiers', () => {
    for (const m of MILESTONES) {
      if (m.condition.kind === 'own-count') {
        expect(m.condition.tier, m.id).toBeGreaterThanOrEqual(1);
        expect(m.condition.tier, m.id).toBeLessThanOrEqual(TIER_COUNT);
      }
    }
  });

  it('include the three shapes §3 names — count, lifetime Mana, Season clear', () => {
    const kinds = new Set(MILESTONES.map((m) => m.condition.kind));
    expect(kinds.has('own-count')).toBe(true);
    expect(kinds.has('lifetime-mana')).toBe(true);
    expect(kinds.has('capstone-cleared')).toBe(true);
  });

  it('award enough early Insight to open the Season 1 unlock chain', () => {
    // Tier 3 gates on s1-gen-3, which needs s1-click-1 first. If the earliest
    // milestones cannot pay for that chain, the game stalls at Tier 2 - which is
    // exactly what happened before the harness claimed milestones at all.
    const earlyReward = MILESTONES.filter(
      (m) =>
        (m.condition.kind === 'own-count' && m.condition.tier <= 2) ||
        (m.condition.kind === 'lifetime-mana' && m.condition.amount <= 1e4)
    ).reduce((sum, m) => sum + m.reward, 0);

    const chainCost =
      (nodeById('s1-click-1')?.cost ?? 0) +
      (nodeById('s1-gen-3')?.cost ?? 0) +
      (nodeById('s1-gen-4')?.cost ?? 0);

    expect(earlyReward).toBeGreaterThanOrEqual(chainCost);
  });
});

describe('no node silently does nothing', () => {
  it('every effect kind is either applied now or explicitly deferred', () => {
    // Kitchen Garden and Insulation nodes are authored before their systems
    // exist. That is fine; going UNNOTICED is not. Adding an effect kind
    // without wiring it fails here.
    const applied: NodeEffect['kind'][] = [
      'unlock-generator',
      'click-bonus',
      'production-bonus',
      'offline-floor',
      'frenzy-duration',
    ];
    const accounted = new Set<string>([...applied, ...PENDING_EFFECT_KINDS]);

    for (const node of INSIGHT_TREE) {
      expect(accounted.has(node.effect.kind), `${node.id}: ${node.effect.kind}`).toBe(true);
    }
  });
});
