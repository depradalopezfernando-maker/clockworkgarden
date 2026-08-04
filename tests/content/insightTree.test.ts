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
import { GENERATOR_TIERS, GENERATOR_UNLOCK_OWNED, TIER_COUNT, tierAt } from '@content/generators';
import { INSIGHT_TREE_NODE_TARGET } from '@content/balance';

describe('no Insight node gates progression — the soft-lock fix', () => {
  // A playtester spent their Insight on click power and the Kitchen Garden and
  // found the next generator tier unreachable, with no way to earn the Insight
  // back. Access must never be purchasable; only strength.
  it('no tier gates on Insight in any form', () => {
    for (const t of GENERATOR_TIERS) {
      expect(t.unlock.kind, `tier ${t.tier}`).not.toBe('insight-node');
    }
  });

  it('every tier is reachable with Mana alone, from a tree bought at random', () => {
    // The property that makes soft-locking impossible: unlock gates read only
    // owned counts, lifetime Mana, Seasons and capstones - never `purchasedNodes`.
    const serialised = JSON.stringify(GENERATOR_TIERS.map((t) => t.unlock));
    expect(serialised).not.toContain('insight');
    expect(serialised).not.toContain('node');
  });

  it('the eight formerly Insight-gated tiers now gate on the previous tier', () => {
    for (const tier of [3, 4, 8, 9, 13, 14, 18, 19]) {
      const gate = GENERATOR_TIERS[tier - 1]!.unlock;
      expect(gate, `tier ${tier}`).toEqual({
        kind: 'own-count',
        tier: tier - 1,
        count: GENERATOR_UNLOCK_OWNED,
      });
    }
  });

  it('per-tier nodes NAME the tier they boost — the playtest caught two that did not', () => {
    // Two nodes were named after generators that do not exist ("Loam Reactors",
    // "Canopy Looms") while boosting Cider Press Guilds and Scarecrow Sentinel
    // Networks. A description that names the wrong plot is worse than a vague
    // one: the player buys it expecting something else.
    for (const node of INSIGHT_TREE) {
      if (node.effect.kind !== 'tier-production') continue;
      const real = tierAt(node.effect.tier).name.toLowerCase();
      const said = node.description.toLowerCase();
      // Compare STEMS, so "Nectar Refineries" still matches "Nectar Refinery".
      const stem = (word: string) => word.replace(/(ies|ys|s|y)$/, '');
      const keyword = stem(real.split(' ').sort((a, b) => b.length - a.length)[0]!);
      expect(said, `${node.id} says "${node.description}" but boosts ${real}`).toContain(keyword);
    }
  });

  it('per-tier production nodes point at tiers that exist', () => {
    for (const node of INSIGHT_TREE) {
      if (node.effect.kind !== 'tier-production') continue;
      expect(node.effect.tier, node.id).toBeGreaterThanOrEqual(1);
      expect(node.effect.tier, node.id).toBeLessThanOrEqual(TIER_COUNT);
      expect(node.effect.amount, node.id).toBeGreaterThan(0);
    }
  });

  it('gives most tiers a production ladder rather than one flat global bonus', () => {
    // §3's "several levels" - the tree should offer real choices about WHICH
    // plots to invest in, not just "+8% to everything" repeated.
    const tiers = new Set(
      INSIGHT_TREE.filter((n) => n.effect.kind === 'tier-production').map((n) =>
        n.effect.kind === 'tier-production' ? n.effect.tier : -1
      )
    );
    expect(tiers.size).toBeGreaterThanOrEqual(8);
    // At least some tiers have more than one level.
    const counts = new Map<number, number>();
    for (const n of INSIGHT_TREE) {
      if (n.effect.kind !== 'tier-production') continue;
      counts.set(n.effect.tier, (counts.get(n.effect.tier) ?? 0) + 1);
    }
    expect([...counts.values()].filter((c) => c > 1).length).toBeGreaterThanOrEqual(4);
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

  it('no single branch can consume the whole budget', () => {
    // Nothing here gates progression any more, so there is no chain a player
    // MUST buy. The remaining risk is the opposite: one branch so expensive
    // that taking it leaves every other branch decorative.
    const byKind = new Map<string, number>();
    for (const n of INSIGHT_TREE)
      byKind.set(n.effect.kind, (byKind.get(n.effect.kind) ?? 0) + n.cost);
    for (const [kind, cost] of byKind) {
      expect(cost, kind).toBeLessThan(TOTAL_INSIGHT_AVAILABLE * 0.8);
    }
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

  it('award enough early Insight for the opening of the tree to be affordable', () => {
    // Nothing gates progression now, so this is about FEEL rather than being
    // stuck: a player who reaches the first few milestones should be able to
    // buy something they can see, not save for twenty minutes.
    const earlyReward = MILESTONES.filter(
      (m) =>
        (m.condition.kind === 'own-count' && m.condition.tier <= 2) ||
        (m.condition.kind === 'lifetime-mana' && m.condition.amount <= 1e4)
    ).reduce((sum, m) => sum + m.reward, 0);

    const chainCost =
      (nodeById('s1-click-1')?.cost ?? 0) +
      (nodeById('s1-yield-1')?.cost ?? 0) +
      (nodeById('s1-yield-3')?.cost ?? 0);

    expect(earlyReward).toBeGreaterThanOrEqual(chainCost);
  });
});

describe('no node silently does nothing', () => {
  it('every effect kind is either applied now or explicitly deferred', () => {
    // Kitchen Garden and Insulation nodes are authored before their systems
    // exist. That is fine; going UNNOTICED is not. Adding an effect kind
    // without wiring it fails here.
    const applied: NodeEffect['kind'][] = [
      'tier-production',
      'click-bonus',
      'production-bonus',
      'offline-floor',
      'frenzy-duration',
      // Wired in Phase 4.
      'kg-slots',
      'kg-surface',
      'kg-automation',
      'kg-day-length',
      'satchel-capacity',
    ];
    const accounted = new Set<string>([...applied, ...PENDING_EFFECT_KINDS]);

    for (const node of INSIGHT_TREE) {
      expect(accounted.has(node.effect.kind), `${node.id}: ${node.effect.kind}`).toBe(true);
    }
  });
});
