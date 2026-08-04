import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

/**
 * The `src/sim` purity boundary is the load-bearing architectural rule in this
 * project (docs/03-technical-architecture.md §2) — it is what makes the balance
 * simulation, and therefore the whole tuning strategy, possible.
 *
 * A lint rule nobody verifies is a lint rule that silently stops working. These
 * tests run ESLint against synthetic violations and assert it actually complains.
 */

const lint = async (code: string, filePath: string) => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
};

const ruleIds = (messages: { ruleId: string | null }[]) => messages.map((m) => m.ruleId);

describe('src/sim purity boundary is enforced by lint', () => {
  it('rejects imports from the runtime layer', async () => {
    const messages = await lint(
      `import { tick } from '@game/loop';\nexport const x = tick;\n`,
      'src/sim/economy.ts'
    );
    expect(ruleIds(messages)).toContain('no-restricted-imports');
  });

  it('rejects imports from the UI layer', async () => {
    const messages = await lint(
      `import { Hud } from '@ui/Hud';\nexport const x = Hud;\n`,
      'src/sim/economy.ts'
    );
    expect(ruleIds(messages)).toContain('no-restricted-imports');
  });

  it('rejects React and Three.js', async () => {
    for (const mod of ['react', 'three']) {
      const messages = await lint(
        `import x from '${mod}';\nexport const y = x;\n`,
        'src/sim/economy.ts'
      );
      expect(ruleIds(messages), mod).toContain('no-restricted-imports');
    }
  });

  it('rejects DOM globals', async () => {
    const messages = await lint(
      `export const save = () => localStorage.getItem('x');\n`,
      'src/sim/economy.ts'
    );
    expect(ruleIds(messages)).toContain('no-restricted-globals');
  });

  it('rejects non-determinism — Math.random and Date.now', async () => {
    const random = await lint(`export const roll = () => Math.random();\n`, 'src/sim/economy.ts');
    expect(ruleIds(random)).toContain('no-restricted-properties');

    const clock = await lint(`export const now = () => Date.now();\n`, 'src/sim/economy.ts');
    expect(ruleIds(clock)).toContain('no-restricted-properties');
  });

  it('allows pure, deterministic, self-contained sim code', async () => {
    const messages = await lint(
      `import { BASE_CLICK_YIELD } from '@content/balance';\n` +
        `export const clickYield = (bonus: number, prestige: number): number =>\n` +
        `  BASE_CLICK_YIELD * (1 + bonus) * prestige;\n`,
      'src/sim/economy.ts'
    );
    expect(messages.filter((m) => m.severity === 2)).toEqual([]);
  });
});

describe('src/content holds data only', () => {
  it('rejects imports from any layer, including sim', async () => {
    const messages = await lint(
      `import { clickYield } from '@sim/economy';\nexport const x = clickYield;\n`,
      'src/content/generators.ts'
    );
    expect(ruleIds(messages)).toContain('no-restricted-imports');
  });
});

describe('the boundary does not leak into other layers', () => {
  it('allows the UI layer to import React and reach into sim', async () => {
    const messages = await lint(
      `import { useState } from 'react';\n` +
        `import { clickYield } from '@sim/economy';\n` +
        `export const useYield = () => useState(clickYield);\n`,
      'src/ui/useYield.ts'
    );
    expect(messages.filter((m) => m.severity === 2)).toEqual([]);
  });
});
