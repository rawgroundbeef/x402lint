---
phase: 09-build-pipeline-and-package-publishing
verified: 2026-01-29T20:02:00Z
status: gaps_found
score: 3/4 must-haves verified
gaps:
  - truth: "Browser bundle is under 15KB minified"
    status: failed
    reason: "IIFE bundle is 26,781 bytes (26.78KB), exceeding the 15KB (15,360 byte) target by 74%"
    artifacts:
      - path: "packages/x402check/dist/index.iife.js"
        issue: "26,781 bytes minified; target was under 15,360 bytes"
    missing:
      - "Bundle size reduction to under 15KB minified, OR explicit requirement revision accepting 26.78KB raw / 9.06KB gzipped as the new target"
---

# Phase 9: Build Pipeline and Package Publishing Verification Report

**Phase Goal:** The SDK produces correct ESM, CJS, and browser IIFE bundles with working type declarations, and the package is ready for package publishing
**Verified:** 2026-01-29T20:02:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `import { validate } from 'x402check'` works in ESM and `const { validate } = require('x402check')` works in CJS | VERIFIED | ESM test: `node /tmp/test-esm-verify.mjs` prints "ESM OK: function function function 0.0.1". CJS test: `node /tmp/test-cjs-verify.cjs` prints "CJS OK: function function function 0.0.1". Both `validate`, `detect`, `normalize` are callable functions. `VERSION` returns "0.0.1". |
| 2 | Loading the UMD/IIFE bundle via `<script>` tag makes `window.x402Validate.validate` a callable function | VERIFIED | vm.runInContext test prints "IIFE OK: function function function". Bundle opens with `var x402Validate=(function(e){...` confirming global assignment. `validate`, `detect`, `normalize` are all callable functions on the global. Note: format is IIFE not UMD, which is functionally equivalent for browser `<script>` tags. |
| 3 | Browser bundle is under 15KB minified | FAILED | `index.iife.js` is 26,781 bytes (26.78KB minified). This exceeds the 15KB (15,360 byte) target by 74%. Gzipped size is 9,038 bytes (9.06KB). The excess is caused by vendored crypto (keccak256 from @noble/hashes, base58/bech32 from @scure/base) which is inherent to the zero-runtime-deps architecture. |
| 4 | TypeScript consumers get full type inference -- `validate()` return type shows `valid`, `errors`, `warnings`, `version`, `normalized` fields with correct types | VERIFIED | `index.d.ts` (483 lines, 15,391 bytes) exports `validate(input: string | object, options?: ValidationOptions): ValidationResult`. `ValidationResult` interface at line 177 includes: `valid: boolean`, `version: ConfigFormat`, `errors: ValidationIssue[]`, `warnings: ValidationIssue[]`, `normalized: NormalizedConfig | null`. All field types are fully specified. CJS types in `index.d.cts` (483 lines, 15,392 bytes) mirror the ESM types. Both are exported via split `exports` conditions in package.json. publint validates with zero errors and zero warnings. |

**Score:** 3/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/x402check/dist/index.js` | ESM bundle | VERIFIED (59,239 bytes) | Exists, substantive, wired via `package.json exports["."].import.default` and `module` field |
| `packages/x402check/dist/index.cjs` | CJS bundle | VERIFIED (59,902 bytes) | Exists, substantive, wired via `package.json exports["."].require.default` and `main` field |
| `packages/x402check/dist/index.d.ts` | TypeScript declarations (ESM) | VERIFIED (15,391 bytes, 483 lines) | Exports all public types and functions. Wired via `exports["."].import.types` and top-level `types` field |
| `packages/x402check/dist/index.d.cts` | TypeScript declarations (CJS) | VERIFIED (15,392 bytes, 483 lines) | Mirrors ESM types. Wired via `exports["."].require.types` |
| `packages/x402check/dist/index.iife.js` | IIFE browser bundle (minified) | PARTIAL (26,781 bytes) | Exists, substantive, correctly exposes `x402Validate` global. File is IIFE not UMD (functionally equivalent). Size exceeds 15KB target. |
| `packages/x402check/dist/index.d.mts` | ESM-specific TypeScript declarations | N/A | Not generated. Not needed: package uses `"type": "module"` so `.d.ts` serves as ESM declarations. publint validates without this file. |
| `packages/x402check/tsdown.config.ts` | Multi-format build configuration | VERIFIED (30 lines) | Array config with two entries: ESM+CJS (neutral, dts, sourcemaps) and IIFE (browser, minified, globalName: x402Validate) |
| `packages/x402check/package.json` | Package metadata with correct exports | VERIFIED (55 lines) | Split exports with per-condition types, `files: ["dist/"]`, `sideEffects: false`, `prepublishOnly` script, `publint` in devDependencies |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json exports["."].import.default` | `dist/index.js` | Node.js module resolution | WIRED | Value is `"./dist/index.js"`, file exists (59,239 bytes) |
| `package.json exports["."].require.default` | `dist/index.cjs` | Node.js module resolution | WIRED | Value is `"./dist/index.cjs"`, file exists (59,902 bytes) |
| `package.json exports["."].import.types` | `dist/index.d.ts` | TypeScript module resolution | WIRED | Value is `"./dist/index.d.ts"`, file exists (15,391 bytes) |
| `package.json exports["."].require.types` | `dist/index.d.cts` | TypeScript module resolution | WIRED | Value is `"./dist/index.d.cts"`, file exists (15,392 bytes) |
| `tsdown.config.ts globalName` | `window.x402Validate` | IIFE bundle global assignment | WIRED | Config has `globalName: 'x402Validate'`, IIFE opens with `var x402Validate=(function(e){...` |
| `package.json main` | `dist/index.cjs` | Legacy CJS resolution | WIRED | Value is `"./dist/index.cjs"` |
| `package.json module` | `dist/index.js` | Bundler ESM resolution | WIRED | Value is `"./dist/index.js"` |
| `package.json types` | `dist/index.d.ts` | Legacy TypeScript resolution | WIRED | Value is `"./dist/index.d.ts"` |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| BUILD-01: TypeScript source compiled to ESM, CJS, and browser IIFE | SATISFIED | ESM (`index.js`), CJS (`index.cjs`), IIFE (`index.iife.js`) all produced and functional |
| BUILD-02: TypeScript declarations generated (.d.ts and .d.cts) | SATISFIED | `index.d.ts` (ESM) and `index.d.cts` (CJS) both generated, 483 lines each |
| BUILD-03: Browser bundle exposes `window.x402Validate` with `{ validate, detect, normalize }` | SATISFIED | Verified via vm.runInContext -- all three are callable functions |
| BUILD-04: Browser bundle under 15KB minified | BLOCKED | IIFE is 26,781 bytes (26.78KB), 74% over the 15KB target |
| BUILD-05: `package.json` with correct `exports`, `main`, `module`, `types`, `files` fields | SATISFIED | All fields present and pointing to correct files. publint validates with zero errors, zero warnings |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | -- | -- | -- | -- |

No TODO, FIXME, placeholder, or stub patterns found in `tsdown.config.ts` or `package.json`.

### Human Verification Required

### 1. Visual TypeScript IntelliSense Check

**Test:** Open a TypeScript file that imports from `x402check`, hover over `validate()` call and its return value
**Expected:** IntelliSense shows `validate(input: string | object, options?: ValidationOptions): ValidationResult` with full field autocompletion on the result (`valid`, `errors`, `warnings`, `version`, `normalized`)
**Why human:** Cannot programmatically verify IDE behavior; structural verification confirms the types exist but IDE integration depends on tsconfig and editor configuration

### 2. Browser Script Tag Integration

**Test:** Create an HTML file with `<script src="dist/index.iife.js"></script>` and call `window.x402Validate.validate(...)` in a subsequent script
**Expected:** `x402Validate` is available on `window`, `validate()` returns a proper result object
**Why human:** vm.runInContext approximates but does not perfectly replicate browser `<script>` tag behavior

### Gaps Summary

**One gap blocks full goal achievement: the browser bundle exceeds the 15KB minified size target.**

The IIFE bundle is 26,781 bytes (26.78KB minified), which is 74% over the 15,360-byte target specified in success criterion #3 and requirement BUILD-04. The gzipped transfer size is 9,038 bytes (9.06KB), which is well within reasonable limits for browser delivery.

The size overage is caused by vendored cryptographic libraries (keccak256 from @noble/hashes, base58/bech32 from @scure/base) that are required for address validation. This crypto code represents the bulk of the bundle and cannot be removed without breaking EVM address checksum validation and Solana address decoding.

**Resolution options:**
1. **Revise the requirement** to accept 26.78KB minified (or redefine the target as gzipped size, where 9.06KB is well under 15KB). The original 15KB target was set before the crypto vendoring decision in Phase 7.
2. **Make crypto optional** by lazy-loading or splitting address validation into a separate entry point, reducing the core bundle. This would be a significant architectural change.
3. **Accept as-is with documentation** noting the tradeoff: zero runtime dependencies requires bundling crypto, which pushes the size above the original estimate.

All other aspects of the phase goal are fully achieved: ESM, CJS, and IIFE bundles work correctly; type declarations are comprehensive; package.json is properly configured; publint validates with zero issues; all 217 tests pass.

---

*Verified: 2026-01-29T20:02:00Z*
*Verifier: Claude (gsd-verifier)*
