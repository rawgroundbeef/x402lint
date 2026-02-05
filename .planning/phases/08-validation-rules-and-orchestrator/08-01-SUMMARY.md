---
phase: 08-validation-rules-and-orchestrator
plan: 01
subsystem: validation
tags: [validation-rules, pure-functions, caip2, url-validation, timeout-validation]

# Dependency graph
requires:
  - phase: 06-types-detection-normalization
    provides: Types (NormalizedConfig, AcceptsEntry, ConfigFormat, ValidationIssue), error codes, parseInput, detect, guards, normalize
  - phase: 07-crypto-vendoring-and-address-validation
    provides: Address validation (used indirectly via error codes)
provides:
  - 6 validation rule modules (structure, version, fields, network, amount, legacy)
  - Barrel export for all rule modules
  - INVALID_URL and INVALID_TIMEOUT error codes
  - StructureResult type for enriched structure validation output
affects: [08-02 orchestrator, 08-03 tests, 09 build]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure validator functions: each returns ValidationIssue[], never throws"
    - "Enriched result type for structure validation (parsed + format + issues)"
    - "Layered validation levels: L1 structure, L2 version, L3 fields, L4 network/amount, L5 legacy"

key-files:
  created:
    - packages/x402lint/src/validation/rules/structure.ts
    - packages/x402lint/src/validation/rules/version.ts
    - packages/x402lint/src/validation/rules/fields.ts
    - packages/x402lint/src/validation/rules/network.ts
    - packages/x402lint/src/validation/rules/amount.ts
    - packages/x402lint/src/validation/rules/legacy.ts
    - packages/x402lint/src/validation/rules/index.ts
  modified:
    - packages/x402lint/src/types/errors.ts

key-decisions:
  - "Pulled INVALID_URL and INVALID_TIMEOUT error codes into Task 1 to unblock fields.ts URL validation"
  - "Cast x402Version to number in validateVersion for runtime safety despite literal type 2"

patterns-established:
  - "Pure validator pattern: (entry, fieldPath) => ValidationIssue[] for per-entry rules"
  - "Early return on missing fields: delegate to validateFields, skip in specialized validators"
  - "URL format validation via new URL() constructor with warning-level severity"
  - "Timeout validation: typeof + isInteger + positivity as sequential guards"

# Metrics
duration: 2.7min
completed: 2026-01-29
---

# Phase 8 Plan 1: Validation Rules Summary

**6 pure validation rule modules (structure/version/fields/network/amount/legacy) with INVALID_URL and INVALID_TIMEOUT error codes for orchestrator composition**

## Performance

- **Duration:** 2.7 min
- **Started:** 2026-01-29T23:51:05Z
- **Completed:** 2026-01-29T23:53:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created 6 validation rule modules organized by validation level (L1-L5)
- Each module is a pure function returning ValidationIssue[], never throwing
- validateStructure returns enriched StructureResult with parsed object, format, and issues
- validateResource validates URL format via new URL() constructor (RULE-04)
- validateTimeout validates positive integer values (RULE-10)
- validateNetwork provides fix suggestions for simple chain names via getCanonicalNetwork
- validateLegacy warns about flat-legacy and v1 formats with upgrade guidance
- Added INVALID_URL and INVALID_TIMEOUT error codes to errors.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create structure, version, and fields rule modules** - `ad0e968` (feat)
2. **Task 2: Create network, amount, legacy rule modules with barrel export** - `6e4ce37` (feat)

## Files Created/Modified
- `packages/x402lint/src/types/errors.ts` - Added INVALID_URL, INVALID_TIMEOUT codes and messages
- `packages/x402lint/src/validation/rules/structure.ts` - L1: JSON parse, object check, format detection
- `packages/x402lint/src/validation/rules/version.ts` - L2: x402Version value validation
- `packages/x402lint/src/validation/rules/fields.ts` - L3: Required field checks, accepts array, resource/URL validation
- `packages/x402lint/src/validation/rules/network.ts` - L4: CAIP-2 format, known network, known asset checks
- `packages/x402lint/src/validation/rules/amount.ts` - L4: Digit-only amount, zero check, timeout validation
- `packages/x402lint/src/validation/rules/legacy.ts` - L5: Legacy format warnings with upgrade suggestions
- `packages/x402lint/src/validation/rules/index.ts` - Barrel export for all rule modules

## Decisions Made
- **Pulled error codes to Task 1:** INVALID_URL and INVALID_TIMEOUT were planned for Task 2 but fields.ts (Task 1) needs INVALID_URL for URL format validation. Added both error codes in Task 1 to keep errors.ts consistent.
- **Cast x402Version to number:** NormalizedConfig types x402Version as literal `2`, making the `!== 1` check a type error. Cast to `number` for runtime safety since malformed inputs could have any value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved INVALID_URL and INVALID_TIMEOUT error codes to Task 1**
- **Found during:** Task 1 (fields.ts compilation)
- **Issue:** fields.ts references `ErrorCode.INVALID_URL` for URL format validation, but that code was planned to be added in Task 2
- **Fix:** Added both INVALID_URL and INVALID_TIMEOUT to errors.ts in Task 1 instead of Task 2
- **Files modified:** packages/x402lint/src/types/errors.ts
- **Verification:** TypeScript compilation passes with zero errors
- **Committed in:** ad0e968 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed version comparison type error**
- **Found during:** Task 1 (version.ts compilation)
- **Issue:** NormalizedConfig has `x402Version: 2` (literal type), so `version !== 1` is flagged by TypeScript as always true
- **Fix:** Cast `config.x402Version` to `number` for runtime safety check
- **Files modified:** packages/x402lint/src/validation/rules/version.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** ad0e968 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep -- same code, different task ordering.

## Issues Encountered
None -- both issues were addressed during initial implementation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 rule modules ready for composition by the orchestrator (Plan 02)
- Barrel export provides clean import surface
- No circular dependencies between rule modules
- Each module independently testable (Plan 03)

---
*Phase: 08-validation-rules-and-orchestrator*
*Completed: 2026-01-29*
