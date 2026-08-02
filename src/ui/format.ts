/**
 * format.ts — number presentation.
 *
 * Mundane and universally underestimated. This game spans 1e0 to ~1e44
 * (ADR-0001), and every one of those numbers has to fit in a HUD without
 * jitter, without lying, and without the player having to count digits.
 */

/**
 * Short-scale suffixes, 1e3 apart. Covers to 1e45; beyond that the formatter
 * falls back to exponential, which the campaign never reaches but the endless
 * sandbox might.
 */
const SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
  'TDc',
] as const;

/**
 * Format Mana and other large quantities.
 *
 * Below 1,000 it shows whole numbers - early game, every single Mana matters and
 * "1.00" where the player expects "1" reads as broken. Above that it switches to
 * three significant figures plus a suffix, which keeps the width stable as the
 * number grows and stops the HUD from twitching.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 0) return `-${formatNumber(-value)}`;
  if (value < 1000) return Math.floor(value).toString();

  const tier = Math.min(Math.floor(Math.log10(value) / 3), SUFFIXES.length - 1);
  const suffix = SUFFIXES[tier];

  if (suffix === undefined || tier >= SUFFIXES.length - 1) {
    if (value >= 1e45) return value.toExponential(2).replace('e+', 'e');
  }

  const scaled = value / Math.pow(1000, tier);
  // Three significant figures: 999 -> "999", 99.9 -> "99.9", 9.99 -> "9.99".
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(decimals)}${suffix ?? ''}`;
}

/**
 * Rates need precision that Mana totals do not.
 *
 * `formatNumber` floors below 1000, which is right for a Mana counter - "1.00"
 * where the player expects "1" reads as broken. It is WRONG for rates: a
 * Watering Can produces 0.1/s and floors to "0/s", making the game look
 * broken to a player who just bought one. Below 1000, rates keep up to two
 * decimals and trim trailing zeros.
 */
export function formatRate(value: number): string {
  return `${formatSmall(value)}/s`;
}

/** Below 1000: up to two decimals, trailing zeros trimmed. Above: suffixed. */
export function formatSmall(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 0) return `-${formatSmall(-value)}`;
  if (value === 0) return '0';
  if (value >= 1000) return formatNumber(value);

  const decimals = value < 1 ? 2 : value < 100 ? 1 : 0;
  const text = value.toFixed(decimals);
  // Only trim INSIDE a decimal fraction. Trimming unconditionally turns 550
  // into 55, which is not a formatting nit - it is a wrong number.
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** Compact duration for offline reports and timers: "3h 12m", "45s". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const total = Math.floor(seconds);
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  if (hours < 24) return remainderMinutes > 0 ? `${hours}h ${remainderMinutes}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours > 0 ? `${days}d ${remainderHours}h` : `${days}d`;
}

/** Seconds with one decimal, for countdowns short enough that tenths matter. */
export function formatSeconds(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
