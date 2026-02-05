# Phase 11: Manifest Types & Detection - Research

**Researched:** 2026-02-04
**Domain:** TypeScript manifest types, format detection patterns, normalization for collection structures, x402 service discovery
**Confidence:** MEDIUM-HIGH

## Summary

This phase defines the TypeScript types for x402 manifests (multi-endpoint collections) and extends the existing `detect()` function to distinguish manifests from single v2 configs. A manifest is a collection of v2 PaymentRequired entries with optional service metadata, designed for the x402 Bazaar discovery layer and DNS-based manifest discovery.

The standard approach is to define manifests as wrapper types containing a service metadata object and an endpoints collection (Map or Record). Detection uses a type guard that checks for the collection structure BEFORE checking for single v2 config, since manifests may contain `x402Version: 2` at the service level. Normalization handles non-standard "wild manifests" by mapping fields to canonical structure while preserving financial data exactly.

x402 v2 introduced the Bazaar discovery extension which exposes structured service metadata that facilitators can crawl. The IETF DNS discovery draft defines `_x402` TXT records pointing to `/.well-known/x402` manifest URLs, but the manifest format itself is not yet standardized. This phase defines the canonical manifest schema that x402lint will recognize.

**Primary recommendation:** Define `ManifestConfig` as a wrapper type with `service` metadata (name, description, version) and `endpoints` collection (Record<id, V2Config>). Extend `detect()` to check for manifest structure first using `isManifestConfig()` guard. Use the same normalization pattern as v1/v2 for wild manifests, emitting warnings for each transformation. Detection order is critical: manifest → v2 → v1 → unknown.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9+ | Type system for manifest interfaces | Same as existing codebase, discriminated unions for detection |
| None (pure TS) | - | Detection logic | Zero-dependency pattern preserved |
| None (custom) | - | Normalization logic | Extends existing normalize() pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON Schema | draft-2020-12 | Documentation of manifest schema | Reference only, not runtime validation |
| Zod | 3.x | Manifest schema validation | Development/testing only, not runtime |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Record<id, V2Config> | Map<id, V2Config> | Map offers better iteration but requires serialization for JSON |
| Wrapper type | Array of configs with metadata | Loses endpoint identifiers, harder to reference in errors |
| Service metadata required | All optional metadata | Required fields enable better discovery, optional is more flexible |
| Custom guard | Generic collection detector | Custom guard provides better type narrowing |

**Installation:**
```bash
# Zero new runtime dependencies
# Optional dev dependencies for schema documentation
npm install zod --save-dev  # Optional: manifest schema validation in tests
```

## Architecture Patterns

### Recommended Manifest Type Structure
```typescript
// Canonical manifest type definition
// src/types/manifest.ts

/**
 * Service metadata for a manifest
 * Used by x402 Bazaar discovery and DNS-based discovery
 */
export interface ServiceMetadata {
  name?: string;           // Service name (e.g., "Weather API")
  description?: string;    // Service description
  version?: string;        // Service version (e.g., "1.0.0")
  url?: string;            // Service homepage URL
  contact?: {              // Contact information
    name?: string;
    email?: string;
    url?: string;
  };
}

/**
 * Canonical manifest config (collection of v2 configs)
 * Each endpoint is a complete v2 PaymentRequired entry
 */
export interface ManifestConfig {
  x402Version?: 2;         // Optional version marker at manifest level
  service?: ServiceMetadata;
  endpoints: Record<string, V2Config>;  // Keyed by endpoint ID
  extensions?: Record<string, unknown>;  // Manifest-level extensions
}

/**
 * Manifest validation result (extends ValidationResult pattern)
 */
export interface ManifestValidationResult {
  valid: boolean;
  errors: ValidationIssue[];        // Manifest-level errors
  warnings: ValidationIssue[];      // Manifest-level warnings
  endpointResults: Map<string, ValidationResult>;  // Per-endpoint results
}
```

### Pattern 1: Manifest Detection Type Guard
**What:** Detect manifest structure before checking for single v2 config
**When to use:** Format detection entry point, must run before isV2Config()
**Example:**
```typescript
// Source: TypeScript discriminated unions
// https://www.typescriptlang.org/docs/handbook/2/narrowing.html

/**
 * Type guard for manifest config
 * Checks for endpoints collection structure
 * MUST run before isV2Config() since manifests may have x402Version: 2
 */
export function isManifestConfig(value: unknown): value is ManifestConfig {
  if (!isRecord(value)) return false;

  // Must have endpoints field
  if (!('endpoints' in value)) return false;

  // endpoints must be a non-null object (Record)
  if (!isRecord(value.endpoints)) return false;

  // If endpoints is empty object, it's still a valid manifest
  // (allows empty manifests for initialization)

  // Check that all endpoint values are v2 configs
  // This prevents false positives with other collection types
  const endpoints = value.endpoints as Record<string, unknown>;
  for (const key in endpoints) {
    const endpoint = endpoints[key];
    // Each endpoint should be a v2 config
    // But we don't want to fail on partial manifests during detection
    // Just verify it's an object with some v2-like structure
    if (!isRecord(endpoint)) return false;
    if (!hasAcceptsArray(endpoint)) return false;
  }

  return true;
}

/**
 * Extended detect() function with manifest support
 * Detection order: manifest → v2 → v1 → unknown
 */
export function detect(input: string | object): ConfigFormat {
  const { parsed, error } = parseInput(input);

  if (error) return 'unknown';

  // CRITICAL: Check manifest BEFORE v2
  // Manifests may contain x402Version: 2 at service level
  if (isManifestConfig(parsed)) return 'manifest';

  if (isV2Config(parsed)) return 'v2';
  if (isV1Config(parsed)) return 'v1';

  return 'unknown';
}
```

### Pattern 2: Wild Manifest Normalization
**What:** Detect and normalize non-standard manifest formats to canonical shape
**When to use:** After manifest detection, before validation
**Example:**
```typescript
// Normalization pattern for wild manifests
// Source: Existing normalize() pattern in codebase

/**
 * Wild manifest formats seen in ecosystem:
 *
 * 1. Flat array style:
 *    { "paymentEndpoints": [ {config1}, {config2} ] }
 *
 * 2. Nested service style:
 *    { "api": { "weather": config1, "data": config2 } }
 *
 * 3. Biwas-style (hypothetical, no real examples found):
 *    { "service": "...", "payments": [...] }
 */

interface NormalizationWarning {
  code: string;
  message: string;
  transformation: string;
}

interface NormalizedManifest {
  manifest: ManifestConfig;
  warnings: NormalizationWarning[];
}

function normalizeWildManifest(input: unknown): NormalizedManifest | null {
  if (!isRecord(input)) return null;

  const warnings: NormalizationWarning[] = [];
  let normalized: ManifestConfig = {
    endpoints: {}
  };

  // Pattern 1: Flat array with paymentEndpoints
  if ('paymentEndpoints' in input && Array.isArray(input.paymentEndpoints)) {
    warnings.push({
      code: 'WILD_MANIFEST_ARRAY_FORMAT',
      message: 'Detected non-standard array format, normalized to endpoints collection',
      transformation: 'paymentEndpoints[n] → endpoints["endpoint-n"]'
    });

    input.paymentEndpoints.forEach((config: unknown, index: number) => {
      normalized.endpoints[`endpoint-${index}`] = config as V2Config;
    });
  }

  // Pattern 2: Extract service metadata if present
  if ('service' in input && isRecord(input.service)) {
    const service = input.service;
    normalized.service = {
      name: typeof service.name === 'string' ? service.name : undefined,
      description: typeof service.description === 'string' ? service.description : undefined,
      version: typeof service.version === 'string' ? service.version : undefined,
    };
  }

  // Pattern 3: Simple name field → service.name
  if ('name' in input && typeof input.name === 'string' && !normalized.service?.name) {
    if (!normalized.service) normalized.service = {};
    normalized.service.name = input.name;
    warnings.push({
      code: 'WILD_MANIFEST_NAME_PROMOTED',
      message: 'Top-level name field promoted to service.name',
      transformation: 'name → service.name'
    });
  }

  // Preserve extensions
  if ('extensions' in input && isRecord(input.extensions)) {
    normalized.extensions = input.extensions as Record<string, unknown>;
  }

  return warnings.length > 0 ? { manifest: normalized, warnings } : null;
}
```

### Pattern 3: Endpoint ID Generation
**What:** Generate stable endpoint IDs from config content when not provided
**When to use:** Wild manifests without explicit IDs
**Example:**
```typescript
/**
 * Generate stable endpoint ID from config content
 * Used when wild manifests don't provide explicit IDs
 */
function generateEndpointId(config: V2Config, index: number): string {
  // Try to extract meaningful ID from config
  if (config.resource?.url) {
    try {
      const url = new URL(config.resource.url);
      // Use pathname as ID (e.g., "/api/weather" → "api-weather")
      const pathname = url.pathname.replace(/^\//, '').replace(/\//g, '-');
      if (pathname) return pathname || `endpoint-${index}`;
    } catch {
      // Invalid URL, fall back to index
    }
  }

  // Fallback: use index
  return `endpoint-${index}`;
}
```

### Pattern 4: Extended ConfigFormat Type
**What:** Extend existing ConfigFormat union to include 'manifest'
**When to use:** Type definitions, all format detection code
**Example:**
```typescript
// Source: Existing types/config.ts
// Extended to include manifest format

/**
 * Config format discriminator
 * Extended with 'manifest' for multi-endpoint collections
 */
export type ConfigFormat = 'manifest' | 'v2' | 'v1' | 'unknown';

// ConfigFormat is used throughout codebase:
// - detect() return type
// - normalize() switch statement
// - CLI format dispatch
// - Website rendering logic
```

### Anti-Patterns to Avoid

- **Checking v2 before manifest:** Manifests may have `x402Version: 2` at service level, causing false positives
- **Requiring all metadata fields:** Service metadata should be optional for flexibility
- **Guessing financial data during normalization:** Never infer amounts, addresses, or networks; preserve exactly or fail
- **Using array indices as stable IDs:** Generate IDs from URL paths for stability across edits
- **Deep validation in type guard:** Keep `isManifestConfig()` structural; save deep validation for `validateManifest()`
- **Not preserving endpoint-level extensions:** Each V2Config has its own extensions, don't lose them

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest schema documentation | Custom docs format | JSON Schema + OpenAPI | Industry standard, tool support, validator generation |
| Endpoint ID generation | Random UUIDs | URL-based stable IDs | Predictable, debuggable, survives reordering |
| Manifest merging | Custom merge logic | Object spread with explicit overrides | Simple, type-safe, obvious behavior |
| Service metadata validation | Custom string checks | Existing V2 validation patterns | Reuse field validation logic |
| Wild manifest detection | Multiple if/else chains | Discriminated union with guards | Type-safe, exhaustive, maintainable |

**Key insight:** Manifests are just wrappers around existing v2 configs. Don't reinvent validation logic - compose the existing `validate()` function per endpoint. The only new logic needed is collection structure detection and cross-endpoint checks.

## Common Pitfalls

### Pitfall 1: Detection Order Violation
**What goes wrong:** `isV2Config()` runs before `isManifestConfig()`, causing manifests to be detected as single v2 configs
**Why it happens:** Manifests may have `x402Version: 2` at service level, which matches v2 guard
**How to avoid:** Always check `isManifestConfig()` first in detection order
**Warning signs:** Manifests detected as 'v2' format; validation fails with "endpoints is not a valid field"

### Pitfall 2: Empty Endpoints Collection Rejection
**What goes wrong:** Rejecting manifests with zero endpoints as invalid during detection
**Why it happens:** Assuming endpoints collection must be non-empty
**How to avoid:** Allow empty `endpoints: {}` for initialization use cases; validation can warn later
**Warning signs:** New services can't initialize empty manifests; chicken-and-egg problem

### Pitfall 3: Endpoint ID Collisions
**What goes wrong:** Generated IDs collide when multiple endpoints have similar URLs
**Why it happens:** Simple ID generation (e.g., just pathname) without collision detection
**How to avoid:** Include index as tiebreaker (e.g., "api-weather" vs "api-weather-2")
**Warning signs:** Later endpoints overwrite earlier ones; manifest appears to have fewer endpoints than input

### Pitfall 4: Losing Endpoint Context in Field Paths
**What goes wrong:** Error at `accepts[0].payTo` doesn't indicate which endpoint
**Why it happens:** Per-endpoint validation doesn't prefix field paths
**How to avoid:** Prefix all field paths with `endpoints["id"].` during manifest validation
**Warning signs:** Errors are ambiguous in multi-endpoint manifests; debugging requires guessing

### Pitfall 5: Over-Normalization of Financial Data
**What goes wrong:** Normalization infers or modifies amounts, addresses, or networks
**Why it happens:** Trying to be "helpful" by filling in missing data
**How to avoid:** Never guess financial data; copy exactly or emit error
**Warning signs:** Silent data corruption; payments sent to wrong addresses/networks

### Pitfall 6: Service Metadata Validation Too Strict
**What goes wrong:** Rejecting manifests with missing service.name or service.description
**Why it happens:** Treating optional metadata as required
**How to avoid:** All service metadata fields are optional; validation can warn but shouldn't error
**Warning signs:** Valid manifests rejected; users forced to add placeholder metadata

### Pitfall 7: Not Supporting Partial Manifests
**What goes wrong:** Detection fails when some endpoints are invalid v2 configs
**Why it happens:** Type guard validates each endpoint deeply
**How to avoid:** Keep detection shallow; validate endpoint structure, not content
**Warning signs:** Can't detect broken manifests; no way to report per-endpoint errors

### Pitfall 8: Manifest-Level x402Version Confusion
**What goes wrong:** Unclear whether `x402Version: 2` applies to manifest or endpoints
**Why it happens:** Spec doesn't define manifest versioning
**How to avoid:** Make manifest-level version optional; each endpoint has its own version
**Warning signs:** Version conflicts; unclear which version applies

## Code Examples

Verified patterns from official sources:

### Complete Manifest Type Definition
```typescript
// Source: TypeScript interface patterns
// https://www.typescriptlang.org/docs/handbook/2/objects.html

import type { V2Config } from './config';
import type { ValidationResult, ValidationIssue } from './validation';

/**
 * Service contact information
 */
export interface ServiceContact {
  name?: string;
  email?: string;
  url?: string;
}

/**
 * Service metadata for manifest discovery
 * All fields optional for flexibility
 */
export interface ServiceMetadata {
  name?: string;           // Service name
  description?: string;    // Service description
  version?: string;        // Service version (semver recommended)
  url?: string;            // Service homepage
  contact?: ServiceContact;
}

/**
 * Manifest config (collection of v2 configs)
 * Represents a service with multiple payment-required endpoints
 */
export interface ManifestConfig {
  x402Version?: 2;         // Optional manifest-level version marker
  service?: ServiceMetadata;
  endpoints: Record<string, V2Config>;  // Keyed by endpoint ID
  extensions?: Record<string, unknown>; // Manifest-level extensions
}

/**
 * Result of manifest validation
 * Contains per-endpoint results plus manifest-level issues
 */
export interface ManifestValidationResult {
  valid: boolean;                      // True if all endpoints valid and no manifest errors
  errors: ValidationIssue[];           // Manifest-level errors (structure, cross-endpoint)
  warnings: ValidationIssue[];         // Manifest-level warnings
  endpointResults: Map<string, ValidationResult>;  // Per-endpoint validation results
}

/**
 * Extended format type with manifest support
 */
export type ConfigFormat = 'manifest' | 'v2' | 'v1' | 'unknown';
```

### Manifest Detection with Correct Order
```typescript
// Source: TypeScript type guards
// https://www.typescriptlang.org/docs/handbook/2/narrowing.html

import { isRecord, hasAcceptsArray } from './guards';

/**
 * Type guard for manifest config
 * Structural check only - deep validation happens later
 */
export function isManifestConfig(value: unknown): value is ManifestConfig {
  // Must be object
  if (!isRecord(value)) return false;

  // Must have endpoints field
  if (!('endpoints' in value)) return false;

  // endpoints must be a non-null object
  const endpoints = value.endpoints;
  if (!isRecord(endpoints)) return false;

  // Check that endpoint values look like v2 configs
  // (structural check, not deep validation)
  for (const key in endpoints) {
    const endpoint = endpoints[key];
    if (!isRecord(endpoint)) return false;
    if (!hasAcceptsArray(endpoint)) return false;
  }

  return true;
}

/**
 * Detect config format with manifest support
 * CRITICAL: Check manifest before v2
 */
export function detect(input: string | object): ConfigFormat {
  const { parsed, error } = parseInput(input);

  if (error) return 'unknown';

  // Order matters! Manifest must be checked first
  if (isManifestConfig(parsed)) return 'manifest';  // 1st
  if (isV2Config(parsed)) return 'v2';              // 2nd
  if (isV1Config(parsed)) return 'v1';              // 3rd

  return 'unknown';
}
```

### Service Metadata Extraction from Wild Formats
```typescript
// Extract and normalize service metadata from various wild formats

function extractServiceMetadata(input: Record<string, unknown>): ServiceMetadata | undefined {
  const metadata: ServiceMetadata = {};
  let hasAnyField = false;

  // Try common metadata fields
  if ('name' in input && typeof input.name === 'string') {
    metadata.name = input.name;
    hasAnyField = true;
  }

  if ('description' in input && typeof input.description === 'string') {
    metadata.description = input.description;
    hasAnyField = true;
  }

  if ('version' in input && typeof input.version === 'string') {
    metadata.version = input.version;
    hasAnyField = true;
  }

  // Try nested service object
  if ('service' in input && isRecord(input.service)) {
    const service = input.service;
    if ('name' in service && typeof service.name === 'string') {
      metadata.name = service.name;
      hasAnyField = true;
    }
    if ('description' in service && typeof service.description === 'string') {
      metadata.description = service.description;
      hasAnyField = true;
    }
    if ('version' in service && typeof service.version === 'string') {
      metadata.version = service.version;
      hasAnyField = true;
    }
  }

  return hasAnyField ? metadata : undefined;
}
```

### Stable Endpoint ID Generation
```typescript
/**
 * Generate stable endpoint ID from config
 * Prefers URL path, falls back to index-based ID
 */
function generateStableEndpointId(
  config: V2Config,
  index: number,
  existingIds: Set<string>
): string {
  let baseId: string;

  // Try to extract ID from resource URL
  if (config.resource?.url) {
    try {
      const url = new URL(config.resource.url);
      // Use pathname as base (e.g., "/api/weather" → "api-weather")
      const pathname = url.pathname
        .replace(/^\//, '')           // Remove leading slash
        .replace(/\/$/, '')           // Remove trailing slash
        .replace(/[^a-z0-9]+/gi, '-') // Replace non-alphanumeric with dash
        .toLowerCase();

      if (pathname) {
        baseId = pathname;
      } else {
        baseId = `endpoint-${index}`;
      }
    } catch {
      // Invalid URL, use index
      baseId = `endpoint-${index}`;
    }
  } else {
    baseId = `endpoint-${index}`;
  }

  // Handle collisions by appending number
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }

  return id;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single config only | Manifest collections | x402 V2 (2025-2026) | Services can define multiple endpoints in one file |
| Inline metadata | Separate ServiceMetadata type | TypeScript patterns 2024+ | Clear separation of concerns, optional fields |
| Hard-coded discovery | DNS-based discovery (IETF draft) | 2025-2026 | Automatic service discovery via TXT records |
| Manual endpoint lists | Bazaar extension crawling | x402 V2 Discovery | Facilitators automatically index services |
| Array-based collections | Record-based with IDs | TypeScript best practices | Stable references, better error reporting |
| No manifest schema | Emerging community patterns | 2025-2026 | x402lint defines canonical format |

**Deprecated/outdated:**
- **Single config per service:** V2 supports manifests for multi-endpoint services
- **Flat array of configs:** Use Record with stable IDs for better referenceability
- **Required service metadata:** All metadata should be optional for flexibility
- **No wild manifest support:** Ecosystem has diverse formats, normalization needed

## Open Questions

Things that couldn't be fully resolved:

1. **Official Manifest Schema**
   - What we know: IETF DNS discovery draft mentions manifests but doesn't define schema; Bazaar extension provides discovery metadata
   - What's unclear: No official x402 manifest schema specification exists as of Feb 2026
   - Recommendation: x402lint defines canonical schema; submit to x402 community for feedback; potential future IETF draft

2. **Wild Manifest Formats (Biwas-style)**
   - What we know: Research mentions "biwas-style" wild manifests but no concrete examples found
   - What's unclear: What does biwas-style actually look like? What fields does it use?
   - Recommendation: Implement detection pattern with placeholder for biwas-style; update when real examples surface; emit LOW confidence warning

3. **Endpoint ID Stability**
   - What we know: URL-based IDs are more stable than index-based
   - What's unclear: Should IDs be required in canonical format or always generated?
   - Recommendation: Record keys are the IDs; if wild manifest uses array, generate IDs with URL-based logic

4. **Manifest Versioning**
   - What we know: Each endpoint has `x402Version`, but manifest itself could also have version
   - What's unclear: Does `x402Version: 2` at manifest level mean all endpoints must be v2?
   - Recommendation: Make manifest-level version optional; each endpoint has its own version; no enforcement of uniform versions

5. **Cross-Endpoint Extensions**
   - What we know: V2 configs have `extensions` field; manifests also have extensions
   - What's unclear: How do manifest-level extensions interact with endpoint-level extensions?
   - Recommendation: They're independent; manifest extensions apply to service, endpoint extensions apply per-endpoint; no merging

6. **Service Metadata Validation**
   - What we know: ServiceMetadata has name, description, version, contact fields
   - What's unclear: Should version follow semver? Should contact.email be validated?
   - Recommendation: Keep all validation lenient; accept any string; linting phase (DMF-1) can provide stricter checks

## Sources

### Primary (HIGH confidence)
- [IETF x402 DNS Discovery Draft](https://www.ietf.org/archive/id/draft-jeftovic-x402-dns-discovery-00.html) - DNS TXT records for manifest discovery
- [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - Type guard patterns
- [TypeScript Discriminated Unions](https://basarat.gitbook.io/typescript/type-system/discriminated-unions) - Union type patterns
- Existing codebase: `src/types/config.ts`, `src/detection/guards.ts` - Current type patterns

### Secondary (MEDIUM confidence)
- [x402 Bazaar Discovery Layer](https://docs.cdp.coinbase.com/x402/bazaar) - Service metadata and discovery
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch) - Discovery extension overview
- [TypeScript Interface Patterns](https://www.typescriptlang.org/docs/handbook/2/objects.html) - Optional fields, metadata types
- [WebSearch] x402 ecosystem services (2026) - Real-world multi-endpoint examples

### Tertiary (LOW confidence - marked for validation)
- [WebSearch] "biwas x402 manifest" - No concrete examples found; mentioned in requirements but unverified
- Community convention: Record-based endpoints collection - Not in official spec but emerging pattern
- Manifest-level x402Version semantics - Not defined in x402 v2 spec, needs clarification

## Metadata

**Confidence breakdown:**
- Manifest type structure: HIGH - Based on TypeScript patterns and x402 discovery extension
- Detection order: HIGH - Critical ordering verified through type guard logic
- Service metadata fields: MEDIUM - Based on Bazaar extension, but no official manifest schema
- Wild manifest normalization: LOW-MEDIUM - Pattern clear, but biwas-style format unverified
- Endpoint ID generation: HIGH - Standard TypeScript/URL patterns

**Research date:** 2026-02-04
**Valid until:** 2026-05-04 (90 days - TypeScript patterns stable; x402 manifest schema emerging)
