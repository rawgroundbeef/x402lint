---
phase: 10-website-integration
plan: 01
subsystem: ui
tags: [iife, cdn, jsdelivr, adapter-pattern, browser-bundle, caip-2]

# Dependency graph
requires:
  - phase: 09-build-pipeline
    provides: IIFE bundle at dist/index.iife.js with window.x402Lint global
  - phase: 08-validation-rules
    provides: validate() orchestrator returning ValidationResult
provides:
  - Website loads SDK via single IIFE script tag (replaces 4 legacy scripts)
  - Adapter layer mapping SDK validate() to old display-compatible shape
  - CAIP-2 reverse lookup for user-friendly chain display names
  - Show v2 equivalent uses SDK normalize() function
affects: [10-02 cleanup and example config updates]

# Tech tracking
tech-stack:
  added: [jsdelivr CDN for x402lint IIFE bundle]
  patterns: [adapter pattern for SDK-to-legacy-UI mapping, CAIP-2 reverse lookup]

key-files:
  modified:
    - apps/website/index.html
    - apps/website/input.js

key-decisions:
  - "Omit SRI integrity hash until package is published to npm"
  - "Map flat-legacy to flat in adapter for backward-compatible format labels"
  - "Detect v2-marketplace by checking normalized.extensions for metadata/outputSchema"
  - "Include all known CAIP-2 networks in reverse lookup (not just original 4)"

patterns-established:
  - "Adapter pattern: validateX402Config() wraps SDK validate() preserving old API shape"
  - "CAIP-2 reverse lookup: CAIP2_TO_SIMPLE map for user-friendly chain names"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 10 Plan 01: Website SDK Integration Summary

**Replaced 5 legacy script tags with single SDK IIFE bundle via jsDelivr CDN, with adapter layer mapping SDK validate() to old display shape**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-30T01:35:32Z
- **Completed:** 2026-01-30T01:38:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced 5 script tags (ethers.js, bs58, chains.js, validator.js, input.js) with 2 (SDK IIFE + input.js)
- Created adapter layer in input.js that maps SDK ValidationResult to old display-compatible shape
- Updated format labels to spec-correct names (Flat Legacy, v2 Canonical)
- Replaced generateV2Equivalent() with SDK normalize() for Show v2 equivalent button
- Updated FAQ with CAIP-2 identifiers, expanded chain list, and SDK attribution

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace script tags and create adapter layer** - `c6a036f` (feat)
2. **Task 2: Update display logic for SDK-specific result differences** - `507c3a4` (feat)

## Files Created/Modified
- `apps/website/index.html` - Replaced script tags, updated format labels, tab labels, showV2Equivalent, FAQ
- `apps/website/input.js` - Added SDK adapter (validateX402Config, mapVersionToFormat, adaptNormalized, normalizeAmount, CAIP2_TO_SIMPLE)

## Decisions Made
- **Omit SRI integrity hash** - Package not yet published to npm; including a fake hash would break loading. SRI to be added during publish workflow.
- **Map flat-legacy to flat** - Old display code expects 'flat' not 'flat-legacy'; adapter translates for backward compatibility.
- **Detect v2-marketplace via extensions** - SDK returns 'v2' for all v2 configs; adapter checks normalized.extensions for metadata/outputSchema to set v2-marketplace format label.
- **Include all known networks in CAIP-2 reverse lookup** - Extended beyond original 4 chains to include avalanche, stellar, aptos for forward compatibility.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Website integration core complete, SDK replaces legacy validation
- Ready for Plan 02: cleanup (remove validator.js, chains.js) and update example configs to canonical v2 format
- Note: validator.js and chains.js are no longer loaded but still present in the repo; cleanup is Plan 02's scope

---
*Phase: 10-website-integration*
*Completed: 2026-01-29*
