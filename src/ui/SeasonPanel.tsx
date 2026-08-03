import { useState } from 'react';
import { gameStore } from '@game/store';
import { capstoneTargetRate, hasDesignedChallenge, isCapstoneReady } from '@sim/capstone';
import { isFrenzyActive } from '@sim/frenzy';
import { canPrestige, prestigeGainFactor, prestigeMultiplier, sqpAvailable } from '@sim/prestige';
import { totalManaPerSecond } from '@sim/economy';
import type { GameState } from '@sim/state';
import { formatNumber, formatRate } from './format';
import { SEASON_NAMES } from './theme';

/**
 * The Season capstone ("First Bloom", D4a) and prestige ("Turn the Soil", §4).
 *
 * Both are moments rather than transactions, so both get room and plain
 * language. Prestige in particular asks before it wipes anything: §4 makes it
 * optional and it must never happen by accident.
 */
export function SeasonPanel({ state }: { state: GameState }) {
  const ready = isCapstoneReady(state);
  const designed = hasDesignedChallenge(state.season);

  return (
    <section className="panel">
      <h2 className="section-title">
        Season {state.season} — {SEASON_NAMES[state.season] ?? 'Spring'}
      </h2>

      {ready && designed ? (
        <Capstone state={state} />
      ) : (
        <p className="footnote" style={{ marginTop: 0 }}>
          {state.capstonesCleared.includes(state.season)
            ? 'This Season is cleared.'
            : 'Keep building. The Season’s capstone opens once the garden is established.'}
        </p>
      )}

      <TurnTheSoil state={state} />
    </section>
  );
}

function Capstone({ state }: { state: GameState }) {
  const target = capstoneTargetRate(state.season);
  const frenzied = isFrenzyActive(state.frenzy);
  const rate = totalManaPerSecond(state) * (frenzied ? 2 : 1);
  const { armed, attemptPeakRate, lastFailed } = state.capstone;
  const progress = Math.min(1, Math.max(attemptPeakRate, armed ? rate : 0) / target);

  return (
    <div className="capstone" data-testid="capstone">
      <p className="capstone__title">First Bloom</p>
      <p className="capstone__flavour">“The garden has never all bloomed at once. Ring for it.”</p>
      <p className="footnote" style={{ marginTop: 0 }}>
        Reach <b>{formatRate(target)}</b> during a single Growth Frenzy.
      </p>

      {armed && (
        <>
          <div className="meter" style={{ marginTop: '0.8rem' }}>
            <div className="meter__label">
              <span>{frenzied ? 'Frenzy — go!' : 'Ring the Bell to start a Frenzy'}</span>
              <span data-testid="capstone-peak">
                {formatNumber(Math.max(attemptPeakRate, armed && frenzied ? rate : 0))}/
                {formatNumber(target)}
              </span>
            </div>
            <div
              className="meter__track"
              role="progressbar"
              aria-label="First Bloom progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className="meter__fill meter__fill--active"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
          <p className="footnote">The attempt ends when the Frenzy does.</p>
        </>
      )}

      {!armed && (
        <>
          {lastFailed && (
            <p className="capstone__failed" data-testid="capstone-failed">
              The bloom faded before it caught.
            </p>
          )}
          <button
            type="button"
            className="button"
            onClick={() => gameStore.armCapstone()}
            data-testid="capstone-arm"
          >
            {lastFailed ? 'Try again' : 'Attempt First Bloom'}
          </button>
        </>
      )}
    </div>
  );
}

function TurnTheSoil({ state }: { state: GameState }) {
  const [confirming, setConfirming] = useState(false);

  if (!canPrestige(state)) {
    return (
      <p className="footnote">
        Turning the Soil unlocks once the first Season is cleared. It is always optional.
      </p>
    );
  }

  const gain = prestigeGainFactor(state);
  const sqp = sqpAvailable(state);
  const worthwhile = sqp > 0;

  return (
    <div className="prestige" data-testid="prestige">
      <p className="capstone__title">Turn the Soil</p>
      <p className="footnote" style={{ marginTop: 0 }}>
        Production would go from <b>×{prestigeMultiplier(state.appliedSqp).toFixed(2)}</b> to{' '}
        <b data-testid="prestige-next">
          ×{(prestigeMultiplier(state.appliedSqp) * gain).toFixed(2)}
        </b>
        {sqp > 0 && ` (+${formatNumber(sqp)} Soil Quality)`}.
      </p>

      {confirming ? (
        <div className="prestige__confirm">
          <p className="footnote" style={{ marginTop: 0 }}>
            <b>Resets:</b> your Mana and every Garden Plot.
            <br />
            <b>Kept:</b> the Kitchen Garden in full, your Insight tree, milestones already earned,
            and Season progress.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              gameStore.turnTheSoil();
              setConfirming(false);
            }}
            data-testid="prestige-confirm"
          >
            Turn the Soil
          </button>{' '}
          <button
            type="button"
            className="tab"
            onClick={() => setConfirming(false)}
            data-testid="prestige-cancel"
          >
            Not yet
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button"
          disabled={!worthwhile}
          onClick={() => setConfirming(true)}
          data-testid="prestige-open"
        >
          {worthwhile ? 'Turn the Soil…' : 'Nothing to gain yet'}
        </button>
      )}
    </div>
  );
}
