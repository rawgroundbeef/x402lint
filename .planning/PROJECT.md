# x402lint

## What This Is

A developer tool and npm package for validating x402 payment configurations. The `x402lint` SDK provides `validate()`, `detect()`, and `normalize()` APIs for any JavaScript/TypeScript project, while the website at x402lint.com offers instant browser-based validation with actionable fix suggestions.

## Core Value

Developers can validate their x402 config in under 30 seconds and get specific, fixable feedback.

## Current State

**Shipped:** v2.0 Spec-Compliant SDK (2026-02-04)
**Live:** x402lint.com
**Stack:** TypeScript SDK (pnpm monorepo) + Plain HTML/JS website + Cloudflare Worker proxy
**LOC:** 2,502 lines SDK TypeScript, 11,937 total project lines
**Package:** `x402lint` — ESM + CJS + IIFE (27KB minified, 9KB gzipped)
**Tests:** 217 test cases

The SDK correctly implements the canonical x402 v1/v2 specs with CAIP-2 network validation, EIP-55 address checksums, and vendored crypto primitives. The website is rebuilt on the SDK's browser bundle.

## Requirements

### Validated

- ✓ User can enter URL or JSON and get validation results — v1.0
- ✓ Tool fetches URLs via CORS proxy — v1.0
- ✓ Clear pass/fail with actionable error messages — v1.0
- ✓ Chain-specific address validation (EVM checksum, Solana Base58) — v1.0
- ✓ Example configs loadable with one click — v1.0
- ✓ Mobile responsive — v1.0
- ✓ Spec-correct validation of x402 v1 and v2 PaymentRequired responses — v2.0
- ✓ Standalone npm package (`x402lint`) usable by any JS/TS project — v2.0
- ✓ Browser-compatible IIFE bundle loadable via `<script>` tag — v2.0
- ✓ Comprehensive test suite (217 cases, every field, every error path) — v2.0
- ✓ Format detection (`v2`, `v1`, `flat-legacy`, `unknown`) — v2.0
- ✓ Normalization of any format to canonical v2 shape — v2.0
- ✓ Deep address validation for EVM (EIP-55 checksum) and Solana (Base58) — v2.0
- ✓ Extensible chain validation (registry-based, community PRs) — v2.0
- ✓ Known networks registry (CAIP-2) and known assets registry — v2.0
- ✓ Strict mode option (warnings become errors for CI/CD) — v2.0
- ✓ Zero runtime dependencies (vendored Base58 + keccak256) — v2.0
- ✓ Website rebuilt on SDK browser bundle — v2.0

### Active

- [ ] MAN-01: Manifest schema definition (collection of v2 PaymentRequired entries with service metadata) — Phase 11
- [ ] MAN-02: Manifest detection & validation (structure, per-endpoint, cross-endpoint checks) — Phase 13
- [ ] MAN-03: Full bazaar extension validation (shape, JSON Schema, method type discrimination) — Phase 13
- [ ] MAN-04: Compatibility layer for non-standard wild manifests (normalize biwas-style formats) — Phase 11
- [ ] MAN-05: Stacks chain address validation (SP/SM addresses, c32check encoding) — Phase 12
- [ ] MAN-06: CLI (`npx x402lint <url-or-file>`) with auto-detection of single config vs manifest — Phase 14
- [ ] MAN-07: npm publish to registry — Phase 16
- [ ] MAN-08: Website manifest validation mode (paste JSON/URL, per-endpoint results) — Phase 15
- [ ] MAN-09: `validateManifest()` SDK export with `ManifestValidationResult` — Phase 13

### Out of Scope

- Test payments — validation only, no actual transactions
- Facilitator liveness checks — just validate URL format, don't ping
- On-chain balance validation — don't check if address has funds
- Batch validation of unrelated configs — manifests are structured collections, not arbitrary batches
- User accounts — contradicts simplicity
- Schema library (Zod/Ajv) internally — adds 13-50KB for ~20 rules
- Async validation — all rules are pure synchronous computation
- DNS TXT record validation — can be added later
- Bazaar registry integration — Coinbase-hosted, separate concern
- Manifest publishing/generation tools — future
- Bazaar deep JSON Schema validation (requires Ajv runtime) — deferred post-v3.0

## Current Milestone: v3.0 Manifest Validation & CLI

**Goal:** Add manifest validation (multi-endpoint x402 configs), CLI tooling, Stacks chain support, bazaar extension validation, and publish to npm.

**Target features:**
- Manifest schema: collection of v2 PaymentRequired entries with service-level metadata
- Manifest validation: structure, per-endpoint (reuses existing pipeline), cross-endpoint consistency
- Bazaar extension validation: full depth (shape + JSON Schema + method discrimination)
- Wild manifest compatibility: detect/normalize non-standard formats (biwas-style)
- Stacks address validation (c32check)
- CLI: `npx x402lint <url-or-file>` with auto-detect single vs manifest
- npm publish: make `x402lint` available on npm registry
- Website: manifest validation mode

## Context

**x402 Protocol (canonical v2 spec from coinbase/x402):**
- HTTP 402 Payment Required responses contain payment config
- Config in `PAYMENT-REQUIRED` response header (base64 JSON) — v2 transport
- Config in response body (JSON) — v1 transport
- Root fields: `x402Version` (required, must be 2), `error`, `resource`, `accepts`, `extensions`
- Each `accepts` entry: `scheme`, `network` (CAIP-2), `amount`, `asset`, `payTo`, `maxTimeoutSeconds`, `extra`
- Networks use CAIP-2 format: `eip155:8453` (Base), `solana:5eykt4...` (Solana)
- Bazaar extension (`extensions.bazaar`): per-endpoint discovery metadata (HTTP method, input params, output format, JSON Schema)
- IETF DNS discovery draft: `_x402` TXT records → `/.well-known/x402` manifest URL (schema deferred to core protocol)
- Wild manifests exist (x402.biwas.xyz) using non-standard formats without proper `accepts` arrays

**Architecture:**
- Monorepo: `packages/x402lint/` (SDK), `apps/website/` (site), `packages/config/` (shared TS config)
- SDK: Pure functions, no side effects, tree-shakeable
- Build: tsdown → ESM + CJS + IIFE
- Crypto: @noble/hashes (keccak-256), @scure/base (Base58) as devDependencies, tree-shaken into bundle

## Constraints

- **Client-side first**: All validation logic runs in browser, proxy only for URL fetching
- **CORS**: Direct URL fetches will fail, proxy required for URL input method
- **Zero runtime deps**: SDK must have no runtime dependencies for browser bundle size
- **Monorepo**: SDK lives in `packages/x402lint/`, website at `apps/website/`, pnpm workspaces

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Plain HTML/JS over React | Simplicity, zero build step, fast to ship | ✓ Good — shipped fast |
| Cloudflare Worker for proxy | Lightweight, free tier sufficient | ✓ Good — works well |
| Skip facilitator reachability | Overkill for v1 | ✓ Good |
| Layered validation (L1-L5) | Prevents error cascades | ✓ Good — keep pattern |
| Monorepo structure | SDK in packages/x402lint/, website at apps/website/ | ✓ Good — clean separation |
| Zero runtime deps | Vendor Base58 + keccak256 via tree-shaking | ✓ Good — 27KB IIFE bundle |
| TypeScript + tsdown | Type safety, ESM/CJS/IIFE output | ✓ Good — publint validated |
| Strict mode | Warnings→errors for CI/CD enforcement | ✓ Good — simple and effective |
| IIFE over UMD | tsdown supports natively, functionally equivalent for `<script>` tags | ✓ Good |
| Named exports only | IIFE compatibility, no default export confusion | ✓ Good |
| @noble/hashes as devDeps | Audited crypto, tree-shaken by bundler, zero runtime deps | ✓ Good |
| Checksum = warning not error | All-lowercase addresses are valid but risky | ✓ Good — better UX |
| CAIP-2 for networks | Canonical spec compliance, future-proof | ✓ Good — replaced simple names |
| Remove flat-legacy support | x402Version required per spec | ✓ Good — cleaner validation |
| Local IIFE bundle symlink | Package not yet published to npm | ⚠️ Revisit — publish to npm in v3.0 |

---
*Last updated: 2026-02-04 after v3.0 roadmap created*
