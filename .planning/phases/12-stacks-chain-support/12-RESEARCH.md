# Phase 12: Stacks Chain Support - Research

**Researched:** 2026-02-04
**Domain:** Stacks blockchain address validation with c32check encoding
**Confidence:** HIGH

## Summary

Stacks blockchain uses c32check encoding for addresses - a Crockford base-32 encoding scheme with 4-byte checksums. The encoding is analogous to Bitcoin's base58check but uses a different character set. Address prefixes indicate network and type: SP (mainnet standard), SM (mainnet contract), ST (testnet standard), SN (testnet contract). Version bytes are: mainnet P2PKH (22/SP), mainnet P2SH (20/SM), testnet P2PKH (26/ST), testnet P2SH (21/SN).

The standard library for c32check operations is the standalone `c32check` npm package (123k weekly downloads, maintained by Stacks Network). While `@stacks/transactions` and `@stacks/common` exist in the Stacks.js ecosystem, they depend on `c32check` internally. For address validation only, the standalone package is appropriate and keeps dependencies minimal.

CAIP-2 network identifiers use numeric references: `stacks:1` (mainnet) and `stacks:2147483648` (testnet). These identifiers are documented in the ChainAgnostic namespaces repository and match the network_id values returned by Stacks node APIs.

**Primary recommendation:** Use `c32check` package for address validation. Implement validation that decodes addresses via `c32addressDecode`, validates version bytes against expected network, and catches checksum errors with clear fix suggestions. Pattern matches existing EVM/Solana validation structure.

## Standard Stack

The established libraries for Stacks address validation:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| c32check | 2.0.0 | c32 encoding/decoding with checksums | Official Stacks Network library, 123k weekly downloads, used by all Stacks.js packages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @stacks/transactions | 7.0.2+ | Higher-level Stacks transaction operations | If building transaction construction, not just validation |
| @stacks/common | 7.0.2+ | Common Stacks utilities | If needing other Stacks-specific utilities beyond addresses |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| c32check | @stacks/transactions | Adds unnecessary transaction construction code (~50KB+ vs ~5KB), but provides higher-level APIs |
| c32check | Manual implementation | Avoid - checksum algorithm is subtle (double-sha256), version byte confusion is easy, community expects c32check |

**Installation:**
```bash
npm install c32check
```

**Dependencies:** c32check has minimal dependencies:
- `@noble/hashes` ^1.1.2 (cryptographic hashing, already used by @scure/base)
- `base-x` ^4.0.0 (base encoding utilities)

**Bundle size:** Package is browser-compatible with webpack dist builds. Current bundle (31KB) + estimated c32check addition (~5-8KB) stays well under 45KB target. The package includes `browser: { "crypto": false }` configuration for browser compatibility.

## Architecture Patterns

### Recommended File Structure
```
src/
├── validation/
│   ├── address.ts           # Dispatcher (add 'stacks' case)
│   ├── evm-address.ts       # Existing
│   ├── solana-address.ts    # Existing
│   └── stacks-address.ts    # NEW
├── crypto/
│   ├── base58.ts           # Existing
│   ├── eip55.ts            # Existing
│   └── c32check.ts         # NEW - wrapper around c32check package
├── registries/
│   └── networks.ts         # Add stacks:1 and stacks:2147483648
└── types/
    └── errors.ts           # Add INVALID_STACKS_ADDRESS, BAD_STACKS_CHECKSUM, STACKS_NETWORK_MISMATCH
```

### Pattern 1: Validation Function Structure
**What:** Chain-specific validator that matches existing EVM/Solana pattern
**When to use:** For all address validation
**Example:**
```typescript
// Based on existing EVM/Solana validators
export function validateStacksAddress(
  address: string,
  network: string,
  field: string
): ValidationIssue[] {
  // 1. Basic format check (regex for SP/SM/ST/SN + c32 charset)
  // 2. Decode address via c32addressDecode (catches checksum errors)
  // 3. Validate version byte matches network
  // 4. Return appropriate errors/warnings
}
```

### Pattern 2: Network-Aware Version Validation
**What:** Extract network from CAIP-2, validate version byte matches
**When to use:** After successful c32addressDecode
**Example:**
```typescript
// Get expected version bytes for network
const expectedVersions = network === 'stacks:1'
  ? [22, 20] // SP, SM
  : [26, 21] // ST, SN

if (!expectedVersions.includes(version)) {
  return createNetworkMismatchError(version, network)
}
```

### Pattern 3: Checksum Error Wrapper
**What:** Wrap c32addressDecode to catch and translate errors
**When to use:** Always - c32addressDecode throws on invalid checksum
**Example:**
```typescript
// Source: c32check library pattern
try {
  const [version, hash160] = c32addressDecode(address)
  // proceed with validation
} catch (error) {
  return [{
    code: ErrorCode.BAD_STACKS_CHECKSUM,
    field,
    message: 'Invalid Stacks address checksum',
    severity: 'error',
    fix: 'Double-check the address for typos'
  }]
}
```

### Pattern 4: Crypto Abstraction Layer
**What:** Wrap c32check package in a crypto module (matches base58.ts pattern)
**When to use:** For all c32check operations
**Example:**
```typescript
// packages/x402check/src/crypto/c32check.ts
import { c32addressDecode as c32Decode } from 'c32check'

export function decodeStacksAddress(address: string): [number, string] {
  try {
    return c32Decode(address)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid c32check encoding: ${message}`)
  }
}
```

### Anti-Patterns to Avoid
- **Accepting any string starting with 'S':** Must validate c32check encoding and checksum
- **Not distinguishing version bytes:** SP address on testnet is an error, not just a warning
- **Exposing c32check library errors directly:** Wrap in domain-specific ValidationIssue types
- **Separate length validation:** c32check validity implies correct length - don't add redundant checks
- **Contract name parsing:** Validate base address only; `.contract-name` suffixes are out of scope

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| c32 encoding/decoding | Custom Crockford base-32 | c32check package | Handles edge cases (normalization of O→0, I→1, L→1), standard in ecosystem |
| Checksum calculation | Manual double-sha256 | c32addressDecode | Checksum is first 4 bytes of sha256(sha256(version + payload)) - subtle to get right |
| Version byte mapping | Hardcoded constants | c32check.versions export | Canonical source of truth, includes all 4 combinations |
| Address format regex | Custom pattern | c32check validation + prefix check | Valid c32 chars are non-obvious subset of alphanumeric |

**Key insight:** Checksum validation is security-critical. The c32check library is battle-tested with 123k weekly downloads and used by all Stacks wallets. Custom implementations risk silent failures that could lead to loss of funds. The encoding is specifically designed to detect typos - don't bypass that by accepting unvalidated addresses.

## Common Pitfalls

### Pitfall 1: Version Byte Confusion
**What goes wrong:** Using wrong version byte constants (e.g., treating 22 as testnet)
**Why it happens:** Four combinations (mainnet/testnet × P2PKH/P2SH) with non-obvious byte values (22, 20, 26, 21)
**How to avoid:**
- Use numeric CAIP-2 identifiers (`stacks:1`, `stacks:2147483648`) not human-readable names
- Map CAIP-2 reference to version bytes: `1` → [22, 20], `2147483648` → [26, 21]
- Reject human-readable network identifiers with helpful error: "Did you mean stacks:1?"
**Warning signs:** Addresses pass validation but fail on-chain; SP addresses accepted on testnet

### Pitfall 2: Forgetting c32 Character Normalization
**What goes wrong:** Rejecting valid addresses with confusable characters
**Why it happens:** c32 encoding allows O→0, I→1, L→1 normalization (like Crockford base-32)
**How to avoid:**
- Use c32addressDecode directly (handles normalization internally)
- Don't pre-filter addresses with strict regex before decoding
- Let c32check library handle character normalization
**Warning signs:** Users report "valid" addresses rejected; addresses with O, I, L fail validation

### Pitfall 3: Missing Network Mismatch Detection
**What goes wrong:** SP address on testnet network passes validation
**Why it happens:** c32addressDecode validates checksum but not network context
**How to avoid:**
- After decoding, check version byte against expected network
- SP (v22) and SM (v20) only valid on `stacks:1`
- ST (v26) and SN (v21) only valid on `stacks:2147483648`
- Return specific error: "Mainnet address on testnet network"
**Warning signs:** Cross-network transactions succeed in validation but fail on-chain

### Pitfall 4: Overly Technical Error Messages
**What goes wrong:** Errors mention "version byte 22" or "c32check encoding" to end users
**Why it happens:** Exposing implementation details instead of user-friendly guidance
**How to avoid:**
- Don't mention c32check, version bytes, or encoding details
- Say "Invalid Stacks address checksum. Double-check the address." not "c32checkDecode failed"
- For network mismatch: "Mainnet address provided but testnet network specified" not "Version byte 22 invalid for stacks:2147483648"
- Keep messages actionable and simple
**Warning signs:** User bug reports show confusion about technical terms

### Pitfall 5: Distinguishing SM/SN from SP/ST in Output
**What goes wrong:** Treating contract addresses differently from standard addresses
**Why it happens:** Assumption that P2SH addresses (SM/SN) need different handling
**How to avoid:**
- Accept both P2PKH (SP/ST) and P2SH (SM/SN) equally
- Don't differentiate in validation output - just say "Stacks address"
- Both are valid payTo targets (contracts can receive STX)
- Contract name suffixes (`.my-contract`) are out of scope - validate base address only
**Warning signs:** SM addresses rejected; special-case code for contract addresses

## Code Examples

Verified patterns from official sources:

### Decoding a Stacks Address
```typescript
// Source: https://github.com/stacks-network/c32check
import { c32addressDecode } from 'c32check'

// Example: SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7
const [version, hash160] = c32addressDecode(address)
// version = 22 (mainnet P2PKH)
// hash160 = 'a46ff88886c2ef9762d970b4d2c63678835bd39d'
```

### Version Byte Mapping
```typescript
// Source: https://github.com/stacks-network/c32check/blob/master/README.md
// Mainnet P2PKH: 22 → produces 'SP' prefix
// Mainnet P2SH:  20 → produces 'SM' prefix
// Testnet P2PKH: 26 → produces 'ST' prefix
// Testnet P2SH:  21 → produces 'SN' prefix

const STACKS_VERSION_MAINNET_P2PKH = 22
const STACKS_VERSION_MAINNET_P2SH = 20
const STACKS_VERSION_TESTNET_P2PKH = 26
const STACKS_VERSION_TESTNET_P2SH = 21
```

### Basic Validation Pattern
```typescript
// Pattern based on existing EVM/Solana validators
const STACKS_ADDRESS_REGEX = /^S[TPMN][0-9A-HJ-NP-Z]{38,41}$/

export function validateStacksAddress(
  address: string,
  network: string,
  field: string
): ValidationIssue[] {
  // Quick format check
  if (!STACKS_ADDRESS_REGEX.test(address)) {
    return [createInvalidFormatError(field)]
  }

  // Decode and validate checksum
  try {
    const [version] = c32addressDecode(address)

    // Validate version matches network
    if (!isValidVersionForNetwork(version, network)) {
      return [createNetworkMismatchError(field, version, network)]
    }

    return [] // Valid
  } catch (error) {
    return [createChecksumError(field)]
  }
}
```

### Network Registry Addition
```typescript
// Source: packages/x402check/src/registries/networks.ts pattern
export const KNOWN_NETWORKS = {
  // ... existing networks ...

  // Stacks networks
  'stacks:1': { name: 'Stacks Mainnet', type: 'stacks', testnet: false },
  'stacks:2147483648': { name: 'Stacks Testnet', type: 'stacks', testnet: true },
} as const
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| base58check (Bitcoin-style) | c32check (Crockford base-32) | Stacks 2.0 (2020) | Different character set, addresses start with 'S' not '1'/'3' |
| String network names | Numeric CAIP-2 identifiers | CAIP-2 standardization (2021) | Use `stacks:1` not `stacks:mainnet` |
| Blockstack → Stacks | Rebranded ecosystem | 2020 rebrand | Old packages under @blockstack/* deprecated, use @stacks/* |

**Deprecated/outdated:**
- `@blockstack/*` packages: Use `@stacks/*` instead (all major packages migrated)
- String-based network identifiers (`stacks:mainnet`): Use numeric form `stacks:1`
- Devnet/mocknet networks: Only mainnet (1) and testnet (2147483648) are officially supported

## Open Questions

Things that couldn't be fully resolved:

1. **c32check package bundle size**
   - What we know: Package has minimal dependencies (@noble/hashes, base-x), webpack dist available, browser-compatible
   - What's unclear: Exact minified+gzipped size (bundlephobia.com lookup failed during research)
   - Recommendation: Install and measure; current 31KB + estimated 5-8KB should stay under 45KB target; fallback: vendor critical functions if needed

2. **SM/SN addresses as payTo targets**
   - What we know: SM/SN are P2SH addresses (multisig/contract), base addresses validate identically to SP/ST
   - What's unclear: Whether contract addresses (SM*.contract-name) should be accepted in payTo fields for x402 payments
   - Recommendation: Accept base SM/SN addresses (they can receive STX); treat contract name suffixes as out of scope for Phase 12; revisit if users need contract-specific payment targeting

3. **c32check error message verbosity**
   - What we know: c32addressDecode throws errors on invalid checksum, library designed for developer use
   - What's unclear: Exact error message format from c32addressDecode (whether it leaks technical details)
   - Recommendation: Always wrap c32addressDecode in try-catch, translate to user-friendly ValidationIssue; never expose library errors directly

## Sources

### Primary (HIGH confidence)
- [c32check GitHub Repository](https://github.com/stacks-network/c32check) - Official library documentation, version bytes, API reference
- [c32check README](https://github.com/blockstack/c32check/blob/master/README.md) - Encoding algorithm, checksum calculation, usage examples
- [Stacks CAIP-2 Namespace](https://namespaces.chainagnostic.org/stacks/caip2) - Official CAIP-2 identifiers (stacks:1, stacks:2147483648)
- [c32check package.json](https://github.com/stacks-network/c32check/blob/master/package.json) - Dependencies, version, browser configuration

### Secondary (MEDIUM confidence)
- [Stacks Documentation - Mainnet and Testnets](https://docs.stacks.co/network-fundamentals/mainnet-and-testnets) - Network overview, chainId confirmation
- [Stacks Documentation - Accounts](https://docs.stacks.co/concepts/network-fundamentals/accounts) - Address format overview
- [Stacks.js Documentation - @stacks/common](https://stacks.js.org/modules/_stacks_common) - Ecosystem utilities
- [How Every Stacks Address Has a Corresponding Bitcoin Address](https://www.hiro.so/blog/how-every-stacks-address-has-a-corresponding-bitcoin-address) - Version byte details
- [GitHub Issue - Address network mismatch](https://github.com/hirosystems/stacks-wallet-web/issues/2179) - Real-world mismatch error patterns
- [GitHub Issue - STX transfer testnet to mainnet](https://github.com/stacks-network/stacks-blockchain/issues/2640) - Network validation requirements

### Tertiary (LOW confidence)
- [npm package search - c32check](https://www.npmjs.com/package/c32check) - Weekly download statistics (123k)
- [Socket.dev - c32check security analysis](https://socket.dev/npm/package/c32check) - Package health metrics (last release cadence)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - c32check is canonical library, used by all Stacks.js packages, 123k weekly downloads
- Architecture: HIGH - Pattern matches existing EVM/Solana validators, CAIP-2 identifiers documented
- Pitfalls: HIGH - Version byte confusion confirmed in GitHub issues, network mismatch errors documented in wallet repos
- Bundle size: MEDIUM - Dependencies confirmed minimal, browser support confirmed, exact minified size not measured
- Contract addresses: MEDIUM - SM/SN usage confirmed via GitHub issues, payTo semantics require validation

**Research date:** 2026-02-04
**Valid until:** 2026-03-06 (30 days - stable blockchain encoding, unlikely to change)
