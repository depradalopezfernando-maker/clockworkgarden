#!/usr/bin/env node
/**
 * spec-audit.mjs — static numerical audit of clockwork-garden-design-spec.md
 *
 * This is an ANALYSIS tool, not game code. It evaluates the formulas the spec
 * states (§2, §4, §6.2, §2a) against the tier table the spec states, and reports
 * where they disagree with each other. Findings feed docs/04-spec-open-questions.md.
 *
 * Run: node tools/spec-audit.mjs
 */

// ---------------------------------------------------------------------------
// §2 — generator table, transcribed verbatim from the spec.
// ---------------------------------------------------------------------------
const TIERS = [
  { t: 1, season: 1, name: 'Watering Can', cost: 15, mult: 1.1, yield: 0.1 },
  { t: 2, season: 1, name: 'Sprout Bed', cost: 150, mult: 1.1, yield: 1 },
  { t: 3, season: 1, name: 'Butterfly Swarm', cost: 1.2e3, mult: 1.11, yield: 8 },
  { t: 4, season: 1, name: 'Garden Gnome Crew', cost: 9e3, mult: 1.11, yield: 55 },
  { t: 5, season: 1, name: 'Sunbeam Lattice', cost: 6.5e4, mult: 1.12, yield: 380 },
  { t: 6, season: 2, name: 'Beehive Outpost', cost: 4.5e5, mult: 1.1, yield: 2.6e3 },
  { t: 7, season: 2, name: 'Sunflower Field', cost: 3.2e6, mult: 1.1, yield: 1.8e4 },
  { t: 8, season: 2, name: 'Pollinator Drone Swarm', cost: 2.2e7, mult: 1.11, yield: 1.25e5 },
  { t: 9, season: 2, name: 'Nectar Refinery', cost: 1.5e8, mult: 1.11, yield: 8.5e5 },
  { t: 10, season: 2, name: 'Solar Bloom Array', cost: 1e9, mult: 1.12, yield: 5.8e6 },
  { t: 11, season: 3, name: 'Harvest Cart Brigade', cost: 7e9, mult: 1.1, yield: 4e7 },
  { t: 12, season: 3, name: 'Grain Silo Complex', cost: 4.8e10, mult: 1.1, yield: 2.75e8 },
  { t: 13, season: 3, name: 'Cider Press Guild', cost: 3.3e11, mult: 1.11, yield: 1.9e9 },
  { t: 14, season: 3, name: 'Scarecrow Sentinel Network', cost: 2.3e12, mult: 1.11, yield: 1.3e10 },
  { t: 15, season: 3, name: 'Harvest Moon Shrine', cost: 1.6e13, mult: 1.12, yield: 9e10 },
  { t: 16, season: 4, name: 'Frost Lantern Ring', cost: 1.1e14, mult: 1.1, yield: 6.2e11 },
  { t: 17, season: 4, name: 'Insulated Greenhouse Wing', cost: 7.5e14, mult: 1.1, yield: 4.3e12 },
  { t: 18, season: 4, name: 'Ember Furnace Core', cost: 5.2e15, mult: 1.11, yield: 2.9e13 },
  { t: 19, season: 4, name: 'Aurora Conduit', cost: 3.6e16, mult: 1.11, yield: 2e14 },
  { t: 20, season: 4, name: 'The Clockwork Heart', cost: 2.5e17, mult: 1.12, yield: 1.4e15 },
];

const fmt = (n) => n.toExponential(2);
const bar = (s) => console.log(`\n${'='.repeat(78)}\n${s}\n${'='.repeat(78)}`);

// Geometric sum: cost to buy `k` units of a tier starting from 0 owned.
const bulkCost = (base, mult, k) => (base * (Math.pow(mult, k) - 1)) / (mult - 1);

// ---------------------------------------------------------------------------
// AUDIT 1 — cost/yield ratio drift. Spec §2 claims ~7-10x per tier for both.
// ---------------------------------------------------------------------------
bar('AUDIT 1 — Tier-to-tier scaling (spec §2 claims "roughly 7-10x" for both)');
console.log('tier  costRatio  yieldRatio   payback(s)  outsideClaimedBand');
let driftCount = 0;
for (let i = 0; i < TIERS.length; i++) {
  const c = TIERS[i];
  const p = TIERS[i - 1];
  const cr = p ? c.cost / p.cost : NaN;
  const yr = p ? c.yield / p.yield : NaN;
  const payback = c.cost / c.yield; // seconds for one unit to repay itself
  const bad = p && (cr < 6.5 || cr > 10.5 || yr < 6.5 || yr > 10.5);
  if (bad) driftCount++;
  console.log(
    String(c.t).padStart(4),
    (p ? cr.toFixed(2) : '  -').padStart(9),
    (p ? yr.toFixed(2) : '  -').padStart(11),
    payback.toFixed(0).padStart(11),
    bad ? '   <-- OUT OF BAND' : ''
  );
}
console.log(`\n  tiers outside the claimed 7-10x band: ${driftCount}`);
console.log('  NOTE: payback time (cost/yield) is the number that actually governs pacing.');
console.log('  A flat payback across tiers means every tier "feels" the same to buy.');

// ---------------------------------------------------------------------------
// AUDIT 2 — §6.2 Barn Capacity vs. next-tier cost.
// Spec: "Barn Capacity (a large number, e.g. 500x current best generator's
// per-second output)". Two readings; test both.
// ---------------------------------------------------------------------------
bar('AUDIT 2 — §6.2 Barn Capacity vs. cost of the NEXT tier (Seasons 3-4)');
console.log('Reading A: cap = 500 x (per-UNIT yield of best generator owned)');
console.log('Reading B: cap = 500 x (TOTAL mana/sec), assuming 25 units of best tier owned\n');
console.log('bestTier -> nextTier   capA        capB        nextCost    A_blocks  B_blocks');
let blocksA = 0,
  blocksB = 0;
for (let i = 10; i < TIERS.length - 1; i++) {
  // Season 3 onward (index 10 = tier 11)
  const best = TIERS[i];
  const next = TIERS[i + 1];
  const capA = 500 * best.yield;
  const capB = 500 * best.yield * 25;
  const aBlocks = capA < next.cost;
  const bBlocks = capB < next.cost;
  if (aBlocks) blocksA++;
  if (bBlocks) blocksB++;
  console.log(
    `T${String(best.t).padStart(2)} -> T${String(next.t).padStart(2)}`.padStart(14),
    fmt(capA).padStart(11),
    fmt(capB).padStart(11),
    fmt(next.cost).padStart(11),
    (aBlocks ? 'BLOCKED' : '  ok').padStart(9),
    (bBlocks ? 'BLOCKED' : '  ok').padStart(9)
  );
}
console.log(`\n  Reading A blocks ${blocksA} of 9 tier purchases -> progression deadlock.`);
console.log(`  Reading B blocks ${blocksB} of 9 -> playable.`);
console.log('  => The spec must state which reading is intended. Reading A is unshippable.');

// ---------------------------------------------------------------------------
// AUDIT 3 — §4 prestige curve shape across the campaign.
// SQP = floor(sqrt(LifetimeMana / 1e6)); PrestigeMult = 1 + 0.02*TotalSQP
// Estimate lifetime mana at each Season's end as ~10x the cost of buying 25
// units of that Season's capstone tier (a deliberately rough but consistent proxy).
// ---------------------------------------------------------------------------
bar('AUDIT 4 — §4 prestige reward curve (is the first prestige worth doing?)');
const seasonEnd = [5, 10, 15, 20];
console.log('season  est.lifetimeMana   SQP          PrestigeMult');
let cumulative = 0;
for (const t of seasonEnd) {
  const tier = TIERS[t - 1];
  const lifetime = 10 * bulkCost(tier.cost, tier.mult, 25);
  const sqp = Math.floor(Math.sqrt(lifetime / 1e6));
  cumulative += sqp;
  const mult = 1 + 0.02 * cumulative;
  console.log(
    String(tier.season).padStart(6),
    fmt(lifetime).padStart(18),
    fmt(sqp).padStart(11),
    ('x' + mult.toExponential(2)).padStart(16)
  );
}
console.log('\n  The first prestige (end of Season 1) is the one the spec unlocks first.');
console.log('  If its multiplier is ~1.0x, players learn "prestige does nothing" and stop.');

// ---------------------------------------------------------------------------
// AUDIT 4 — §2a Kitchen Garden feedback loop.
// PlotContribution = BaseFraction(1%) x mods x CurrentTotalManaPerSec
// If "CurrentTotalManaPerSec" includes Kitchen Garden output, this is recursive.
// ---------------------------------------------------------------------------
bar('AUDIT 3 — §2a Kitchen Garden self-reference (1% of "CurrentTotalManaPerSec")');
const scenarios = [
  { label: 'S1: 4 Bare Soil plots, 1 plant each', slots: 4, cap: 1, yieldMult: 1.0 },
  { label: 'S2: 10 Raised Garden Box, 3 plants each', slots: 10, cap: 3, yieldMult: 1.0 },
  { label: 'S4: 20 Clockwork Trellis, 5 plants, 1.2x yield', slots: 20, cap: 5, yieldMult: 1.2 },
];
console.log('scenario                                        totalFraction  recursive?');
for (const s of scenarios) {
  const frac = 0.01 * s.slots * s.cap * s.yieldMult;
  const diverges = frac >= 1.0;
  console.log(
    s.label.padEnd(46),
    (frac * 100).toFixed(0).padStart(12) + '%',
    diverges ? '  DIVERGES (infinite loop)' : '  converges, but still self-amplifying'
  );
}
console.log('\n  At 20 Clockwork Trellis slots the Kitchen Garden claims >=100% of total');
console.log('  mana/sec. If that total includes its own output, production is unbounded.');
console.log('  => "CurrentTotalManaPerSec" must be defined as GARDEN PLOT output only.');

// ---------------------------------------------------------------------------
// AUDIT 5 — numeric range: does this need a big-number library?
// ---------------------------------------------------------------------------
bar('AUDIT 5 — Peak magnitudes vs. float64 (do we need break_infinity.js?)');
const t20 = TIERS[19];
for (const owned of [50, 100, 200, 400]) {
  const c = bulkCost(t20.cost, t20.mult, owned);
  console.log(`  cost to own ${String(owned).padStart(3)}x Tier 20:`.padEnd(34), fmt(c));
}
const worst = bulkCost(t20.cost, t20.mult, 400) * 1e6; // x generous prestige multiplier
console.log('  worst-case lifetime mana (x1e6 prestige):'.padEnd(34), fmt(worst));
console.log('\n  Number.MAX_SAFE_INTEGER:'.padEnd(35), fmt(Number.MAX_SAFE_INTEGER));
console.log('  Number.MAX_VALUE:'.padEnd(35), fmt(Number.MAX_VALUE));
console.log(
  `\n  Verdict: peak ~${fmt(worst)} is ${((Math.log10(worst) / Math.log10(Number.MAX_VALUE)) * 100).toFixed(1)}% of float64's exponent range.`
);
console.log('  Plain JS `number` is sufficient. NO big-number library required.');
console.log('  (Values exceed MAX_SAFE_INTEGER, so integer exactness is lost - irrelevant');
console.log('   for display, but save files must never assume integer round-tripping.)');

// ---------------------------------------------------------------------------
// AUDIT 6 — §2a slot cost sanity.
// SlotCost(n) = 3 x (Season Tier-1 cost) x 1.15^(n-5), n = 5..20
// ---------------------------------------------------------------------------
bar('AUDIT 6 — §2a Kitchen Garden slot costs vs. Season income');
const seasonTier1 = { 1: TIERS[0], 2: TIERS[5], 3: TIERS[10], 4: TIERS[15] };
console.log("slot n   season   slotCost     as multiple of that Season's Tier-1 cost");
for (const n of [5, 8, 12, 16, 20]) {
  const season = n <= 7 ? 1 : n <= 11 ? 2 : n <= 15 ? 3 : 4;
  const base = seasonTier1[season].cost;
  const cost = 3 * base * Math.pow(1.15, n - 5);
  console.log(
    String(n).padStart(6),
    String(season).padStart(9),
    fmt(cost).padStart(12),
    ('x' + (cost / base).toFixed(1)).padStart(12)
  );
}
console.log(
  '\n  Slot 20 costs ~%sx a Season-4 Tier-1 generator - trivially affordable',
  (3 * Math.pow(1.15, 15)).toFixed(0)
);
console.log('  by the time it unlocks. The 1.15 curve is too shallow to be a real');
console.log('  decision; slot cost is effectively free late. Consider re-anchoring.');

bar('END OF AUDIT');
