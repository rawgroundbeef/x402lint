import { defineConfig } from 'tsdown'

export default defineConfig([
  // ESM + CJS re-exports
  {
    entry: ['./src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'neutral',
    dts: true,
    sourcemap: true,
    minify: false,
    clean: true,
    outDir: 'dist',
  },
  // CLI wrapper
  {
    entry: ['./src/cli.ts'],
    format: ['esm'],
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    dts: false,
    sourcemap: false,
    minify: false,
    clean: false,
    outDir: 'dist',
    external: ['x402lint'],
  },
])
