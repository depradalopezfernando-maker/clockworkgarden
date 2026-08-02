# ADR-0001 — Use plain `number`; no big-number library

**Status:** Accepted · **Date:** 2026-08-02 · **Phase:** 0

## Context

Incremental games reflexively reach for `break_infinity.js` or `decimal.js`,
because the genre routinely exceeds float64. _Clockwork Garden_ displays numbers
up to 250 quadrillion (2.5e17) in its tier table alone, which is past
`Number.MAX_SAFE_INTEGER` (9.007e15) — so the reflex looks justified here.

It is not. `tools/spec-audit.mjs` (audit 5) measured the actual worst case across
the whole campaign: 400 units of Tier 20 at a 1.12 cost multiplier, multiplied by
a generous prestige bonus. That lands at **~1e44**, against float64's ceiling of
**1.8e308** — about 14% of the available exponent range, with roughly 264 orders
of magnitude of headroom.

The game is _bounded_. It ends after Season 4. That is precisely why the usual
argument does not apply: there is no endless inflation to outrun.

## Decision

All game quantities are plain JavaScript `number`. No big-number dependency.

## Consequences

**Good:**

- One fewer dependency, and a notable one — big-number libraries are a common
  source of serialization bugs and subtle precision surprises.
- The tick loop is meaningfully faster; arithmetic stays on the JS fast path.
- Save files hold plain JSON numbers with no custom (de)serializer.
- `src/sim` stays trivially portable and readable.

**Bad / accepted:**

- Values above `MAX_SAFE_INTEGER` lose integer exactness. **Nothing may assume
  integer round-tripping** — never compare Mana totals with `===`, never assume a
  saved value reloads bit-identical. Irrelevant to gameplay (no player can
  perceive the low-order digits of 1e17) but load-bearing for save tests, which
  must compare with a relative tolerance.
- If the endless sandbox mode (Phase 10) were ever allowed to run unbounded for
  days, it could approach the ceiling. **Mitigation:** the sandbox must apply a
  soft cap or the ending must remain terminal. Revisit this ADR if endless mode
  grows beyond a victory lap.

## Revisit if

Endless mode becomes a first-class, long-running feature, or a future tier table
raises peak magnitude past ~1e250.
