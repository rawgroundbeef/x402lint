---
phase: 07-crypto-vendoring-and-address-validation
plan: 02
subsystem: validation
tags: [address-validation, evm, solana, eip-55, base58, caip-2, checksum, cross-chain]

# Dependency graph
requires:
  - phase: 07-crypto-vendoring-and-address-validation
    plan: 01
    provides: keccak256, Base58, EIP-55 crypto primitives
  - phase: 06-types-detection-normalization
    plan: 03
    provides: Network registry with CAIP-2 namespace extraction
provides:
  - validateEvmAddress with EIP-55 checksum verification (warnings for bad/missing checksum)
  - validateSolanaAddress with Base58 + 32-byte length validation
  - validateAddress dispatcher routing by CAIP-2 namespace
  - Cross-chain mismatch detection (EVM on Solana, Solana on EVM)
  - Validation barrel exports + main index.ts crypto/validation exports
affects: [08-validation-orchestrator, future address validation enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CAIP-2 namespace dispatch: eip155 -> EVM, solana -> Solana, stellar/aptos -> accept any"
    - "Cross-chain mismatches caught by dispatch (wrong format = error), not explicit ADDRESS_NETWORK_MISMATCH"
    - "Checksum issues are warnings (severity: warning), format issues are errors (severity: error)"
    - "All-digits addresses (0x000...000) bypass checksum checks - no warning needed"

key-files:
  created:
    - packages/x402lint/src/validation/evm-address.ts
    - packages/x402lint/src/validation/solana-address.ts
    - packages/x402lint/src/validation/address.ts
    - packages/x402lint/src/validation/index.ts
    - packages/x402lint/test/validation/evm-address.test.ts
    - packages/x402lint/test/validation/solana-address.test.ts
    - packages/x402lint/test/validation/address.test.ts
  modified:
    - packages/x402lint/src/index.ts

key-decisions:
  - "Checksum errors are warnings (not errors) - all-lowercase/bad-checksum addresses are valid but risky"
  - "All-digits addresses (no hex letters) bypass checksum validation - no warning for 0x000...000"
  - "Cross-chain mismatches caught naturally by dispatch (EVM address on Solana = Base58 format error)"
  - "Unknown namespaces return empty issues array - registry warnings handled by Phase 8 orchestrator"
  - "Stellar and Aptos namespaces accept any address - deep validation deferred to future phases"

patterns-established:
  - "Chain-specific validators (validateEvmAddress, validateSolanaAddress) handle format details"
  - "Dispatcher (validateAddress) routes by CAIP-2 namespace using getNetworkNamespace"
  - "Validation returns ValidationIssue[] with code, field, message, severity, fix"
  - "Fix suggestions include computed correct values (checksummed address, expected format)"

# Metrics
duration: 2.9min
completed: 2026-01-29
---

# Phase 07 Plan 02: Address Validation Summary

**Chain-specific address validators with CAIP-2 dispatch, EIP-55 checksum warnings, Solana Base58 validation, and cross-chain mismatch detection**

## Performance

- **Duration:** 2.9 min (174 seconds)
- **Started:** 2026-01-29T21:55:13Z
- **Completed:** 2026-01-29T21:58:07Z
- **Tasks:** 2
- **Files modified:** 8 (created 7, modified 1)

## Accomplishments

- Created validateEvmAddress with EIP-55 checksum verification (warnings for bad/missing checksum, errors for format)
- Created validateSolanaAddress with Base58 format + 32-byte decoded length validation
- Created validateAddress dispatcher routing by CAIP-2 namespace (eip155, solana, stellar, aptos, unknown)
- Comprehensive test suites: 13 EVM tests, 9 Solana tests, 12 dispatch tests
- Cross-chain mismatch tests verify EVM address on Solana = error, Solana address on EVM = error
- Updated src/index.ts to export crypto and validation modules
- All-digits address handling (0x000...000 produces no checksum warning)
- All 93 tests pass (Phase 6 + Phase 7)

## Task Commits

Each task was committed atomically:

1. **Task 1: EVM and Solana address validation modules with dispatch** - `c9429f4` (feat)
2. **Task 2: Address validation test suites with cross-chain mismatch tests** - `66b85eb` (test)

## Files Created/Modified

**Created:**
- `packages/x402lint/src/validation/evm-address.ts` - EVM address format + EIP-55 checksum validation
- `packages/x402lint/src/validation/solana-address.ts` - Solana Base58 + 32-byte length validation
- `packages/x402lint/src/validation/address.ts` - CAIP-2 namespace dispatch router
- `packages/x402lint/src/validation/index.ts` - Validation barrel export
- `packages/x402lint/test/validation/evm-address.test.ts` - 13 EVM validation tests
- `packages/x402lint/test/validation/solana-address.test.ts` - 9 Solana validation tests
- `packages/x402lint/test/validation/address.test.ts` - 12 dispatch and cross-chain tests

**Modified:**
- `packages/x402lint/src/index.ts` - Added crypto and validation exports

**Deleted:**
- `packages/x402lint/src/validation/.gitkeep` - Replaced with real modules

## Decisions Made

**1. Checksum issues are warnings, not errors**
- **Rationale:** All-lowercase and incorrectly-checksummed addresses are technically valid (42 hex chars with 0x prefix), just risky
- **Impact:** Users can proceed with lowercase addresses but receive clear fix suggestions with correct checksummed version
- **Validation output:** `severity: 'warning'` for NO_EVM_CHECKSUM and BAD_EVM_CHECKSUM

**2. All-digits addresses bypass checksum validation**
- **Rationale:** Addresses like 0x000...000 have no hex letters (a-f), so uppercase/lowercase comparison is meaningless
- **Impact:** Zero address and other all-digits addresses produce no warnings
- **Implementation:** Check `/[a-f]/.test(hexPart)` before issuing NO_EVM_CHECKSUM, check `/[A-F]/.test(hexPart)` before skipping uppercase checksum, check `/^[0-9]{40}$/.test(hexPart)` to accept all-digits

**3. Cross-chain mismatches caught by dispatch, not explicit code**
- **Rationale:** Dispatch naturally catches format mismatches (EVM address on Solana fails Base58 regex, Solana on EVM fails 0x prefix check)
- **Impact:** No need for ADDRESS_NETWORK_MISMATCH error in this phase - dispatch handles it
- **Implementation:** validateAddress extracts namespace, routes to chain validator, wrong format = format error for that chain

**4. Unknown namespaces return empty issues array**
- **Rationale:** Network registry validation (Phase 8) handles unknown networks with UNKNOWN_NETWORK warning
- **Impact:** Address validation doesn't duplicate network validation concerns
- **Implementation:** `default: return []` in switch statement

**5. Stellar and Aptos accept any address**
- **Rationale:** Deep validation for these chains deferred to future phases
- **Impact:** Any string accepted as valid address for stellar:* and aptos:* networks
- **Implementation:** `case 'stellar': case 'aptos': return []`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] All-digits addresses incorrectly produced NO_EVM_CHECKSUM warning**
- **Found during:** Task 2 test execution
- **Issue:** Address `0x0000000000000000000000000000000000000000` triggered NO_EVM_CHECKSUM warning because `address === address.toLowerCase()` is true for all-digits strings
- **Fix:** Added `/[a-f]/.test(hexPart)` check before issuing NO_EVM_CHECKSUM warning, plus `/^[0-9]{40}$/.test(hexPart)` check to explicitly accept all-digits addresses
- **Files modified:** `packages/x402lint/src/validation/evm-address.ts`
- **Verification:** All 93 tests pass, zero address produces no issues
- **Committed in:** `66b85eb` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed bug
**Impact on plan:** Minor logic refinement for edge case (all-digits addresses). No scope changes.

## Issues Encountered

None - single auto-fixed bug during test execution.

## Test Results

**EVM address validation (13 tests):**
- ✅ Valid EIP-55 checksummed addresses (4 reference vectors) produce zero issues
- ✅ All-lowercase address produces NO_EVM_CHECKSUM warning with fix suggestion containing correct checksum
- ✅ All-uppercase addresses (including all-uppercase letters + all-digits) produce zero issues
- ✅ Bad checksum produces BAD_EVM_CHECKSUM warning with fix suggestion containing correct checksum
- ✅ Invalid formats (no 0x, wrong length, invalid chars, empty) produce INVALID_EVM_ADDRESS errors

**Solana address validation (9 tests):**
- ✅ Valid addresses (system program all-1s, SPL Token program, typical wallet) produce zero issues
- ✅ Invalid Base58 chars (special chars, excluded chars 0/O/I/l) produce INVALID_SOLANA_ADDRESS errors
- ✅ Wrong length (too short, too long) produces INVALID_SOLANA_ADDRESS errors
- ✅ Valid Base58 but wrong decoded byte length produces INVALID_SOLANA_ADDRESS error
- ✅ Empty string produces INVALID_SOLANA_ADDRESS error

**Address dispatch (12 tests):**
- ✅ Valid EVM address on EVM network (Base, unknown eip155) produces zero issues
- ✅ Valid Solana address on Solana network produces zero issues
- ✅ EVM address on Solana network produces INVALID_SOLANA_ADDRESS error (cross-chain mismatch)
- ✅ Solana address on EVM network produces INVALID_EVM_ADDRESS error (cross-chain mismatch)
- ✅ Stellar namespace accepts any address (even invalid-looking ones)
- ✅ Aptos namespace accepts any address
- ✅ Unknown namespaces return empty array (bitcoin:mainnet)
- ✅ Invalid CAIP-2 format returns empty array (network errors handled elsewhere)

## User Setup Required

None - all validation logic is pure functions with no external dependencies.

## Next Phase Readiness

**Ready for Phase 08 (Validation Orchestrator):**
- ✅ validateAddress ready for per-accepts-entry payTo validation
- ✅ Cross-chain mismatches caught automatically by dispatch
- ✅ EIP-55 checksum warnings provide actionable fix suggestions
- ✅ Stellar/Aptos namespaces gracefully handled (accept any for now)
- ✅ All validation functions exported from src/index.ts for orchestrator import
- ✅ 93 tests pass (44 Phase 6 + 15 Phase 7-01 crypto + 34 Phase 7-02 validation)

**Test coverage:**
- 93 total tests pass
- Zero TypeScript errors
- All must_haves verified:
  - ✅ EIP-55 checksummed address passes with zero issues
  - ✅ All-lowercase produces NO_EVM_CHECKSUM warning (not error)
  - ✅ Bad checksum produces BAD_EVM_CHECKSUM warning (not error)
  - ✅ Invalid EVM format produces INVALID_EVM_ADDRESS error
  - ✅ Valid Solana address passes with zero issues
  - ✅ Invalid Solana address produces INVALID_SOLANA_ADDRESS error
  - ✅ EVM on Solana produces error (dispatch catches)
  - ✅ Solana on EVM produces error (dispatch catches)
  - ✅ CAIP-2 namespace dispatch works (eip155 -> EVM, solana -> Solana)
  - ✅ Unknown namespaces accepted gracefully
  - ✅ Stellar/Aptos accept any address

**Key exports verified:**
- ✅ `import { validateAddress, validateEvmAddress, validateSolanaAddress } from './src/index'` resolves
- ✅ `import { keccak256, decodeBase58, toChecksumAddress } from './src/index'` resolves (crypto exports from 07-01)

---
*Phase: 07-crypto-vendoring-and-address-validation*
*Completed: 2026-01-29*
