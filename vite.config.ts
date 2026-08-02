import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sim': r('./src/sim'),
      '@game': r('./src/game'),
      '@content': r('./src/content'),
      '@ui': r('./src/ui'),
      '@render': r('./src/render'),
    },
  },
  test: {
    globals: true,
    // Default to the fast, DOM-free environment. `src/sim` and `src/content`
    // must never need a DOM; UI tests opt into jsdom per-file with
    // `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
