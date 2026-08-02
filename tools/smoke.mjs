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

const ownedOfTier1 = () => page.locator('[data-testid="generator-1"]').getAttribute('data-owned');

console.log(`\nDriving ${url}\n`);

// --- 1. Loads clean -----------------------------------------------------------
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
await page.reload({ waitUntil: 'networkidle' });

check(await page.locator('[data-testid="bell"]').isVisible(), 'the Bell renders');
check(await page.locator('[data-testid="generators"]').isVisible(), 'the generator list renders');
check((await ownedOfTier1()) === '0', 'a fresh game owns nothing');

// --- 2. The Bell earns Mana ---------------------------------------------------
for (let i = 0; i < 15; i++) await page.locator('[data-testid="bell"]').click();
const afterClicks = (await readSave())?.state.mana ?? 0;
check(afterClicks >= 15, 'ringing the Bell 15 times earns at least 15 Mana', `${afterClicks}`);

// --- 3. Growth Frenzy triggers (§5) -------------------------------------------
for (let i = 0; i < 10; i++) await page.locator('[data-testid="bell"]').click();
const bellText = (await page.locator('[data-testid="bell"]').textContent()) ?? '';
check(bellText.includes('Frenzy'), 'filling the meter triggers a Growth Frenzy', bellText.trim());

// --- 4. Buying a generator ----------------------------------------------------
await page.locator('[data-testid="generator-1"]').click();
check(
  (await ownedOfTier1()) === '1',
  'buying Tier 1 increments owned',
  `owned=${await ownedOfTier1()}`
);

// --- 5. Passive production accrues --------------------------------------------
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
await page.reload({ waitUntil: 'networkidle' });
check(
  (await ownedOfTier1()) === '1',
  'generators survive a reload',
  `owned=${await ownedOfTier1()}`
);

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

// One Tier-1 generator yields 0.1/s, so 4 hours inside the 100% window is 1440
// Mana. Assert the magnitude, not just "more" - a broken taper would still be
// "more".
const expectedOffline = 0.1 * OFFLINE_HOURS * 3600;
const gained = manaAfterAway - manaBeforeAway;
check(
  gained > expectedOffline * 0.5,
  `${OFFLINE_HOURS}h away credits roughly ${expectedOffline} Mana`,
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

check(consoleErrors.length === 0, 'no console errors', consoleErrors.join(' | '));

await page.setViewportSize({ width: 1100, height: 850 });
await page.screenshot({ path: process.env.SMOKE_SCREENSHOT ?? 'smoke.png', fullPage: true });

await browser.close();

console.log(
  `\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECK(S) FAILED`}\n`
);
process.exit(failures === 0 ? 0 : 1);
