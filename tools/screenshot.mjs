#!/usr/bin/env node
/**
 * screenshot.mjs — drive the built app and capture what it looks like.
 *
 * This is the visual verification loop referenced in CLAUDE.md and
 * docs/03-technical-architecture.md §7: an agent can run this, read the PNG, and
 * check layout, overflow, contrast and empty panels without a human. It verifies
 * correctness, never taste.
 *
 * Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   node tools/screenshot.mjs [url] [outfile]
 *
 * Chromium is pre-installed at PLAYWRIGHT_BROWSERS_PATH. Never run
 * `playwright install`.
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'screenshot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });

// Horizontal overflow is the single most common layout regression and is
// invisible in a fixed-viewport screenshot, so assert on it directly.
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
if (overflow > 0) problems.push(`page scrolls horizontally by ${overflow}px`);

console.log(`url:      ${url}`);
console.log(`title:    ${await page.title()}`);
console.log(`saved:    ${out}`);
console.log(`problems: ${problems.length ? '\n  - ' + problems.join('\n  - ') : 'none'}`);

await browser.close();
process.exit(problems.length ? 1 : 0);
