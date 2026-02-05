# Phase 5: Repository Restructuring - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the repo into a monorepo with the SDK package skeleton. The existing website keeps working after restructuring. No new validation logic, no build outputs, no publishing — just giving the SDK code a home so all subsequent phases have a place to land.

</domain>

<decisions>
## Implementation Decisions

### Workspace tooling
- pnpm workspaces (pnpm-workspace.yaml)
- Root package.json has proxy scripts: `build:sdk`, `test:sdk`, `lint:sdk` that run `pnpm --filter x402lint <command>`
- Website is its own workspace member (not plain files at root)
- SDK package name: `x402lint` (matches repo, `import { validate } from 'x402lint'`)

### Directory layout
- `apps/website/` — website workspace (deployable app)
- `packages/x402lint/` — SDK workspace (library)
- `packages/config/` — shared config package (tsconfig base, eslint, prettier)
- `.planning/` stays at repo root (project-wide concern)
- Website file reorganization within `apps/website/` — Claude's discretion based on current file structure

### SDK package skeleton
- `src/` pre-organized into subdirectories matching upcoming phases: `src/types/`, `src/detection/`, `src/validation/`, `src/crypto/`
- Test setup included in this phase: vitest config, `test/` dir, one smoke test that imports index.ts
- TypeScript maximum strict: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### Claude's Discretion
- What the initial `index.ts` exports (stubs, types, or empty barrel — whatever fits best)
- Whether website files get reorganized into subdirs (js/, css/) or stay flat within `apps/website/`
- Exact vitest configuration details
- Shared config package contents and structure

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is that the website must still load and function after the move.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-repository-restructuring*
*Context gathered: 2026-01-29*
