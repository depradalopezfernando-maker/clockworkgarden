# ADR-0004 — Saves are versioned from v1, with tested migrations

**Status:** Accepted · **Date:** 2026-08-02 · **Phase:** 0 (implemented Phase 2)

## Context

The design spec never mentions saving (recorded as open question 9 in
`docs/04-spec-open-questions.md`). But this is a 6–10 hour single-player game with
offline progress: the save file _is_ the player's investment.

The failure mode is well known and expensive. Ship v1 without a version field,
gather playtesters, then change the shape of `GameState` in Phase 4 — and every
tester either loses hours of progress or you write a fragile shape-sniffing
migration under time pressure. Retrofitting versioning always costs more than
adding it at the start, and the cost lands at the worst moment.

## Decision

```ts
interface SaveFile {
  version: number; // integer, monotonic, starts at 1
  savedAt: number; // epoch ms — offline progress depends on it
  state: GameState;
}
```

- **Every save carries a version from the very first one.**
- Migrations form a chain: `v1 -> v2 -> v3`, each a pure function, applied in
  sequence. Loading a v1 save into a v4 build runs three migrations.
- **Each version ships with a frozen fixture** of that format in
  `tests/fixtures/saves/`, and a test that migrates it to current and asserts the
  result. Fixtures are never edited after the fact — that is the whole point.
- Autosave every 10s and on `visibilitychange`.
- Export/import as base64, so playtesters can hand over broken states and receive
  repro states.
- **Clock-skew guard:** if `savedAt` is in the future, grant zero offline
  progress rather than a negative or enormous amount.
- **Unknown future version:** refuse to load and surface a clear message, rather
  than silently corrupting a newer save with an older build.

## No anti-tamper

Single-player, one-time purchase, no leaderboards, no IAP, no competitive surface.
Obfuscating or signing the save would cost real effort, break export/import as a
support tool, and protect nothing that matters. A player who edits their save is
choosing their own experience in a game they own.

Confirmed as open question 9 in `docs/04-spec-open-questions.md`; pending the
designer's explicit sign-off, but no code depends on the answer being "none"
except the absence of an obfuscation layer.

## Consequences

**Good:**

- Save format can evolve freely through Phases 3–9 without stranding testers.
- Migration bugs surface in CI against real frozen fixtures, not in the wild.
- Export/import doubles as the primary bug-report mechanism.

**Bad / accepted:**

- Every `GameState` shape change needs a migration and a fixture. This is the
  cost, and it is small when paid per change and large when deferred.
- Fixtures accumulate. Twenty versions means twenty fixtures — cheap, they are
  small JSON files, and they are the only real proof migrations work.

## Revisit if

The game gains a competitive or social surface, which would change the anti-tamper
calculation entirely.
