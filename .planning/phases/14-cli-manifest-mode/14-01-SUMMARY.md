---
phase: 14-cli-manifest-mode
plan: 01
subsystem: cli
tags: [cli, args, fetch, detection, manifest]
requires: [13-manifest-validation]
provides: [cli-args-parsing, cli-fetch-redirects, cli-input-detection]
affects: [14-02]
tech-stack:
  added: [cli-table3]
  patterns: [node-util-parseArgs, manual-redirect-tracking, manifest-auto-detection]
key-files:
  created:
    - packages/x402lint/src/cli/args.ts
    - packages/x402lint/src/cli/fetch.ts
    - packages/x402lint/src/cli/detect.ts
  modified:
    - packages/x402lint/package.json
decisions:
  - slug: cli-table3-as-devdep
    title: cli-table3 installed as devDependency
    rationale: tsdown bundles it into cli.mjs (same pattern as @noble/hashes and c32check)
  - slug: node-util-parseargs
    title: Use node:util parseArgs instead of custom parser
    rationale: Modern Node API provides built-in argument parsing with repeatable flags and short options
  - slug: manual-redirect-tracking
    title: Manual redirect handling with configurable limits
    rationale: Allows custom header forwarding across redirects and timeout enforcement (existing fetch() auto-followed all redirects without timeout)
  - slug: stdin-dash-convention
    title: Stdin reading via readStdin() helper
    rationale: Supports both TTY detection and explicit '-' positional arg (Plan 02 handles the '-' convention)
metrics:
  duration: 1 min
  tasks: 3
  commits: 3
  files-created: 3
  files-modified: 1
completed: 2026-02-04
---

# Phase 14 Plan 01: CLI Infrastructure Modules Summary

**One-liner:** Created three CLI modules (args, fetch, detect) with node:util parseArgs, manual redirect tracking up to 5 hops, and manifest auto-detection with wild manifest normalization support.

## Objective Completed

Created CLI infrastructure modules that extract argument parsing, URL fetching with redirect tracking, and input detection/loading into focused modules. These modules will be composed in Plan 02 to create the manifest-aware CLI flow.

## Work Summary

### Task 1: Install cli-table3 and Create Args Module
**Commit:** 7d2da03

Installed cli-table3 as devDependency and created `src/cli/args.ts` with modern argument parsing:

- Uses `node:util` parseArgs API (built-in since Node 16.17)
- Supports `--header` flag multiple times to collect custom HTTP headers
- Parses header strings (`Key: Value`) into `Record<string, string>`
- Includes all existing flags: `--strict`, `--json`, `--quiet/-q`, `--help/-h`, `--version/-v`
- Note: No `-s` short flag for `--strict` to avoid future conflicts

**Files created:**
- `packages/x402lint/src/cli/args.ts` (2012 bytes)

**Files modified:**
- `packages/x402lint/package.json` (added cli-table3 ^0.6.5)

### Task 2: Create Fetch Module with Redirect Tracking
**Commit:** 2273f89

Created `src/cli/fetch.ts` with manual redirect handling:

- Manual redirect loop for 301/302/303/307/308 status codes
- Configurable limits: maxRedirects (default 5), timeoutMs (default 10s)
- Uses `AbortSignal.timeout()` for request timeout enforcement
- Resolves relative Location headers correctly via `new URL(location, currentUrl)`
- Accepts custom headers object for authentication
- Auto-parses JSON responses based on Content-Type header
- Throws errors for missing Location header or redirect limit exceeded

**Key improvement over existing cli.ts fetchUrl():**
- Existing: Auto-followed all redirects with no timeout or custom headers
- New: Tracks redirect count, enforces timeout, supports custom headers

**Files created:**
- `packages/x402lint/src/cli/fetch.ts` (2593 bytes)

### Task 3: Create Input Detection/Loading Module
**Commit:** 579d984

Created `src/cli/detect.ts` with comprehensive input handling:

- `resolveInput(rawInput)`: Handles file reading, JSON parsing, and format detection
  - If not JSON-like string, tries to read as file (with proper error messages)
  - Parses JSON and detects format using existing `detect()` function
  - Attempts wild manifest normalization for unknown formats
  - Returns InputResult with type (manifest | single-config | url) and optional warnings

- `readStdin()`: Reads stdin until EOF (same pattern as existing cli.ts)
  - Returns empty string if TTY (no piped input)
  - Buffers chunks and returns concatenated UTF-8 string

- `isUrl()` and `isJsonLike()`: Simple string pattern detection helpers

**Integration with existing detection:**
- Imports `detect()` from `../detection/detect.ts`
- Imports `normalizeWildManifest()` from `../detection/wild-manifest.ts`
- Preserves all normalization warnings for display to user

**Files created:**
- `packages/x402lint/src/cli/detect.ts` (3380 bytes)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Module Exports

**src/cli/args.ts:**
- `parseCliArgs(argv: string[]): CliArgs`
- `CliArgs` interface (input, strict, json, quiet, help, version, headers)

**src/cli/fetch.ts:**
- `fetchWithRedirects(url, options?): Promise<FetchResult>`
- `FetchResult` interface (status, body, headers)

**src/cli/detect.ts:**
- `resolveInput(rawInput: string): InputResult`
- `readStdin(): Promise<string>`
- `isUrl(s: string): boolean`
- `isJsonLike(s: string): boolean`
- `InputType` type ('manifest' | 'single-config' | 'url')
- `InputResult` interface (type, data, normalizationWarnings?)

### Dependencies Added

**cli-table3 ^0.6.5** (devDependency)
- Used for formatted table output in CLI
- Bundled into cli.mjs by tsdown (same pattern as other deps)
- License: MIT
- Bundle impact: TBD (will measure after Plan 02 integration)

### Type Safety

All modules compile cleanly with TypeScript strict mode:
- Fixed `fetchOptions.headers` conditional assignment to satisfy exactOptionalPropertyTypes
- Type assertion `parsed as string | object` for detect() call (JSON.parse returns unknown)

## Decisions Made

1. **cli-table3 as devDependency:** Follows existing pattern (tsdown bundles into CLI, not exposed to library users)

2. **node:util parseArgs API:** Modern built-in solution superior to custom string parsing:
   - Built-in support for repeatable flags (`multiple: true`)
   - Short option aliases (`-q`, `-h`, `-v`)
   - Proper positional argument handling
   - Type-safe API

3. **Manual redirect tracking:** Provides control needed for:
   - Custom header forwarding across redirects
   - Timeout enforcement per-request
   - Redirect limit protection
   - Better error messages (Location missing, loop detected)

4. **Manifest auto-detection in resolveInput():** Single entry point for all input handling:
   - Detects canonical manifests via `detect()`
   - Attempts wild manifest normalization for unknown formats
   - Returns type + warnings for display
   - Centralizes file reading and error handling

## Next Phase Readiness

**Ready for Plan 02:** CLI Main Flow Rewrite

All three modules are self-contained and importable. Plan 02 will:
- Import parseCliArgs, fetchWithRedirects, resolveInput, readStdin
- Compose them into manifest-aware CLI flow
- Handle `-` (dash) stdin convention
- Add manifest result formatting (table output using cli-table3)
- No blockers or concerns

**No blockers.**

## Testing Notes

- TypeScript compilation passes with no errors
- All exports are correctly typed
- Files created with proper imports and dependencies
- Runtime testing deferred to Plan 02 integration (will test full CLI flow end-to-end)

## File Summary

| File | Size | Lines | Purpose |
|------|------|-------|---------|
| src/cli/args.ts | 2.0 KB | 70 | Argument parsing with util.parseArgs |
| src/cli/fetch.ts | 2.6 KB | 94 | URL fetching with redirect tracking |
| src/cli/detect.ts | 3.4 KB | 124 | Input detection and loading |
| package.json | +1 line | - | Added cli-table3 devDependency |

**Total:** 3 new files, 1 modified file, 288 lines of new code
