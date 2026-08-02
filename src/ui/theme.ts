/**
 * theme.ts — bridges the locked palette (§11) into CSS custom properties.
 *
 * The stylesheet never hard-codes a colour. `src/content/palette.ts` stays the
 * single source of truth, so a palette change - including the human art review
 * still pending on it - propagates without touching CSS.
 */

import { SEASON_KEYS, SEASON_PALETTES, UI_PALETTE, type SeasonKey } from '@content/palette';

export function seasonKeyFor(season: number): SeasonKey {
  return SEASON_KEYS[Math.min(Math.max(season, 1), SEASON_KEYS.length) - 1] ?? 'spring';
}

/** CSS variables for the UI chrome plus the active Season's ramp. */
export function themeVariables(season: number): Record<string, string> {
  const palette = SEASON_PALETTES[seasonKeyFor(season)];
  return {
    '--ui-surface': UI_PALETTE.surface,
    '--ui-surface-raised': UI_PALETTE.surfaceRaised,
    '--ui-text': UI_PALETTE.text,
    '--ui-text-muted': UI_PALETTE.textMuted,
    '--ui-border': UI_PALETTE.border,
    '--ui-positive': UI_PALETTE.positive,
    '--ui-negative': UI_PALETTE.negative,
    '--ui-mana': UI_PALETTE.mana,
    '--ui-insight': UI_PALETTE.insight,
    '--season-primary': palette.primary,
    '--season-secondary': palette.secondary,
    '--season-accent': palette.accent,
    '--season-shadow': palette.shadow,
    '--season-ground': palette.ground,
    '--season-sky': palette.sky,
  };
}

export const SEASON_NAMES: Readonly<Record<number, string>> = {
  1: 'Spring',
  2: 'Summer',
  3: 'Autumn',
  4: 'Winter',
};
