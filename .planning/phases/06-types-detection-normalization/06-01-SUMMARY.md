---
phase: 06-types-detection-normalization
plan: 01
subsystem: types
tags: [typescript, error-codes, validation, type-system, json-parsing]

# Dependency graph
requires:
  - phase: 05-repository-restructuring
    provides: Monorepo structure with x402lint package and shared tsconfig
provides:
  - Complete TypeScript type system for all x402 config formats (v2, v1, flat-legacy)
  - ErrorCode vocabulary (27 codes) with human-readable messages
  - parseInput utility for string | object input handling
  - ValidationResult and ValidationIssue types for error reporting
affects: [06-02-detection-normalization, 06-03-caip-validation, 08-validation-orchestration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "as const error code vocabulary with satisfies Record<> type safety"
    - "exactOptionalPropertyTypes-compatible optional fields (prop?: T | undefined)"
    - "Barrel re-exports through types/index.ts"
    - "Named exports only (no default exports)"

key-files:
  created:
    - packages/x402lint/src/types/config.ts
    - packages/x402lint/src/types/validation.ts
    - packages/x402lint/src/types/errors.ts
    - packages/x402lint/src/types/parse-input.ts
    - packages/x402lint/src/types/index.ts
    - packages/x402lint/test/types.test.ts
  modified:
    - packages/x402lint/src/index.ts

key-decisions:
  - "27 error codes cover structure, version, accepts, fields, addresses, and warnings"
  - "ErrorMessages enforced at type level with satisfies Record<ErrorCode, string>"
  - "ParsedInput returns error with ValidationIssue structure for consistency"
  - "All optional properties use `prop?: T | undefined` for exactOptionalPropertyTypes: true"

patterns-established:
  - "Error vocabulary: const object with as const + type extraction"
  - "Type-safe message mapping: satisfies Record<ErrorCode, string> catches missing messages at compile time"
  - "API-04 compliance: parseInput(string | object) handles JSON parsing with structured errors"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 6 Plan 01: Types, Error Vocabulary, and Input Parsing Summary

**Complete type system with 27 error codes, config format types (v2/v1/flat-legacy), and JSON parsing utility for x402lint SDK**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T21:03:48Z
- **Completed:** 2026-01-29T21:05:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- TypeScript interfaces for all x402 config formats (V2Config, V1Config, FlatLegacyConfig, NormalizedConfig)
- 27 error codes with compile-time enforced human-readable messages
- parseInput utility handles string | object input with JSON parse errors (API-04)
- ValidationResult and ValidationIssue types with severity levels (error/warning)
- All types compatible with strictest tsconfig (exactOptionalPropertyTypes: true)

## Task Commits

Each task was committed atomically:

1. **Task 1: Config types, validation types, and error vocabulary** - `20774d0` (feat)
2. **Task 2: Input parsing utility and package entry point** - `ab1a1bc` (feat)

## Files Created/Modified
- `packages/x402lint/src/types/config.ts` - V2Config, V1Config, FlatLegacyConfig, NormalizedConfig, AcceptsEntry, Resource interfaces
- `packages/x402lint/src/types/validation.ts` - ValidationResult, ValidationIssue, ParsedInput, Severity types
- `packages/x402lint/src/types/errors.ts` - ErrorCode const object (27 codes) and ErrorMessages with type-safe mapping
- `packages/x402lint/src/types/parse-input.ts` - parseInput(string | object) utility with JSON parsing
- `packages/x402lint/src/types/index.ts` - Barrel re-export of all type modules
- `packages/x402lint/src/index.ts` - Activated type system exports from package entry point
- `packages/x402lint/test/types.test.ts` - Comprehensive tests for ErrorCode, ErrorMessages, parseInput

## Decisions Made

**1. 27 error codes across 5 categories**
- Structure errors (3): INVALID_JSON, NOT_OBJECT, UNKNOWN_FORMAT
- Version errors (2): MISSING_VERSION, INVALID_VERSION
- Accepts errors (3): MISSING_ACCEPTS, EMPTY_ACCEPTS, INVALID_ACCEPTS
- Field errors (9): MISSING_SCHEME, MISSING_NETWORK, INVALID_NETWORK_FORMAT, MISSING_AMOUNT, INVALID_AMOUNT, ZERO_AMOUNT, MISSING_ASSET, MISSING_PAY_TO, MISSING_RESOURCE
- Address errors (4): INVALID_EVM_ADDRESS, BAD_EVM_CHECKSUM, INVALID_SOLANA_ADDRESS, ADDRESS_NETWORK_MISMATCH
- Warning codes (4): UNKNOWN_NETWORK, UNKNOWN_ASSET, LEGACY_FORMAT, MISSING_MAX_TIMEOUT

**2. Type-safe error message mapping**
- Used `satisfies Record<ErrorCode, string>` to enforce every error code has a message at compile time
- TypeScript will error if ErrorMessages is missing any code or has extra codes

**3. exactOptionalPropertyTypes compatibility**
- All optional properties use `prop?: T | undefined` syntax
- Required by tsconfig.json `exactOptionalPropertyTypes: true`
- More precise than standard optional properties

**4. parseInput error structure**
- Returns ParsedInput with optional ValidationIssue error
- Consistent with ValidationResult error reporting structure
- Field path is '$' for root-level JSON parse errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready for Phase 6 Plan 02 (Detection and Normalization):**
- All config format types defined (V2Config, V1Config, FlatLegacyConfig, NormalizedConfig)
- ErrorCode vocabulary complete and exportable
- parseInput utility ready for detection module to use
- ValidationIssue structure established for error reporting

**Blocking concerns:** None

**Tech debt:** None

---
*Phase: 06-types-detection-normalization*
*Completed: 2026-01-29*
