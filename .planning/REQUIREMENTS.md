# Requirements: x402check v2.0

**Defined:** 2026-01-29
**Core Value:** Developers can validate their x402 config in under 30 seconds with actionable feedback

## v2.0 Requirements

Requirements for spec-compliant SDK extraction and website rebuild. Each maps to roadmap phases.

### SDK Core API

- [x] **API-01**: `validate(config)` returns structured `{ valid, errors, warnings, version, normalized }` — never throws on invalid input
- [ ] **API-02**: `detect(config)` returns `'v2' | 'v1' | 'flat-legacy' | 'unknown'` based on structural markers
- [ ] **API-03**: `normalize(config)` converts any recognized format to canonical v2 shape, returns `null` if unparseable
- [ ] **API-04**: All public APIs accept `string | object` input (JSON string or parsed object)
- [x] **API-05**: `validate()` includes `normalized` field in result (null only if completely unparseable)
- [x] **API-06**: `validate(config, { strict: true })` promotes all warnings to errors
- [ ] **API-07**: Public API exported as named exports only (no default export) — `{ validate, detect, normalize }`

### Validation Rules

- [x] **RULE-01**: Level 1 — input must be valid JSON, must be an object, must have recognized format
- [x] **RULE-02**: Level 2 — `x402Version` must be present (error for v2, warning for v1/flat), must be 1 or 2
- [x] **RULE-03**: Level 2 — `accepts` array must exist and be non-empty
- [x] **RULE-04**: Level 2 — `resource` object should exist in v2 (warning), `resource.url` should be valid URL
- [x] **RULE-05**: Level 3 — `scheme` must be present (error for v2, warning for v1/flat)
- [x] **RULE-06**: Level 3 — `network` must be present and use CAIP-2 format (`namespace:reference`)
- [x] **RULE-07**: Level 3 — `amount` (v2) / `maxAmountRequired` (v1) must be present, numeric string, positive
- [x] **RULE-08**: Level 3 — `asset` must be present
- [x] **RULE-09**: Level 3 — `payTo` must be present
- [x] **RULE-10**: Level 3 — `maxTimeoutSeconds` should be present in v2 (warning), must be positive integer if present
- [x] **RULE-11**: Level 5 — Legacy format warnings: flat format, v1 field names, simple chain names, alias fields, missing scheme defaults

### Error Reporting

- [ ] **ERR-01**: Machine-readable error codes (`MISSING_SCHEME`, `INVALID_NETWORK_FORMAT`, etc.) as `as const` string constants
- [ ] **ERR-02**: Field path in dot-notation format (`accepts[0].network`) on every issue
- [ ] **ERR-03**: Human-readable error messages that a developer unfamiliar with x402 can understand
- [ ] **ERR-04**: Actionable fix suggestions where correct value can be inferred (e.g., `"Use 'eip155:8453' instead of 'base'"`)
- [ ] **ERR-05**: Errors vs warnings distinction — errors mean config will fail at runtime, warnings mean suboptimal but functional

### Address Validation

- [x] **ADDR-01**: EVM address must be 42-char hex with `0x` prefix
- [x] **ADDR-02**: EVM address checksum validation (EIP-55) using vendored keccak256
- [x] **ADDR-03**: Solana address must be valid Base58, 32-byte decoded length
- [x] **ADDR-04**: Address format must match network type (EVM address on Solana network = error)
- [x] **ADDR-05**: Address validation dispatches by CAIP-2 namespace (`eip155:*` → EVM, `solana:*` → Solana)

### Network & Asset Registry

- [ ] **REG-01**: Known CAIP-2 network registry (Base, Base Sepolia, Avalanche, Avalanche Fuji, Solana mainnet/devnet/testnet, Stellar, Aptos)
- [ ] **REG-02**: Unknown but valid CAIP-2 format produces warning, not error
- [ ] **REG-03**: Simple chain name → CAIP-2 mapping for legacy detection and fix suggestions
- [ ] **REG-04**: Known asset addresses per network (USDC on Base, Solana, etc.)
- [ ] **REG-05**: Unknown assets produce warning, not error
- [ ] **REG-06**: Extensible chain validation — new chains can be added via community PRs to registry files

### Format Detection & Normalization

- [ ] **FMT-01**: Detect v2 (has `accepts` + `x402Version: 2` + `resource`)
- [ ] **FMT-02**: Detect v1 (has `accepts` + `x402Version: 1`, no `resource`)
- [ ] **FMT-03**: Detect flat-legacy (root-level `payTo`/`amount`/`network` or `payments` array)
- [ ] **FMT-04**: Return `unknown` for unrecognized shapes
- [ ] **FMT-05**: Normalize flat-legacy → canonical v2 (wrap in `accepts[]`, map field names, set `scheme: "exact"`)
- [ ] **FMT-06**: Normalize v1 → canonical v2 (`maxAmountRequired` → `amount`, per-entry `resource` → top-level)
- [ ] **FMT-07**: Normalize v2 → pass through unchanged
- [ ] **FMT-08**: Preserve `extra` and `extensions` through normalization

### Crypto Vendoring

- [x] **CRYPTO-01**: Vendored keccak256 implementation (NOT SHA-3) with empty-string canary test
- [x] **CRYPTO-02**: Vendored Base58 decoder handling leading-zero bytes correctly
- [x] **CRYPTO-03**: EIP-55 checksum function built on vendored keccak256
- [x] **CRYPTO-04**: Zero runtime dependencies — all crypto is vendored source code

### Build & Package

- [x] **BUILD-01**: TypeScript source compiled to ESM (`index.js`), CJS (`index.cjs`), and browser IIFE (`index.iife.js`)
- [x] **BUILD-02**: TypeScript declarations generated (`.d.ts` and `.d.cts`)
- [x] **BUILD-03**: Browser bundle exposes `window.x402Validate` with `{ validate, detect, normalize }`
- [x] **BUILD-04**: Browser bundle under 30KB minified (~27KB actual, ~9KB gzipped — revised from 15KB due to vendored crypto)
- [x] **BUILD-05**: `package.json` with correct `exports`, `main`, `module`, `types`, `files` fields
- [x] **BUILD-06**: Monorepo structure — SDK in `packages/x402check/`, website at root, npm workspaces

### Testing

- [x] **TEST-01**: Unit tests for every validation rule (each error code exercised)
- [x] **TEST-02**: Format detection tests (v2, v1, flat-legacy, unknown)
- [x] **TEST-03**: Normalization tests (flat → v2, v1 → v2, v2 passthrough, extra/extensions preserved)
- [x] **TEST-04**: Address validation tests (valid/invalid EVM, valid/invalid Solana, network mismatch)
- [x] **TEST-05**: Crypto primitive tests (keccak256 canary, Base58 leading zeros, EIP-55 reference vectors)
- [x] **TEST-06**: Integration tests (real-world configs, round-trip normalize→validate)
- [x] **TEST-07**: JSON fixture files for reproducible testing
- [x] **TEST-08**: 100+ test cases total

### Website Integration

- [ ] **WEB-01**: Replace `validator.js` + `chains.js` with SDK UMD bundle via CDN `<script>` tag
- [ ] **WEB-02**: `input.js` calls SDK `validate()` instead of `validateX402Config()`
- [ ] **WEB-03**: Map SDK result shape to display code (handle 8+ field name changes)
- [ ] **WEB-04**: Update example configs to canonical v2 format
- [ ] **WEB-05**: Remove ethers.js and bs58 CDN dependencies (~810KB savings)

## Future Requirements

Deferred beyond v2.0.

### Publishing & Distribution

- **PUB-01**: Publish to npm as `x402check`
- **PUB-02**: CI/CD pipeline for automated testing and publishing
- **PUB-03**: Changelog and versioning automation

### Extended Chain Support

- **CHAIN-01**: Stellar address validation (StrKey encoding)
- **CHAIN-02**: Aptos address validation (hex format)
- **CHAIN-03**: Bitcoin address validation (Base58Check, Bech32)

### Advanced Features

- **ADV-01**: Shareable validation URLs
- **ADV-02**: Custom network validator option (`validate(config, { networkValidators: {...} })`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Payment payload construction or signing | @x402/core's job, not a validator |
| On-chain verification | Requires RPC connections, async, chain SDKs |
| Facilitator liveness checks | Network calls violate offline validation principle |
| Async validation | All rules are pure synchronous computation |
| Schema library (Zod/Ajv) internally | Adds 13-50KB for ~20 rules, domain logic can't be expressed as schemas |
| Per-rule configurable severity | Only ~20 rules — strict mode is sufficient |
| Custom error message templates / i18n | Machine-readable codes are the stable API |
| Batch validation | One config at a time |
| User accounts | Contradicts simplicity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 8 | Complete |
| API-02 | Phase 6 | Complete |
| API-03 | Phase 6 | Complete |
| API-04 | Phase 6 | Complete |
| API-05 | Phase 8 | Complete |
| API-06 | Phase 8 | Complete |
| API-07 | Phase 6 | Complete |
| RULE-01 | Phase 8 | Complete |
| RULE-02 | Phase 8 | Complete |
| RULE-03 | Phase 8 | Complete |
| RULE-04 | Phase 8 | Complete |
| RULE-05 | Phase 8 | Complete |
| RULE-06 | Phase 8 | Complete |
| RULE-07 | Phase 8 | Complete |
| RULE-08 | Phase 8 | Complete |
| RULE-09 | Phase 8 | Complete |
| RULE-10 | Phase 8 | Complete |
| RULE-11 | Phase 8 | Complete |
| ERR-01 | Phase 6 | Complete |
| ERR-02 | Phase 6 | Complete |
| ERR-03 | Phase 6 | Complete |
| ERR-04 | Phase 6 | Complete |
| ERR-05 | Phase 6 | Complete |
| ADDR-01 | Phase 7 | Complete |
| ADDR-02 | Phase 7 | Complete |
| ADDR-03 | Phase 7 | Complete |
| ADDR-04 | Phase 7 | Complete |
| ADDR-05 | Phase 7 | Complete |
| REG-01 | Phase 6 | Complete |
| REG-02 | Phase 6 | Complete |
| REG-03 | Phase 6 | Complete |
| REG-04 | Phase 6 | Complete |
| REG-05 | Phase 6 | Complete |
| REG-06 | Phase 6 | Complete |
| FMT-01 | Phase 6 | Complete |
| FMT-02 | Phase 6 | Complete |
| FMT-03 | Phase 6 | Complete |
| FMT-04 | Phase 6 | Complete |
| FMT-05 | Phase 6 | Complete |
| FMT-06 | Phase 6 | Complete |
| FMT-07 | Phase 6 | Complete |
| FMT-08 | Phase 6 | Complete |
| CRYPTO-01 | Phase 7 | Complete |
| CRYPTO-02 | Phase 7 | Complete |
| CRYPTO-03 | Phase 7 | Complete |
| CRYPTO-04 | Phase 7 | Complete |
| BUILD-01 | Phase 9 | Complete |
| BUILD-02 | Phase 9 | Complete |
| BUILD-03 | Phase 9 | Complete |
| BUILD-04 | Phase 9 | Complete |
| BUILD-05 | Phase 9 | Complete |
| BUILD-06 | Phase 5 | Complete |
| TEST-01 | Phase 8 | Complete |
| TEST-02 | Phase 8 | Complete |
| TEST-03 | Phase 8 | Complete |
| TEST-04 | Phase 7 | Complete |
| TEST-05 | Phase 7 | Complete |
| TEST-06 | Phase 8 | Complete |
| TEST-07 | Phase 8 | Complete |
| TEST-08 | Phase 8 | Complete |
| WEB-01 | Phase 10 | Pending |
| WEB-02 | Phase 10 | Pending |
| WEB-03 | Phase 10 | Pending |
| WEB-04 | Phase 10 | Pending |
| WEB-05 | Phase 10 | Pending |

**Coverage:**
- v2.0 requirements: 65 total
- Mapped to phases: 65
- Unmapped: 0

**Phase distribution:**
| Phase | Count | Categories |
|-------|-------|------------|
| Phase 5 | 1 | BUILD |
| Phase 6 | 23 | API, ERR, FMT, REG |
| Phase 7 | 11 | CRYPTO, ADDR, TEST |
| Phase 8 | 20 | API, RULE, TEST |
| Phase 9 | 5 | BUILD |
| Phase 10 | 5 | WEB |

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 -- Phase 9 requirements complete*
