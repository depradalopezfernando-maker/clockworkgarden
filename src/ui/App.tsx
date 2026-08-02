import { useCallback, useMemo, useState } from 'react';
import { gameStore } from '@game/store';
import { costOfNext, isTierUnlocked, totalManaPerSecond, unlockedTiers } from '@sim/economy';
import { CLICKS_TO_FILL, isFrenzyActive } from '@sim/frenzy';
import { prestigeMultiplier } from '@sim/prestige';
import { ownedOf, type GameState } from '@sim/state';
import { GENERATOR_TIERS, tierAt } from '@content/generators';
import { formatDuration, formatNumber, formatRate, formatSeconds } from './format';
import { SEASON_NAMES, themeVariables } from './theme';
import { useGameRuntime, useGameState, useGameStatus } from './useGame';
import './styles.css';

/**
 * Phase 2 shell: HUD, Bell, generator list, Growth Frenzy, offline report.
 * Deliberately plain 2D - the isometric layer is Phase 6.
 */
export function App() {
  useGameRuntime();
  const state = useGameState();
  const status = useGameStatus();
  const [offlineDismissed, setOfflineDismissed] = useState(false);

  const theme = useMemo(() => themeVariables(state.season), [state.season]);
  const perSecond = totalManaPerSecond(state);
  const multiplier = prestigeMultiplier(state.appliedSqp);
  const frenzyActive = isFrenzyActive(state.frenzy);

  const ring = useCallback(() => {
    gameStore.ringBell();
  }, []);

  return (
    <div className="app" style={theme}>
      <section className="panel">
        <Hud
          season={state.season}
          mana={state.mana}
          perSecond={perSecond}
          multiplier={multiplier}
          elapsedSeconds={state.elapsedSeconds}
          prestigeCount={state.prestigeCount}
        />

        <button
          type="button"
          className={frenzyActive ? 'bell bell--frenzy' : 'bell'}
          onClick={ring}
          data-testid="bell"
        >
          {frenzyActive ? 'Growth Frenzy! ×2' : 'Ring the Greenhouse Bell'}
        </button>

        <FrenzyMeter meter={state.frenzy.meter} remainingSeconds={state.frenzy.remainingSeconds} />

        <p className="footnote">
          {frenzyActive
            ? 'All production doubled while the Frenzy lasts.'
            : `Fill the meter with ${CLICKS_TO_FILL} rings to trigger a Growth Frenzy.`}
        </p>
      </section>

      <section className="panel">
        <h2 className="section-title">Garden Plots</h2>
        <GeneratorList state={state} />
      </section>

      {status.offline && !offlineDismissed && (
        <OfflineDialog
          awaySeconds={status.offline.awaySeconds}
          manaEarned={status.offline.manaEarned}
          efficiency={status.offline.averageEfficiency}
          onDismiss={() => setOfflineDismissed(true)}
        />
      )}
    </div>
  );
}

interface HudProps {
  season: number;
  mana: number;
  perSecond: number;
  multiplier: number;
  elapsedSeconds: number;
  prestigeCount: number;
}

function Hud({ season, mana, perSecond, multiplier, elapsedSeconds, prestigeCount }: HudProps) {
  return (
    <header>
      <p className="hud__season">
        Season {season} — {SEASON_NAMES[season] ?? 'Spring'}
      </p>
      <div className="hud__mana" data-testid="mana">
        {formatNumber(mana)}
      </div>
      <div className="hud__rate" data-testid="rate">
        {formatRate(perSecond)} Mana
      </div>

      <div className="hud__stats">
        <span>
          Production <b>×{multiplier.toFixed(2)}</b>
        </span>
        <span>
          Played <b>{formatDuration(elapsedSeconds)}</b>
        </span>
        {prestigeCount > 0 && (
          <span>
            Soil turned <b>{prestigeCount}×</b>
          </span>
        )}
      </div>
    </header>
  );
}

function FrenzyMeter({ meter, remainingSeconds }: { meter: number; remainingSeconds: number }) {
  const active = remainingSeconds > 0;
  const fill = active ? 1 : meter;
  return (
    <div className="meter">
      <div className="meter__label">
        <span>Growth Frenzy</span>
        <span>{active ? formatSeconds(remainingSeconds) : `${Math.round(meter * 100)}%`}</span>
      </div>
      <div
        className="meter__track"
        role="progressbar"
        aria-label="Growth Frenzy meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
      >
        <div
          className={active ? 'meter__fill meter__fill--active' : 'meter__fill'}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
    </div>
  );
}

function GeneratorList({ state }: { state: GameState }) {
  const unlocked = unlockedTiers(state);

  // Show one locked tier ahead so progression is legible - a list that simply
  // ends gives the player no sense that more is coming.
  const nextLocked = GENERATOR_TIERS.find((t) => !isTierUnlocked(state, t.tier))?.tier;
  const visible = nextLocked ? [...unlocked, nextLocked] : unlocked;

  return (
    <div className="generators" data-testid="generators">
      {visible.map((tier) => (
        <GeneratorRow key={tier} tier={tier} state={state} locked={!isTierUnlocked(state, tier)} />
      ))}
    </div>
  );
}

function GeneratorRow({
  tier,
  state,
  locked,
}: {
  tier: number;
  state: GameState;
  locked: boolean;
}) {
  const definition = tierAt(tier);
  const owned = ownedOf(state, tier);
  const cost = costOfNext(tier, owned);
  const affordable = !locked && state.mana >= cost;

  return (
    <button
      type="button"
      className="generator"
      disabled={!affordable}
      onClick={() => gameStore.buy(tier)}
      data-testid={`generator-${tier}`}
      data-owned={owned}
    >
      <span>
        <span className="generator__name">{locked ? '???' : definition.name}</span>
        <span className="generator__detail">
          {locked ? 'Locked' : `${formatRate(definition.baseYield)} each · owned ${owned}`}
        </span>
      </span>
      <span
        className={affordable ? 'generator__cost generator__cost--affordable' : 'generator__cost'}
      >
        <b>{formatNumber(cost)}</b>
        <span className="generator__owned">Mana</span>
      </span>
    </button>
  );
}

function OfflineDialog({
  awaySeconds,
  manaEarned,
  efficiency,
  onDismiss,
}: {
  awaySeconds: number;
  manaEarned: number;
  efficiency: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-title"
    >
      <div className="dialog">
        <h2 id="offline-title">The garden kept growing</h2>
        <p>
          You were away for <b>{formatDuration(awaySeconds)}</b> and earned{' '}
          <b>{formatNumber(manaEarned)}</b> Mana
          {efficiency < 0.999 && ` (at ${Math.round(efficiency * 100)}% efficiency)`}.
        </p>
        <button type="button" className="button" onClick={onDismiss} data-testid="offline-dismiss">
          Back to the garden
        </button>
      </div>
    </div>
  );
}
