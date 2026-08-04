# ADR-0002 — `src/sim` is pure, and lint enforces it

**Status:** Accepted · **Date:** 2026-08-02 · **Phase:** 0

## Context

The whole tuning strategy for this project rests on being able to run the economy
forward _without a browser_. Nine of the ten open playtest questions in the design
spec's §10 — campaign length, prestige cadence, whether the Kitchen Garden's yield
share is meaningful — are answerable by simulation alone, in milliseconds, swept
across thousands of parameter combinations.

That capability is fragile. It survives only as long as no one imports React "just
for a type", reads `localStorage` "just to check", or calls `Date.now()` "just
here". Each of those individually looks harmless; collectively they make the
simulation unrunnable and the tuning strategy collapses back to playing the game
by hand.

Conventions documented in a README do not survive a year of sessions.

## Decision

`src/sim` is pure, deterministic, and Node-runnable. It must not:

- import from `game/`, `ui/`, or `render/`
- import React or Three.js
- touch `window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `fetch`
- call `Math.random()` or `Date.now()` — randomness comes from a seeded RNG passed
  in, and time arrives as a parameter

This is enforced by `no-restricted-imports`, `no-restricted-globals`, and
`no-restricted-properties` rules scoped to `src/sim/**` in `eslint.config.js`.

`src/content` is data only and may not import from any layer.

**The lint rules are themselves tested.** `tests/architecture/boundary.test.ts`
runs ESLint against synthetic violations and asserts it complains — because a lint
rule nobody verifies is a lint rule that silently stops working.

## Consequences

**Good:**

- The balance harness (Phase 1) and every invariant test stay possible.
- Determinism means sims are reproducible and bugs are replayable from a seed.
- The sim layer is trivially unit-testable with no mocking.

**Bad / accepted:**

- Threading time and RNG through function signatures is more verbose than reading
  the clock directly. This is the cost, and it is worth paying.
- Some genuinely convenient shortcuts are unavailable in `src/sim`. When one is
  needed, it belongs in `src/game` — that is what the layer is for.

## Revisit if

Never, ideally. If a rule blocks something legitimate, move the code to
`src/game` rather than weakening the boundary.
