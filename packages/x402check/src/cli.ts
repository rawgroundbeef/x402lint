#!/usr/bin/env node
// x402check CLI — thin wrapper that delegates to x402lint
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'

// Find x402lint's CLI binary
const require = createRequire(import.meta.url)
const x402lintPkg = require.resolve('x402lint/package.json')
const cliBin = join(dirname(x402lintPkg), 'dist', 'cli.mjs')

try {
  execFileSync('node', [cliBin, ...process.argv.slice(2)], { stdio: 'inherit' })
} catch (err: any) {
  process.exit(err.status ?? 2)
}
