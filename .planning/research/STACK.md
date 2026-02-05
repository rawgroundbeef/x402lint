# Technology Stack — v3.0 Additions

**Project:** x402lint v3.0 milestone
**Researched:** 2026-02-04
**Overall confidence:** HIGH

## Executive Summary

v3.0 adds CLI improvements, Stacks address validation, manifest validation, bazaar extension validation, and npm publishing. The existing zero-dependency architecture is preserved with strategic vendoring and minimal additions. Current IIFE bundle is 30KB — target is to stay under 40KB.

**Key decisions:**
- **CLI:** Built-in `util.parseArgs` + manual parsing + ANSI codes (zero deps)
- **Stacks c32check:** Vendor implementation using existing @noble/hashes (ripemd160) + @scure/base (base32) → +4 KB
- **JSON Schema validation:** Ajv as devDependency for build-time only → 0 KB runtime
- **npm publishing:** Current `publint` + `prepublishOnly` setup is production-ready
- **Manifest validation:** Custom cross-validation logic (no library needed) → +2-3 KB

## Existing Stack (Validated, Do Not Change)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| TypeScript | ^5.9.3 | Type safety + compilation | Keep |
| tsdown | ^0.20.1 | ESM + CJS + IIFE bundling | Keep |
| vitest | ^4.0.18 | Test suite (217 cases) | Keep |
| @noble/hashes | ^2.0.1 | Crypto primitives (devDep) | Keep |
| @scure/base | ^2.0.0 | Base58/Base32 encoding (devDep) | Keep |
| publint | ^0.3.16 | Package validation | Keep |
| pnpm | - | Monorepo management | Keep |

**Vendoring pattern:** Import from devDependencies, tree-shake via tsdown, zero runtime deps.

## New Stack Additions

### 1. CLI Argument Parsing

**Decision:** Use built-in `util.parseArgs()` (Node.js 18.3+, stable in v25)

- Supports boolean and string argument types, short/long flags, positionals
- Replace current manual parsing loop in `src/cli.ts`
- Continue using raw ANSI escape codes for colors (already implemented: green/red/yellow)
- **Bundle impact: 0 bytes** (built-in)

**Alternatives rejected:** commander.js, minimist, yargs — all add runtime dependencies.

### 2. Stacks c32check Address Validation

**Decision:** Vendor c32check implementation using existing devDependencies

**c32check algorithm:**
1. Crockford base-32 encoding → use `@scure/base`
2. SHA-256 double hash for checksum → use `@noble/hashes/sha256.js`
3. RIPEMD-160 for address hashing → use `@noble/hashes/legacy.js`

**Version bytes:** Mainnet P2PKH=22, P2SH=20; Testnet P2PKH=26, P2SH=21

**Why vendor:** Taking c32check as runtime dep would add `base-x` + `@noble/hashes@1.x` (conflicts with our @2.x devDep), violating zero-dep constraint.

**Bundle impact: +4 KB** (RIPEMD-160 ~2KB + base32 ~1KB + c32 logic ~1KB)

### 3. JSON Schema Validation (Bazaar Extensions)

**Decision:** Ajv as devDependency for build-time validation only

- **Option A (Recommended):** Build-time validation via `pnpm validate:schemas` script. Runtime does structural checks only. **0 KB runtime impact.**
- **Option B:** Ajv standalone compiled validators (~2-5 KB per schema)
- **Option C:** Structural validation only (no Ajv, lower confidence)

### 4. Manifest Validation Logic

**Decision:** Custom TypeScript validation logic, no library

- Per-entry: reuse existing `validate()` for each endpoint
- Cross-entry: custom consistency checks (duplicate endpoints, network consistency, payTo consistency)
- Manifest-level: structure validation, metadata checks
- **Bundle impact: +2-3 KB**

### 5. npm Publishing

**Decision:** Current setup is production-ready, no changes needed

Already configured: `prepublishOnly` runs tests+build+publint, `files` field restricts to `dist/`, dual ESM/CJS exports, CLI bin entry.

## Bundle Size Impact

| Addition | Estimated Impact | Rationale |
|----------|-----------------|-----------|
| CLI improvements | 0 KB | Refactor only |
| Stacks c32check | +4 KB | RIPEMD-160, base32, c32 logic |
| JSON Schema (Ajv) | 0 KB | devDependency only |
| Manifest validation | +2-3 KB | Custom validation logic |
| **Total** | **+6-7 KB** | Conservative estimate |

**Current:** 30 KB → **Projected:** 36-37 KB → **Target:** <40 KB

## What NOT to Add

- **CLI framework libraries** (commander, yargs) — overkill for 4 flags
- **Zod/runtime validation libraries** — duplicates existing pipeline, +45KB
- **JSON Schema runtime validation** — dev/CI concern, not runtime
- **c32check as runtime dep** — breaks zero-dep constraint
- **YAML/TOML parsers** — manifests are JSON only

## Sources

- [Node.js util.parseArgs](https://nodejs.org/api/util.html)
- [c32check GitHub](https://github.com/stacks-network/c32check)
- [Stacks Accounts](https://docs.stacks.co/concepts/network-fundamentals/accounts)
- [@noble/hashes GitHub](https://github.com/paulmillr/noble-hashes)
- [Ajv Standalone](https://ajv.js.org/standalone.html)
- [publint docs](https://publint.dev/docs/)
