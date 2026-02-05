# Phase 10: Website Integration - Research

**Researched:** 2026-01-29
**Domain:** Browser bundle integration, CDN delivery, legacy code migration
**Confidence:** HIGH

## Summary

Phase 10 replaces the website's five separate CDN dependencies (ethers.js, bs58, validator.js, chains.js, input.js - totaling ~810KB) with a single SDK IIFE bundle (~27KB raw, 9KB gzip) from Phase 9. The research confirms IIFE bundles are the correct format for browser `<script>` tag integration, jsDelivr is the standard CDN for npm packages, and adapter patterns enable clean migration from old API to new SDK without rewriting display logic.

**Primary recommendation:** Use jsDelivr CDN with SRI integrity hashes, create thin adapter layer in input.js that maps old `validateX402Config()` calls to SDK `validate()`, and implement incremental migration to minimize breaking changes.

## Standard Stack

The established libraries/tools for browser bundle integration via CDN:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsDelivr CDN | Latest | npm package delivery | Auto-serves package.json "browser" field, global CDN, supports SRI |
| IIFE bundle | tsdown | Browser-compatible format | Exposes window.x402Lint namespace, zero module system required |
| SRI (Subresource Integrity) | Native | CDN security | Browser validates cryptographic hash, prevents tampering |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| unpkg | Alternative CDN | Fallback or preference (both auto-resolve package.json) |
| webpack-bundle-analyzer | Bundle size analysis | Verify 810KB → 27KB reduction |
| onerror handler | CDN fallback | Production resilience (rare but mission-critical) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsDelivr | unpkg.com | functionally equivalent, jsDelivr has multi-provider redundancy |
| IIFE | ESM via `<script type="module">` | ESM cleaner but requires import maps, IIFE works everywhere |
| Global window namespace | Custom namespace (`window.X402SDK`) | Less collision risk but breaks convention (x402Lint matches package) |

**Installation:**
```html
<!-- Replace 5 script tags with 2 -->
<script src="https://cdn.jsdelivr.net/npm/x402lint@0.0.1/dist/index.iife.js"
        integrity="sha384-[HASH]"
        crossorigin="anonymous"></script>
<script src="input.js"></script>
```

## Architecture Patterns

### Recommended Migration Approach

**Incremental replacement:**
1. Keep existing display logic (renderVerdict, renderDetails) unchanged
2. Replace validation function only (validateX402Config → window.x402Lint.validate)
3. Map SDK result shape to old result shape in adapter
4. Verify UI renders identically
5. Clean up old files (validator.js, chains.js)

**Rationale:** Minimize blast radius. Display code is complex (1480 lines index.html), already works, and doesn't need SDK awareness. Only input.js needs changes.

### Pattern 1: Adapter Layer for API Migration

**What:** Thin wrapper that preserves old API surface while delegating to new implementation

**When to use:** When migrating from legacy code to new SDK without rewriting consumers

**Example:**
```javascript
// OLD API (current website)
function validateX402Config(configText) {
  return {
    valid: boolean,
    errors: Array<{field, message, fix}>,
    warnings: Array<{field, message, fix}>,
    detectedFormat: string,
    normalized: object
  };
}

// NEW SDK API
window.x402Lint.validate(config, options) {
  return {
    valid: boolean,
    version: string,
    errors: Array<{code, field, message, severity, fix}>,
    warnings: Array<{code, field, message, severity, fix}>,
    normalized: object
  };
}

// ADAPTER (maps new to old shape)
function validateX402Config(configText) {
  const result = window.x402Lint.validate(configText);
  return {
    valid: result.valid,
    errors: result.errors.map(e => ({
      field: e.field,
      message: e.message,
      fix: e.fix
    })),
    warnings: result.warnings.map(w => ({
      field: w.field,
      message: w.message,
      fix: w.fix
    })),
    detectedFormat: result.version, // 'v2' | 'v1' | 'flat-legacy'
    normalized: result.normalized
  };
}
```

**Source:** [JavaScript Adapter Design Pattern](https://www.dofactory.com/javascript/design-patterns/adapter)

### Pattern 2: CDN Loading with SRI and Fallback

**What:** Load external resource with integrity verification and local fallback

**When to use:** Production websites relying on third-party CDNs

**Example:**
```html
<!-- Primary: jsDelivr with SRI -->
<script src="https://cdn.jsdelivr.net/npm/x402lint@0.0.1/dist/index.iife.js"
        integrity="sha384-[HASH]"
        crossorigin="anonymous"
        onerror="loadLocalFallback()"></script>

<script>
// Fallback strategy
function loadLocalFallback() {
  if (!window.x402Lint) {
    const script = document.createElement('script');
    script.src = '/vendor/x402lint.iife.js';
    document.head.appendChild(script);
  }
}
</script>
```

**Source:** [CDNs fail, but your scripts don't have to](https://www.hanselman.com/blog/cdns-fail-but-your-scripts-dont-have-to-fallback-from-cdn-to-local-jquery)

### Pattern 3: Field Name Mapping (Breaking Change Handling)

**What:** Handle 8+ field name changes between old validator and SDK

**Field mappings:**
| Old Field | SDK Field | Handling |
|-----------|-----------|----------|
| `detectedFormat` | `version` | Direct rename: `flat` → `flat-legacy` |
| `errors[].severity` | (always `'error'`) | SDK includes severity, filter or ignore |
| `warnings[].severity` | (always `'warning'`) | SDK includes severity, filter or ignore |
| `normalized.payments` | `normalized.accepts` | SDK uses spec-correct `accepts` array |
| `payment.chain` | `accept.network` | SDK uses CAIP-2 format (e.g., `eip155:8453`) |
| `payment.address` | `accept.payTo` | SDK uses spec field name |
| `payment.minAmount` | `accept.amount` | SDK uses atomic units string |
| `payment.asset` | `accept.asset` | Same field name, different validation |

**Adapter implementation:**
```javascript
function adaptNormalized(sdkNormalized) {
  if (!sdkNormalized || !sdkNormalized.accepts) return null;

  return {
    x402Version: sdkNormalized.x402Version,
    payments: sdkNormalized.accepts.map(accept => ({
      chain: accept.network, // CAIP-2 format
      address: accept.payTo,
      asset: accept.asset,
      minAmount: accept.amount,
      _normalizedAmount: normalizeAmount(accept.amount)
    })),
    metadata: sdkNormalized.extensions?.metadata,
    outputSchema: sdkNormalized.extensions?.outputSchema
  };
}
```

### Anti-Patterns to Avoid

- **Rewriting display logic:** UI code is complex and works. Don't touch it unless necessary.
- **Breaking old examples:** Keep flat/v1/v2 example tabs working, users may link to them.
- **Removing CDN fallback:** CDNs do fail (rare but happens). Always have local copy.
- **Skipping SRI hashes:** Security best practice. Generate during publish, not manually.
- **Manual hash updates:** Automate SRI hash generation in CI/publish workflow.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRI hash generation | Manual sha384 calculation | `openssl dgst -sha384` or srihash.org | Hash must match byte-for-byte, human error likely |
| CDN version pinning | Hardcode version numbers | jsDelivr version aliasing (`@latest`, `@0.x`) | Auto-updates patch versions, manual update for majors |
| Bundle size measurement | Eyeball file sizes | webpack-bundle-analyzer | Visualizes treemap, identifies bloat sources |
| Global namespace conflicts | Hope for the best | Check `window.x402Lint` exists | Other libs might use same name (unlikely but defensive) |
| API compatibility layer | Inline field mapping everywhere | Centralized adapter function | Single source of truth, easier to remove later |

**Key insight:** Browser tooling is mature. Use standard tools (SRI, CDN versioning, analyzers) rather than custom solutions. The hard parts are hash generation and version management, both solved by ecosystem.

## Common Pitfalls

### Pitfall 1: Missing crossorigin Attribute with SRI

**What goes wrong:** Script loads but integrity check fails silently

**Why it happens:** SRI requires CORS. Without `crossorigin="anonymous"`, browser doesn't send CORS headers, CDN doesn't respond with Access-Control-Allow-Origin, integrity check aborts.

**How to avoid:** Always pair `integrity` with `crossorigin="anonymous"`:
```html
<!-- WRONG: integrity without crossorigin -->
<script src="..." integrity="sha384-..."></script>

<!-- RIGHT: both attributes -->
<script src="..." integrity="sha384-..." crossorigin="anonymous"></script>
```

**Warning signs:** Script tag in HTML but `window.x402Lint` is undefined. Console shows CORS error.

**Source:** [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

### Pitfall 2: CDN Version Updates Breaking Integrity Hash

**What goes wrong:** Site stops working after minor package version update because SRI hash doesn't match

**Why it happens:** `@latest` alias resolves to new version, but integrity hash is for old version. Browser rejects mismatched hash.

**How to avoid:**
- Option A: Pin exact version (`x402lint@0.0.1`) and update hash manually when upgrading
- Option B: Omit SRI for dev, generate during CI/deploy for production
- Option C: Use CDN's SRI auto-generation (jsDelivr doesn't support this)

**Recommended:** Pin version + automate hash generation in publish workflow

**Warning signs:** Script worked yesterday, now fails with integrity violation. Recent package publish.

### Pitfall 3: Field Name Mismatches Breaking Display Logic

**What goes wrong:** Website shows "undefined" or blank fields after SDK integration

**Why it happens:** Display code expects `result.detectedFormat`, SDK returns `result.version`. Code fails silently.

**How to avoid:**
1. **Create comprehensive adapter mapping** (see Pattern 3 above)
2. **Test with all three formats** (flat, v1, v2) to verify display
3. **Add defensive checks** for missing fields before rendering
4. **Log SDK raw output** during dev to compare shapes

**Warning signs:** Some validation results render correctly, others show blank sections. Format badge missing.

### Pitfall 4: Example Configs Using Old Field Names

**What goes wrong:** "Load into validator" button breaks for flat/v1 examples

**Why it happens:** Example configs use legacy field names (`network: "solana"`), SDK expects CAIP-2 (`network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"`). Old validator silently normalized, SDK returns errors.

**How to avoid:**
- Update example configs to canonical v2 format (see requirement WEB-04)
- Keep legacy examples in "deprecated" tab with warnings
- Test each example's load → validate → display flow

**Warning signs:** Example loads but validation fails with "invalid network format" errors. Users report examples don't work.

### Pitfall 5: Bundle Size Regression from Incorrect Import

**What goes wrong:** IIFE bundle balloons from 27KB to 200KB+ after adding feature

**Why it happens:** Accidentally imported entire SDK (`import * from 'x402lint'`) instead of named exports. Tree-shaking doesn't work for wildcard imports in IIFE format.

**How to avoid:**
- Use named exports only: `export { validate, detect, normalize }`
- Verify `dist/index.iife.js` size after every build (< 30KB threshold)
- Run bundle analyzer if size increases unexpectedly

**Warning signs:** Build succeeds but dist file much larger than expected. Website loads slowly.

## Code Examples

Verified patterns from implementation planning:

### Complete Migration: Before and After

**BEFORE (5 script tags, ~810KB):**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js"
        integrity="sha512-..." crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/bs58@6.0.0/dist/index.umd.js"
        integrity="sha512-..." crossorigin="anonymous"></script>
<script src="chains.js"></script>
<script src="validator.js"></script>
<script src="input.js"></script>
```

**AFTER (2 script tags, ~27KB):**
```html
<script src="https://cdn.jsdelivr.net/npm/x402lint@0.0.1/dist/index.iife.js"
        integrity="sha384-[GENERATE_ON_PUBLISH]"
        crossorigin="anonymous"></script>
<script src="input.js"></script>
```

### Adapter Function (Preserves Old API)

**Source:** Planned for `input.js` modification

```javascript
// Place at top of input.js, replaces old validateX402Config() from validator.js

/**
 * Adapter: Maps SDK validate() to old website API shape
 * Preserves backward compatibility with display logic
 */
function validateX402Config(configText) {
  try {
    const sdkResult = window.x402Lint.validate(configText);

    // Map SDK shape to old shape
    return {
      valid: sdkResult.valid,
      errors: sdkResult.errors.map(e => ({
        field: e.field,
        message: e.message,
        fix: e.fix || undefined
      })),
      warnings: sdkResult.warnings.map(w => ({
        field: w.field,
        message: w.message,
        fix: w.fix || undefined
      })),
      detectedFormat: mapVersionToFormat(sdkResult.version),
      normalized: adaptNormalized(sdkResult.normalized)
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ field: 'root', message: error.message }],
      warnings: [],
      detectedFormat: 'unknown',
      normalized: null
    };
  }
}

function mapVersionToFormat(version) {
  const map = {
    'v2': 'v2',
    'v2-marketplace': 'v2-marketplace',
    'v1': 'v1',
    'flat-legacy': 'flat',
    'unknown': 'unknown'
  };
  return map[version] || 'unknown';
}

function adaptNormalized(sdkNormalized) {
  if (!sdkNormalized?.accepts) return null;

  return {
    x402Version: sdkNormalized.x402Version,
    payments: sdkNormalized.accepts.map(accept => ({
      chain: extractSimpleChain(accept.network), // "eip155:8453" → "base"
      address: accept.payTo,
      asset: accept.asset,
      minAmount: accept.amount,
      _normalizedAmount: normalizeAmount(accept.amount)
    })),
    metadata: sdkNormalized.extensions?.metadata,
    outputSchema: sdkNormalized.extensions?.outputSchema
  };
}

function extractSimpleChain(caip2Network) {
  // Reverse lookup: "eip155:8453" → "base"
  const reverseMap = {
    'eip155:8453': 'base',
    'eip155:84532': 'base-sepolia',
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'solana',
    'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'solana-devnet'
  };
  return reverseMap[caip2Network] || caip2Network;
}

function normalizeAmount(atomicUnits) {
  // SDK returns atomic units as string, old validator returned object
  const num = parseInt(atomicUnits, 10);
  if (isNaN(num)) return { normalized: null, original: atomicUnits, isMicroUnits: false };

  const isMicroUnits = num > 1000;
  const normalized = isMicroUnits ? num / 1_000_000 : num;

  return {
    normalized,
    original: atomicUnits,
    isMicroUnits,
    microUnits: num
  };
}
```

### Generate SRI Hash (Automation)

**Source:** Publish workflow requirement

```bash
# Generate SHA-384 hash for SRI attribute
# Run during npm publish or CI build

# Option 1: openssl
cat dist/index.iife.js | openssl dgst -sha384 -binary | openssl base64 -A
# Output: sha384-Xyz123...

# Option 2: Online tool (manual fallback)
# Visit: https://www.srihash.org/
# Upload: dist/index.iife.js
# Copy: integrity attribute with hash

# Option 3: Node.js script (recommended for CI)
node -e "
const crypto = require('crypto');
const fs = require('fs');
const file = fs.readFileSync('dist/index.iife.js');
const hash = crypto.createHash('sha384').update(file).digest('base64');
console.log(\`sha384-\${hash}\`);
"
```

### Canonical v2 Example Configs (Updated)

**Source:** Requirement WEB-04 - update example configs

```javascript
// Replace examples object in index.html <script> section

const examples = {
  v2: `{
  "x402Version": 2,
  "resource": {
    "url": "https://api.example.com/endpoint"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    "payTo": "5F5Yy9qJov8xK67vEWRoZHppWHEmH3WuG7mSfvLuqUTz",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "25000",
    "maxTimeoutSeconds": 300
  }]
}`,

  v1: `{
  "x402Version": 1,
  "accepts": [{
    "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    "payTo": "5F5Yy9qJov8xK67vEWRoZHppWHEmH3WuG7mSfvLuqUTz",
    "maxAmountRequired": "25000",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "resource": "https://api.example.com/endpoint"
  }]
}`,

  'flat-legacy': `{
  "amount": 0.025,
  "currency": "USDC",
  "network": "solana",
  "payTo": "5F5Yy9qJov8xK67vEWRoZHppWHEmH3WuG7mSfvLuqUTz"
}`,

  marketplace: `{
  "x402Version": 2,
  "resource": {
    "url": "https://api.example.com/endpoint"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "payTo": "0x1234567890abcdef1234567890abcdef12345678",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "10000",
    "maxTimeoutSeconds": 300
  }],
  "extensions": {
    "outputSchema": {
      "type": "object",
      "properties": { "result": { "type": "string" } }
    },
    "metadata": {
      "name": "My API",
      "description": "Does something useful",
      "category": "ai"
    }
  }
}`
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UMD bundles | IIFE preferred for browser globals | 2023-2024 | tsdown/tsup default to IIFE, simpler than UMD |
| Manual SRI hashes | CI-automated hash generation | 2024+ | Reduces human error, required for @latest versions |
| Multiple CDN scripts | Single bundled SDK | 2024+ (this project) | 810KB → 27KB (97% reduction) |
| Handwritten validators | Spec-compliant SDKs | 2025+ | x402 spec stabilized, SDKs align with canonical format |
| ethers.js + bs58 dependencies | Vendored crypto (@noble/hashes, @scure/base) | 2025+ | Zero runtime deps, smaller bundles |

**Deprecated/outdated:**
- **UMD format:** Replaced by IIFE for browser, ESM for bundlers. UMD still works but unnecessary complexity.
- **Manual checksum validation:** ethers.js checksumming replaced by SDK's @noble/hashes vendored implementation.
- **Base58 via bs58 npm package:** Replaced by @scure/base vendored decoder, lighter and no external deps.
- **"Flat" config format at root level:** Legacy pre-spec format. SDK supports but warns to upgrade to v2.

## Open Questions

Things that couldn't be fully resolved:

1. **Should we keep local fallback for IIFE bundle?**
   - What we know: CDN failures are rare, jsDelivr has multi-provider redundancy (Cloudflare + Fastly)
   - What's unclear: Whether x402lint.com serves enough traffic to justify fallback complexity
   - Recommendation: Start without fallback (simpler), add if CDN issues occur. Document pattern in code comments for future.

2. **Should example configs use CAIP-2 networks or simple names?**
   - What we know: SDK normalizes simple names (`"solana"`) to CAIP-2 (`"solana:5eykt..."`) internally
   - What's unclear: Whether showing full CAIP-2 in UI confuses users vs. educates them
   - Recommendation: Show simple names in UI ("solana"), use CAIP-2 in "raw config" view. Balance UX vs. spec correctness.

3. **How to handle API version upgrades (0.x → 1.x)?**
   - What we know: @latest will auto-resolve to 1.0.0, breaking integrity hash
   - What's unclear: Whether to pin `@0.0.1` forever or automate hash updates
   - Recommendation: Pin version in HTML, update manually during website deploys. Document process for future maintainers.

## Sources

### Primary (HIGH confidence)

**CDN and IIFE Integration:**
- [jsDelivr Official](https://www.jsdelivr.com/) - CDN platform, npm package serving
- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) - SRI specification and best practices
- [MDN: SRI Implementation Guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/SRI) - Practical implementation guidance
- [UI.dev: JavaScript Modules](https://ui.dev/javascript-modules-iifes-commonjs-esmodules) - IIFE format explanation

**Bundle Optimization:**
- [webpack-bundle-analyzer npm](https://www.npmjs.com/package/webpack-bundle-analyzer) - Bundle size visualization tool
- [Medium: Bundle Size Optimization](https://tianyaschool.medium.com/webpack-bundle-analyzer-deep-analysis-and-optimization-of-your-bundle-78bee9a2f053) - Practical optimization guide

**Adapter Pattern:**
- [DoFactory: JavaScript Adapter Pattern](https://www.dofactory.com/javascript/design-patterns/adapter) - Design pattern reference
- [LogRocket: Design Patterns in Node.js](https://blog.logrocket.com/design-patterns-in-node-js-2/) - Adapter pattern for API migration

**CDN Fallback:**
- [Scott Hanselman: CDN Fallback](https://www.hanselman.com/blog/cdns-fail-but-your-scripts-dont-have-to-fallback-from-cdn-to-local-jquery) - Fallback strategy pattern
- [SRI Fallback Tool](https://sri.js.org/) - Subresource integrity with fallback

### Secondary (MEDIUM confidence)

**Security Best Practices:**
- [OWASP: Subresource Integrity](https://owasp.org/www-community/controls/SubresourceIntegrity) - Security controls guidance
- [DEV.to: Securing JavaScript with SRI](https://dev.to/rigalpatel001/securing-javascript-applications-with-subresource-integrity-sri-a-comprehensive-guide-570o) - Implementation guide

**IIFE and Global Namespace:**
- [JavaScriptToday: IIFE, Scope, and Window Object](https://javascripttoday.com/blog/iife-scope-and-the-window-object/) - Window object access patterns
- [DEV.to: IIFE, Modules, and Namespaces](https://dev.to/moyedx3/8-iife-modules-and-namespaces-53p5) - Namespace management

### Tertiary (LOW confidence - context only)

- GitHub issues: Vite IIFE namespace pollution (#14810, #16443) - Shows ongoing tooling challenges, not directly applicable
- CDNBundle and dynamic-cdn-webpack-plugin - General bundling tools, not specific to this use case

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - jsDelivr, IIFE, and SRI are industry-standard with official documentation
- Architecture: **HIGH** - Adapter pattern well-documented, field mapping extracted from actual code comparison
- Pitfalls: **HIGH** - Based on common CDN integration issues documented in official sources and practical guides
- Examples: **HIGH** - Code patterns verified against current website implementation and SDK API

**Research date:** 2026-01-29
**Valid until:** ~30 days (stable ecosystem, CDN/SRI practices don't change rapidly)

**Key limitations:**
- SRI hash generation examples are generic; actual hash must be generated from real built file
- Field name mappings based on current SDK implementation (Phase 9); may change if SDK refactored
- Bundle size (27KB) is from Phase 9 build; verify actual size after Phase 10 changes
