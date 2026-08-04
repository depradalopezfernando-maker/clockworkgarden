#!/usr/bin/env node
/**
 * smoke.mjs — Phase 2's exit criterion, executed.
 *
 * "A human can play Season 1's first 15 minutes in a browser, close the tab,
 *  return, and find correct offline progress."
 *
 * Drives the real built app in real Chromium: ring the Bell, trigger a Frenzy,
 * buy a generator, watch production accrue, reload, confirm the save survived,
 * then fake being away and confirm offline progress is credited.
 *
 * Unit tests cannot prove this. The store, the save layer, React's subscription
 * and localStorage all have to work together in a browser for it to pass.
 *
 * Assertions read exact numbers out of the SAVE FILE rather than the HUD. The
 * HUD deliberately floors values under 1000 (see src/ui/format.ts), so two
 * genuinely different amounts can render identically - fine for a player,
 * useless for a test.
 *
 * Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   node tools/smoke.mjs [url]
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const SAVE_KEY = 'clockwork-garden:save';
const OFFLINE_HOURS = 4;

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1100, height: 850 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

/**
 * Force an autosave.
 *
 * The game saves on `visibilitychange` only when the document actually reports
 * `hidden` - dispatching the bare event is not enough, because the handler
 * checks `document.visibilityState`. Playwright cannot background a tab, so
 * shadow the property, fire the event, then restore the prototype getter.
 */
const forceSave = async () => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
  await page.waitForTimeout(120);
};

/** Force a save, then read the exact persisted state. */
const readSave = async () => {
  await forceSave();
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
};

/**
 * Dismiss the offline report if it is up.
 *
 * Any reload with real production credits some Mana, and the modal then
 * intercepts every click behind it. Harmless in play; fatal to a script.
 */
const dismissOffline = async () => {
  const dialog = page.locator('[data-testid="offline-dismiss"]');
  if (await dialog.isVisible().catch(() => false)) await dialog.click();
};

const ownedOfTier1 = () => page.locator('[data-testid="generator-1"]').getAttribute('data-owned');

/**
 * Ring the Bell `times` in one round trip.
 *
 * Clicking through Playwright costs a few hundred milliseconds each once the
 * page is doing real work, and §5's meter DRAINS at 0.02/s against 0.05 a
 * click - so twenty-two slow clicks fill it to 0.78 and no Frenzy ever starts.
 * That is a fact about the test harness, not about the game: a human ringing a
 * bell twenty times does it in seconds. Dispatching from inside the page keeps
 * the real click handler in the loop while removing the latency that was
 * quietly testing Playwright instead of the Frenzy.
 */
const ringBell = (times) =>
  page.evaluate((n) => {
    const bell = document.querySelector('[data-testid="bell"]');
    for (let i = 0; i < n; i++) bell?.click();
  }, times);

console.log(`\nDriving ${url}\n`);

// --- 1. Loads clean -----------------------------------------------------------
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
await page.reload({ waitUntil: 'networkidle' });

check(await page.locator('[data-testid="bell"]').isVisible(), 'the Bell renders');
check(await page.locator('[data-testid="generators"]').isVisible(), 'the generator list renders');
check((await ownedOfTier1()) === '0', 'a fresh game owns nothing');
check(await page.locator('[data-testid="tutorial"]').isVisible(), 'onboarding greets a new player');
check(
  (await page.locator('[data-testid="tutorial"]').getAttribute('data-step')) === 'ring',
  'onboarding starts by asking for the first Bell ring'
);

// --- 2. The Bell earns Mana ---------------------------------------------------
await ringBell(15);
const afterClicks = (await readSave())?.state.mana ?? 0;
check(afterClicks >= 15, 'ringing the Bell 15 times earns at least 15 Mana', `${afterClicks}`);

// --- 3. Growth Frenzy triggers (§5) -------------------------------------------
await ringBell(10);
const bellText = (await page.locator('[data-testid="bell"]').textContent()) ?? '';
check(bellText.includes('Frenzy'), 'filling the meter triggers a Growth Frenzy', bellText.trim());

// --- 4. Buying a generator ----------------------------------------------------
await page.locator('[data-testid="generator-1"]').click();
check(
  (await ownedOfTier1()) === '1',
  'buying Tier 1 increments owned',
  `owned=${await ownedOfTier1()}`
);

// --- 4b. Insight and the tree (§3) --------------------------------------------
// The first milestone is owning 10 Watering Cans, which costs ~240 Mana. Ring
// the Bell until that is affordable, then buy up to ten.
const bell = page.locator('[data-testid="bell"]');
for (let i = 0; i < 320; i++) await bell.click();

const tierOne = page.locator('[data-testid="generator-1"]');
for (let i = 0; i < 12; i++) {
  if (Number(await tierOne.getAttribute('data-owned')) >= 10) break;
  if (!(await tierOne.isEnabled())) break;
  await tierOne.click();
}
const ownedTierOne = Number(await tierOne.getAttribute('data-owned'));
check(ownedTierOne >= 10, 'can reach the first milestone by playing', `owned=${ownedTierOne}`);
// The store publishes to React on a 100ms cadence, so the milestone award can
// land a frame after the purchase that triggered it. Wait for the UI rather
// than racing it.
await page
  .locator('[data-testid="insight"]')
  .filter({ hasNotText: /^0 / })
  .waitFor({ timeout: 3000 })
  .catch(() => {});
const insightText = (await page.locator('[data-testid="insight"]').textContent()) ?? '';
check(!insightText.startsWith('0 '), 'reaching a milestone awards Insight', insightText.trim());

const firstNode = page.locator('[data-testid="node-s1-click-1"]');
check(await firstNode.isVisible(), 'the Insight tree renders its first node');
await firstNode.click();
check((await firstNode.getAttribute('data-owned')) === 'true', 'buying a node marks it purchased');

await page.locator('[data-testid="tab-milestones"]').click();
check(await page.locator('[data-testid="milestones"]').isVisible(), 'the milestone list renders');
await page.locator('[data-testid="tab-tree"]').click();

// --- 4c. Kitchen Garden (§2a) -------------------------------------------------
check(await page.locator('[data-testid="kg-plots"]').isVisible(), 'the Kitchen Garden renders');

const plot0 = page.locator('[data-testid="kg-plot-0"]');
check((await plot0.getAttribute('data-stage')) === 'bare', 'plots start bare');

const dayBefore = Number(
  (await page.locator('[data-testid="kg-day"]').textContent())?.replace(/\D/g, '')
);
await plot0.click(); // Dig
check((await plot0.getAttribute('data-stage')) === 'dug', 'Dig advances the plot');
await plot0.click(); // Plant
await plot0.click(); // Cover
check(
  (await plot0.getAttribute('data-stage')) === 'growing',
  'a full cycle starts the crop growing'
);

const dayAfter = Number(
  (await page.locator('[data-testid="kg-day"]').textContent())?.replace(/\D/g, '')
);
check(
  dayBefore - dayAfter === 6,
  'a manual cycle spends 6s of Day Time (§2a)',
  `${dayBefore}s -> ${dayAfter}s`
);

// --- 4d. Onboarding, capstone and prestige (Phase 5) --------------------------
// Prestige must be locked until Season 1 is cleared (§4).
check(
  !(await page.locator('[data-testid="prestige-open"]').isVisible()),
  'Turning the Soil is locked before the Season 1 capstone'
);

// Reach the capstone by handing the player the build the gate asks for, then
// play First Bloom for real: arm it, ring up a Frenzy, and clear on the rate.
// Editing localStorage then reloading does NOT work: `pagehide` fires first and
// the game saves over the edit. An init script runs after that unload-save and
// before the app boots. A one-shot sentinel keeps it from re-applying on every
// later navigation.
await context.addInitScript((key) => {
  const flag = '__cg_smoke_grant__';
  if (localStorage.getItem(flag) === null) return;
  localStorage.removeItem(flag);
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const save = JSON.parse(raw);
  save.state.owned = [200, 100, 60, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  save.state.mana = 1e6;
  save.savedAt = Date.now();
  localStorage.setItem(key, JSON.stringify(save));
}, SAVE_KEY);

await page.evaluate(() => localStorage.setItem('__cg_smoke_grant__', '1'));
await page.reload({ waitUntil: 'networkidle' });
await dismissOffline();

check(
  await page.locator('[data-testid="capstone"]').isVisible(),
  'the capstone offers itself once ready'
);
// Wait out any Frenzy still running from the earlier steps before arming.
// An attempt ends when the Frenzy that carried it ends (D4a), so arming into
// the tail of one means the window shuts a moment later and the attempt fails
// before the bell has been rung. Harmless in the game - retrying is free - but
// it made this test depend on how fast the page happened to be.
await page
  .waitForFunction(
    () => !(document.querySelector('[data-testid="bell"]')?.textContent ?? '').includes('Frenzy'),
    undefined,
    { timeout: 30_000 }
  )
  .catch(() => {});

await page.locator('[data-testid="capstone-arm"]').click();
check(
  await page.locator('[data-testid="capstone-peak"]').isVisible(),
  'arming shows the First Bloom progress meter'
);

// Ring up a Frenzy - the attempt clears on rate during the window.
await ringBell(22);

// Poll rather than sleep. The capstone clears on a TICK, and how soon that tick
// lands depends on what else the main thread is doing - once the 3D garden
// started loading three.js and 37 models, a fixed 400ms wait became a coin
// flip. Waiting for the outcome is both faster and not a flake.
await page
  .waitForFunction(
    () => (document.querySelector('.hud__season')?.textContent ?? '').includes('Season 2'),
    undefined,
    { timeout: 8000 }
  )
  .catch(() => {});

const seasonText = (await page.locator('.hud__season').textContent()) ?? '';
check(
  seasonText.includes('Season 2'),
  'clearing First Bloom advances to Season 2',
  seasonText.trim()
);

check(
  await page.locator('[data-testid="prestige-open"]').isVisible(),
  'clearing the capstone unlocks Turning the Soil'
);

// Prestige asks before it wipes anything.
await page.locator('[data-testid="prestige-open"]').click();
check(
  await page.locator('[data-testid="prestige-confirm"]').isVisible(),
  'Turning the Soil confirms before resetting'
);
await page.locator('[data-testid="prestige-cancel"]').click();
check(
  (await page.locator('[data-testid="generator-1"]').getAttribute('data-owned')) === '200',
  'cancelling keeps every generator'
);

await page.locator('[data-testid="prestige-open"]').click();
await page.locator('[data-testid="prestige-confirm"]').click();
await page.waitForTimeout(300);
check(
  (await page.locator('[data-testid="generator-1"]').getAttribute('data-owned')) === '0',
  'Turning the Soil resets Garden Plots'
);
check(
  (await page.locator('[data-testid="kg-plots"]').isVisible()) &&
    (await page.locator('[data-testid="kg-plot-0"]').isVisible()),
  'the Kitchen Garden survives the reset (§4)'
);

// --- 5. Passive production accrues --------------------------------------------
// Rebuild a little after the reset so there is something to accrue.
await context.addInitScript((key) => {
  const flag = '__cg_smoke_rebuild__';
  if (localStorage.getItem(flag) === null) return;
  localStorage.removeItem(flag);
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const save = JSON.parse(raw);
  save.state.owned[0] = 10;
  save.savedAt = Date.now();
  localStorage.setItem(key, JSON.stringify(save));
}, SAVE_KEY);
await page.evaluate(() => localStorage.setItem('__cg_smoke_rebuild__', '1'));
await page.reload({ waitUntil: 'networkidle' });
await dismissOffline();

const beforeIdle = (await readSave())?.state.mana ?? 0;
await page.waitForTimeout(3000);
const afterIdle = (await readSave())?.state.mana ?? 0;
check(
  afterIdle > beforeIdle,
  'production accrues without clicking',
  `${beforeIdle.toFixed(3)} -> ${afterIdle.toFixed(3)}`
);

// --- 6. The save survives a reload --------------------------------------------
check((await readSave()) !== null, 'the game writes a save');
const ownedBeforeReload = Number(await ownedOfTier1());
await page.reload({ waitUntil: 'networkidle' });
const ownedAfterReload = Number(await ownedOfTier1());
check(
  ownedAfterReload === ownedBeforeReload && ownedAfterReload >= 10,
  'generators survive a reload',
  `${ownedBeforeReload} -> ${ownedAfterReload}`
);

const nodesAfterReload = await page
  .locator('[data-testid="node-s1-click-1"]')
  .getAttribute('data-owned');
check(nodesAfterReload === 'true', 'purchased Insight nodes survive a reload');

// --- 7. Offline progress (§7) -------------------------------------------------
// Rewinding `savedAt` from the running page does not work: reloading fires
// `pagehide`, the game saves with the current timestamp, and the rewind is
// clobbered before the new document reads it. An init script runs AFTER that
// unload-save and BEFORE the app boots, which is exactly the window needed.
const manaBeforeAway = (await readSave())?.state.mana ?? 0;

await context.addInitScript(
  ({ key, hours }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const save = JSON.parse(raw);
    save.savedAt -= hours * 3600 * 1000;
    localStorage.setItem(key, JSON.stringify(save));
  },
  { key: SAVE_KEY, hours: OFFLINE_HOURS }
);

await page.reload({ waitUntil: 'networkidle' });

const dialog = page.locator('[data-testid="offline-dismiss"]');
check(await dialog.isVisible(), 'returning after time away shows the offline report');

// Offline Mana is applied to in-memory state on load; force a save so the
// figure on disk reflects it.
const manaAfterAway = (await readSave())?.state.mana ?? 0;

// Assert the magnitude, not just "more" - a broken taper would still be "more".
// Derived from what is actually owned rather than hard-coded, so the check stays
// honest if the playing above changes.
const rateAtSave = 0.1 * ownedAfterReload;
const expectedOffline = rateAtSave * OFFLINE_HOURS * 3600;
const gained = manaAfterAway - manaBeforeAway;
check(
  gained > expectedOffline * 0.5,
  `${OFFLINE_HOURS}h away credits roughly ${expectedOffline.toFixed(0)} Mana`,
  `gained ${gained.toFixed(0)}`
);

await dialog.click();
check(!(await dialog.isVisible()), 'the offline report dismisses');

// --- 8. Layout and console health ---------------------------------------------
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
check(overflow <= 0, 'the page does not scroll horizontally', `overflow=${overflow}px`);

await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(200);
const mobileOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
check(mobileOverflow <= 0, 'no horizontal overflow at 390px wide', `overflow=${mobileOverflow}px`);

// --- The 3D garden --------------------------------------------------------
//
// Headless Chromium has no GPU here, so this exercises the FALLBACK on purpose:
// `createGardenView` returns a NullGardenView and the panel mounts empty. The
// roadmap requires the 2D build stay runnable, and this is what keeps that a
// tested claim rather than an assertion in a document.
check(
  (await page.locator('[data-testid="garden-canvas"]').count()) === 1,
  'the garden panel mounts'
);
check(
  await page.evaluate(
    () => document.querySelectorAll('[data-testid="garden-canvas"] canvas').length <= 1
  ),
  'one canvas, or none where WebGL is unavailable'
);

check(consoleErrors.length === 0, 'no console errors', consoleErrors.join(' | '));

await page.setViewportSize({ width: 1100, height: 850 });
await page.screenshot({ path: process.env.SMOKE_SCREENSHOT ?? 'smoke.png', fullPage: true });

await browser.close();

console.log(
  `\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECK(S) FAILED`}\n`
);
process.exit(failures === 0 ? 0 : 1);
