---
phase: 11-manifest-types-detection
plan: 01
subsystem: types
tags: [typescript, manifest, detection, type-guards, config-format]

# Dependency graph
requires:
  - phase: 06-types
    provides: V2Config, ConfigFormat, validation types
  - phase: 06-detection
    provides: detect(), normalize(), type guards pattern
provides:
  - ManifestConfig type with endpoints Record structure
  - Extended ConfigFormat union including 'manifest'
  - isManifestConfig() type guard with correct detection order
  - 7 manifest-specific error codes
  - Manifest validation result types for Phase 13
affects: [13-manifest-validation, 14-cli, 15-website]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Manifest-first detection order (manifest checked before v2)
    - Shallow structural type guards (endpoints collection)
    - Empty endpoints ({}) valid for manifest initialization

key-files:
  created:
    - packages/x402lint/src/types/manifest.ts
  modified:
    - packages/x402lint/src/types/config.ts
    - packages/x402lint/src/types/errors.ts
    - packages/x402lint/src/detection/guards.ts
    - packages/x402lint/src/detection/detect.ts
    - packages/x402lint/src/detection/normalize.ts
    - packages/x402lint/src/index.ts
    - packages/x402lint/test/integration.test.ts

key-decisions:
  - "Manifest detection must occur before v2 (manifests may have x402Version: 2)"
  - "Empty endpoints ({}) is valid to allow manifest initialization"
  - "Manifest error codes marked as unreachable until Phase 13 validation implemented"
  - "Type guards (isManifestConfig, isV2Config, isV1Config) exported from main entry for SDK users"

patterns-established:
  - "Detection order critical: manifest → v2 → v1 → unknown"
  - "Type guards check structure only, not field values (shallow validation)"
  - "normalize() returns null for manifests (collections, not single configs)"

# Metrics
duration: 5min
completed: 2026-02-04
---

# Phase 11 Plan 01: Manifest Types & Detection Summary

**Canonical ManifestConfig type with endpoints Record, manifest-first detection order, and type guard exporting 7 error codes for Phase 13 validation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-04T17:34:23Z
- **Completed:** 2026-02-04T17:39:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- ManifestConfig type with service metadata and endpoints Record<string, V2Config>
- Extended ConfigFormat union to include 'manifest' as first option
- isManifestConfig() type guard with correct structural validation
- detect() now checks manifest before v2 (critical ordering)
- 7 manifest-specific error codes for Phase 13 to consume
- All 294 existing tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Manifest types, extended ConfigFormat, and error codes** - `b79f7be` (feat)
   - Created ManifestConfig, ServiceMetadata, ServiceContact, ManifestValidationResult types
   - Extended ConfigFormat to 'manifest' | 'v2' | 'v1' | 'unknown'
   - Added 7 manifest error codes and messages

2. **Task 2: Manifest type guard, detection order, and normalize switch** - `a9755a9` (feat)
   - Added isManifestConfig() type guard checking endpoints collection
   - Updated detect() to check manifest BEFORE v2
   - Added 'manifest' case to normalize() switch (returns null)
   - Updated integration test for manifest error codes

3. **Export manifest type guards from main entry** - `8647179` (feat)
   - Exported isManifestConfig, isV2Config, isV1Config from main index
   - Ensures type guards importable from x402lint package

## Files Created/Modified
- `packages/x402lint/src/types/manifest.ts` - ManifestConfig, ServiceMetadata, ServiceContact, ManifestValidationResult types
- `packages/x402lint/src/types/config.ts` - Extended ConfigFormat union to include 'manifest'
- `packages/x402lint/src/types/errors.ts` - Added 7 manifest-specific error codes and messages
- `packages/x402lint/src/types/index.ts` - Export manifest types
- `packages/x402lint/src/detection/guards.ts` - isManifestConfig() type guard
- `packages/x402lint/src/detection/detect.ts` - Manifest-first detection order
- `packages/x402lint/src/detection/normalize.ts` - Handle 'manifest' case (returns null)
- `packages/x402lint/src/index.ts` - Export type guards from main entry
- `packages/x402lint/test/integration.test.ts` - Mark manifest error codes as unreachable until Phase 13

## Decisions Made
- **Manifest detection order:** Manifest must be checked before v2 since manifests may contain `x402Version: 2` at the manifest level. Checking v2 first would incorrectly classify manifests as single v2 configs.
- **Empty endpoints valid:** `{ endpoints: {} }` returns true from isManifestConfig() to allow manifest initialization patterns.
- **Shallow type guards:** isManifestConfig() only checks structural properties (has endpoints Record, each endpoint has accepts array), not field values. Deep validation happens in Phase 13 validateManifest().
- **Type guard exports:** Exported isManifestConfig, isV2Config, isV1Config from main SDK entry to enable SDK users to discriminate config types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated integration test for manifest error codes**
- **Found during:** Task 2 verification (test run)
- **Issue:** Integration test exercises all ErrorCode values. Added 7 manifest error codes but they're not reachable until Phase 13 implements validateManifest(). Test was failing.
- **Fix:** Added 7 manifest error codes to `expectedUnreachableFromPipeline` array with comment explaining they're not yet exercised (manifest validation is Phase 13)
- **Files modified:** packages/x402lint/test/integration.test.ts
- **Verification:** All 294 tests pass
- **Committed in:** a9755a9 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Export type guards from main entry point**
- **Found during:** Task 2 verification (checking plan verification criteria)
- **Issue:** Plan verification states "isManifestConfig function is importable from x402lint" but it was only exported from detection module, not main entry point
- **Fix:** Added isManifestConfig, isV2Config, isV1Config to main index.ts exports
- **Files modified:** packages/x402lint/src/index.ts
- **Verification:** Checked dist/index.d.ts contains isManifestConfig in export list, runtime test confirmed isManifestConfig(manifest) = true, isManifestConfig(v2) = false
- **Committed in:** 8647179 (separate commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for test suite correctness and SDK API completeness. No scope creep.

## Issues Encountered
None. Plan executed smoothly with expected TypeScript compilation error in Task 1 (exhaustive switch) resolved by Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Manifest types and detection complete
- Phase 12 (Stacks validation) can run in parallel
- Phase 13 (Manifest validation) blocked on this phase - now ready
- Manifest error codes defined but not yet exercised (will be tested in Phase 13)
- All existing 294 tests pass, no regressions

**Blocker:** None

**Concerns:** None - manifest-first detection order working correctly, type guards behaving as expected

---
*Phase: 11-manifest-types-detection*
*Completed: 2026-02-04*
