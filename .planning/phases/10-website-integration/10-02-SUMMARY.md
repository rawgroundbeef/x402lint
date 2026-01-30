---
phase: 10-website-integration
plan: 02
subsystem: ui
tags: [examples, cleanup, v2-canonical, caip-2]

# Dependency graph
requires:
  - phase: 10-website-integration
    plan: 01
    provides: SDK adapter layer and updated display logic
provides:
  - Example configs updated to canonical v2 format with CAIP-2 networks
  - v2 is default example tab
  - validator.js and chains.js deleted
affects: []

# Tech tracking
tech-stack:
  removed: [validator.js, chains.js]
  patterns: [v2-first example ordering]

key-files:
  modified:
    - apps/website/index.html
  deleted:
    - apps/website/validator.js
    - apps/website/chains.js

key-decisions:
  - "v2 is default (first) example tab"
  - "Example amounts use atomic units as strings per spec"
  - "Flat legacy example kept for demonstration of deprecation warnings"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 10 Plan 02: Example Config Updates and CDN Cleanup Summary

**Updated example configs to canonical v2 format, deleted legacy validator.js and chains.js**

## Performance

- **Duration:** 2 min
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 1
- **Files deleted:** 2

## Accomplishments
- Reordered example tabs: v2 (Recommended) is now default, followed by v1, Flat (Legacy), + Marketplace
- All example configs use canonical v2 format with CAIP-2 networks, scheme, resource fields
- Deleted validator.js and chains.js (replaced by SDK)
- User-verified end-to-end flow working

## Task Commits

1. **Task 1: Update example configs and tabs** - `25008f5` (feat)
2. **Task 2: Delete old validator.js and chains.js** - `961afbe` (chore)
3. **Task 3: End-to-end verification** - User approved

## Files Modified
- `apps/website/index.html` - Example configs, tab order, default tab
- `apps/website/validator.js` - DELETED
- `apps/website/chains.js` - DELETED

## Deviations from Plan
- SDK IIFE script tag changed from jsdelivr CDN to local `x402check.iife.js` symlink (package not yet published to npm)

## Issues Encountered
- jsdelivr CDN URL 404'd because package not published yet; switched to local bundle symlink

---
*Phase: 10-website-integration*
*Completed: 2026-01-29*
