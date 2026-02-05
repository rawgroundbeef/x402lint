# Architecture Integration — v3.0

**Project:** x402lint v3.0 milestone
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

The v2.0 architecture is well-designed for extension. All 5 new features integrate cleanly using established patterns. No breaking changes — all additions are extensions, not modifications.

**Key integration points:**
1. `validateManifest()` — new orchestrator composing existing `validate()`
2. `detect()` — extended with `'manifest'` return value (check BEFORE v2)
3. CLI — format-based dispatch to appropriate validator
4. Stacks — new entry in address validation dispatch switch
5. Website — detection-first UI rendering pattern

## Current Architecture Baseline

```
packages/x402lint/src/
+-- index.ts              # Public API exports
+-- cli.ts                # CLI entry (separate build)
+-- types/                # TypeScript type definitions
|   +-- config.ts         # x402 config types
|   +-- validation.ts     # ValidationResult, ValidationIssue
|   +-- errors.ts         # ErrorCode enum (30 codes)
+-- detection/
|   +-- detect.ts         # Format detection (v2, v1, flat-legacy, unknown)
|   +-- guards.ts         # Type guard functions
+-- normalization/
|   +-- normalize.ts      # Any format -> canonical v2
+-- validation/
|   +-- validate.ts       # Main orchestrator (L1-L5 layers)
|   +-- address.ts        # Address validation dispatcher
|   +-- rules/            # Validation rule modules
|       +-- structure.ts  # L1: Structure checks
|       +-- fields.ts     # L2-L3: Field validation
|       +-- network.ts    # L4: Network/CAIP-2 validation
|       +-- extensions.ts # L5: Bazaar extension checks
+-- registries/
|   +-- networks.ts       # Known CAIP-2 networks
|   +-- assets.ts         # Known assets per network
+-- crypto/
    +-- keccak256.ts      # Vendored keccak (EIP-55)
    +-- eip55.ts          # EVM checksum
    +-- base58.ts         # Vendored Base58 (Solana)
```

**Build outputs (tsdown):**
- `dist/index.js` — ESM library
- `dist/index.cjs` — CJS library
- `dist/index.iife.js` — Browser bundle (30KB)
- `dist/cli.mjs` — CLI binary with shebang

## Integration Points

### 1. Manifest Validation Orchestrator (NEW)

**New files:**
```
src/types/manifest.ts              # ManifestConfig, ManifestValidationResult
src/validation/validate-manifest.ts # Orchestrator
src/validation/rules/manifest.ts    # Cross-endpoint rules
```

**Pattern:** Composition — `validateManifest()` calls existing `validate()` per endpoint, adds cross-endpoint checks.

```typescript
export function validateManifest(input: unknown, options?: ValidateOptions): ManifestValidationResult {
  const parsed = parseManifest(input)
  const endpointResults = new Map()
  for (const [id, endpoint] of parsed.endpoints) {
    endpointResults.set(id, validate(endpoint.config, options))
  }
  const crossErrors = validateCrossEndpoint(parsed, endpointResults)
  return { valid, errors: crossErrors, warnings, endpointResults }
}
```

### 2. Detection Extension (MODIFY)

**Critical:** Check manifest format BEFORE v2 (manifests also have `x402Version: 2`)

```typescript
export function detect(input: unknown): 'manifest' | 'v2' | 'v1' | 'flat-legacy' | 'unknown' {
  if (isManifestConfig(input)) return 'manifest'  // Check first!
  if (isV2Config(input)) return 'v2'
  if (isV1Config(input)) return 'v1'
  return 'unknown'
}
```

### 3. CLI Format Dispatch (MODIFY)

```typescript
const format = detect(input)
if (format === 'manifest') {
  const result = validateManifest(input, { strict: args.strict })
  // Format per-endpoint summaries + cross-endpoint issues
} else {
  const result = validate(input, { strict: args.strict })
  // Existing single-config formatting
}
```

No build config changes needed (CLI already separate entry point).

### 4. Stacks Chain Validator (NEW)

**New files:**
```
src/crypto/c32check.ts             # Vendored c32check decoder
src/validation/stacks-address.ts   # Stacks address validation
```

**Integration:** Extend address dispatch switch:
```typescript
switch (namespace) {
  case 'eip155':  return validateEvmAddress(address, field)
  case 'solana':  return validateSolanaAddress(address, field)
  case 'stacks':  return validateStacksAddress(address, field)  // NEW
  default:        return []
}
```

**Registry:** Add `stacks:mainnet` and `stacks:testnet` to networks.ts.

### 5. Bazaar Extension Validation (ALREADY EXISTS)

Current `src/validation/rules/extensions.ts` already validates bazaar extensions structurally. For v3.0:
- Add method discrimination validation (GET vs POST input types)
- Keep structural checks (presence of `type`, `$schema`, `properties`)
- Do NOT embed full JSON Schema validator in runtime

### 6. Website Manifest Mode (MODIFY)

Detection-first rendering — no framework needed:
```javascript
const format = x402Lint.detect(inputText)
if (format === 'manifest') {
  renderManifestResult(x402Lint.validateManifest(inputText))
} else {
  renderResult(x402Lint.validate(inputText))
}
```

`validateManifest()` exported from index.ts automatically included in IIFE bundle.

## Data Flow

### Single-Config (Unchanged)
```
Input -> validate() -> [Parse -> Detect -> Normalize -> Rules -> Strict] -> ValidationResult
```

### Manifest (New)
```
Input -> detect() -> 'manifest'
  -> validateManifest()
    -> Parse manifest structure
    -> For each endpoint: validate() -> ValidationResult
    -> Cross-endpoint rules
  -> ManifestValidationResult { valid, endpointResults, errors, warnings }
```

## Build Order (Component Dependencies)

1. **Types & Detection** — ManifestConfig type, `isManifestConfig()` guard, extend detect()
2. **Stacks Chain Support** (parallel with 3) — Vendor c32check, add validator, extend registry
3. **Manifest Validation** — Orchestrator + cross-endpoint rules
4. **CLI Manifest Mode** — Format dispatch + manifest output formatting
5. **Website Manifest UI** — Detection-first rendering + per-endpoint cards
6. **Build & Publish** — Verify bundle, publint, npm publish

**Parallel:** Stacks (2) independent from Manifest (3). CLI (4) and Website (5) independent.

## Bundle Size Impact

| Component | Estimated Size |
|-----------|---------------|
| Manifest types + detection | +3 KB |
| Manifest orchestrator + rules | +5 KB |
| Stacks c32check + validator | +4 KB |
| SHA-256 (for c32check) | +2 KB |
| **Total** | **+14 KB** |

**Current:** ~30 KB -> **Projected:** ~45 KB (compressed ~16 KB gzip)

## Anti-Patterns to Avoid

1. **Don't duplicate validation logic** — compose validate(), don't reimplement
2. **Don't mix library and CLI builds** — Node.js code stays in cli.ts
3. **Don't over-validate bazaar schema** — structural check is sufficient for runtime
4. **Don't break detection order** — manifest check BEFORE v2 check

## Sources

- [c32check GitHub](https://github.com/stacks-network/c32check)
- [Stacks Accounts](https://docs.stacks.co/concepts/network-fundamentals/accounts)
- [tsdown Entry Options](https://tsdown.dev/options/entry)
- [Kubeconform](https://github.com/yannh/kubeconform)
- [JSON Schema Validation Spec](https://json-schema.org/draft/2020-12/json-schema-validation)
