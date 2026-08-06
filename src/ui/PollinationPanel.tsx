import { useCallback, useEffect, useRef, useState } from 'react';
import { gameStore } from '@game/store';
import {
  FLOWERS,
  activeBloom,
  isPollinationUnlocked,
  type FlowerType,
  type PollinationTier,
} from '@sim/pollination';
import { POLLINATION_CHAIN_WINDOW_SECONDS, POLLINATION_TIERS } from '@content/balance';
import { effectsOf } from '@sim/insight';
import type { GameState } from '@sim/state';
import { formatSeconds } from './format';

/**
 * §6.1 Pollination Combo — three flowers, a chain, and the Blooms it earns.
 *
 * Sits directly under the Bell because §6.1 puts the flowers "near the Bell",
 * and because the two are meant to be played TOGETHER: a Golden Bloom during a
 * Frenzy is the Season's peak moment, and a player cannot discover that if the
 * two controls live in different panels.
 *
 * The chain meter shows the WINDOW, not the chain length. The length is a
 * number the player can read at a glance; what they cannot feel is how much of
 * their three seconds is left, and that is the thing every miss comes down to.
 */
export function PollinationPanel({ state }: { state: GameState }) {
  const [landed, setLanded] = useState<PollinationTier | null>(null);
  const clearAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const click = useCallback((flower: FlowerType) => {
    const bloom = gameStore.pollinate(flower);
    if (!bloom) return;
    setLanded(bloom);
    if (clearAt.current) clearTimeout(clearAt.current);
    clearAt.current = setTimeout(() => setLanded(null), 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (clearAt.current) clearTimeout(clearAt.current);
    };
  }, []);

  if (!isPollinationUnlocked(state.season)) return null;

  const p = state.pollination;
  const bloom = activeBloom(p);
  const window = POLLINATION_CHAIN_WINDOW_SECONDS + effectsOf(state).pollinationWindowSeconds;
  const fill = window > 0 ? Math.min(1, p.windowRemaining / window) : 0;
  const nextTier = POLLINATION_TIERS.find((tier) => tier.chain > p.chain);

  return (
    <div className="pollination" data-testid="pollination">
      <div className="meter">
        <div className="meter__label">
          <span>
            Pollination chain <b data-testid="pollination-chain">{p.chain}</b>
            {p.driver === 'drone' && p.chain > 0 && ' · drones'}
          </span>
          <span>
            {bloom
              ? `${bloom.name} ${formatSeconds(p.bloomRemaining)}`
              : nextTier
                ? `${nextTier.name} at ${nextTier.chain}`
                : ''}
          </span>
        </div>
        <div
          className="meter__track"
          role="progressbar"
          aria-label="Pollination chain window"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill * 100)}
        >
          <div
            className={bloom ? 'meter__fill meter__fill--active' : 'meter__fill'}
            style={{ width: `${fill * 100}%` }}
          />
        </div>
      </div>

      <div className="flowers">
        {FLOWERS.map((flower) => (
          <button
            key={flower}
            type="button"
            // The flower that landed the last link is the one that BREAKS the
            // chain. Marking it is the whole teaching surface for the mechanic:
            // §6.1 rewards variety, and a player who cannot see what they just
            // pressed is being asked to hold the pattern in their head instead.
            className={p.lastFlower === flower ? 'flower flower--spent' : 'flower'}
            onClick={() => click(flower)}
            data-testid={`flower-${flower}`}
          >
            <span className="flower__glyph" aria-hidden="true">
              {FLOWER_GLYPHS[flower]}
            </span>
            <span className="flower__name">{FLOWER_NAMES[flower]}</span>
          </button>
        ))}
      </div>

      <p className="footnote" data-testid="pollination-hint">
        {landed
          ? `${landed.name}! ×${(1 + landed.bonus).toFixed(2)} Mana${landed.seeds > 0 ? `, +${landed.seeds} Seed` : ''}`
          : bloom
            ? `${bloom.name} — ×${(1 + bloom.bonus).toFixed(2)} Mana, and it stacks with a Frenzy.`
            : `Click a DIFFERENT flower each time, within ${window} seconds, to build a chain.`}
      </p>
    </div>
  );
}

/**
 * Text glyphs, not icons.
 *
 * The game-icons.net set is in the project (Phase 6) but nothing in the UI draws
 * from it yet, and shipping this panel behind an icon pipeline would hold up the
 * mechanic for a presentation decision. Swapping these for real icons is a
 * localised change to this table.
 */
const FLOWER_GLYPHS: Readonly<Record<FlowerType, string>> = {
  sunflower: '✿',
  lavender: '❦',
  poppy: '❁',
};

const FLOWER_NAMES: Readonly<Record<FlowerType, string>> = {
  sunflower: 'Sunflower',
  lavender: 'Lavender',
  poppy: 'Poppy',
};
