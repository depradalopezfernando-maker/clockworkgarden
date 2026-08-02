# Architecture Decision Records

Load-bearing technical decisions, with the reasoning that produced them. Written
so a future session can tell whether a constraint still applies — every ADR ends
with a "revisit if" clause naming the conditions that would reopen it.

| ADR                                    | Decision                                         | Status   |
| -------------------------------------- | ------------------------------------------------ | -------- |
| [0001](0001-plain-number-no-bignum.md) | Plain `number`; no big-number library            | Accepted |
| [0002](0002-sim-purity-boundary.md)    | `src/sim` is pure, enforced by lint and tested   | Accepted |
| [0003](0003-state-outside-react.md)    | Game state lives outside React; no state library | Accepted |
| [0004](0004-versioned-saves.md)        | Saves versioned from v1, migrations tested       | Accepted |

**Design** decisions — what the game _is_ — live in
[`../04-spec-open-questions.md`](../04-spec-open-questions.md) instead. The split
is deliberate: ADRs here are reversible engineering calls, D1–D6 there are the
designer's calls and override the spec.
