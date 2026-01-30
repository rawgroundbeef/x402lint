---
phase: 09-build-pipeline-and-package-publishing
plan: 01
subsystem: infra
tags: [tsdown, rolldown, esm, cjs, iife, umd, publint, bundle, tree-shaking]

# Dependency graph
requires:
  - phase: 08-validation-rules-and-orchestrator
    provides: "Complete SDK source with validate/detect/normalize exports"
  - phase: 07-crypto-vendoring-and-address-validation
    provides: "Vendored keccak256 + base58 crypto with .js import extensions"
  - phase: 05-repository-restructuring
    provides: "Monorepo structure with tsdown build tooling"
provides:
  - "Multi-format build: ESM (index.js), CJS (index.cjs), IIFE (index.iife.js)"
  - "TypeScript declarations: index.d.ts (ESM) and index.d.cts (CJS)"
  - "Publish-ready package.json with split exports, files, sideEffects"
  - "publint-validated package configuration (zero errors, zero warnings)"
affects: [10-documentation-and-website]

# Tech tracking
tech-stack:
  added: [publint]
  patterns: ["Multi-format build via tsdown array config", "Split types conditions in exports for ESM/CJS", "IIFE format for browser script tag usage"]

key-files:
  created: []
  modified:
    - "packages/x402check/tsdown.config.ts"
    - "packages/x402check/package.json"

key-decisions:
  - "Use IIFE format instead of UMD (tsdown supports IIFE natively, functionally equivalent for browser script tags)"
  - "ESM output is index.js (not .mjs) because package type is 'module'"
  - "Split types conditions in exports (import.types -> .d.ts, require.types -> .d.cts) per publint recommendation"
  - "IIFE bundle at 26.78KB minified (9.06KB gzip) exceeds 15KB raw target due to vendored crypto -- acceptable tradeoff for zero runtime deps"

patterns-established:
  - "Array config pattern for tsdown multi-format builds"
  - "publint validation as pre-publish gate"
  - "Split types conditions for dual ESM/CJS TypeScript resolution"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 9 Plan 01: Build Pipeline Summary

**Multi-format tsdown build (ESM + CJS + IIFE) with publint-validated package.json exports and zero-error publish configuration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-30T00:55:21Z
- **Completed:** 2026-01-30T00:58:17Z
- **Tasks:** 2
- **Files modified:** 3 (tsdown.config.ts, package.json, pnpm-lock.yaml)

## Accomplishments
- Configured tsdown for three output formats: ESM (index.js), CJS (index.cjs), IIFE (index.iife.js)
- TypeScript declarations generated for both ESM (.d.ts) and CJS (.d.cts) module systems
- publint validates with zero errors and zero warnings
- All three module formats verified: validate, detect, normalize export as callable functions
- All 217 existing tests pass with no regressions
- Package.json configured with split exports, files whitelist, sideEffects: false, prepublishOnly script

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure tsdown multi-format build and update package.json** - `e2c9bf7` (feat)
2. **Task 2: Build SDK and verify all output artifacts** - `62b2eee` (feat)

## Files Created/Modified
- `packages/x402check/tsdown.config.ts` - Multi-format array config: ESM+CJS (neutral, dts, sourcemaps) + IIFE (browser, minified, globalName x402Validate)
- `packages/x402check/package.json` - Split exports with per-condition types, files whitelist, sideEffects: false, publint devDep, prepublishOnly script
- `pnpm-lock.yaml` - Updated with publint dependency

## Build Output Summary

| File | Format | Size | Gzip |
|------|--------|------|------|
| dist/index.js | ESM | 59.24 KB | 16.10 KB |
| dist/index.cjs | CJS | 59.90 KB | 16.20 KB |
| dist/index.iife.js | IIFE | 26.78 KB | 9.06 KB |
| dist/index.d.ts | ESM types | 15.39 KB | 4.10 KB |
| dist/index.d.cts | CJS types | 15.39 KB | 4.11 KB |

## Decisions Made

1. **IIFE instead of UMD**: tsdown v0.20.1 supports IIFE format natively. UMD and IIFE are functionally equivalent for browser `<script>` tags -- both assign to a global variable (`window.x402Validate`).

2. **ESM output as `.js` not `.mjs`**: Since the package declares `"type": "module"`, Node.js interprets `.js` files as ESM. tsdown follows this convention. No `.mjs` extension needed.

3. **Split types conditions**: publint flagged that a single `types` field is ambiguous for require consumers. Split into `exports["."].import.types` (-> `.d.ts`) and `exports["."].require.types` (-> `.d.cts`) for correct TypeScript resolution in both module systems.

4. **Bundle size exceeds 15KB raw but 9KB gzipped**: The IIFE bundle is 26.78KB minified due to vendored crypto (keccak256 from @noble/hashes, base58/bech32 from @scure/base). This is an unavoidable consequence of the zero-runtime-deps decision. The gzipped transfer size is 9.06KB, which is excellent. No code was removed -- all crypto is actively used for address validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM output filename mismatch**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan specified `./dist/index.mjs` for ESM output, but tsdown produces `./dist/index.js` when package type is "module"
- **Fix:** Updated package.json module and exports.import to reference `./dist/index.js`
- **Files modified:** packages/x402check/package.json
- **Verification:** ESM import test passes, publint validates
- **Committed in:** `62b2eee` (Task 2 commit)

**2. [Rule 1 - Bug] IIFE output filename differs from plan**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan expected `index.umd.js` but tsdown IIFE format outputs `index.iife.js`
- **Fix:** No code change needed -- IIFE is functionally equivalent, tests updated to use actual filename
- **Verification:** IIFE test passes in vm context with window.x402Validate

**3. [Rule 2 - Missing Critical] publint types warning for CJS consumers**
- **Found during:** Task 2 (publint validation)
- **Issue:** Single `types` field in exports was ambiguous for `require` condition consumers
- **Fix:** Split into nested `import.types` and `require.types` conditions pointing to `.d.ts` and `.d.cts` respectively
- **Files modified:** packages/x402check/package.json
- **Verification:** publint reports "All good!" (zero errors, zero warnings)
- **Committed in:** `62b2eee` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes were necessary for correct package resolution. The IIFE filename and ESM extension differences are tsdown conventions, not bugs in our config. The types split was a publint best practice. No scope creep.

## Issues Encountered

- **IIFE bundle size (26.78KB) exceeds 15KB plan target**: The vendored crypto libraries (keccak256, base58, bech32) account for the majority of the bundle. This is an inherent tradeoff of the zero-runtime-deps architecture decision. The gzipped size (9.06KB) is well within acceptable limits for browser delivery. No action taken -- removing crypto would break address validation.

- **IIFE global scope testing in Node.js**: The `var x402Validate = (function(e){...})({})` pattern creates a module-scoped variable in Node.js CJS, not a global. Used Node.js `vm.runInContext()` to simulate browser global scope for testing. In actual browser `<script>` tags, `var` at top level correctly becomes `window.x402Validate`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Build pipeline complete and validated
- dist/ outputs ready for Phase 10 website integration (IIFE filename is `index.iife.js`)
- Package is publish-ready: `pnpm --filter x402check prepublishOnly` runs tests + build + publint
- No blockers for Phase 10

---
*Phase: 09-build-pipeline-and-package-publishing*
*Completed: 2026-01-29*
