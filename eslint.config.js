import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * The rule that matters here is the `src/sim` boundary (see
 * docs/03-technical-architecture.md §2). `src/sim` must stay pure and
 * Node-runnable, because the entire balance-simulation strategy depends on being
 * able to run the economy forward without a browser. That is enforced below, not
 * left to convention.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'assets/vendor'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ---------------------------------------------------------------------------
  // BOUNDARY: src/sim is pure. No DOM, no React, no Three.js, no runtime layer.
  // Deterministic and runnable under plain Node.
  // ---------------------------------------------------------------------------
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@game/*', '@ui/*', '@render/*', '**/game/*', '**/ui/*', '**/render/*'],
              message:
                'src/sim must not import from game/, ui/ or render/. It stays pure and Node-runnable so the balance simulation can run headlessly. See docs/03-technical-architecture.md §2.',
            },
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'three', 'three/*'],
              message:
                'src/sim must not import React or Three.js. Keep the simulation free of view concerns.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch'].map(
          (name) => ({
            name,
            message: `src/sim must not touch ${name}. It runs under Node during simulation. See docs/03-technical-architecture.md §2.`,
          })
        ),
      ],
      // Non-determinism breaks reproducible sims and replayable tests.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Use the seeded RNG from game/rng.ts (passed in), never Math.random, so sims stay reproducible.',
        },
        {
          object: 'Date',
          property: 'now',
          message:
            'src/sim must receive time as a parameter, never read the clock. Determinism is required.',
        },
      ],
    },
  },

  // Content is data. Data files should not contain logic that reaches outward.
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@game/*', '@ui/*', '@render/*', '@sim/*'],
              message:
                'src/content holds data only. It must not import from any layer. See docs/03-technical-architecture.md §3.',
            },
          ],
        },
      ],
    },
  },

  { files: ['tools/**/*.{ts,mjs}'], rules: { 'no-console': 'off' } },
  { files: ['tests/**/*.{ts,tsx}'], rules: { 'no-console': 'off' } },

  prettier
);
