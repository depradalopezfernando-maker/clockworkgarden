import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatRate,
  formatSeconds,
  formatSmall,
} from '@ui/format';

describe('formatNumber', () => {
  it('shows whole numbers below 1000', () => {
    // Early game every single Mana matters; "1.00" reads as broken.
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(42.9)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('switches to suffixes at 1000', () => {
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(1500)).toBe('1.50K');
    expect(formatNumber(15_000)).toBe('15.0K');
    expect(formatNumber(150_000)).toBe('150K');
  });

  it('covers the whole campaign range', () => {
    expect(formatNumber(1e6)).toBe('1.00M');
    expect(formatNumber(1e9)).toBe('1.00B');
    expect(formatNumber(1e12)).toBe('1.00T');
    expect(formatNumber(1e15)).toBe('1.00Qa');
    expect(formatNumber(1e18)).toBe('1.00Qi');
    // Tier 20 costs 2.5e17 - 250 quadrillion - the largest number the campaign
    // displays routinely.
    expect(formatNumber(2.5e17)).toBe('250Qa');
  });

  it('keeps three significant figures, so the HUD width stays stable', () => {
    // A width that changes as digits appear makes the whole panel twitch.
    for (const value of [1.234e6, 12.34e6, 123.4e6, 1.234e9, 9.99e12]) {
      expect(formatNumber(value).replace(/[^\d]/g, '')).toHaveLength(3);
    }
  });

  it('handles the extremes without producing nonsense', () => {
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-1500)).toBe('-1.50K');
    // ADR-0001 puts the campaign peak near 1e44; the endless sandbox may exceed
    // the suffix table, which must degrade to exponential rather than break.
    expect(formatNumber(1e44)).toMatch(/TDc|e/);
    expect(formatNumber(1e60)).toMatch(/e/);
  });
});

describe('formatRate', () => {
  it('labels the unit', () => {
    expect(formatRate(1500)).toBe('1.50K/s');
    expect(formatRate(0)).toBe('0/s');
  });

  it('KEEPS sub-1 precision — a Watering Can makes 0.1/s, not 0/s', () => {
    // Flooring here made a freshly-bought generator look broken in the HUD.
    expect(formatRate(0.1)).toBe('0.1/s');
    expect(formatRate(0.05)).toBe('0.05/s');
    expect(formatRate(1)).toBe('1/s');
  });

  it('trims trailing zeros rather than padding', () => {
    expect(formatSmall(12.5)).toBe('12.5');
    expect(formatSmall(12)).toBe('12');
    expect(formatSmall(550)).toBe('550');
  });

  it('hands off to the suffix formatter above 1000', () => {
    expect(formatSmall(1000)).toBe('1.00K');
    expect(formatSmall(2.6e3)).toBe('2.60K');
  });

  it('never renders a bare minus or NaN', () => {
    expect(formatSmall(-0.5)).toBe('-0.5');
    expect(formatSmall(Infinity)).toBe('∞');
  });
});

describe('formatDuration', () => {
  it('scales its unit with the magnitude', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(90)).toBe('1m');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3600 + 12 * 60)).toBe('1h 12m');
    expect(formatDuration(26 * 3600)).toBe('1d 2h');
    expect(formatDuration(48 * 3600)).toBe('2d');
  });

  it('never renders a negative or non-finite duration', () => {
    expect(formatDuration(-100)).toBe('0s');
    expect(formatDuration(NaN)).toBe('0s');
  });
});

describe('formatSeconds and formatPercent', () => {
  it('shows tenths for short countdowns', () => {
    expect(formatSeconds(12.34)).toBe('12.3s');
    expect(formatSeconds(-1)).toBe('0.0s');
  });

  it('rounds percentages', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.325)).toBe('33%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('rates must not hide the Kitchen Garden', () => {
  // A single Bare Soil plot adds 0.4% of Garden Plot income. With 50 Watering
  // Cans that is 5.00/s -> 5.02/s, and `formatRate` renders BOTH as "5/s".
  // Covering a second and third plot moved nothing on screen, so the garden
  // read as "only one plot produces". The rate readout is not the place to fix
  // that - three significant figures is right for a HUD - so the Kitchen Garden
  // panel states its own contribution instead. This test records WHY.
  it('genuinely cannot distinguish one plot from two at HUD precision', () => {
    expect(formatRate(5.02)).toBe(formatRate(5.04));
  });

  it('and that is why a percentage readout is needed at one decimal', () => {
    // Whole percentages collapse the small end, which is the end that matters:
    // a player's FIRST grown plot is worth 0.4% and would render as "0%" -
    // indistinguishable from having no garden at all.
    expect(Math.round(0.004 * 100)).toBe(Math.round(0));
    // One decimal keeps them distinct.
    expect((0.004 * 100).toFixed(1)).toBe('0.4');
    expect((0.004 * 100).toFixed(1)).not.toBe((0).toFixed(1));
  });
});
