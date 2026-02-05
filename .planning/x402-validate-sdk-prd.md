# PRD: x402lint SDK

## Summary

Extract x402lint's validation logic into a standalone npm package (`x402lint`) that correctly implements the canonical x402 v1 and v2 specs from [coinbase/x402](https://github.com/coinbase/x402). The package validates `PaymentRequired` response structures, not payment payloads or settlement — it answers "is this 402 config correct?" Ship with comprehensive tests, then rebuild x402lint.com on top of it via CDN.

## Problem

The current `validator.js` was built on assumptions that don't match the actual spec:

| Current | Spec |
|---------|------|
| `payments` array | `accepts` array |
| `address` field | `payTo` field |
| `chain` field | `network` (CAIP-2: `eip155:8453`) |
| `minAmount` | `amount` (v2) / `maxAmountRequired` (v1) |
| No `scheme` field | Required (`"exact"`) |
| No `resource` object | Required in v2 |
| No `maxTimeoutSeconds` | Required |
| Simple names (`"base"`) | CAIP-2 (`"eip155:8453"`) |

There are also no tests. The validation logic is tightly coupled to the website's HTML file. Nobody else can use it.

## Goals

1. **Spec-correct validation** of x402 v1 and v2 `PaymentRequired` responses
2. **Standalone npm package** usable by any JS/TS project
3. **Browser-compatible** — loadable via CDN `<script>` tag (UMD bundle)
4. **Comprehensive test suite** — every field, every error path, every edge case
5. **Backward-compatible detection** — gracefully handle "flat" legacy configs that predate the spec (like the current token-data-aggregator endpoint)

## Non-Goals

- Payment payload construction or signing
- Settlement/facilitation logic
- On-chain verification
- Facilitator liveness checks
- Anything that requires network calls

## Architecture

```
x402lint/
├── src/
│   ├── index.ts              # Public API exports
│   ├── validate.ts           # Main validate() function
│   ├── detect.ts             # Format detection (v2, v1, flat-legacy)
│   ├── normalize.ts          # Normalize any format → canonical v2
│   ├── rules/
│   │   ├── structure.ts      # Top-level shape validation
│   │   ├── requirements.ts   # PaymentRequirements field validation
│   │   ├── network.ts        # CAIP-2 network validation + registry
│   │   ├── address.ts        # Chain-specific address validation
│   │   └── amount.ts         # Amount string validation
│   ├── networks.ts           # Known CAIP-2 network registry
│   ├── assets.ts             # Known asset addresses per network
│   └── types.ts              # TypeScript types (mirroring spec)
├── tests/
│   ├── validate.test.ts      # Integration tests
│   ├── detect.test.ts        # Format detection tests
│   ├── normalize.test.ts     # Normalization tests
│   ├── rules/
│   │   ├── structure.test.ts
│   │   ├── requirements.test.ts
│   │   ├── network.test.ts
│   │   ├── address.test.ts
│   │   └── amount.test.ts
│   └── fixtures/             # JSON test fixtures
│       ├── valid-v2.json
│       ├── valid-v1.json
│       ├── valid-flat.json
│       ├── invalid-*.json
│       └── real-world/       # Configs from actual endpoints
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build: ESM + CJS + UMD
└── vitest.config.ts
```

### Build Outputs

```
dist/
├── index.mjs          # ESM (Node, bundlers)
├── index.cjs          # CJS (legacy Node)
├── index.d.ts         # TypeScript declarations
└── x402lint.umd.js  # Browser UMD (for CDN <script> tag)
```

The UMD build exposes `window.x402Lint` for the static HTML site.

## Public API

```typescript
import x402lint from 'x402lint';
// or destructured:
import { validate, detect, normalize } from 'x402lint';

// Primary: validate a config (string or object)
const result = validate(configStringOrObject);
// Returns: ValidationResult

// Detect format without full validation
const format = detect(configStringOrObject);
// Returns: 'v2' | 'v1' | 'flat-legacy' | 'unknown'

// Normalize any format to canonical v2 shape
const normalized = normalize(configStringOrObject);
// Returns: NormalizedConfig | null
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  version: 'v2' | 'v1' | 'flat-legacy';
  errors: ValidationIssue[];      // Blocking — config won't work
  warnings: ValidationIssue[];    // Non-blocking — config works but suboptimal
  normalized: NormalizedConfig | null;  // Canonical v2 shape (null if unparseable)
}

interface ValidationIssue {
  code: string;           // Machine-readable: 'MISSING_SCHEME', 'INVALID_NETWORK_FORMAT'
  field: string;          // JSON path: 'accepts[0].network'
  message: string;        // Human-readable: 'Network must use CAIP-2 format'
  fix?: string;           // Actionable: 'Use "eip155:8453" instead of "base"'
  severity: 'error' | 'warning';
}

interface NormalizedConfig {
  x402Version: number;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: NormalizedRequirements[];
  extensions?: Record<string, unknown>;
}

interface NormalizedRequirements {
  scheme: string;
  network: string;        // CAIP-2 format
  amount: string;         // Atomic units string
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}
```

## Validation Rules

### Level 1: Structure (can the config be parsed?)

| Rule | Error Code | Severity |
|------|-----------|----------|
| Input must be valid JSON | `INVALID_JSON` | error |
| Must be an object | `NOT_OBJECT` | error |
| Must have recognized format (v2, v1, or flat-legacy) | `UNKNOWN_FORMAT` | error |

### Level 2: Version & Shape

| Rule | Error Code | Severity |
|------|-----------|----------|
| `x402Version` must be present | `MISSING_VERSION` | error (v2), warning (v1/flat) |
| `x402Version` must be 1 or 2 | `INVALID_VERSION` | error |
| `accepts` array must exist and be non-empty | `MISSING_ACCEPTS` | error |
| `resource` object must exist (v2 only) | `MISSING_RESOURCE` | warning |
| `resource.url` must be valid URL (v2) | `INVALID_RESOURCE_URL` | warning |

### Level 3: PaymentRequirements fields

| Rule | Error Code | Severity |
|------|-----------|----------|
| `scheme` must be present | `MISSING_SCHEME` | error (v2), warning (v1/flat) |
| `network` must be present | `MISSING_NETWORK` | error |
| `network` must be CAIP-2 format (`namespace:reference`) | `INVALID_NETWORK_FORMAT` | error |
| `amount` (v2) / `maxAmountRequired` (v1) must be present | `MISSING_AMOUNT` | error |
| `amount` must be numeric string | `INVALID_AMOUNT` | error |
| `amount` must be positive | `ZERO_AMOUNT` | error |
| `asset` must be present | `MISSING_ASSET` | error |
| `payTo` must be present | `MISSING_PAY_TO` | error |
| `maxTimeoutSeconds` should be present (v2) | `MISSING_TIMEOUT` | warning |
| `maxTimeoutSeconds` must be positive integer | `INVALID_TIMEOUT` | error |

### Level 4: Network-specific validation

| Rule | Error Code | Severity |
|------|-----------|----------|
| EVM address must be 42-char hex with 0x prefix | `INVALID_EVM_ADDRESS` | error |
| EVM address checksum (EIP-55) | `BAD_EVM_CHECKSUM` | warning |
| Solana address must be valid Base58, 32-byte decoded | `INVALID_SOLANA_ADDRESS` | error |
| Network is in known registry | `UNKNOWN_NETWORK` | warning |
| Asset is known for this network | `UNKNOWN_ASSET` | warning |
| Address format matches network type | `ADDRESS_NETWORK_MISMATCH` | error |

### Level 5: Legacy format warnings

| Rule | Error Code | Severity |
|------|-----------|----------|
| Using flat format (fields at root level) | `FLAT_FORMAT` | warning |
| Using v1 field names (`maxAmountRequired`) | `V1_FIELD_NAMES` | warning |
| Using simple chain name instead of CAIP-2 | `SIMPLE_CHAIN_NAME` | warning |
| Using alias field (`address` instead of `payTo`) | `ALIAS_FIELD` | warning |
| Missing `scheme` (will default to `"exact"`) | `DEFAULT_SCHEME` | warning |

## Known Networks Registry

```typescript
const NETWORKS = {
  // EVM
  'eip155:8453':  { name: 'Base',           type: 'evm',    testnet: false },
  'eip155:84532': { name: 'Base Sepolia',   type: 'evm',    testnet: true },
  'eip155:43114': { name: 'Avalanche',      type: 'evm',    testnet: false },
  'eip155:43113': { name: 'Avalanche Fuji', type: 'evm',    testnet: true },

  // Solana
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana Mainnet', type: 'solana', testnet: false },
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': { name: 'Solana Devnet',  type: 'solana', testnet: true },
  'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': { name: 'Solana Testnet', type: 'solana', testnet: true },

  // Stellar
  'stellar:pubnet':  { name: 'Stellar Mainnet', type: 'stellar', testnet: false },
  'stellar:testnet': { name: 'Stellar Testnet', type: 'stellar', testnet: true },

  // Aptos
  'aptos:1': { name: 'Aptos Mainnet', type: 'aptos', testnet: false },
  'aptos:2': { name: 'Aptos Testnet', type: 'aptos', testnet: true },
};
```

### Simple Name → CAIP-2 Mapping (for legacy detection)

```typescript
const SIMPLE_NAME_MAP = {
  'base':          'eip155:8453',
  'base-sepolia':  'eip155:84532',
  'solana':        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
};
```

## Known Assets Registry

```typescript
const ASSETS = {
  'eip155:8453': {
    'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  'eip155:84532': {
    'USDC': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': {
    'USDC': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
};
```

## Format Detection Logic

```
Has `accepts` array?
├── Yes → Has `x402Version: 2` + `resource` object? → v2
│         Otherwise → v1
├── No → Has `payments` array? → flat-legacy (alias)
├── No → Has `payTo`/`amount`/`network` at root? → flat-legacy
└── No → unknown
```

## Normalization Logic

All detected formats normalize to canonical v2 shape:

**Flat-legacy** (`{ payTo, amount, network, currency }`):
- Wrap in `accepts: [{ ... }]`
- Map `payTo` → `payTo`, `network` → CAIP-2 via lookup, `amount` → `amount`, `currency` → `asset`
- Set `scheme: "exact"`, add `x402Version: 2`

**v1** (`{ x402Version: 1, accepts: [{ maxAmountRequired, resource, ... }] }`):
- Map `maxAmountRequired` → `amount`
- Move per-entry `resource` string to top-level `resource: { url: resource }`
- Set `x402Version: 2`

**v2** — already canonical, return as-is.

## Dependencies

### Runtime
- **None** for core validation (zero-dependency for browser compatibility)
- Address validation uses pure JS regex for EVM, and a vendored Base58 decoder for Solana (or accept `bs58` as optional peer dep)

### Dev
- `typescript` — source language
- `vitest` — test runner
- `tsup` — build (ESM + CJS + UMD)

### Design Decision: Address Validation Libraries

| Option | Pros | Cons |
|--------|------|------|
| **Vendor minimal Base58 decoder** | Zero deps, tiny bundle | Must maintain decoder |
| **Peer dep on ethers + bs58** | Battle-tested | Heavy for a validation lib |
| **Regex only (skip deep validation)** | Simplest | Misses checksum/encoding errors |

**Recommendation:** Vendor a ~50-line Base58 decoder for Solana. Use pure JS for EVM checksum (keccak256 can be vendored too, ~100 lines). This keeps the package at **zero runtime dependencies** and the UMD bundle tiny (<15KB).

If users want full address validation, they can pass their own validator:

```typescript
validate(config, {
  addressValidator: (address, networkType) => { ... }
});
```

## Website Integration

Replace `validator.js` + `chains.js` with:

```html
<script src="https://cdn.jsdelivr.net/npm/x402lint@latest/dist/x402lint.umd.js"></script>
<script>
  const { validate, detect, normalize } = window.x402Lint;
</script>
```

The website's `input.js` calls `validate()` instead of `validateX402Config()`. The result shape is the same concept (valid/errors/warnings/normalized) so the display code needs minimal changes.

## Test Strategy

### Unit Tests (~100+ cases)

**Structure validation:**
- Valid v2 config passes
- Valid v1 config passes
- Valid flat-legacy config passes with warnings
- Missing `x402Version` → error (v2) / warning (flat)
- Empty `accepts` → error
- `accepts` not an array → error
- Missing `resource` in v2 → warning

**Requirements validation (per field):**
- Missing `scheme` / `network` / `amount` / `asset` / `payTo` → error
- Invalid CAIP-2 format (`"base"` instead of `"eip155:8453"`) → error + fix suggestion
- Invalid amount (negative, zero, non-numeric, scientific notation) → error
- Valid `maxTimeoutSeconds` (positive int) vs invalid (negative, float, string)

**Network validation:**
- Known CAIP-2 identifier → pass
- Unknown but valid CAIP-2 format → warning (unknown network)
- Invalid CAIP-2 format (no colon) → error

**Address validation:**
- Valid EVM checksummed address → pass
- Valid EVM lowercase address → pass + warning
- Invalid EVM address (wrong length, no 0x) → error
- Valid Solana Base58 address → pass
- Invalid Solana address (not Base58, wrong decoded length) → error
- EVM address on Solana network → error (mismatch)
- Solana address on EVM network → error (mismatch)

**Format detection:**
- Detects v2 (has `accepts` + `x402Version: 2` + `resource`)
- Detects v1 (has `accepts` + `x402Version: 1`, no `resource`)
- Detects flat-legacy (root-level `payTo`/`amount`)
- Returns `unknown` for unrecognized shapes

**Normalization:**
- Flat → v2 canonical shape
- v1 → v2 canonical shape (field remapping)
- v2 → unchanged
- Preserves `extra` and `extensions` through normalization
- Maps simple chain names to CAIP-2

### Integration Tests

- Real-world configs from actual endpoints (token-data-aggregator, etc.)
- Round-trip: normalize then validate the normalized output
- Error messages contain actionable fix suggestions

### Fixture-based Tests

JSON fixtures in `tests/fixtures/` for reproducible testing:
- `valid-v2-base.json` — minimal valid v2 config (Base mainnet)
- `valid-v2-solana.json` — minimal valid v2 config (Solana)
- `valid-v2-full.json` — v2 with all optional fields
- `valid-v1.json` — valid v1 config
- `valid-flat.json` — flat legacy that passes with warnings
- `invalid-no-accepts.json`, `invalid-bad-network.json`, etc.
- `real-world/token-data-aggregator.json` — actual endpoint response

## Package Metadata

```json
{
  "name": "x402lint",
  "version": "1.0.0",
  "description": "Validate x402 payment configurations against the canonical spec",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "keywords": ["x402", "payment", "validation", "402", "http-402"],
  "license": "MIT"
}
```

## Rollout Plan

1. **Build SDK** in `packages/x402lint/` within the repo (or at repo root if keeping it simple)
2. **Write tests** — aim for 100+ test cases covering every rule
3. **Build UMD bundle** — verify it loads in a plain `<script>` tag
4. **Integrate with website** — replace `validator.js` + `chains.js` with CDN import
5. **Update website display** — map new `ValidationResult` shape to existing UI
6. **Update example configs** — show canonical v2 format, keep flat as "legacy" tab
7. **Publish to npm** — `npm publish` as `x402lint`

## Open Questions

1. **Package location:** Subdirectory of x402lint (`packages/x402lint/`) or separate repo? Subdirectory is simpler for now, separate repo if it gets traction.
2. **Algorand/Sui/Aptos/Stellar support:** The spec supports these chains. Include them in the network registry from day one, or start with just EVM + Solana? Recommend: include all known networks in the registry, but only do deep address validation for EVM + Solana initially.
3. **Strict vs lenient mode:** Should there be a `strict: true` option that turns warnings into errors? Useful for CI/CD pipelines where you want to enforce v2 compliance.
