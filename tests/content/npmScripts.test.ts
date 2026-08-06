import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The npm scripts have to run on Windows.
 *
 * `assets:fetch` was `NODE_USE_ENV_PROXY=1 node tools/fetch-assets.mjs`. That
 * leading assignment is POSIX shell syntax; cmd.exe reads it as a command name
 * and gives "'NODE_USE_ENV_PROXY' is not recognized", so `npm run assets` failed
 * on Windows before it did a single thing. A playtester lost an evening to it.
 *
 * Cheap to test, and the alternative is finding out from whoever clones next.
 */

const scripts = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  .scripts as Record<string, string>;

describe('npm scripts are cross-platform', () => {
  it('has scripts to check at all', () => {
    // Guards against the file moving and this suite silently passing on {}.
    expect(Object.keys(scripts).length).toBeGreaterThan(5);
  });

  it.each(Object.entries(scripts))('%s carries no env-var prefix', (_name, command) => {
    // `FOO=bar cmd` — an assignment before the first space. Windows cannot parse
    // it. Use `cross-env`, or set it inside the script the way fetch-assets does.
    const firstWord = command.trim().split(/\s+/)[0] ?? '';
    expect(firstWord).not.toMatch(/^[A-Za-z_][A-Za-z0-9_]*=/);
  });

  it.each(Object.entries(scripts))('%s uses no shell-only operators', (_name, command) => {
    // `&&` is fine in cmd.exe. These are not: single-quoted args, subshells,
    // pipes to Unix filters, and redirection to /dev/null all assume a POSIX
    // shell that a Windows contributor does not have.
    expect(command).not.toMatch(/\/dev\/null|\$\(|`|\|\s*(grep|sed|awk|head|tail)\b/);
  });
});
