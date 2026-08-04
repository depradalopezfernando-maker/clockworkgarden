# `src/sim` — the pure simulation layer

Empty until Phase 1. This directory holds the game's economy as **pure,
deterministic, Node-runnable TypeScript**.

It must not import from `game/`, `ui/`, or `render/`; must not import React or
Three.js; must not touch the DOM; and must not call `Math.random()` or
`Date.now()` — randomness comes from a seeded RNG passed in, time arrives as a
parameter.

This is enforced by ESLint (`eslint.config.js`) and the rules are themselves
verified by `tests/architecture/boundary.test.ts`.

Rationale: **ADR-0002**. The short version is that the entire balance-tuning
strategy depends on running the economy forward without a browser, and that
capability survives only as long as this boundary holds.
