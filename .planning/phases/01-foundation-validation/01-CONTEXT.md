# Phase 1: Foundation & Validation - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Validation engine that checks x402 payment configs for correctness. Validates field presence, address formats, chain/asset combinations. Distinguishes errors (blocking) from warnings (advisory). Supports both x402 v1 and v2 schemas.

</domain>

<decisions>
## Implementation Decisions

### Schema Versioning
- Support both x402 v1 and v2 schemas
- v1: `payments` array, `address` field, `minAmount`
- v2: `accepts` array, `payTo` field, `amount`, CAIP-2 network format
- Detect version from `x402Version` field
- Error if `x402Version` is missing — can't validate without knowing schema
- Tell user which version they're validating

### Validation Feedback
- Group errors by field path (top to bottom, like editing the config)
- Always include fix suggestions: one line for what's wrong, one line for how to fix
- Format: `❌ payments[0].address` / `"0x123" is not valid` / `→ EVM addresses are 42 characters`
- Count-based header + badges: "❌ Invalid — 2 errors, 1 warning"
- No machine-readable error codes for v1 — human messages only

### Error vs Warning Rules
- **Errors** (blocking): missing required fields, invalid address format, unknown chain, malformed JSON, minAmount ≤ 0, empty payments array, chain/address format mismatch
- **Warnings** (advisory): HTTP instead of HTTPS on facilitator, missing optional fields like description, deprecated fields, unusually high/low amounts
- Warnings don't block validation — "✅ Valid (1 warning)" still passes
- Two severity levels only: errors and warnings (no info tier)
- Deprecated fields get warning with migration hint: `⚠️ payTo is deprecated → use "address" instead`

### Address Validation
- Checksum validation if mixed-case provided; accept all-lowercase as valid
- Chain/address format mismatch = error (EVM address on Solana chain won't work)
- Validate known asset addresses match their chain (USDC contract on Base = known address)
- CAIP-2 network hash validation deferred to v2-specific scope

### Edge Cases
- Ignore unknown fields silently — forwards compatibility, extensions OK
- Error on empty payments/accepts array — no payment options = broken config
- Single parse error message for malformed JSON — point to line/column

### Claude's Discretion
- Exact error message wording and formatting
- Loading skeleton design
- Internal validation order and short-circuiting
- Which known assets to include in registry

</decisions>

<specifics>
## Specific Ideas

- Error format inspired by user example:
  ```
  ❌ payments[0].address
     "0x123" is not valid
     → EVM addresses are 42 characters (0x + 40 hex)
  ```
- Summary format: "❌ Invalid — 2 errors, 1 warning" at top, then detailed list with badges
- Validation should feel like a helpful linter, not a gatekeeper

</specifics>

<deferred>
## Deferred Ideas

- Machine-readable error codes / JSON output format — revisit if CI usage requested
- CAIP-2 chain ID hash validation — v2-specific enhancement
- Strict mode that fails on warnings — add if requested

</deferred>

---

*Phase: 01-foundation-validation*
*Context gathered: 2026-01-22*
