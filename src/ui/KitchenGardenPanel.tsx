import { gameStore } from '@game/store';
import { effectsOf, levelsOf } from '@sim/insight';
import {
  canPerform,
  dayLengthSeconds,
  satchelCapacity,
  slotCap,
  slotCost,
  type Plot,
  type PlotStep,
} from '@sim/kitchenGarden';
import { seasonTierOneCost } from '@content/generators';
import { surfaceById } from '@content/surfaces';
import type { GameState } from '@sim/state';
import { formatNumber, formatSeconds } from './format';

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
}: {
  index: number;
  plot: Plot;
  state: GameState;
  context: { levels: ReturnType<typeof levelsOf>; season: number; nowSeconds: number };
  canAct: boolean;
}) {
  const surface = surfaceById(plot.surface);
  const step = NEXT_STEP[plot.stage] ?? null;

  if (plot.stage === 'growing') {
    const remaining = Math.max(0, plot.grownAt - state.elapsedSeconds);
    return (
      <div className="plot plot--growing" data-testid={`kg-plot-${index}`} data-stage="growing">
        <span className="generator__name">{surface.name}</span>
        <span className="generator__detail">Growing · {formatSeconds(remaining)}</span>
      </div>
    );
  }

  if (plot.stage === 'grown') {
    const stale = plot.plantedSeason !== state.season;
    const perfect = plot.perfectUntil > state.elapsedSeconds;
    return (
      <button
        type="button"
        className="plot plot--grown"
        onClick={() => gameStore.kitchenGardenClear(index)}
        data-testid={`kg-plot-${index}`}
        data-stage="grown"
      >
        <span className="generator__name">{surface.name}</span>
        <span className="generator__detail">
          {stale ? 'Last Season — replant' : perfect ? 'Perfect Planting ×2' : 'Producing'}
        </span>
      </button>
    );
  }

  const allowed = step !== null && canAct && canPerform(state.kitchenGarden, index, step, context);

  return (
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
  );
}
