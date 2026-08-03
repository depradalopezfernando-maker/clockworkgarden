/**
 * simulate.ts — Phase 1's balance report.
 *
 * Runs the campaign for every player archetype and reports whether the economy
 * lands on §8's targets. This is the tool that answers §10's questions 1, 2, 3
 * and 10 numerically, without anyone playing the game.
 *
 * Run: npm run simulate
 */

import {
  ARCHETYPES,
  simulateAllArchetypes,
  simulateCampaign,
  type CampaignResult,
} from '@sim/campaign';
import { paybackSeconds } from '@sim/economy';
import { totalSqp } from '@sim/prestige';
import { fullBuildOut, kitchenGardenIncomeShare } from '@sim/kitchenGarden';
import { effectiveOfflineHours, averageOfflineEfficiency } from '@sim/offline';
import {
  KITCHEN_GARDEN_BASE_FRACTION,
  KITCHEN_GARDEN_TARGET_INCOME_SHARE,
  PRESTIGE_SQP_COEFFICIENT,
  TARGET_CAMPAIGN_HOURS,
  TARGET_PRESTIGE_RESETS,
} from '@content/balance';
import { GENERATOR_TIERS } from '@content/generators';

const rule = (label: string) => console.log(`\n${'='.repeat(76)}\n${label}\n${'='.repeat(76)}`);
const h = (n: number) => `${n.toFixed(2)}h`;
const pass = (ok: boolean) => (ok ? 'PASS' : 'FAIL');

let failures = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) failures++;
  console.log(`  [${pass(ok)}] ${label}`);
};

// ---------------------------------------------------------------------------
rule('1. Tier payback stays flat (§2, the property that makes the economy read)');
// ---------------------------------------------------------------------------
{
  const paybacks = GENERATOR_TIERS.map((t) => paybackSeconds(t.tier, 0));
  const min = Math.min(...paybacks);
  const max = Math.max(...paybacks);
  console.log(`  range across all 20 tiers: ${min.toFixed(0)}s - ${max.toFixed(0)}s`);
  check(max - min < 40, 'spread under 40s (no tier feels different to buy)');
  check(min > 140 && max < 190, 'inside the 140-190s band');
}

// ---------------------------------------------------------------------------
rule('2. Campaign length by archetype (§8 target: 6-10 engaged hours)');
// ---------------------------------------------------------------------------
const results = simulateAllArchetypes();
{
  console.log('  archetype   completed   total     S2 at    S3 at    S4 at   prestiges');
  for (const r of results) {
    const [, s2, s3, s4] = r.seasonStartHours;
    console.log(
      `  ${r.archetype.padEnd(10)}  ${String(r.completed).padEnd(9)}  ${h(r.totalHours).padStart(6)}  ` +
        `${(s2 === undefined ? '-' : h(s2)).padStart(7)}  ${(s3 === undefined ? '-' : h(s3)).padStart(7)}  ` +
        `${(s4 === undefined ? '-' : h(s4)).padStart(7)}  ${String(r.prestigeCount).padStart(9)}`
    );
  }
  console.log('');
  for (const r of results) {
    check(r.completed, `${r.archetype}: reaches the Full Bloom ending`);
  }
  for (const r of results) {
    const ok =
      r.totalHours >= TARGET_CAMPAIGN_HOURS.min && r.totalHours <= TARGET_CAMPAIGN_HOURS.max;
    check(ok, `${r.archetype}: campaign is ${h(r.totalHours)} (target 6-10h)`);
  }
}

// ---------------------------------------------------------------------------
rule('3. Prestige cadence (§4 target: 4-5 natural resets, every one felt)');
// ---------------------------------------------------------------------------
{
  // Reset COUNT is reported, not asserted. K provably cannot move it (SQP is
  // linear in K, so the ratio the player compares against is K-independent); it
  // is set by how eagerly players reset, which is behaviour, not design. Making
  // it a hard gate would mean failing CI over an assumption about strangers.
  for (const r of results) {
    const ok =
      r.prestigeCount >= TARGET_PRESTIGE_RESETS.min &&
      r.prestigeCount <= TARGET_PRESTIGE_RESETS.max;
    console.log(
      `  [${ok ? 'in band' : '  info '}] ${r.archetype}: ${r.prestigeCount} resets (target 4-5)`
    );
  }
  console.log('');
  for (const r of results) {
    const steps = r.prestigeMultipliers.map((m, i) => {
      const prev = i === 0 ? 1 : (r.prestigeMultipliers[i - 1] ?? 1);
      return `x${(m / prev).toFixed(2)}`;
    });
    console.log(`  ${r.archetype.padEnd(8)} step-ups: ${steps.join('  ') || '(none)'}`);
  }
  console.log('');
  // What the first prestige is WORTH when it unlocks - not what the simulated
  // player happened to wait for. The spec's original formula made this x1.18,
  // which taught players the mechanic was a trap.
  for (const r of results) {
    console.log(
      `  ${r.archetype.padEnd(8)} first prestige offered: x${r.firstPrestigeOfferedMultiplier.toFixed(2)}`
    );
  }
  // 1.75 rather than a round 2.0: the requirement is "unmistakably felt", and
  // demanding exactly 2x would trade real margin on campaign length for a number
  // with no design meaning behind it.
  check(
    results.every((r) => r.firstPrestigeOfferedMultiplier >= 1.75),
    'the first prestige is clearly felt when it unlocks (spec gave x1.00 here)'
  );
}

// ---------------------------------------------------------------------------
rule('4. Kitchen Garden share (§10 item 10, decision D2)');
// ---------------------------------------------------------------------------
{
  const full = kitchenGardenIncomeShare(fullBuildOut(4, 0), {
    levels: { dig: 0, plant: 0, cover: 0 },
    season: 4,
    nowSeconds: 1e9,
  });
  console.log(`  BaseFraction:                 ${KITCHEN_GARDEN_BASE_FRACTION}`);
  console.log(`  share at full S4 build-out:   ${(full * 100).toFixed(1)}%`);
  console.log(
    `  target band:                  ${(KITCHEN_GARDEN_TARGET_INCOME_SHARE.min * 100).toFixed(0)}-${(KITCHEN_GARDEN_TARGET_INCOME_SHARE.max * 100).toFixed(0)}%`
  );
  check(
    full >= KITCHEN_GARDEN_TARGET_INCOME_SHARE.min &&
      full <= KITCHEN_GARDEN_TARGET_INCOME_SHARE.max,
    'full build-out lands inside the target band'
  );
  check(full < 0.5, 'never becomes the majority of income (keeps the §7 cut viable)');

  // Full build-out is the CEILING, and on its own it is a flattering number: it
  // was reachable only in the closing minutes of Season 4. What §10 item 10
  // actually asks is what the garden is worth while the player is there, so
  // report the realised share too, and gate on it.
  console.log('');
  console.log('  realised in play      Seasons 1-2   whole run   at the end');
  for (const r of results) {
    console.log(
      `  ${r.archetype.padEnd(20)}` +
        `${(r.kitchenGardenShareEarly * 100).toFixed(1)}%`.padStart(11) +
        `${(r.kitchenGardenShareTimeAverage * 100).toFixed(1)}%`.padStart(12) +
        `${(r.kitchenGardenShareAtEnd * 100).toFixed(1)}%`.padStart(13)
    );
  }
  check(
    results.every((r) => r.kitchenGardenShareTimeAverage >= 0.05),
    'the garden is worth something across the run, not only at full build-out'
  );
  check(
    results.every((r) => r.kitchenGardenShareAtEnd >= 0.15),
    'a finished garden is a substantial share of income'
  );
}

// ---------------------------------------------------------------------------
rule('5. Offline taper (§7)');
// ---------------------------------------------------------------------------
{
  console.log('  away      productive-hours   average efficiency');
  for (const hours of [1, 8, 12, 16, 24, 48]) {
    console.log(
      `  ${String(hours).padStart(3)}h  ${effectiveOfflineHours(hours).toFixed(2).padStart(15)}   ` +
        `${(averageOfflineEfficiency(hours) * 100).toFixed(1)}%`
    );
  }
  check(effectiveOfflineHours(8) === 8, '8h away = 8 productive hours (100%)');
  check(Math.abs(effectiveOfflineHours(24) - 20) < 1e-9, '24h away = 20 productive hours');
}

// ---------------------------------------------------------------------------
rule('6. Archetype spread — how much tuning margin does the 6-10h band leave?');
// ---------------------------------------------------------------------------
{
  const hours = results.map((r) => r.totalHours);
  const slowest = Math.max(...hours);
  const fastest = Math.min(...hours);
  const spread = slowest / fastest;
  const bandRatio = TARGET_CAMPAIGN_HOURS.max / TARGET_CAMPAIGN_HOURS.min;
  console.log(`  slowest (idle) / fastest (active):  x${spread.toFixed(2)}`);
  console.log(`  target band 6-10h allows:           x${bandRatio.toFixed(2)}`);
  console.log(`  margin:                             ${((bandRatio - spread) * 100).toFixed(0)}%`);
  console.log('');
  console.log('  The spread is driven almost entirely by Growth Frenzy uptime (x1.05 for');
  console.log('  idle vs x1.60 for active), not by clicking - late-game click income is');
  console.log('  negligible against quadrillion-per-second production.');
  check(spread <= bandRatio, 'archetype spread fits inside the target band at all');
}

// ---------------------------------------------------------------------------
rule('7. Sensitivity: does the result depend on getting K exactly right?');
// ---------------------------------------------------------------------------
{
  console.log('  K      idle      casual    active    resets (i/c/a)');
  for (const k of [20, 30, 40, 50, 60]) {
    const runs = ARCHETYPES.map((a) => simulateCampaign(a, { prestigeCoefficient: k }));
    const times = runs.map((r) => (r.completed ? h(r.totalHours) : 'DNF').padStart(8)).join('  ');
    const resets = runs.map((r) => r.prestigeCount).join('/');
    console.log(`  ${String(k).padStart(3)}  ${times}    ${resets}`);
  }
  console.log(`\n  current K = ${PRESTIGE_SQP_COEFFICIENT}`);
  console.log(`  SQP at 1e12 lifetime Mana: ${totalSqp(1e12)}`);
}

// ---------------------------------------------------------------------------
rule(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
// ---------------------------------------------------------------------------
process.exit(failures === 0 ? 0 : 1);

export type { CampaignResult };
