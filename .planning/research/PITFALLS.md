# Pitfalls Research — v3.0

**Project:** x402lint v3.0 milestone
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

12 pitfalls identified across CLI, manifest validation, Stacks support, and npm publishing. Organized by severity with prevention strategies and phase assignments.

## Critical Pitfalls

### P1: CLI Code Leaks Into Library Bundle

**What:** Node.js-only imports (`fs`, `path`, `process`) in library code bloat browser bundle and crash in browser.

**Prevention:**
- CLI stays in `src/cli.ts` (separate tsdown entry point)
- Library code in `src/index.ts` must never import Node.js built-ins
- CI check: search IIFE bundle for `require("fs")` or `require("path")`
- Current tsdown config already has separate entry points (GOOD)

**Phase:** All phases — guard throughout

### P2: Shebang + ESM Compatibility

**What:** `#!/usr/bin/env node` + `.mjs` extension fails on some platforms.

**Prevention:**
- CLI output is `dist/cli.mjs` (already configured correctly)
- Test `npx x402lint` on macOS/Linux
- Verify `bin` field points to `.mjs` file
- tsdown adds shebang automatically

**Phase:** Phase 1 (CLI)

### P3: c32check Version Byte Confusion

**What:** Stacks has 4 version bytes (22, 20 mainnet; 26, 21 testnet). Confusing P2PKH/P2SH or mainnet/testnet corrupts validation.

**Prevention:**
- Explicit version byte checking in validator
- Unit tests for all 4 combinations: mainnet P2PKH (SP, v22), mainnet P2SH (SM, v20), testnet P2PKH (ST, v26), testnet P2SH (SN, v21)
- Network-version cross-validation: `stacks:mainnet` with testnet address = error

**Phase:** Phase 2 (Stacks)

### P4: Manifest Field Paths Lose Index Context

**What:** Error at `accepts[0].payTo` in endpoint 47 shows without indicating which endpoint.

**Prevention:**
- Prefix field paths with endpoint ID: `endpoints["api/data"].accepts[0].payTo`
- `validateManifest()` wraps `validate()` results with endpoint context
- Test with 20+ endpoints to verify paths are distinguishable

**Phase:** Phase 3 (Manifest validation)

### P5: First npm Publish Missing Files

**What:** Published package missing CLI binary, type declarations, or source maps.

**Prevention:**
- `files` field already set to `["dist/"]` (GOOD)
- Test with `npm pack && tar -tzf *.tgz` before publish
- Verify dist/ contains: index.js, index.cjs, index.iife.js, cli.mjs, .d.ts files
- publint in `prepublishOnly` catches most issues (already configured)

**Phase:** Phase 6 (npm publish)

## Moderate Pitfalls

### P6: Bazaar JSON Schema Bloats Bundle

**What:** Including Ajv adds 30KB+ to browser bundle.

**Prevention:**
- Ajv as devDependency only (build-time validation)
- Runtime does structural checks only
- Existing `extensions.ts` already does this correctly

**Phase:** Phase 4 (Bazaar validation)

### P7: Over-Normalization Corrupts Data

**What:** Normalization guesses wrong and silently corrupts valid data.

**Prevention:**
- Warn on every normalization transformation
- Strict mode rejects configs requiring normalization
- Never guess financial data (amounts, addresses, networks)
- Test: broken config should fail, not silently fix

**Phase:** Phase 3 (Manifest validation)

### P8: Website Mode Switching Breaks State

**What:** Switching between modes leaves stale results or crashes display.

**Prevention:**
- Discriminated union state: `{ mode: 'single', result } | { mode: 'manifest', results }`
- Clear all results on mode switch
- URL parameters reflect current mode
- Separate render functions per mode

**Phase:** Phase 5 (Website)

### P9: CLI Flags Don't Compose

**What:** `--strict --json` outputs ANSI codes in JSON. `--quiet --json` prints nothing.

**Prevention:**
- Define flag precedence: `--help/--version` short-circuit, `--quiet` suppresses, `--json` is pure JSON (no ANSI), `--strict` affects validation only
- Test all flag combinations
- `--json` output must parse with `JSON.parse()`

**Phase:** Phase 1 (CLI)

## Minor Pitfalls

### P10: c32check API Differs From Expected

**What:** Actual API is `c32encode(version, payload)` not `c32check.encode(payload)`.

**Prevention:** Read official docs, vendor with TypeScript types, integration test with real addresses.

**Phase:** Phase 2 (Stacks)

### P11: npm postpublish Hook Fails Silently

**What:** `postpublish` for x402lint alias fails but npm reports success.

**Prevention:** Move x402lint publishing to separate CI step, not postpublish hook.

**Phase:** Phase 6 (npm publish)

### P12: Manifest Validation Slow With 100+ Endpoints

**What:** Sequential validation with crypto operations takes too long at scale.

**Prevention:**
- Validation is synchronous but fast per-entry (<1ms each)
- Cache network registry lookups
- Benchmark with 1000-endpoint manifest, verify <1s total
- Consider fail-fast mode for CI

**Phase:** Phase 3 (Manifest validation)

## Phase-Specific Warnings

| Phase | Key Pitfalls | Priority |
|-------|-------------|----------|
| Phase 1: CLI | P1 (bundle leak), P2 (shebang), P9 (flag composition) | HIGH |
| Phase 2: Stacks | P3 (version bytes), P10 (API assumptions) | HIGH |
| Phase 3: Manifest | P4 (field paths), P7 (over-normalization), P12 (performance) | MEDIUM |
| Phase 4: Bazaar | P6 (bundle bloat) | MEDIUM |
| Phase 5: Website | P8 (mode switching) | LOW |
| Phase 6: Publish | P5 (missing files), P11 (postpublish) | HIGH |

## Sources

- [npm Files & Ignores](https://github.com/npm/cli/wiki/Files-&-Ignores)
- [Creating ESM shell scripts](https://2ality.com/2022/07/nodejs-esm-shell-scripts.html)
- [c32check GitHub](https://github.com/stacks-network/c32check)
- [Tree-shaking with tsup](https://dorshinar.me/posts/treeshaking-with-tsup)
- [Ajv Standalone mode](https://ajv.js.org/standalone.html)
