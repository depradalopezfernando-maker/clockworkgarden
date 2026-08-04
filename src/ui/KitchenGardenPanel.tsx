import { gameStore } from '@game/store';
import { effectsOf, levelsOf } from '@sim/insight';
import {
  canPerform,
  dayLengthSeconds,
  plotUnits,
  satchelCapacity,
  slotCap,
  slotCost,
  type Plot,
  type PlotStep,
} from '@sim/kitchenGarden';
import { gardenPlotManaPerSecond, kitchenGardenShare } from '@sim/economy';
import { KITCHEN_GARDEN_BASE_FRACTION } from '@content/balance';
import { seasonTierOneCost } from '@content/generators';
import { DEFAULT_SURFACE, SURFACES, surfaceById, type SurfaceId } from '@content/surfaces';
import type { GameState } from '@sim/state';
import { formatNumber, formatRate, formatSeconds } from './format';

/**
 * The garden's contribution, as a percentage of Garden Plot income (D2).
 *
 * One decimal, not `formatPercent`'s whole numbers: a single Bare Soil plot is
 * worth 0.4%, and rounding that to "0%" tells the player their plot does
 * nothing. Four of them are worth 1.6%, which whole numbers render as "2%" —
 * the same as three. The small end is exactly where this readout has to work.
 */
function formatContribution(share: number): string {
  if (share <= 0) return '+0%';
  return `+${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
}

/**
 * The Kitchen Garden (§2a).
 *
 * One card per plot showing the next step in the Dig → Plant → Cover cycle, so
 * the ritual reads as a ritual rather than a form. The Day Time bar is the only
 * budget on screen, and it moves only when the player acts — §2a is emphatic
 * that it must never look like a countdown.
 */
export function KitchenGardenPanel({ state }: { state: GameState }) {
  const kg = state.kitchenGarden;
  const effects = effectsOf(state);
  const levels = levelsOf(state);
  const context = { levels, season: state.season, nowSeconds: state.elapsedSeconds };

  const cap = slotCap(effects.kgSlotBonus);
  const nextSlotCost = slotCost(kg.plots.length + 1, seasonTierOneCost(state.season));
  const canBuySlot = kg.plots.length < cap && state.mana >= nextSlotCost;

  const dayLength = dayLengthSeconds(effects.kgDayLengthStep);
  const dayFraction = Math.max(0, Math.min(1, kg.dayTimeRemaining / dayLength));
  const night = kg.nightRemaining > 0;

  // Surfaces the Insight tree has opened, best first. Bare Soil is always
  // available and always free, so it is the fallback rather than a choice.
  const unlockedSurfaces = (Object.keys(SURFACES) as SurfaceId[])
    .filter((id) => id !== DEFAULT_SURFACE && effects.kgSurfaces.has(id))
    .sort(
      (a, b) =>
        SURFACES[b].capacity * SURFACES[b].yieldMult - SURFACES[a].capacity * SURFACES[a].yieldMult
    );

  // What the garden is actually worth right now. Without this the subsystem is
  // invisible: each Bare Soil plot adds 0.4% of Garden Plot income, so a player
  // covering their second and third plots sees the HUD rate not move at all and
  // concludes only one plot produces.
  const share = kitchenGardenShare(state);
  const contribution = gardenPlotManaPerSecond(state) * share;
  const growing = kg.plots.filter((p) => p.stage === 'grown').length;

  return (
    <section className="panel panel--wide">
      <div className="tabs">
        <h2 className="section-title" style={{ margin: 0 }}>
          Kitchen Garden
        </h2>
        <span className="tabs__spacer" />
        <span className="insight-balance" data-testid="kg-seeds">
          {kg.seeds}/{satchelCapacity(effects.satchelBonus)} Seeds
        </span>
      </div>

      <p className="footnote" data-testid="kg-contribution">
        {growing === 0 ? (
          'No crop is producing yet. Every grown plot adds to your Garden Plots.'
        ) : (
          <>
            <b>
              {growing} plot{growing === 1 ? '' : 's'} producing
            </b>{' '}
            · {formatContribution(share)} to Garden Plots · +{formatRate(contribution)}
          </>
        )}
      </p>

      <div className="meter">
        <div className="meter__label">
          <span>{night ? 'Night' : 'Day Time'}</span>
          <span data-testid="kg-day">
            {night ? formatSeconds(kg.nightRemaining) : `${Math.ceil(kg.dayTimeRemaining)}s`}
          </span>
        </div>
        <div
          className="meter__track"
          role="progressbar"
          aria-label="Day Time remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(dayFraction * 100)}
        >
          <div
            className={night ? 'meter__fill meter__fill--night' : 'meter__fill'}
            style={{ width: `${night ? 100 : dayFraction * 100}%` }}
          />
        </div>
      </div>

      <p className="footnote" style={{ marginTop: '0.6rem' }}>
        {night
          ? 'Night. The Bell, your Garden Plots and Growth Frenzy all keep running.'
          : 'Day Time is spent only when you work a plot — it never runs down on its own.'}
      </p>

      <div className="plots" data-testid="kg-plots">
        {kg.plots.map((plot, index) => (
          <PlotCard
            key={index}
            index={index}
            plot={plot}
            state={state}
            context={context}
            canAct={!night}
            unlockedSurfaces={unlockedSurfaces}
          />
        ))}

        <button
          type="button"
          className="plot plot--add"
          disabled={!canBuySlot}
          onClick={() => gameStore.kitchenGardenBuySlot()}
          data-testid="kg-buy-slot"
        >
          {kg.plots.length >= cap ? (
            <span className="generator__detail">
              {cap >= 20 ? 'Every slot broken' : 'Insight raises the cap'}
            </span>
          ) : (
            <>
              <span className="generator__name">Break ground</span>
              <span className="generator__detail">{formatNumber(nextSlotCost)} Mana</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

const NEXT_STEP: Readonly<Record<string, PlotStep | null>> = {
  bare: 'dig',
  dug: 'plant',
  planted: 'cover',
  growing: null,
  grown: null,
};

const STEP_LABEL: Readonly<Record<PlotStep, string>> = {
  dig: 'Dig',
  plant: 'Plant',
  cover: 'Cover',
};

function PlotCard({
  index,
  plot,
  state,
  context,
  canAct,
  unlockedSurfaces,
}: {
  index: number;
  plot: Plot;
  state: GameState;
  context: { levels: ReturnType<typeof levelsOf>; season: number; nowSeconds: number };
  canAct: boolean;
  unlockedSurfaces: readonly SurfaceId[];
}) {
  const surface = surfaceById(plot.surface);
  const step = NEXT_STEP[plot.stage] ?? null;

  // Re-surfacing a plot you already own was unreachable: the Insight tree sold
  // you a Raised Garden Box and nothing in the UI applied it, so it could only
  // ever land on newly broken ground. `applySurface` resets the plot (§2a counts
  // a surface change as one of the three things that force a replant), which is
  // why the offer sits under the plot rather than replacing its action.
  const upgrades = unlockedSurfaces
    .filter((id) => id !== plot.surface)
    .map((id) => ({
      id,
      surface: SURFACES[id],
      cost: SURFACES[id].applyCostMultiplier * seasonTierOneCost(state.season),
    }))
    .filter((u) => u.surface.capacity * u.surface.yieldMult > surface.capacity * surface.yieldMult);

  const surfaceOffer = <SurfaceOffer index={index} state={state} upgrades={upgrades} />;

  if (plot.stage === 'growing') {
    const remaining = Math.max(0, plot.grownAt - state.elapsedSeconds);
    return (
      <div className="plot-cell">
        <div className="plot plot--growing" data-testid={`kg-plot-${index}`} data-stage="growing">
          <span className="generator__name">{surface.name}</span>
          <span className="generator__detail">Growing · {formatSeconds(remaining)}</span>
        </div>
        {surfaceOffer}
      </div>
    );
  }

  if (plot.stage === 'grown') {
    const stale = plot.plantedSeason !== state.season;
    const perfect = plot.perfectUntil > state.elapsedSeconds;
    // Per-plot contribution, so a player can see each plot pulling its weight
    // rather than inferring it from a HUD rate that barely moves.
    const own = plotUnits(plot, context) * KITCHEN_GARDEN_BASE_FRACTION;
    return (
      <div className="plot-cell">
        <button
          type="button"
          className="plot plot--grown"
          onClick={() => gameStore.kitchenGardenClear(index)}
          data-testid={`kg-plot-${index}`}
          data-stage="grown"
          data-contribution={own.toFixed(4)}
        >
          <span className="generator__name">{surface.name}</span>
          <span className="generator__detail">
            {stale
              ? 'Last Season — replant'
              : `${formatContribution(own)}${perfect ? ' · ×2' : ''}`}
          </span>
        </button>
        {surfaceOffer}
      </div>
    );
  }

  const allowed = step !== null && canAct && canPerform(state.kitchenGarden, index, step, context);

  return (
    <div className="plot-cell">
      <button
        type="button"
        className="plot"
        disabled={!allowed}
        onClick={() => step && gameStore.kitchenGardenStep(index, step)}
        data-testid={`kg-plot-${index}`}
        data-stage={plot.stage}
      >
        <span className="generator__name">{step ? STEP_LABEL[step] : surface.name}</span>
        <span className="generator__detail">
          {surface.name}
          {surface.capacity > 1 && ` · ×${surface.capacity}`}
        </span>
      </button>
      {surfaceOffer}
    </div>
  );
}

/**
 * The "upgrade this plot's surface" offer.
 *
 * Only strictly better surfaces are listed, and only the cheapest one at a time:
 * six surfaces x twenty plots would be a hundred and twenty buttons, which is
 * the busywork §2a's twenty-plot cap exists to prevent.
 */
function SurfaceOffer({
  index,
  state,
  upgrades,
}: {
  index: number;
  state: GameState;
  upgrades: readonly { id: SurfaceId; surface: (typeof SURFACES)[SurfaceId]; cost: number }[];
}) {
  const best = upgrades[0];
  if (!best) return null;
  const affordable = state.mana >= best.cost;

  return (
    <button
      type="button"
      className="plot-upgrade"
      disabled={!affordable}
      onClick={() => gameStore.kitchenGardenApplySurface(index, best.id)}
      data-testid={`kg-surface-${index}`}
      title={`${best.surface.name} — ${best.surface.description} Replants this plot.`}
    >
      <span className="plot-upgrade__name">↑ {best.surface.name}</span>
      <span className="plot-upgrade__cost">{formatNumber(best.cost)} Mana</span>
    </button>
  );
}
