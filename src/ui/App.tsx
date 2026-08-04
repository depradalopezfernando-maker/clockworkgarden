import { useCallback, useMemo, useState } from 'react';
import { gameStore } from '@game/store';
import {
  costOfNext,
  isTierUnlocked,
  perUnitManaPerSecond,
  totalManaPerSecond,
  unlockedTiers,
} from '@sim/economy';
import { CLICKS_TO_FILL, frenzyMultiplier, isFrenzyActive } from '@sim/frenzy';
import { prestigeMultiplier } from '@sim/prestige';
import { ownedOf, type GameState } from '@sim/state';
import { GENERATOR_TIERS, tierAt, type UnlockGate } from '@content/generators';
import { formatDuration, formatNumber, formatRate, formatSeconds } from './format';
import { SEASON_NAMES, themeVariables } from './theme';
import { InsightPanel } from './InsightPanel';
import { GardenCanvas } from './GardenCanvas';
import { KitchenGardenPanel } from './KitchenGardenPanel';
import { SeasonPanel } from './SeasonPanel';
import { Tutorial } from './Tutorial';
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
  const multiplier = prestigeMultiplier(state.appliedSqp);
  const frenzyActive = isFrenzyActive(state.frenzy);
  // The rate the player is ACTUALLY earning, Frenzy included. Reading
  // `totalManaPerSecond` alone showed the un-frenzied rate while Mana visibly
  // climbed at twice it, which reads as the counter being broken - and hides
  // the whole point of the Frenzy.
  const perSecond = totalManaPerSecond(state) * frenzyMultiplier(state.frenzy);

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
          frenzyActive={frenzyActive}
          multiplier={multiplier}
          elapsedSeconds={state.elapsedSeconds}
          prestigeCount={state.prestigeCount}
          insight={state.insight}
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

        <Tutorial state={state} />

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

      {/* Season and Insight share a column: both are short, and left as
          separate grid children they pushed Insight onto its own row and left
          two thirds of the viewport empty. */}
      <div className="column">
        <SeasonPanel state={state} />
        <InsightPanel state={state} />
      </div>

      {/* The diorama spans the full width above the Kitchen Garden: it is the
          view OF the garden, so it reads as the thing the panels describe
          rather than as one panel among them. */}
      <section className="panel panel--wide panel--diorama">
        <GardenCanvas state={state} />
      </section>

      <KitchenGardenPanel state={state} />

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
  frenzyActive: boolean;
  multiplier: number;
  elapsedSeconds: number;
  prestigeCount: number;
  insight: number;
}

function Hud({
  season,
  mana,
  perSecond,
  frenzyActive,
  multiplier,
  elapsedSeconds,
  prestigeCount,
  insight,
}: HudProps) {
  return (
    <header>
      <p className="hud__season">
        Season {season} — {SEASON_NAMES[season] ?? 'Spring'}
      </p>
      <div className="hud__mana" data-testid="mana">
        {formatNumber(mana)}
      </div>
      <div
        className={frenzyActive ? 'hud__rate hud__rate--frenzy' : 'hud__rate'}
        data-testid="rate"
      >
        {formatRate(perSecond)} Mana{frenzyActive ? ' · Frenzy ×2' : ''}
      </div>

      <div className="hud__stats">
        <span>
          Production <b>×{multiplier.toFixed(2)}</b>
        </span>
        <span>
          Played <b>{formatDuration(elapsedSeconds)}</b>
        </span>
        <span>
          Insight <b data-testid="hud-insight">{insight}</b>
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

/**
 * What a locked tier is waiting for, in words.
 *
 * Worth stating now that gates are legible things a player can act on. They used
 * to be Insight nodes, where "Locked" was about all that could honestly be said;
 * "Own 10 Sprout Beds" is a goal.
 */
function describeGate(gate: UnlockGate): string {
  switch (gate.kind) {
    case 'own-count':
      return `Own ${gate.count} ${tierAt(gate.tier).name}s`;
    case 'lifetime-mana':
      return `Earn ${formatNumber(gate.amount)} Mana in total`;
    case 'any':
      return gate.gates.map(describeGate).join(' or ');
    case 'capstone-clear':
      return `Clear the Season ${gate.season} capstone`;
    case 'season-start':
      return `Reach Season ${gate.season}`;
    case 'start':
      return 'Available';
  }
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
          {locked
            ? describeGate(definition.unlock)
            : `${formatRate(perUnitManaPerSecond(state, tier))} each · owned ${owned}`}
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
