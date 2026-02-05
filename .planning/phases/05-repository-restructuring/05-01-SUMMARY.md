---
phase: 05-repository-restructuring
plan: 01
subsystem: infra
tags: [pnpm, monorepo, typescript, vitest, tsdown, workspace]

# Dependency graph
requires:
  - phase: none
    provides: v1.0 website foundation
provides:
  - pnpm workspace monorepo with 4 members (root, website, config, SDK)
  - Strict TypeScript configuration with noUncheckedIndexedAccess + exactOptionalPropertyTypes
  - SDK package skeleton at packages/x402lint/ with vitest + tsdown
  - Shared config package at packages/config/
  - Directory structure for future phases (types, detection, validation, crypto)
affects: [06-type-system, 07-crypto-utilities, 08-validation-engine, 09-build-pipeline, 10-documentation]

# Tech tracking
tech-stack:
  added: [pnpm@10.21.0, typescript@5.9.3, vitest@4.0.18, tsdown@0.20.1]
  patterns:
    - "Monorepo with root workspace member for Cloudflare Pages compatibility"
    - "Strict TypeScript with explicit noUncheckedIndexedAccess and exactOptionalPropertyTypes"
    - "Named exports only (no default) for IIFE compatibility"
    - "tsconfig extends via relative path (not package name)"

key-files:
  created:
    - pnpm-workspace.yaml
    - packages/config/typescript/base.json
    - packages/x402lint/package.json
    - packages/x402lint/src/index.ts
    - packages/x402lint/tsconfig.json
    - packages/x402lint/vitest.config.ts
    - packages/x402lint/tsdown.config.ts
  modified:
    - .gitignore (added dist/, .pnpm-debug.log)

key-decisions:
  - "Include root ('.') in pnpm-workspace.yaml for Cloudflare Pages compatibility"
  - "Use relative path extends in tsconfig (../config/typescript/base.json) not package name"
  - "Named exports only in SDK entry point (no default export)"
  - "Separate strict config flags: noUncheckedIndexedAccess and exactOptionalPropertyTypes must be explicit"

patterns-established:
  - "SDK versioning: VERSION constant exported from index.ts"
  - "Directory structure: src/{types,detection,validation,crypto}/ for phase organization"
  - "Build tooling: tsdown for multi-format builds (ESM + CJS + DTS)"
  - "Testing: vitest with globals enabled"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 5 Plan 01: Repository Restructuring Summary

**pnpm workspace monorepo with SDK skeleton at packages/x402lint/, strict TypeScript config with noUncheckedIndexedAccess, and website preserved at apps/website/ with git history intact**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T20:33:15Z
- **Completed:** 2026-01-29T20:36:14Z
- **Tasks:** 3 (2 with commits)
- **Files modified:** 25

## Accomplishments
- Created pnpm workspace with 4 members: root, @x402lint/website, @x402lint/config, x402lint
- Moved all website files to apps/website/ preserving git history via git mv
- Set up SDK package skeleton with TypeScript strict mode, vitest, and tsdown
- Established shared TypeScript base config with maximum strictness (noUncheckedIndexedAccess + exactOptionalPropertyTypes)
- Created directory structure for future phases (types, detection, validation, crypto)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo scaffold and move website** - `761d791` (chore)
2. **Task 2: Create shared config and SDK package skeleton** - `abdac30` (feat)
3. **Task 3: Verify workspace integrity and website health** - (verification only, no commit)

## Files Created/Modified

**Created:**
- `pnpm-workspace.yaml` - Workspace definition with root, apps/*, packages/*
- `package.json` - Root package with SDK proxy scripts (build:sdk, test:sdk, lint:sdk)
- `.npmrc` - pnpm strictness config (shamefully-hoist=false, strict-peer-dependencies=true)
- `apps/website/package.json` - Website workspace member package manifest
- `packages/config/package.json` - Shared config package manifest
- `packages/config/typescript/base.json` - Strict TypeScript base config
- `packages/x402lint/package.json` - SDK package manifest with ESM + CJS exports
- `packages/x402lint/tsconfig.json` - SDK TypeScript config extending shared base
- `packages/x402lint/vitest.config.ts` - Test runner configuration
- `packages/x402lint/tsdown.config.ts` - Build tool configuration
- `packages/x402lint/src/index.ts` - SDK entry point with VERSION export
- `packages/x402lint/test/index.test.ts` - Smoke test verifying SDK imports
- `packages/x402lint/src/{types,detection,validation,crypto}/.gitkeep` - Directory structure for future phases

**Modified:**
- `.gitignore` - Added monorepo patterns (dist/, .pnpm-debug.log)
- All website files moved from root to `apps/website/` via git mv (history preserved)

## Decisions Made

**1. Include root in pnpm-workspace.yaml**
- Rationale: Cloudflare Pages compatibility (RESEARCH.md Pitfall 1)
- Pattern: `packages: ['.', 'apps/*', 'packages/*']`

**2. Use relative path for tsconfig extends**
- Rationale: TypeScript doesn't resolve package names in extends without node_modules setup (RESEARCH.md Pitfall 5)
- Pattern: `"extends": "../config/typescript/base.json"`

**3. Explicit strict TypeScript flags**
- Rationale: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are NOT included in `strict: true`
- Impact: Maximum type safety for SDK development

**4. Named exports only (no default)**
- Rationale: IIFE/UMD compatibility for browser usage
- Pattern: `export const VERSION = '...'` not `export default { VERSION }`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**test-validator.html not tracked by git**
- Issue: `git mv` failed for test-validator.html, test-verify.html, verify-all.html (in .gitignore)
- Resolution: Used regular `mv` for untracked files, `git mv` for tracked files
- Impact: Git history preserved for tracked files, untracked files moved successfully

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 6 (Type System):**
- `packages/x402lint/src/types/` directory exists and ready for type definitions
- TypeScript compilation works with strict mode enabled
- Test infrastructure in place (vitest configured and passing)
- Build tooling ready (tsdown configured for multi-format output)

**Blockers:** None

**Concerns:**
- tsdown UMD config specifics will need verification during Phase 9 (Build Pipeline)
- Keccak-256 vendoring strategy to decide in Phase 7 (Crypto Utilities)

---
*Phase: 05-repository-restructuring*
*Completed: 2026-01-29*
