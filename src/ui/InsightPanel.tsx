import { useMemo, useState } from 'react';
import { gameStore } from '@game/store';
import { arePrerequisitesMet, canPurchaseNode, isNodePurchased, isNodeVisible } from '@sim/insight';
import { isClaimed, milestoneProgress } from '@sim/milestones';
import { INSIGHT_TREE, nodeById, type InsightNode } from '@content/insightTree';
import { MILESTONES } from '@content/milestones';
import type { GameState } from '@sim/state';
import { formatNumber, formatPercent } from './format';

/**
 * The Insight tree and milestone list (§3).
 *
 * Laid out as grouped columns rather than a free-form graph. A real node-graph
 * with edges is prettier, but this reads correctly at 390px, needs no layout
 * engine, and keeps prerequisites legible as text. Phase 6 can make it a
 * diorama; the data is the same either way.
 */
export function InsightPanel({ state }: { state: GameState }) {
  const [tab, setTab] = useState<'tree' | 'milestones'>('tree');

  const visible = useMemo(
    () => INSIGHT_TREE.filter((node) => isNodeVisible(state, node)),
    [state.season]
  );

  const bySeason = useMemo(() => {
    const groups = new Map<number, InsightNode[]>();
    for (const node of visible) {
      const list = groups.get(node.season) ?? [];
      list.push(node);
      groups.set(node.season, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const unclaimed = MILESTONES.filter((m) => !isClaimed(state, m.id));

  return (
    <section className="panel">
      <div className="tabs">
        <button
          type="button"
          className={tab === 'tree' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('tree')}
          data-testid="tab-tree"
        >
          Insight
        </button>
        <button
          type="button"
          className={tab === 'milestones' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('milestones')}
          data-testid="tab-milestones"
        >
          Milestones
        </button>
        <span className="tabs__spacer" />
        <span className="insight-balance" data-testid="insight">
          {formatNumber(state.insight)} Insight
        </span>
      </div>

      {tab === 'tree' ? (
        <div className="tree" data-testid="tree">
          {bySeason.map(([season, nodes]) => (
            <div key={season}>
              <h3 className="section-title">Season {season}</h3>
              {nodes.map((node) => (
                <NodeRow key={node.id} node={node} state={state} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="tree" data-testid="milestones">
          <p className="footnote" style={{ marginTop: 0 }}>
            Insight comes from milestones, never from spending Mana — so the tree is a set of
            choices, not a shopping list.
          </p>
          {unclaimed.slice(0, 12).map((milestone) => (
            <div key={milestone.id} className="milestone">
              <span>
                <span className="generator__name">{milestone.name}</span>
                <span className="generator__detail">+{milestone.reward} Insight</span>
              </span>
              <span className="milestone__progress">
                {formatPercent(milestoneProgress(state, milestone))}
              </span>
            </div>
          ))}
          {unclaimed.length === 0 && <p className="footnote">Every milestone earned.</p>}
        </div>
      )}
    </section>
  );
}

function NodeRow({ node, state }: { node: InsightNode; state: GameState }) {
  const purchased = isNodePurchased(state, node.id);
  const prerequisitesMet = arePrerequisitesMet(state, node);
  const affordable = canPurchaseNode(state, node.id);

  const missing = node.requires
    .filter((id) => !state.purchasedNodes.includes(id))
    .map((id) => nodeById(id)?.name ?? id);

  return (
    <button
      type="button"
      className={purchased ? 'node node--owned' : 'node'}
      disabled={!affordable}
      onClick={() => gameStore.purchaseNode(node.id)}
      data-testid={`node-${node.id}`}
      data-owned={purchased ? 'true' : 'false'}
    >
      <span>
        <span className="generator__name">{node.name}</span>
        <span className="generator__detail">
          {purchased
            ? 'Purchased'
            : prerequisitesMet
              ? node.description
              : `Requires ${missing.join(', ')}`}
        </span>
      </span>
      <span className="node__cost">{purchased ? '✓' : node.cost}</span>
    </button>
  );
}
