---
phase: 07-crypto-vendoring-and-address-validation
plan: 01
subsystem: crypto
tags: [keccak256, base58, eip-55, noble-hashes, scure-base, checksums, address-validation]

# Dependency graph
requires:
  - phase: 06-types-detection-normalization
    provides: Error code infrastructure and type system
provides:
  - Keccak-256 hash function (NOT SHA-3) via @noble/hashes
  - Base58 decoder with leading-zero preservation via @scure/base
  - EIP-55 checksum address encoding and validation
  - NO_EVM_CHECKSUM error code for all-lowercase EVM addresses
  - Comprehensive canary tests proving cryptographic correctness
affects: [07-02-address-validation, future address validation phases]

# Tech tracking
tech-stack:
  added:
    - "@noble/hashes ^2.0.1 (devDependency) - audited crypto primitives"
    - "@scure/base ^2.0.0 (devDependency) - Base58 encoding/decoding"
  patterns:
    - "Crypto primitive wrappers isolate library APIs from SDK"
    - "Canary tests with reference vectors prove algorithm correctness"
    - "Import from @noble/hashes/sha3.js (exports field requires .js extension)"
    - "Add DOM lib to tsconfig when using TextEncoder in ES2022-only context"

key-files:
  created:
    - packages/x402lint/src/crypto/keccak256.ts
    - packages/x402lint/src/crypto/base58.ts
    - packages/x402lint/src/crypto/eip55.ts
    - packages/x402lint/src/crypto/index.ts
    - packages/x402lint/test/crypto/keccak256.test.ts
    - packages/x402lint/test/crypto/base58.test.ts
    - packages/x402lint/test/crypto/eip55.test.ts
  modified:
    - packages/x402lint/src/types/errors.ts
    - packages/x402lint/tsconfig.json
    - packages/x402lint/package.json

key-decisions:
  - "Use @noble/hashes and @scure/base as devDependencies (tree-shakeable with bundler)"
  - "Import from @noble/hashes/sha3.js not /sha3 (package.json exports requires .js)"
  - "Add DOM lib to package tsconfig for TextEncoder (ES2022 alone insufficient)"
  - "EIP-55 validation: all-lowercase and all-uppercase return false (not checksummed)"
  - "Handle noUncheckedIndexedAccess by checking char/hashChar existence in eip55"

patterns-established:
  - "Crypto wrappers provide SDK-specific signatures isolating from library changes"
  - "Canary tests with known-bad outputs (SHA-3 vs Keccak-256) prove correctness"
  - "Reference test vectors from specs (EIP-55, Solana all-1s address) ensure compliance"

# Metrics
duration: 4.4min
completed: 2026-01-29
---

# Phase 07 Plan 01: Crypto Vendoring and Address Validation Summary

**Audited crypto primitives (keccak256, Base58, EIP-55) with canary tests proving Keccak-256 (not SHA-3) and Base58 leading-zero preservation**

## Performance

- **Duration:** 4.4 min (264 seconds)
- **Started:** 2026-01-29T21:46:12Z
- **Completed:** 2026-01-29T21:50:36Z
- **Tasks:** 2
- **Files modified:** 11 (created 7, modified 4)

## Accomplishments

- Installed @noble/hashes and @scure/base as devDependencies (zero runtime deps)
- Created keccak256 wrapper producing Keccak-256 (NOT SHA-3) hex output
- Created decodeBase58 wrapper preserving leading zero bytes
- Created EIP-55 checksum address encoder and validator
- Added NO_EVM_CHECKSUM error code (28th total error code)
- Comprehensive test suites with 15 new tests proving cryptographic correctness via canary vectors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install crypto libraries and create keccak256 + Base58 wrappers** - `2efc897` (feat)
2. **Task 2: Crypto primitive test suites with canary vectors** - `8b240f1` (test)

## Files Created/Modified

**Created:**
- `packages/x402lint/src/crypto/keccak256.ts` - Keccak-256 hash (NOT SHA-3) via @noble/hashes
- `packages/x402lint/src/crypto/base58.ts` - Base58 decoder with error handling
- `packages/x402lint/src/crypto/eip55.ts` - EIP-55 mixed-case checksum encoder and validator
- `packages/x402lint/src/crypto/index.ts` - Barrel export for all crypto primitives
- `packages/x402lint/test/crypto/keccak256.test.ts` - 5 tests including Keccak-256 vs SHA-3 canary
- `packages/x402lint/test/crypto/base58.test.ts` - 5 tests including all-1s address canary
- `packages/x402lint/test/crypto/eip55.test.ts` - 5 tests with six EIP-55 reference vectors

**Modified:**
- `packages/x402lint/src/types/errors.ts` - Added NO_EVM_CHECKSUM error code and message
- `packages/x402lint/tsconfig.json` - Added DOM lib for TextEncoder support
- `packages/x402lint/package.json` - Added @noble/hashes and @scure/base devDependencies
- `pnpm-lock.yaml` - Dependency lock update

## Decisions Made

**1. Use .js extension in @noble/hashes import**
- **Rationale:** Package exports field requires `@noble/hashes/sha3.js` not `/sha3`
- **Impact:** TypeScript moduleResolution: bundler requires explicit .js for subpath exports

**2. Add DOM lib to package-specific tsconfig**
- **Rationale:** ES2022 lib alone doesn't provide TextEncoder in all contexts
- **Impact:** Enables browser-compatible TextEncoder without node: imports

**3. NO_EVM_CHECKSUM separate from BAD_EVM_CHECKSUM**
- **Rationale:** All-lowercase addresses (no checksum) vs wrong checksum are different issues
- **Impact:** Validation can distinguish "add checksum" from "fix checksum" guidance

**4. Handle noUncheckedIndexedAccess in EIP-55 implementation**
- **Rationale:** TypeScript strict mode requires undefined checks on array access
- **Impact:** Added char/hashChar existence check in checksum loop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .js extension to @noble/hashes import**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `import from '@noble/hashes/sha3'` failed with TS2307 (cannot find module)
- **Fix:** Changed to `'@noble/hashes/sha3.js'` per package.json exports field requirement
- **Files modified:** `packages/x402lint/src/crypto/keccak256.ts`
- **Verification:** TypeScript compilation succeeds
- **Committed in:** `2efc897` (Task 1 commit)

**2. [Rule 3 - Blocking] Added DOM lib to tsconfig**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** TextEncoder not found despite ES2022 lib (TS2304)
- **Fix:** Added `"lib": ["ES2022", "DOM"]` to package tsconfig.json
- **Files modified:** `packages/x402lint/tsconfig.json`
- **Verification:** TypeScript compilation succeeds, TextEncoder available
- **Committed in:** `2efc897` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed noUncheckedIndexedAccess type errors in eip55**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Array indexing returns `T | undefined` with noUncheckedIndexedAccess, causing TS18048 errors
- **Fix:** Added `if (!char || !hashChar) continue` guard in checksum loop
- **Files modified:** `packages/x402lint/src/crypto/eip55.ts`
- **Verification:** TypeScript compilation succeeds, runtime logic unchanged
- **Committed in:** `2efc897` (Task 1 commit)

**4. [Rule 1 - Bug] Added explicit type annotation for Array.from map function**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `Array.from(hash).map(b => ...)` had `b: unknown` causing TS2345
- **Fix:** Added explicit type: `.map((b: number) => ...)`
- **Files modified:** `packages/x402lint/src/crypto/keccak256.ts`
- **Verification:** TypeScript compilation succeeds
- **Committed in:** `2efc897` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All fixes required for TypeScript compilation. No behavioral changes or scope changes.

## Issues Encountered

None - all deviations were TypeScript configuration and type safety fixes handled automatically.

## Canary Test Results

**Keccak-256 vs SHA-3 canary:**
- ✅ `keccak256('')` returns `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
- ✅ Does NOT return SHA-3-256 hash `a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a`
- **Proves:** Using Keccak-256 (pre-FIPS version) not SHA-3-256 (FIPS version)

**Base58 leading-zero preservation canary:**
- ✅ `decodeBase58('11111111111111111111111111111111')` returns 32 bytes of all zeros
- **Proves:** Leading '1' characters map to 0x00 bytes (Solana system program address)

**EIP-55 reference vectors:**
- ✅ All six canonical test vectors from EIP-55 specification produce correct checksummed output
- ✅ All-lowercase and all-uppercase addresses correctly return false for isValidChecksum
- **Proves:** EIP-55 checksum algorithm implementation is spec-compliant

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Address Validation):**
- ✅ keccak256 available for EVM address checksum computation
- ✅ decodeBase58 available for Solana address validation
- ✅ toChecksumAddress and isValidChecksum available for EIP-55 enforcement
- ✅ NO_EVM_CHECKSUM error code ready for validation results
- ✅ All crypto primitives fully tested with canary vectors

**Test coverage:**
- 59 total tests pass (44 from Phase 6 + 15 new crypto tests)
- Zero TypeScript errors
- Zero runtime dependencies (crypto libs are devDependencies only)

**Blocker resolution:**
- ✅ Keccak-256 vendoring strategy: devDependency with tree-shaking via bundler (tsdown)
- ✅ Confirmed @noble/hashes and @scure/base are audited and actively maintained

---
*Phase: 07-crypto-vendoring-and-address-validation*
*Completed: 2026-01-29*
