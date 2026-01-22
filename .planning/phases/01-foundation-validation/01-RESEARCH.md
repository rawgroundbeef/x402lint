# Phase 1: Foundation & Validation - Research

**Researched:** 2026-01-22
**Domain:** Address validation, config validation, browser-based tooling
**Confidence:** MEDIUM-HIGH

## Summary

This phase builds a browser-based x402 config validator with zero build step requirements. The core challenges are: (1) implementing chain-specific address validation (EVM EIP-55 checksum, Solana Base58), (2) supporting both x402 v1 and v2 schemas with their different field structures, and (3) providing helpful, actionable error messages.

**Standard approach:** Use established cryptographic libraries (ethers.js or viem for EVM, bs58 + custom validation for Solana) loaded via CDN. Avoid hand-rolling address validation or checksum algorithms—these have subtle edge cases and security implications. Plain HTML/JS with CDN-loaded libraries provides the fastest path to a working validator without build complexity.

**Primary recommendation:** Use ethers.js v5 for EVM address validation (mature, CDN-available, checksum-aware) and bs58 with length validation for Solana addresses (lightweight, no official @solana/addresses CDN). Structure validation with clear field path errors following linter-style feedback patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ethers.js | 5.7+ | EVM address validation with EIP-55 checksum | De facto standard for Ethereum tooling, `.getAddress()` validates checksums automatically, available via cdnjs |
| bs58 | 6.0+ | Base58 encoding/decoding for Solana | Bitcoin-compatible Base58, 5M+ weekly downloads, jsDelivr CDN available |
| js-sha3 | 0.9+ | Keccak256 hashing (if custom EIP-55 needed) | Lightweight SHA-3/Keccak implementation, cdnjs available, browser-compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| viem | 2.0+ | Modern alternative to ethers.js | If starting fresh in 2026, more tree-shakeable, but less CDN maturity |
| @solana/addresses | latest | Official Solana address validation | Ideal but no CDN dist—requires bundler, conflicts with "no build" requirement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ethers.js | viem | Viem is more modern/modular but ethers has better CDN support for no-build usage |
| bs58 + custom | @solana/addresses | Official library but requires npm/bundler, not CDN-friendly |
| Library validation | multicoin-address-validator | Supports many chains but 6 months since last update, EIP-55 support unclear |

**Installation (CDN approach):**
```html
<!-- EVM validation -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js"></script>

<!-- Solana validation -->
<script src="https://cdn.jsdelivr.net/npm/bs58@6.0.0/index.min.js"></script>

<!-- If custom EIP-55 needed -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-sha3/0.9.3/sha3.min.js"></script>
```

## Architecture Patterns

### Recommended Project Structure
```
/
├── index.html           # Main validator interface
├── validator.js         # Core validation logic
├── ui.js               # Error display and feedback
└── chains.js           # Chain/asset configuration
```

### Pattern 1: Layered Validation
**What:** Validate in stages: JSON parse → schema structure → field types → address format → semantic rules
**When to use:** Always—catches errors early and provides specific feedback per layer
**Example:**
```javascript
// Stage 1: Parse
let config;
try {
  config = JSON.parse(input);
} catch (e) {
  return { errors: [{ field: 'root', message: 'Invalid JSON', fix: `Check line ${getLineFromError(e)}` }] };
}

// Stage 2: Schema structure
if (!config.x402Version) {
  errors.push({ field: 'x402Version', message: 'Missing required field', fix: 'Add "x402Version": 1 or 2' });
}

// Stage 3: Field types
const version = config.x402Version;
const paymentsField = version === 1 ? 'payments' : 'accepts';
if (!Array.isArray(config[paymentsField])) {
  errors.push({ field: paymentsField, message: 'Must be an array', fix: `Change ${paymentsField} to an array` });
}

// Stage 4: Address validation (per entry)
config[paymentsField].forEach((payment, i) => {
  const chain = payment.chain || payment.network;
  const address = payment.address || payment.payTo;

  if (isEVMChain(chain)) {
    try {
      ethers.utils.getAddress(address); // Validates checksum
    } catch (e) {
      errors.push({
        field: `${paymentsField}[${i}].address`,
        message: `Invalid EVM address: ${e.message}`,
        fix: 'Use checksummed address (0x with 40 hex chars, proper case)'
      });
    }
  }
});
```

### Pattern 2: Version-Aware Field Mapping
**What:** Map v1 and v2 field names to normalized internal structure
**When to use:** When supporting multiple schema versions
**Example:**
```javascript
function normalizePayment(payment, version) {
  return {
    chain: version === 1 ? payment.chain : extractChainFromCAIP2(payment.network),
    address: version === 1 ? payment.address : payment.payTo,
    asset: payment.asset,
    minAmount: version === 1 ? payment.minAmount : payment.price,
    maxAmount: payment.maxAmount || payment.maxAmountRequired
  };
}
```

### Pattern 3: Contextual Error Messages
**What:** Include both what's wrong AND how to fix it, with field paths
**When to use:** Always—error messages are primary UX
**Example:**
```javascript
// Bad: "Invalid address"
// Good:
{
  field: 'payments[0].address',
  severity: 'error',
  message: '"0x123abc" is not a valid EVM address',
  fix: 'EVM addresses must be 42 characters (0x + 40 hex chars)'
}
```

### Anti-Patterns to Avoid
- **Silent coercion:** Don't auto-fix case on addresses—inform user instead (they may have wrong address)
- **Generic errors:** "Validation failed" without specifics leaves user guessing
- **Regex-only address validation:** Misses checksum validation, creates false security
- **Early exit on first error:** Show ALL errors at once so user can fix in one pass

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EIP-55 checksum | Custom keccak256 + case logic | `ethers.utils.getAddress()` | Subtleties in mixed-case handling, wallet compatibility edge cases |
| Solana address validation | Regex pattern matching | bs58 decode + length check | Base58 has no checksum; need to verify 32-byte decode, not just character set |
| Decimal validation | Regex `/^\d+\.\d+$/` | Parse + number checks | Scientific notation, leading zeros, internationalization, max precision |
| JSON schema validation | Manual object property checks | ajv or z-schema (if adding) | Nested validation, conditional rules, type coercion edge cases |
| CAIP-2 parsing | String splitting | Parse with regex `/^([a-z0-9-]{3,8}):([a-zA-Z0-9_-]{1,32})$/` | Namespace/reference constraints, case sensitivity rules |

**Key insight:** Address validation is security-critical. Hand-rolled implementations miss edge cases that can lead to fund loss. Use battle-tested libraries that thousands of wallets rely on.

## Common Pitfalls

### Pitfall 1: Accepting Invalid Checksums
**What goes wrong:** Using regex or `toLowerCase()` comparison accepts addresses with wrong checksums, bypassing EIP-55 error detection
**Why it happens:** EIP-55 appears optional (lowercase-only addresses are "valid"), but mixed-case implies checksum assertion
**How to avoid:** Always validate checksum when mixed-case is present; accept all-lowercase as valid but warn about missing checksum protection
**Warning signs:** Addresses with random capitalization that pass validation
**Detection:**
```javascript
// Bad: accepts wrong checksums
if (/^0x[0-9a-fA-F]{40}$/.test(address)) { return true; }

// Good: validates checksum if present
try {
  const checksummed = ethers.utils.getAddress(address);
  if (address !== checksummed && address !== address.toLowerCase()) {
    warnings.push('Address has incorrect checksum');
  }
} catch (e) {
  errors.push('Invalid address format');
}
```

### Pitfall 2: Chain/Address Format Mismatch
**What goes wrong:** Accepting EVM address on Solana chain (or vice versa) passes field validation but will fail on-chain
**Why it happens:** Both are valid addresses in isolation; need cross-field validation
**How to avoid:** After validating address format, check it matches the specified chain type
**Warning signs:** Solana config with "0x..." address, EVM config with base58 address
**Code:**
```javascript
function validateChainAddressMatch(chain, address) {
  const isEVM = ['base', 'base-sepolia', 'eip155:*'].some(c => chain.includes(c));
  const isSolana = ['solana', 'solana-devnet'].some(c => chain.includes(c));

  const looksLikeEVM = address.startsWith('0x') && address.length === 42;
  const looksLikeSolana = !address.startsWith('0x') && address.length >= 32 && address.length <= 44;

  if (isEVM && !looksLikeEVM) {
    return { error: 'EVM chains require 0x-prefixed addresses' };
  }
  if (isSolana && !looksLikeSolana) {
    return { error: 'Solana chains require Base58 addresses (no 0x prefix)' };
  }
  return { valid: true };
}
```

### Pitfall 3: Version Detection Ambiguity
**What goes wrong:** Config missing `x402Version` field leads to guessing which schema to validate against
**Why it happens:** Early x402 implementations may omit version field; both schemas use JSON objects
**How to avoid:** Require `x402Version` explicitly; error if missing rather than guessing
**Warning signs:** Validation succeeds on wrong schema, confusing error messages
**Code:**
```javascript
if (!config.x402Version) {
  return {
    errors: [{
      field: 'x402Version',
      message: 'Missing required version field',
      fix: 'Add "x402Version": 1 or "x402Version": 2 at top level'
    }]
  };
}
if (![1, 2].includes(config.x402Version)) {
  return {
    errors: [{
      field: 'x402Version',
      message: `Unknown version: ${config.x402Version}`,
      fix: 'Use version 1 or 2'
    }]
  };
}
```

### Pitfall 4: Solana Address False Positives
**What goes wrong:** Base58 regex matches but decode fails or produces wrong byte length
**Why it happens:** Solana has no checksum; any Base58 string "looks valid" to regex
**How to avoid:** Always decode and verify 32-byte result
**Warning signs:** Short strings or strings with invalid Base58 chars passing validation
**Code:**
```javascript
function validateSolanaAddress(address) {
  // Bad: regex only
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) { return true; }

  // Good: decode and check length
  try {
    const decoded = bs58.decode(address);
    if (decoded.length !== 32) {
      return { error: `Solana addresses must decode to 32 bytes (got ${decoded.length})` };
    }
    return { valid: true };
  } catch (e) {
    return { error: 'Invalid Base58 encoding' };
  }
}
```

### Pitfall 5: Decimal Amount Validation Gaps
**What goes wrong:** Accepting `"0"`, `"-5"`, or `"1e10"` as minAmount passes string checks but violates "positive decimal" requirement
**Why it happens:** JavaScript number parsing is permissive; validation needs explicit bounds
**How to avoid:** Parse as number, check `> 0`, reject scientific notation for clarity
**Warning signs:** Zero or negative amounts, exponential notation in config
**Code:**
```javascript
function validatePositiveDecimal(value, fieldName) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { error: 'Must be a number or numeric string' };
  }

  const str = String(value);
  if (/[eE]/.test(str)) {
    return { error: 'Scientific notation not allowed (use decimal format)' };
  }

  const num = parseFloat(str);
  if (isNaN(num)) {
    return { error: 'Not a valid number' };
  }
  if (num <= 0) {
    return { error: 'Must be greater than zero' };
  }
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return { error: 'Must be positive decimal (e.g., "1.50")' };
  }

  return { valid: true, value: num };
}
```

## Code Examples

Verified patterns from official sources:

### EVM Address Checksum Validation
```javascript
// Source: https://docs.ethers.org/v5/api/utils/address/
// Using ethers.js v5 via CDN

function validateEvmAddress(address) {
  try {
    // getAddress() returns checksummed version if valid
    // Throws if invalid format or wrong checksum
    const checksummed = ethers.utils.getAddress(address);

    // Check if input had correct checksum (if mixed case)
    const hasUpperAndLower = address !== address.toLowerCase() &&
                             address !== address.toUpperCase();

    if (hasUpperAndLower && address !== checksummed) {
      return {
        valid: false,
        error: 'Address has invalid checksum',
        suggestion: `Did you mean: ${checksummed}?`
      };
    }

    return {
      valid: true,
      checksummed: checksummed,
      warning: address === address.toLowerCase() ?
        'Address is valid but lacks checksum protection' : null
    };

  } catch (error) {
    return {
      valid: false,
      error: 'Invalid EVM address format',
      details: error.message
    };
  }
}
```

### Solana Address Validation
```javascript
// Source: https://www.npmjs.com/package/bs58
// Using bs58 v6 via jsDelivr CDN

function validateSolanaAddress(address) {
  // Basic format check
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return {
      valid: false,
      error: 'Invalid Base58 format',
      fix: 'Solana addresses use Base58 encoding (32-44 chars, no 0/O/I/l)'
    };
  }

  // Decode and verify length
  try {
    const decoded = bs58.decode(address);

    if (decoded.length !== 32) {
      return {
        valid: false,
        error: `Address decodes to ${decoded.length} bytes (expected 32)`,
        fix: 'Verify the address is complete and unmodified'
      };
    }

    return {
      valid: true,
      warning: 'Solana addresses have no checksum—double-check for typos'
    };

  } catch (error) {
    return {
      valid: false,
      error: 'Failed to decode Base58',
      fix: 'Check for invalid characters'
    };
  }
}
```

### Version-Aware Config Validation
```javascript
// Source: https://docs.cdp.coinbase.com/x402/migration-guide
// x402 v1 vs v2 schema differences

function validateX402Config(configText) {
  const errors = [];
  const warnings = [];

  // Parse JSON
  let config;
  try {
    config = JSON.parse(configText);
  } catch (e) {
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid JSON syntax',
        fix: `Check syntax near: ${e.message}`
      }]
    };
  }

  // Require version field
  if (!config.x402Version) {
    errors.push({
      field: 'x402Version',
      severity: 'error',
      message: 'Missing required field',
      fix: 'Add "x402Version": 1 or 2'
    });
    return { valid: false, errors }; // Can't continue without version
  }

  const version = config.x402Version;
  if (![1, 2].includes(version)) {
    errors.push({
      field: 'x402Version',
      severity: 'error',
      message: `Invalid version: ${version}`,
      fix: 'Use version 1 or 2'
    });
    return { valid: false, errors };
  }

  // v1: "payments" array with "address", "minAmount"
  // v2: "accepts" array with "payTo", "price", CAIP-2 networks
  const paymentsField = version === 1 ? 'payments' : 'accepts';
  const addressField = version === 1 ? 'address' : 'payTo';
  const amountField = version === 1 ? 'minAmount' : 'price';

  if (!config[paymentsField]) {
    errors.push({
      field: paymentsField,
      severity: 'error',
      message: 'Missing required field',
      fix: `Add "${paymentsField}": [...]`
    });
    return { valid: false, errors };
  }

  if (!Array.isArray(config[paymentsField]) || config[paymentsField].length === 0) {
    errors.push({
      field: paymentsField,
      severity: 'error',
      message: 'Must be non-empty array',
      fix: 'Add at least one payment option'
    });
  }

  // Validate each payment option
  config[paymentsField].forEach((payment, i) => {
    const path = `${paymentsField}[${i}]`;

    // Check required fields
    const requiredFields = [
      'chain', addressField, 'asset', amountField
    ];

    if (version === 2) {
      requiredFields.push('scheme', 'network');
    }

    requiredFields.forEach(field => {
      if (!payment[field]) {
        errors.push({
          field: `${path}.${field}`,
          severity: 'error',
          message: 'Missing required field',
          fix: `Add "${field}" to this payment option`
        });
      }
    });

    // Validate network format (v2 uses CAIP-2)
    if (version === 2 && payment.network) {
      const caip2Pattern = /^[a-z0-9-]{3,8}:[a-zA-Z0-9_-]{1,32}$/;
      if (!caip2Pattern.test(payment.network)) {
        errors.push({
          field: `${path}.network`,
          severity: 'error',
          message: `Invalid CAIP-2 format: "${payment.network}"`,
          fix: 'Use format "namespace:reference" (e.g., "eip155:84532")'
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    version
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple chain names ("base") | CAIP-2 identifiers ("eip155:8453") | x402 v2 (Jan 2025) | Need to parse namespace:reference format, validate separately |
| Single payment config | `accepts` array with multiple options | x402 v2 (Jan 2025) | Validate array of payment schemes, not single object |
| Lowercase address acceptance | Checksum validation | EIP-55 (2016, but enforcement varies) | Must validate mixed-case checksums, warn on lowercase-only |
| Custom validation libs | Modern utilities (viem, ethers v6) | 2024-2025 | Better TypeScript support, tree-shaking, but less CDN availability |

**Deprecated/outdated:**
- **multicoin-address-validator**: Last updated 6 months ago, unclear EIP-55 checksum support for Ethereum
- **X-* HTTP headers in x402**: Replaced with `PAYMENT-*` headers in v2 (not relevant for config validation but impacts integration testing)
- **@solana/web3.js v1**: Replaced by modular @solana/\* packages (v2), but legacy version still widely used

## Open Questions

Things that couldn't be fully resolved:

1. **x402 v1 "payments" field exact schema**
   - What we know: v2 uses `accepts` array with `payTo`, `network` (CAIP-2), `scheme`, `price`
   - What's unclear: v1 used `payments` but exact required fields not in accessible docs
   - Recommendation: Assume v1 mirrors requirements list (chain, address, asset, minAmount) since user context specified these

2. **Known asset contract addresses**
   - What we know: User wants validation of "known asset addresses match their chain" (USDC on Base = specific contract)
   - What's unclear: No authoritative registry found; contract addresses vary by network
   - Recommendation: Create small hardcoded registry for common pairs (USDC on Base/Base Sepolia, SOL on Solana), mark LOW confidence, expand as needed

3. **CAIP-2 reference validation strictness**
   - What we know: Format is `namespace:reference` with regex `/^[a-z0-9-]{3,8}:[a-zA-Z0-9_-]{1,32}$/`
   - What's unclear: Whether to validate reference semantics (e.g., "eip155:999999" is valid format but nonexistent chain)
   - Recommendation: Validate format only for v1; warn on unknown chain IDs but don't error (user context says "deferred to v2-specific scope")

4. **Browser compatibility for CDN libraries**
   - What we know: ethers.js v5, bs58, js-sha3 have CDN distributions
   - What's unclear: Minimum browser version support, polyfill needs
   - Recommendation: Test in Chrome/Firefox/Safari latest, add note about IE11 non-support if user asks

## Sources

### Primary (HIGH confidence)
- [EIP-55 Specification](https://eips.ethereum.org/EIPS/eip-55) - Checksum algorithm and requirements
- [ethers.js v5 Address Documentation](https://docs.ethers.org/v5/api/utils/address/) - `getAddress()` validation behavior
- [CAIP-2 Specification](https://chainagnostic.org/CAIPs/caip-2) - Chain ID format and validation rules
- [x402 Migration Guide](https://docs.cdp.coinbase.com/x402/migration-guide) - v1 to v2 schema changes

### Secondary (MEDIUM confidence)
- [viem isAddress utility](https://viem.sh/docs/utilities/isAddress.html) - Modern checksum validation (WebSearch verified)
- [bs58 npm package](https://www.npmjs.com/package/bs58) - Base58 encoding standard (WebSearch + jsDelivr CDN confirmed)
- [@solana/addresses specification](https://www.npmjs.com/package/@solana/addresses) - Solana address validation approach (WebSearch)
- [js-sha3 on cdnjs](https://cdnjs.com/libraries/js-sha3) - Keccak256 implementation (WebSearch verified)
- [x402.org overview](https://www.x402.org/) - Protocol documentation (WebSearch)

### Tertiary (LOW confidence)
- Form validation best practices (NN/G, UX Writing Hub) - Error message patterns
- Decimal regex patterns (various tutorials) - Number validation approaches
- JSON validator tools (JSONLint) - UI/UX patterns for validation feedback

### Key Research Notes
- **EVM checksum**: High confidence—official EIP-55 spec and ethers.js docs provide exact algorithm
- **Solana validation**: Medium confidence—official package exists but no CDN; bs58 approach is workaround
- **x402 v1 schema**: Medium confidence—v2 migration guide shows changes but v1 spec not directly accessed; user context fills gaps
- **CAIP-2**: High confidence—official ChainAgnostic spec accessed via docs.cdp.coinbase.com redirect
- **Error UX patterns**: Medium confidence—industry best practices consistent across sources but no x402-specific guidelines

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ethers.js and bs58 are well-established, CDN availability verified
- Architecture: MEDIUM-HIGH - Layered validation is standard pattern, version-aware approach inferred from migration docs
- Pitfalls: HIGH - EIP-55 gotchas well-documented, Solana no-checksum limitation explicit in sources
- x402 schema details: MEDIUM - v2 spec clear, v1 inferred from migration guide and user requirements

**Research date:** 2026-01-22
**Valid until:** ~30 days (Feb 2026) for library versions; x402 spec is stable but actively evolving (check for v2.1+ if delays occur)

**Research gaps addressed:**
- ✅ Chain-specific checksum implementation (EVM EIP-55, Solana Base58)
- ✅ Multicoin-address-validator evaluation (conclusion: use ethers.js + bs58 instead)
- ⚠️ Complete x402 spec (v2 clear, v1 partially inferred—acceptable given user context decisions)

**Critical for planner:**
- Don't hand-roll address validation—security-critical
- Support both v1 and v2 schemas with different field names (user decision)
- CDN-only approach constrains library choices (no @solana/addresses, no bundlers)
- Error messages must include field path + fix suggestion (user decision on format)
