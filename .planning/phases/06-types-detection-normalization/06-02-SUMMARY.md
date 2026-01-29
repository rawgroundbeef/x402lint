---
phase: 06-types-detection-normalization
plan: 02
subsystem: detection
tags: [typescript, type-guards, normalization, format-detection]

# Dependency graph
requires:
  - phase: 06-01
    provides: Type definitions for V2Config, V1Config, FlatLegacyConfig, ConfigFormat
  - phase: 06-03
    provides: getCanonicalNetwork for simple name to CAIP-2 mapping
provides:
  - detect() function identifying config format
  - normalize() function converting any format to canonical v2 shape
  - Type guard functions for runtime format detection
  - Format-specific normalization transformers
affects: [07-field-validation, 08-validation-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime type guards for format discrimination"
    - "Normalization pipeline with format-specific transformers"
    - "Never-throw API design (return 'unknown' or null for invalid input)"

key-files:
  created:
    - packages/x402check/src/detection/guards.ts
    - packages/x402check/src/detection/detect.ts
    - packages/x402check/src/detection/normalize.ts
    - packages/x402check/src/detection/index.ts
    - packages/x402check/test/detection.test.ts
  modified:
    - packages/x402check/src/index.ts

key-decisions:
  - "Detection uses accepts array + x402Version value, not resource presence"
  - "Payments array alone is sufficient to detect flat-legacy format"
  - "Normalization preserves unknown networks for validation to catch later"

patterns-established:
  - "Type guard pattern: isRecord check → specific field checks → type predicate"
  - "Normalization pattern: detect format → switch → format-specific transformer"
  - "Always return new objects from normalization (never mutate input)"

# Metrics
duration: 4min
completed: 2026-01-29
---

# Phase 6 Plan 2: Detection and Normalization Summary

**detect() and normalize() APIs converting any x402 config format to canonical v2 shape with type-safe guards and format-specific transformers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-29T21:14:16Z
- **Completed:** 2026-01-29T21:18:49Z
- **Tasks:** 2
- **Files modified:** 6
- **Test cases:** 23 (all passing)

## Accomplishments

- Implemented detect() returning ConfigFormat union ('v2' | 'v1' | 'flat-legacy' | 'unknown')
- Implemented normalize() converting all formats to canonical v2 shape or returning null
- Created runtime type guards (isV2Config, isV1Config, isFlatLegacyConfig)
- Built format-specific transformers (normalizeV2, normalizeV1ToV2, normalizeFlatToV2)
- Achieved 100% test coverage across 23 test cases covering all format combinations

## Task Commits

Each task was committed atomically:

1. **Task 1: Type guards and detect() function** - `2106028` (feat)
2. **Task 2: normalize() with format transformers** - `0f797d5` (feat)

## Files Created/Modified

**Created:**
- `packages/x402check/src/detection/guards.ts` - Runtime type guards for format detection
- `packages/x402check/src/detection/detect.ts` - Main detect() function with ordered format checking
- `packages/x402check/src/detection/normalize.ts` - Normalization pipeline with format transformers
- `packages/x402check/src/detection/index.ts` - Barrel exports for detection module
- `packages/x402check/test/detection.test.ts` - Comprehensive test suite (23 tests)

**Modified:**
- `packages/x402check/src/index.ts` - Exported detect and normalize from package entry point

## Decisions Made

**1. Detection uses x402Version value, not resource presence**
- Rationale: Resource is required by spec but its absence is a validation error, not a detection failure. Detection should be lenient, validation strict.
- Impact: v2 configs without resource still detect as 'v2' and fail validation later with actionable error.

**2. Payments array alone identifies flat-legacy format**
- Rationale: Flat-legacy can have `payments: [...]` where network/chain is nested inside each entry, not at root level.
- Impact: Guard checks for payments array first before requiring root-level network field.

**3. Preserve unrecognized networks through normalization**
- Rationale: normalizeFlatToV2 tries getCanonicalNetwork() but keeps original value if mapping fails.
- Impact: Validation catches unknown networks later with actionable error message, not silent in normalization.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed payments array detection**
- **Found during:** Task 2 (Running tests)
- **Issue:** Test "detects flat config with payments array" failed - guard required root-level network field but payments variant has nested network
- **Fix:** Updated isFlatLegacyConfig to check for payments array first, making it sufficient for detection
- **Files modified:** packages/x402check/src/detection/guards.ts
- **Verification:** Test passes, payments array with nested chain/network fields correctly detects as flat-legacy
- **Committed in:** 0f797d5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary to handle payments array variant correctly. No scope creep.

## Issues Encountered

None - plan executed smoothly after guard fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 7 (Field Validation):**
- detect() and normalize() fully functional and tested
- All formats convertible to canonical v2 shape
- Extra and extensions preserved through normalization (FMT-08)
- Test suite covers all format combinations and edge cases

**API Surface Complete:**
- API-02: detect() returns ConfigFormat ✓
- API-03: normalize() returns NormalizedConfig | null ✓
- API-04: Both accept string | object ✓
- API-07: Named exports only ✓
- FMT-01 through FMT-08: All format requirements satisfied ✓

**No blockers.** Phase 7 can begin field validation using normalized configs.

---
*Phase: 06-types-detection-normalization*
*Completed: 2026-01-29*
