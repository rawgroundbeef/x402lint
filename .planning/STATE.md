# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Developers can validate their x402 config in under 30 seconds with actionable feedback
**Current focus:** Phase 10 - Documentation and Website (v2.0 Spec-Compliant SDK)

## Current Position

Phase: 9 of 10 (Build Pipeline and Package Publishing)
Plan: 1 of 1 in current phase
Status: Phase complete
Last activity: 2026-01-29 — Completed 09-01-PLAN.md

Progress: [██████████░] 83% (10/12 plans across 8 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (3 v1.0 + 10 v2.0)
- Average duration: 2.9 min
- Total execution time: 0.62 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation & Validation | 2/2 | 5.4 min | 2.7 min |
| 2 - Input & Proxy | 1/2 | 4.0 min | 4.0 min |
| 5 - Repository Restructuring | 1/1 | 3.0 min | 3.0 min |
| 6 - Types, Detection, Normalization | 3/3 | 8.8 min | 2.9 min |
| 7 - Crypto Vendoring & Address Validation | 2/2 | 7.3 min | 3.7 min |
| 8 - Validation Rules & Orchestrator | 3/3 | 9.3 min | 3.1 min |
| 9 - Build Pipeline & Package Publishing | 1/1 | 3.0 min | 3.0 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list.
Recent decisions affecting current work:

| Decision | Phase | Impact |
|----------|-------|--------|
| Include root ('.') in pnpm-workspace.yaml | 05-01 | Cloudflare Pages compatibility |
| Use relative path for tsconfig extends | 05-01 | TypeScript package resolution |
| Explicit noUncheckedIndexedAccess + exactOptionalPropertyTypes | 05-01 | Maximum type safety (not in strict: true) |
| Named exports only (no default) | 05-01 | IIFE/UMD browser compatibility |
| Zero runtime deps: Vendor Base58 + keccak256 | Roadmap | Minimal bundle size |
| Use tsdown (not tsup) | Roadmap | Better UMD support, actively maintained |
| 27 error codes with satisfies Record<> enforcement | 06-01 | Type-safe message mapping |
| prop?: T \| undefined for optional fields | 06-01 | exactOptionalPropertyTypes compliance |
| Store EVM addresses in lowercase for case-insensitive lookup | 06-03 | Asset registry implementation |
| Separate isValidCaip2 from isKnownNetwork | 06-03 | Unknown-but-valid networks produce warnings not errors |
| Use community convention for Aptos networks (aptos:1, aptos:2) | 06-03 | No official CAIP namespace yet |
| Detection uses x402Version value, not resource presence | 06-02 | v2 without resource detects as v2, fails validation later |
| Payments array alone identifies flat-legacy format | 06-02 | Handles nested network/chain in payments entries |
| Preserve unrecognized networks through normalization | 06-02 | Validation catches unknown networks with actionable errors |
| Use @noble/hashes and @scure/base as devDependencies | 07-01 | Tree-shakeable crypto, zero runtime deps |
| Import @noble/hashes subpaths with .js extension | 07-01 | Package exports field requires explicit .js |
| Add DOM lib to package tsconfig for TextEncoder | 07-01 | ES2022 alone doesn't provide TextEncoder in all contexts |
| NO_EVM_CHECKSUM separate from BAD_EVM_CHECKSUM | 07-01 | Distinguish no-checksum from wrong-checksum guidance |
| Checksum errors are warnings (not errors) | 07-02 | All-lowercase/bad-checksum addresses valid but risky |
| All-digits addresses bypass checksum validation | 07-02 | 0x000...000 has no hex letters, no meaningful case comparison |
| Cross-chain mismatches caught by dispatch | 07-02 | EVM on Solana fails Base58, no explicit ADDRESS_NETWORK_MISMATCH needed |
| Pull error codes forward when downstream modules need them | 08-01 | INVALID_URL/INVALID_TIMEOUT added in Task 1 to unblock fields.ts |
| Cast literal types to number for runtime safety checks | 08-01 | NormalizedConfig.x402Version is literal 2 but runtime value could be anything |
| Separate runPipeline() from validate() for clean try/catch | 08-02 | Safety net boundary stays minimal, pipeline logic stays readable |
| Route issues by severity field, not by rule module | 08-02 | Network and timeout validation return both errors and warnings |
| Orchestrator routes timeout by severity | 08-03 | INVALID_TIMEOUT is error, MISSING_MAX_TIMEOUT is warning |
| Use IIFE format (not UMD) for browser bundle | 09-01 | tsdown supports IIFE natively, functionally equivalent |
| ESM output as .js (not .mjs) per type:module convention | 09-01 | Package declares type:module, Node interprets .js as ESM |
| Split types conditions in exports for ESM/CJS | 09-01 | publint best practice for correct TypeScript resolution |
| IIFE bundle 27KB raw / 9KB gzip acceptable | 09-01 | Crypto vendoring tradeoff for zero runtime deps |

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-29
Stopped at: Completed 09-01-PLAN.md (Phase 9 complete)
Resume file: None
Next: Plan Phase 10 (Documentation and Website)
