# Features Research — v3.0 Manifest Validation & CLI

**Project:** x402lint v3.0 milestone
**Researched:** 2026-02-04
**Confidence:** MEDIUM-HIGH

## Executive Summary

v3.0 adds 6 new features (MF-1 through MF-6) building on the v2.0 foundation. All v2.0 table stakes and differentiators are already implemented (validate, detect, normalize, strict mode, address validation, error/warning distinction, known registries). The new features compose existing APIs rather than replacing them.

## v2.0 Foundation (IMPLEMENTED)

All table stakes and differentiators shipped in v2.0:
- `validate()` with 30 error codes, layered L1-L5 validation
- `detect()` returning `v2`, `v1`, `flat-legacy`, `unknown`
- `normalize()` converting any format to canonical v2
- Strict mode (warnings become errors)
- EVM (EIP-55 checksum) and Solana (Base58) address validation
- Extensible chain validation registry (CAIP-2)
- Known networks and known assets registries
- Actionable fix suggestions on every error

## v3.0 New Features

### MF-1: Manifest Validation (Collection Processing)

| Aspect | Detail |
|--------|--------|
| **Pattern** | Per-endpoint validation reusing `validate()` + aggregate reporting |
| **Complexity** | LOW |
| **Key** | Each endpoint IS a v2 PaymentRequired config; orchestrator collects results + adds manifest-level checks |
| **Output** | `ManifestValidationResult { valid, errors, warnings, endpointResults: Map<id, ValidationResult> }` |

### MF-2: CLI Manifest Support

| Aspect | Detail |
|--------|--------|
| **Pattern** | Auto-detect via `detect()` returning `'manifest'`, dispatch to `validateManifest()` |
| **Complexity** | LOW |
| **Flags** | `--json` (pure JSON), `--quiet` (exit code only), `--strict` (warnings=errors) |
| **Exit codes** | 0=valid, 1=validation errors, 2=input errors |
| **Output** | Per-endpoint summaries + cross-endpoint issues |

### MF-3: Cross-Endpoint Consistency Checks

| Aspect | Detail |
|--------|--------|
| **Pattern** | Post-validation cross-checks across all endpoints |
| **Complexity** | LOW-MEDIUM |
| **Checks** | (1) Duplicate URLs (warning), (2) Inconsistent payTo addresses (warning), (3) Network inconsistency (warning), (4) Duplicate HTTP method+path in bazaar metadata (error) |

### MF-4: Bazaar Extension Validation — Method Discrimination

| Aspect | Detail |
|--------|--------|
| **Pattern** | Discriminated union: `method` field determines input shape (GET uses queryParams, POST uses body) |
| **Complexity** | MEDIUM |
| **Key** | (1) Extension presence, (2) Schema structure `{ info, schema }`, (3) Method discrimination (GET vs POST), (4) Input schema presence, (5) Output schema optional with warning |

### MF-5: Wild Manifest Normalization

| Aspect | Detail |
|--------|--------|
| **Pattern** | Detect non-standard → transform to canonical → warn about transformation |
| **Complexity** | MEDIUM |
| **Key** | Detect non-standard shapes (e.g., biwas-style), map fields to canonical v2, infer networks from simple names, preserve unknown fields in `extra` |
| **Principle** | Normalize structure, never guess financial data |

### MF-6: Stacks Address Validation

| Aspect | Detail |
|--------|--------|
| **Pattern** | Prefix validation (SP mainnet, ST testnet) + c32check decoding |
| **Complexity** | LOW |
| **Key** | Vendor c32check, add to address dispatch switch, extend network registry |

## Differentiator Features (Post-MVP)

### DMF-1: Manifest Linting (Opinionated Best Practices)
- Warn if service.description missing
- Warn if maxTimeoutSeconds > 300
- Asset diversity and network coverage suggestions

### DMF-2: Bazaar Schema Deep Validation
- Full JSON Schema compliance checking (requires Ajv runtime)
- **Defer to post-v3.0** — high complexity, requires library dependency

## Anti-Features (Do NOT Build)

1. **Network calls** — validation must be synchronous, offline-capable, side-effect-free
2. **Payment payload construction** — that's @x402/core's job
3. **On-chain verification** — requires RPC connections, chain SDKs
4. **Overly verbose CLI output** — quiet on success, detailed on failure

## Feature Dependencies

```
v2.0 Foundation (COMPLETED):
+-- validate() (per-entry)
+-- detect() (format detection)
+-- normalize() (v1->v2, flat->v2)
+-- CLI (--json, --quiet, --strict)
+-- Address validation (EVM, Solana)

v3.0 NEW:
validateManifest()
+-- Depends on: validate() [reuse per-endpoint]
+-- Depends on: ManifestConfig types
+-- Enables: CLI manifest mode, cross-endpoint checks

Stacks address validation
+-- Depends on: c32check decoder [new]
+-- Depends on: Stacks network registry entries [new]
+-- Integrates into: existing address dispatcher

Wild manifest normalization
+-- Depends on: normalize() pattern [exists]
+-- Depends on: Manifest shape detection [new]
```

## MVP Recommendation

**Must Have:** MF-1 through MF-6 (all 6 features)
**Should Have:** DMF-1 (manifest linting)
**Defer:** DMF-2 (bazaar deep schema validation)

## Sources

- [Coinbase x402 Bazaar docs](https://docs.cdp.coinbase.com/x402/bazaar)
- [Bazaar Go package types](https://pkg.go.dev/github.com/coinbase/x402/go/extensions/bazaar)
- [Zod discriminated unions](https://zod.dev/api?id=discriminated-unions)
- [Stacks Accounts](https://docs.stacks.co/concepts/network-fundamentals/accounts)
- [ESLint CLI Reference](https://eslint.org/docs/latest/use/command-line-interface)
- [OpenAPI spec validator](https://github.com/python-openapi/openapi-spec-validator)
