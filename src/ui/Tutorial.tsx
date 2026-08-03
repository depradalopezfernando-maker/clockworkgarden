import { isCapstoneReady } from '@sim/capstone';
import { CLICKS_TO_FILL } from '@sim/frenzy';
import { ownedOf, type GameState } from '@sim/state';
import { INSIGHT_TREE } from '@content/insightTree';

/**
 * §8's first fifteen minutes: "Tutorial, first generator, Frenzy intro".
 *
 * Every step is DERIVED from game state rather than stored, so onboarding needs
 * no save field, no migration, and cannot desynchronise from what the player has
 * actually done. A returning player sees the step that matches their save.
 *
 * One line at a time, no modals, nothing to dismiss. An incremental game that
 * opens with a wall of instructions has already lost.
 */
interface Step {
  readonly id: string;
  readonly done: (s: GameState) => boolean;
  readonly hint: string;
}

const STEPS: readonly Step[] = [
  {
    id: 'ring',
    done: (s) => s.lifetimeMana > 0,
    hint: 'Ring the Greenhouse Bell to gather your first Mana.',
  },
  {
    id: 'buy',
    done: (s) => ownedOf(s, 1) >= 1,
    hint: 'Buy a Watering Can. It gathers Mana for you, without clicking.',
  },
  {
    id: 'frenzy',
    done: (s) => s.frenzy.remainingSeconds > 0 || s.frenzy.meter > 0.5 || ownedOf(s, 2) >= 1,
    hint: `Keep ringing — ${CLICKS_TO_FILL} rings fills the meter and doubles everything for a while.`,
  },
  {
    id: 'insight',
    done: (s) => s.purchasedNodes.length > 0,
    hint: 'You have earned Insight from a milestone. Spend it on the tree — it never comes from Mana.',
  },
  {
    id: 'garden',
    done: (s) => s.kitchenGarden.plots.some((p) => p.stage !== 'bare'),
    hint: 'Try the Kitchen Garden: Dig, Plant, then Cover. All three quickly earns a Perfect Planting.',
  },
  {
    id: 'capstone',
    done: (s) => s.capstonesCleared.length > 0 || !isCapstoneReady(s),
    hint: 'The Season’s capstone is ready. Attempt First Bloom when you are.',
  },
];

/** The first step the player has not completed, or null once they are all done. */
export function currentStep(state: GameState): Step | null {
  // Insight guidance only makes sense once there is something to spend it on.
  const affordableNode = INSIGHT_TREE.some(
    (n) => n.season <= state.season && n.requires.length === 0 && state.insight >= n.cost
  );

  for (const step of STEPS) {
    if (step.id === 'insight' && !affordableNode) continue;
    if (!step.done(state)) return step;
  }
  return null;
}

export function Tutorial({ state }: { state: GameState }) {
  const step = currentStep(state);
  if (!step) return null;

  return (
    <p className="tutorial" data-testid="tutorial" data-step={step.id}>
      {step.hint}
    </p>
  );
}
