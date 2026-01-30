# Phase 9: Build Pipeline and Package Publishing - Research

**Researched:** 2026-01-29
**Domain:** TypeScript library bundling and npm package publishing
**Confidence:** HIGH

## Summary

Build pipelines for TypeScript libraries in 2026 center on tsdown (Rolldown-powered bundler) for multi-format output, strict package.json exports configuration, and validation tooling to prevent dual-package hazards. The standard approach is:

1. **tsdown for bundling** - Generates ESM (.mjs), CJS (.cjs), and UMD (.umd.js) with automatic TypeScript declaration files (.d.ts)
2. **package.json exports field** - Conditional exports with types-first ordering for TypeScript compatibility
3. **Validation before publish** - publint + are-the-types-wrong to catch configuration errors

The ecosystem has consolidated around ESM-first dual packages with UMD for legacy browser support. TypeScript declaration files require format-specific extensions (.d.mts for ESM, .d.cts for CJS, .d.ts for universal) to avoid the dual-package hazard. Bundle size optimization relies on tree-shaking via sideEffects: false and modern minifiers (esbuild default, terser for maximum compression).

**Primary recommendation:** Use tsdown with separate configs for ESM/CJS and UMD builds, validate with publint before publishing, and ensure types condition comes first in exports.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsdown | ^0.20.x | Build tool for libraries | Rust-based (10-30x faster than Rollup), automatic .d.ts generation, tsup-compatible API, built on Rolldown (foundation for Vite 8) |
| @noble/hashes | ^2.0.1 | Crypto primitives | Tree-shakeable, zero runtime deps, used for vendored keccak256 |
| @scure/base | ^2.0.0 | Base58/Base64 encoding | Tree-shakeable, zero runtime deps, used for vendored base58 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| publint | ^0.3.16 | Package validation | Before every npm publish - validates exports, main, module fields |
| are-the-types-wrong | latest | TypeScript validation | Before npm publish - catches ESM/CJS type masquerading |
| npm-packlist | built-in | Preview published files | Testing files field before publish (npx npm-packlist) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsdown | tsup | tsup lacks UMD support, tsdown is tsup-compatible with better UMD handling |
| tsdown | Rollup + plugins | Manual configuration, slower builds (30x), no automatic .d.ts |
| esbuild minifier | terser | terser 1-2% better compression but 20-40x slower, esbuild is tsdown default |

**Installation:**
```bash
pnpm add -D tsdown@^0.20.1 typescript@^5.9.3
```

## Architecture Patterns

### Recommended Project Structure
```
packages/x402check/
├── src/                    # TypeScript source
│   ├── index.ts           # Public API (named exports only)
│   ├── types/             # Type definitions
│   ├── crypto/            # Vendored crypto (keccak256, base58)
│   ├── validation/        # Validation logic
│   └── registries/        # Static data
├── dist/                   # Build output
│   ├── index.mjs          # ESM bundle
│   ├── index.d.mts        # ESM types
│   ├── index.cjs          # CJS bundle
│   ├── index.d.cts        # CJS types
│   ├── x402check.umd.js   # UMD bundle (browser)
│   └── index.d.ts         # Universal types (fallback)
├── tsdown.config.ts       # Build configuration
├── package.json           # Package metadata + exports
└── tsconfig.json          # TypeScript config
```

### Pattern 1: Multi-Format Build with tsdown
**What:** Single config generating ESM, CJS, and UMD outputs
**When to use:** All npm libraries with browser support
**Example:**
```typescript
// tsdown.config.ts
// Source: https://tsdown.dev/options/output-format
import { defineConfig } from 'tsdown'

export default defineConfig([
  // ESM + CJS (Node.js and bundlers)
  {
    entry: './src/index.ts',
    format: ['esm', 'cjs'],
    platform: 'neutral',
    dts: true,              // Generate .d.ts, .d.mts, .d.cts
    sourcemap: true,
    minify: false,          // Don't minify Node builds
    clean: true,
  },
  // UMD (Browser <script> tag)
  {
    entry: './src/index.ts',
    format: ['umd'],
    platform: 'browser',
    globalName: 'x402Validate',  // window.x402Validate
    external: [],                 // Bundle everything
    minify: true,                 // Minify browser bundle
    sourcemap: false,
    dts: false,                   // No types for UMD
    outDir: 'dist',
  },
])
```

### Pattern 2: package.json Exports Field (Types-First)
**What:** Conditional exports with types before import/require
**When to use:** All dual ESM/CJS packages
**Example:**
```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist/", "README.md", "LICENSE"]
}
```
**Critical:** `"types"` must come FIRST in exports, before `"import"` and `"require"`, or TypeScript ignores it.

### Pattern 3: Files Field for Publishing
**What:** Whitelist files included in npm package
**When to use:** Every npm package (prevents accidental secret leaks)
**Example:**
```json
{
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ]
}
```
**Note:** package.json, README, LICENSE auto-included. Test with `npx npm-packlist` before publish.

### Pattern 4: Tree-Shaking Enablement
**What:** sideEffects: false signals pure modules for bundler optimization
**When to use:** Libraries with no module-level side effects (most validation libraries)
**Example:**
```json
{
  "sideEffects": false
}
```
**Warning:** Don't use if modules have side effects (CSS imports, polyfills, global state mutations).

### Pattern 5: prepublishOnly Validation
**What:** Run tests and build verification before npm publish
**When to use:** All npm packages to prevent broken publishes
**Example:**
```json
{
  "scripts": {
    "prepublishOnly": "pnpm test && pnpm build && publint && attw --pack ."
  }
}
```

### Anti-Patterns to Avoid
- **Single .d.ts for dual packages:** Use .d.mts for ESM, .d.cts for CJS to avoid dual-package hazard
- **types condition last in exports:** TypeScript won't find types if types comes after import/require
- **Default exports in UMD:** Named exports only (export { validate }) for UMD compatibility
- **Bundling dependencies:** Use external for runtime deps, only vendor zero-dep crypto
- **No validation before publish:** Always run publint + are-the-types-wrong

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-format bundling | Custom Rollup config | tsdown | Automatic .d.ts generation, 10-30x faster, UMD support, format-specific targets |
| Package validation | Manual testing | publint + are-the-types-wrong | Catches exports ordering, dual-package hazard, types masquerading |
| Minification | Custom terser config | tsdown minify: true | Uses esbuild (20-40x faster, 1-2% worse compression) by default |
| Declaration bundling | Manual .d.ts concatenation | tsdown dts: true | Generates .d.ts, .d.mts, .d.cts automatically, resolves imports |
| Tree-shaking config | Custom webpack config | sideEffects: false in package.json | Standard webpack/Rollup/vite signal for pure modules |

**Key insight:** Build tooling in 2026 is fast enough that custom scripts are anti-patterns. tsdown handles 95% of library builds with zero-config, and the ecosystem has standardized on package.json exports field rather than build-time solutions.

## Common Pitfalls

### Pitfall 1: Types Condition Ordering in Exports
**What goes wrong:** TypeScript doesn't find .d.ts files even though they're in dist/
**Why it happens:** TypeScript only reads types condition if it comes FIRST in exports object
**How to avoid:** Always put types before import/require
```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",  // MUST BE FIRST
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```
**Warning signs:** Consumers report "Could not find declaration file" despite package including .d.ts

### Pitfall 2: Single .d.ts File for Dual Packages
**What goes wrong:** TypeScript misinterprets module format, allows code that fails at runtime
**Why it happens:** TypeScript infers format from .d.ts extension - .d.ts is ambiguous, .d.mts is ESM, .d.cts is CJS
**How to avoid:** Generate format-specific declaration files
```typescript
// tsdown.config.ts
export default defineConfig({
  format: ['esm', 'cjs'],
  dts: true,  // Generates .d.mts AND .d.cts
})
```
**Warning signs:** "Dual package hazard" warnings, runtime errors with require() vs import

### Pitfall 3: Publishing Source Files
**What goes wrong:** npm package bloated with tests, configs, source .ts files
**Why it happens:** Default npm publish includes everything except .gitignore patterns
**How to avoid:** Use files field to whitelist only dist/
```json
{
  "files": ["dist/"]
}
```
**Test before publish:** `npx npm-packlist` shows exact files
**Warning signs:** Package size >100KB for small library, users report finding .env or test files

### Pitfall 4: UMD globalName Mismatch
**What goes wrong:** window.MyLib is undefined after <script> tag load
**Why it happens:** globalName in tsdown config doesn't match documentation
**How to avoid:** Match globalName to package intent
```typescript
// tsdown.config.ts
{
  format: ['umd'],
  globalName: 'x402Validate',  // window.x402Validate.validate()
}
```
**Warning signs:** Browser console errors "validate is not defined"

### Pitfall 5: Breaking Monorepo Workspace Protocol
**What goes wrong:** pnpm publish fails with "cannot resolve workspace protocol"
**Why it happens:** Publishing from dist/ subdirectory instead of package root
**How to avoid:** Use publishConfig.directory, not cd dist && pnpm publish
```json
{
  "publishConfig": {
    "directory": "dist"
  }
}
```
**Warning signs:** "ENOWORKSPACE" error during pnpm publish

### Pitfall 6: Bundle Size Over 15KB
**What goes wrong:** Browser bundle exceeds 15KB requirement
**Why it happens:** Not tree-shaking, including sourcemaps, or bundling dependencies
**How to avoid:**
- Set sideEffects: false for tree-shaking
- Set sourcemap: false for UMD build
- Set external: [] but verify zero runtime deps
- Use minify: true for browser bundle
**Warning signs:** dist/x402check.umd.js >15KB

### Pitfall 7: Missing .js Extensions in Imports
**What goes wrong:** Build fails with "Cannot find module" for @noble/hashes imports
**Why it happens:** @noble/hashes package exports field requires explicit .js extensions
**How to avoid:** Import subpaths with .js extension
```typescript
// Correct
import { keccak_256 } from '@noble/hashes/sha3.js'

// Wrong
import { keccak_256 } from '@noble/hashes/sha3'
```
**Warning signs:** Build error mentioning @noble/hashes or @scure/base

## Code Examples

Verified patterns from official sources:

### Complete tsdown Configuration for Multi-Format Build
```typescript
// tsdown.config.ts
// Source: https://tsdown.dev/options/output-format
import { defineConfig } from 'tsdown'

export default defineConfig([
  // Node.js builds (ESM + CJS)
  {
    entry: './src/index.ts',
    format: {
      esm: {
        target: ['es2022'],  // Modern JS for ESM
      },
      cjs: {
        target: ['node20'],  // Node 20+ for CJS
      },
    },
    platform: 'neutral',
    dts: true,              // Generate .d.ts, .d.mts, .d.cts
    sourcemap: true,
    minify: false,
    clean: true,
    outDir: 'dist',
    external: [],           // No runtime dependencies
  },
  // Browser build (UMD)
  {
    entry: './src/index.ts',
    format: ['umd'],
    platform: 'browser',
    globalName: 'x402Validate',
    target: ['es2020'],      // Broad browser support
    minify: true,            // Minify for size
    sourcemap: false,        // No sourcemaps in UMD
    dts: false,              // No types for UMD
    clean: false,            // Don't clean (ESM/CJS already did)
    outDir: 'dist',
    external: [],
  },
])
```

### Complete package.json for Dual ESM/CJS + UMD
```json
{
  "name": "x402check",
  "version": "0.0.1",
  "description": "Validate x402 payment configurations",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": [
    "dist/"
  ],
  "sideEffects": false,
  "scripts": {
    "build": "tsdown",
    "prepublishOnly": "pnpm test && pnpm build && publint && attw --pack .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["x402", "payment", "validation"],
  "license": "MIT",
  "devDependencies": {
    "@noble/hashes": "^2.0.1",
    "@scure/base": "^2.0.0",
    "publint": "^0.3.16",
    "@arethetypeswrong/cli": "^0.16.0",
    "tsdown": "^0.20.1",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```
**Source:** Synthesized from https://tsdown.dev/guide/getting-started and https://nodejs.org/api/packages.html

### Validating Package Before Publish
```bash
# Test what files will be published
npx npm-packlist

# Validate package.json configuration
npx publint

# Check TypeScript types configuration
npx attw --pack .

# Check bundle sizes
ls -lh dist/
```
**Source:** https://publint.dev/docs/comparisons

### Named Exports for UMD Compatibility
```typescript
// src/index.ts
// Source: Prior decisions (named exports only)

// CORRECT - Named exports work in UMD
export { validate } from './validation'
export { detect, normalize } from './detection'
export const VERSION = '0.0.1' as const

// WRONG - Default export breaks UMD
// export default { validate, detect, normalize }
```

### Vendoring Zero-Dep Crypto
```typescript
// src/crypto/keccak256.ts
// Source: Prior decisions (vendor for zero runtime deps)
import { keccak_256 } from '@noble/hashes/sha3.js'  // .js extension required

export function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data)
}
```
**Note:** @noble/hashes is devDependency (build-time only), output has zero runtime deps

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rollup + plugins | tsdown (Rolldown-based) | 2024-2025 | 10-30x faster builds, automatic .d.ts, UMD support |
| tsup | tsdown | 2025-2026 | Better UMD support, tsup-compatible API, Rolldown migration path |
| main/module fields only | exports field with conditions | 2020-2023 | Required for Node 16+ ESM support, enables types resolution |
| Single .d.ts file | Format-specific .d.mts/.d.cts | 2022-2024 | Fixes dual-package hazard, required for strict TypeScript |
| Terser minification | esbuild minification | 2023-2025 | 20-40x faster builds, 1-2% larger bundles (acceptable tradeoff) |
| .npmignore | files field | 2018-2023 | Whitelist safer than blacklist (prevents accidental secret leaks) |

**Deprecated/outdated:**
- **Rollup for libraries:** tsdown is 10-30x faster, Rolldown is foundation for Vite 8
- **main/module without exports:** Node 16+ requires exports for ESM support
- **prepublish script:** Renamed to prepublishOnly in npm 4+ (prepublish ran on install)
- **UMD as primary format:** ESM is primary in 2026, UMD is legacy browser support only

## Open Questions

Things that couldn't be fully resolved:

1. **tsdown outputOptions API for UMD filename customization**
   - What we know: vue-sonner uses outputOptions.entryFileName for custom UMD filename
   - What's unclear: Official tsdown docs don't document outputOptions API shape
   - Recommendation: Test with outputOptions or file issue to tsdown repo for docs

2. **isolatedDeclarations performance benefit**
   - What we know: tsdown uses oxc-transform for .d.ts generation if isolatedDeclarations: true (extremely fast)
   - What's unclear: Whether x402check codebase is compatible with isolatedDeclarations compiler option
   - Recommendation: Try enabling, fall back to TypeScript compiler if errors

3. **Bundle size with vendored crypto**
   - What we know: @noble/hashes is tree-shakeable, only keccak256 should be included
   - What's unclear: Actual bundle size after minification with base58 + keccak256 vendored
   - Recommendation: Build and measure, optimize if >15KB (unlikely with just keccak256 + base58)

## Sources

### Primary (HIGH confidence)
- [tsdown official docs - Introduction](https://tsdown.dev/guide/)
- [tsdown official docs - Getting Started](https://tsdown.dev/guide/getting-started)
- [tsdown official docs - Output Format](https://tsdown.dev/options/output-format)
- [tsdown official docs - Config File](https://tsdown.dev/options/config-file)
- [tsdown official docs - Declaration Files](https://tsdown.dev/options/dts)
- [tsdown official docs - UserConfig API](https://tsdown.dev/reference/api/interface.userconfig)
- [Node.js official docs - Packages (exports field)](https://nodejs.org/api/packages.html)
- [publint official docs - Rules](https://publint.dev/rules)
- [publint official docs - Comparisons](https://publint.dev/docs/comparisons)

### Secondary (MEDIUM confidence)
- [vue-sonner tsdown.config.umd.ts example](https://github.com/xiaoluoboding/vue-sonner/blob/main/tsdown.config.umd.ts) - Real-world UMD config
- [Publishing dual ESM+CJS packages - Mayank](https://mayank.co/blog/dual-packages/) - Verified with Node.js docs
- [Ship ESM & CJS in one Package - Anthony Fu](https://antfu.me/posts/publish-esm-and-cjs) - Verified with Node.js docs
- [Building npm package compatible with ESM and CJS - Snyk 2024](https://snyk.io/blog/building-npm-package-compatible-with-esm-and-cjs-2024/)
- [Guide to package.json exports field - Hiroki Osame](https://hirok.io/posts/package-json-exports)
- [Dual publish ESM and CJS with tsdown - DEV](https://dev.to/hacksore/dual-publish-esm-and-cjs-with-tsdown-2l75)
- [TypeScript Handbook - Creating .d.ts Files](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)
- [Webpack Tree Shaking Guide](https://webpack.js.org/guides/tree-shaking/) - Verified with package.json standards
- [npm official docs - scripts field](https://docs.npmjs.com/cli/v8/using-npm/scripts/)
- [npm official docs - package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [pnpm publish docs](https://pnpm.io/cli/publish)

### Tertiary (LOW confidence - marked for validation)
- [Rolldown/tsdown performance claims](https://github.com/rolldown/tsdown) - Need to verify 10-30x faster claim in our build
- [esbuild vs terser benchmarks](https://minify-js.com/benchmarks/) - Claims 20-40x faster, 1-2% worse - should measure our bundle
- [Tree-shaking with tsup](https://dev.to/orabazu/how-to-bundle-a-tree-shakable-typescript-library-with-tsup-and-publish-with-npm-3c46) - tsup patterns apply to tsdown due to compatibility

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - tsdown official docs, Node.js official docs, tool usage verified in examples
- Architecture: HIGH - Patterns from official docs and verified real-world configs (vue-sonner)
- Pitfalls: HIGH - Issues documented in official Node.js docs, TypeScript issues, and publint rules
- Bundle size optimization: MEDIUM - Need to measure actual x402check bundle size
- UMD filename customization: LOW - outputOptions API not fully documented in tsdown

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - tsdown stable, exports field standardized, build tools fast-moving)
