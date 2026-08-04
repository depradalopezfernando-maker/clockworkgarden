/**
 * fit.ts — fit D3's prestige coefficient K against §8 and §4's targets.
 *
 * K is the one free parameter in the prestige curve. The formula SHAPE is fixed
 * by decision D3; this finds the coefficient.
 *
 * The sweep is two-dimensional on purpose. K is a DESIGN parameter, but the
 * player's prestige threshold - how strong a boost they demand before accepting
 * a reset - is a BEHAVIOURAL one that no designer controls. Sweeping both
 * answers the question that actually matters: for which K does the design hit
 * its targets across the widest range of player habits? A K that only works if
 * everyone prestiges at exactly x1.6 is not balanced, it is tuned to a guess.
 *
 * Run: npm run fit
 */

import { ARCHETYPES, simulateCampaign } from '@sim/campaign';
import { TARGET_CAMPAIGN_HOURS, TARGET_PRESTIGE_RESETS } from '@content/balance';

const K_VALUES = [60, 70, 80, 85, 90, 95, 100, 110];
const THRESHOLDS = [1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7];

interface Cell {
  readonly hoursOk: boolean;
  readonly resetsOk: boolean;
  readonly allCompleted: boolean;
  readonly hours: readonly number[];
  readonly resets: readonly number[];
}

function evaluate(k: number, threshold: number): Cell {
  const runs = ARCHETYPES.map((a) =>
    simulateCampaign(a, { prestigeCoefficient: k, prestigeThresholdOverride: threshold })
  );
  const hours = runs.map((r) => r.totalHours);
  const resets = runs.map((r) => r.prestigeCount);
  return {
    allCompleted: runs.every((r) => r.completed),
    hoursOk: hours.every((x) => x >= TARGET_CAMPAIGN_HOURS.min && x <= TARGET_CAMPAIGN_HOURS.max),
    resetsOk: resets.every(
      (x) => x >= TARGET_PRESTIGE_RESETS.min && x <= TARGET_PRESTIGE_RESETS.max
    ),
    hours,
    resets,
  };
}

const grid = new Map<string, Cell>();
for (const k of K_VALUES) {
  for (const t of THRESHOLDS) {
    grid.set(`${k}:${t}`, evaluate(k, t));
  }
}

const cell = (k: number, t: number): Cell => {
  const c = grid.get(`${k}:${t}`);
  if (!c) throw new Error(`missing ${k}:${t}`);
  return c;
};

console.log('='.repeat(78));
console.log('FIT: prestige coefficient K vs. player prestige threshold');
console.log('='.repeat(78));
console.log(`Targets: campaign ${TARGET_CAMPAIGN_HOURS.min}-${TARGET_CAMPAIGN_HOURS.max}h AND`);
console.log(
  `         ${TARGET_PRESTIGE_RESETS.min}-${TARGET_PRESTIGE_RESETS.max} resets, for ALL THREE archetypes.\n`
);
console.log('  ##  both targets met      ~~  campaign length only      ..  neither\n');

const header = THRESHOLDS.map((t) => t.toFixed(1).padStart(5)).join('');
console.log(`   K \\ threshold${header}`);
for (const k of K_VALUES) {
  const row = THRESHOLDS.map((t) => {
    const c = cell(k, t);
    if (!c.allCompleted) return '   XX';
    if (c.hoursOk && c.resetsOk) return '   ##';
    if (c.hoursOk) return '   ~~';
    return '   ..';
  }).join('');
  console.log(`   ${String(k).padStart(3)}         ${row}`);
}

// --- Robustness: how many thresholds does each K satisfy? --------------------
console.log(`\n${'='.repeat(78)}`);
console.log('ROBUSTNESS — how many player habits each K works for');
console.log('='.repeat(78));
console.log('   K   both targets   hours only   widest contiguous threshold band');

let bestK = K_VALUES[0] ?? 40;
let bestScore = -1;

for (const k of K_VALUES) {
  const both = THRESHOLDS.filter((t) => cell(k, t).hoursOk && cell(k, t).resetsOk);
  const hoursOnly = THRESHOLDS.filter((t) => cell(k, t).hoursOk);

  // Longest run of consecutive thresholds meeting both targets.
  let run = 0;
  let bestRun = 0;
  let runStart: number | null = null;
  let bestBand: [number, number] | null = null;
  for (const t of THRESHOLDS) {
    const c = cell(k, t);
    if (c.hoursOk && c.resetsOk) {
      if (run === 0) runStart = t;
      run++;
      if (run > bestRun && runStart !== null) {
        bestRun = run;
        bestBand = [runStart, t];
      }
    } else {
      run = 0;
    }
  }

  const band = bestBand ? `${bestBand[0].toFixed(1)} - ${bestBand[1].toFixed(1)}` : 'none';
  console.log(
    `  ${String(k).padStart(2)}   ${String(both.length).padStart(12)}   ${String(hoursOnly.length).padStart(10)}   ${band}`
  );

  // Prefer K values that pass; when nothing passes, prefer the K whose worst
  // archetype sits closest to the target band, so the report still points
  // somewhere useful instead of defaulting to the first entry.
  const violation = Math.min(
    ...THRESHOLDS.map((t) => {
      const c = cell(k, t);
      return c.hours.reduce(
        (acc, x) =>
          acc +
          Math.max(0, TARGET_CAMPAIGN_HOURS.min - x) +
          Math.max(0, x - TARGET_CAMPAIGN_HOURS.max),
        0
      );
    })
  );
  const score = bestRun * 1000 + both.length * 100 - violation;
  if (score > bestScore) {
    bestScore = score;
    bestK = k;
  }
}

// --- Detail on the winner ---------------------------------------------------
console.log(`\n${'='.repeat(78)}`);
console.log(`DETAIL — K = ${bestK}`);
console.log('='.repeat(78));
console.log('  threshold   idle          casual        active        resets (i/c/a)');
for (const t of THRESHOLDS) {
  const c = cell(bestK, t);
  const hours = c.hours.map((x) => `${x.toFixed(2)}h`.padStart(12)).join('  ');
  const flag = c.hoursOk && c.resetsOk ? ' <-- both' : c.hoursOk ? ' <-- hours' : '';
  console.log(`  ${t.toFixed(1).padStart(9)}   ${hours}   ${c.resets.join('/')}${flag}`);
}

// --- Is prestige worth taking at all? ---------------------------------------
// The sweep above shows campaign length rising monotonically with reset count,
// which would mean resetting COSTS time rather than saving it. That contradicts
// §4's promise of "a faster next loop", so it is worth isolating rather than
// inferring: hold everything constant and vary only whether the player resets.
console.log(`\n${'='.repeat(78)}`);
console.log('IS PRESTIGE WORTH TAKING? (same K, only reset behaviour varies)');
console.log('='.repeat(78));
console.log('  A threshold of Infinity means "never reset".\n');
console.log('   K   archetype   never reset   eager (1.4)   reluctant (2.0)   verdict');

for (const k of [30, 50, 80]) {
  for (const a of ARCHETYPES) {
    const never = simulateCampaign(a, {
      prestigeCoefficient: k,
      prestigeThresholdOverride: Number.POSITIVE_INFINITY,
    });
    const eager = simulateCampaign(a, {
      prestigeCoefficient: k,
      prestigeThresholdOverride: 1.4,
    });
    const reluctant = simulateCampaign(a, {
      prestigeCoefficient: k,
      prestigeThresholdOverride: 2.0,
    });
    const best = Math.min(never.totalHours, eager.totalHours, reluctant.totalHours);
    const verdict = best === never.totalHours ? 'NEVER RESET IS FASTEST' : 'resetting helps';
    console.log(
      `  ${String(k).padStart(2)}   ${a.name.padEnd(9)}   ${never.totalHours.toFixed(2).padStart(11)}h   ` +
        `${eager.totalHours.toFixed(2).padStart(11)}h   ${reluctant.totalHours.toFixed(2).padStart(15)}h   ${verdict}`
    );
  }
}

console.log(`\n  If "never reset" wins, §4's prestige is a trap for optimising players`);
console.log('  and the 4-5 natural resets target cannot be reached by tuning K alone.');

console.log(`\n${'='.repeat(78)}`);
console.log(`  Best K for campaign length: ${bestK}`);
console.log('  Set it in src/content/balance.ts and re-run `npm run simulate`.');
