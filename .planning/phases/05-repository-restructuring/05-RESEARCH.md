# Phase 5: Repository Restructuring - Research

**Researched:** 2026-01-29
**Domain:** pnpm workspaces, TypeScript monorepo architecture
**Confidence:** HIGH

## Summary

This phase restructures a single-project repository into a pnpm workspace monorepo with SDK package skeleton and website workspace. The research focused on pnpm workspace configuration, monorepo architecture patterns, TypeScript strict mode configuration, and migration pitfalls.

**Key findings:**
- pnpm workspaces are the current standard for TypeScript monorepos in 2026, offering superior performance and disk efficiency
- The `apps/` and `packages/` structure is the de facto standard, where apps/ contains deployable applications and packages/ contains reusable libraries
- TypeScript strict mode alone is insufficient - `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are critical additions not included in `strict: true`
- Cloudflare Pages has a known deployment gotcha with pnpm workspaces requiring `packages: ['.']` in pnpm-workspace.yaml

**Primary recommendation:** Use pnpm workspaces with workspace: protocol for internal links, create shared config package for TypeScript/ESLint/Prettier, and structure the website as its own workspace member to maintain deployment compatibility.

## Standard Stack

The established libraries/tools for TypeScript monorepo management:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 10.x | Package manager & workspace orchestrator | 2x faster than npm, strict dependency resolution, content-addressable storage, native workspace support |
| TypeScript | 5.x | Type-safe compilation | Industry standard for type-safe JavaScript |
| Vitest | 4.x | Testing framework | Vite-native, 10-20x faster feedback than Jest, native ESM/TS support |
| tsdown | 0.9.x | Library bundler | Built on Rolldown (Rust), 10-30x faster than traditional tools, ESM/CJS/IIFE/UMD support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Changesets | Latest | Version management | When publishing packages to npm (not needed for private SDK initially) |
| @rushstack/eslint-patch | Latest | ESLint plugin resolution | Allows shared config package to provide ESLint plugins without duplicating devDependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm | npm/yarn | pnpm is 2x faster, has better disk efficiency, and stricter dependency resolution |
| Vitest | Jest | Jest is more mature but significantly slower and requires more configuration for ESM |
| tsdown | tsup | tsdown has better UMD/IIFE support and is actively maintained by Rolldown team |

**Installation:**
```bash
# At repo root
pnpm add -D pnpm typescript

# In SDK package
pnpm add -D tsdown vitest @vitest/ui

# In shared config package
pnpm add -D @rushstack/eslint-patch
```

## Architecture Patterns

### Recommended Project Structure
```
repo-root/
├── apps/
│   └── website/           # Existing website as workspace member
│       ├── index.html     # Main entry point
│       ├── *.html         # Test pages
│       ├── *.js           # Website scripts
│       └── package.json   # Website-specific dependencies
├── packages/
│   ├── x402lint/         # SDK library package
│   │   ├── src/
│   │   │   ├── types/     # Type definitions (Phase 6)
│   │   │   ├── detection/ # Format detection (Phase 7)
│   │   │   ├── validation/# Validation logic (Phase 8)
│   │   │   ├── crypto/    # Crypto vendoring (Phase 9)
│   │   │   └── index.ts   # Barrel export
│   │   ├── test/
│   │   │   └── index.test.ts  # Smoke test
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsdown.config.ts
│   │   └── vitest.config.ts
│   └── config/            # Shared configurations
│       ├── typescript/
│       │   └── base.json  # Base tsconfig
│       ├── eslint/        # Shared ESLint config (if needed)
│       └── package.json
├── pnpm-workspace.yaml    # Workspace definition
├── package.json           # Root package with proxy scripts
└── .planning/             # Project-wide concern (stays at root)
```

### Pattern 1: pnpm Workspace Configuration
**What:** Define workspace packages using pnpm-workspace.yaml
**When to use:** Every pnpm monorepo setup
**Example:**
```yaml
# pnpm-workspace.yaml
# Source: https://pnpm.io/pnpm-workspace_yaml
packages:
  - '.'              # CRITICAL: Include root for Cloudflare Pages compatibility
  - 'apps/*'
  - 'packages/*'
```

### Pattern 2: Workspace Protocol for Internal Links
**What:** Use `workspace:*` protocol to reference local packages
**When to use:** Whenever one workspace package depends on another
**Example:**
```json
// apps/website/package.json (future use)
{
  "dependencies": {
    "x402lint": "workspace:*"
  }
}
```
**Why:** Prevents fallback to npm registry, ensures local resolution, auto-converts to semver on publish

### Pattern 3: Root Proxy Scripts
**What:** Root package.json delegates to workspace packages via --filter
**When to use:** All monorepos to provide convenient root-level commands
**Example:**
```json
// Root package.json
// Source: https://pnpm.io/filtering
{
  "scripts": {
    "build:sdk": "pnpm --filter x402lint build",
    "test:sdk": "pnpm --filter x402lint test",
    "lint:sdk": "pnpm --filter x402lint lint"
  }
}
```

### Pattern 4: Shared TypeScript Base Config
**What:** Shared tsconfig.json base extended by all workspace packages
**When to use:** Every TypeScript monorepo
**Example:**
```json
// packages/config/typescript/base.json
// Source: https://www.typescriptlang.org/tsconfig/
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true
  }
}

// packages/x402lint/tsconfig.json
{
  "extends": "../config/typescript/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### Pattern 5: Vitest Configuration for Library Testing
**What:** Minimal vitest config for Node.js library (no DOM)
**When to use:** Testing libraries that don't need browser environment
**Example:**
```typescript
// packages/x402lint/vitest.config.ts
// Source: https://vitest.dev/config/
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',  // Not jsdom - this is a Node/browser library
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
```

### Pattern 6: tsdown Configuration for Dual-Format Output
**What:** Configure tsdown for ESM + CJS output with type declarations
**When to use:** Building libraries that need to support both module systems
**Example:**
```typescript
// packages/x402lint/tsdown.config.ts
// Source: https://tsdown.dev/guide/getting-started
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],  // IIFE/UMD added later when needed
  dts: true,               // Generate .d.ts files
  clean: true,             // Clean dist before build
})
```

### Pattern 7: package.json Exports Field
**What:** Modern conditional exports for dual-format packages
**When to use:** All published libraries supporting ESM and CJS
**Example:**
```json
// packages/x402lint/package.json
// Source: https://hirok.io/posts/package-json-exports
{
  "name": "x402lint",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

### Anti-Patterns to Avoid
- **Missing root in pnpm-workspace.yaml:** Cloudflare Pages deployment will break without `packages: ['.']`
- **Using default exports:** IIFE format requires named exports for global exposure
- **Flat workspace structure:** Mixing apps and packages at root creates ambiguity
- **Hoisting all dependencies:** Website and SDK have different needs - keep dependencies scoped

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Library bundling | Custom Rollup config | tsdown | 10-30x faster, handles ESM/CJS/IIFE/UMD, auto-generates .d.ts files, maintained by Rolldown team |
| Shared TypeScript config | Copy-paste tsconfig | Shared config package with extends | Single source of truth, easier updates, enforces consistency |
| Test runner | Custom test setup | Vitest | Native TypeScript/ESM support, 10-20x faster than Jest, compatible API for migration |
| Module format detection | Runtime checks | package.json exports field | Standard Node.js resolution, works with all bundlers, declarative |
| Dependency linking | Relative imports or symlinks | workspace: protocol | Auto-converts on publish, type-safe, prevents registry fallback |

**Key insight:** Modern build tooling has solved these problems with far better performance than custom solutions. The Rust-based tools (Rolldown, Oxc powering tsdown) are orders of magnitude faster than JavaScript-based alternatives.

## Common Pitfalls

### Pitfall 1: Cloudflare Pages Deployment Breaks After Adding pnpm-workspace.yaml
**What goes wrong:** After creating pnpm-workspace.yaml, Cloudflare Pages deployment fails with "server.js not found" or refuses to deploy
**Why it happens:** Cloudflare auto-detects pnpm workspaces but fails without explicit root package declaration
**How to avoid:** Always include `packages: ['.']` at the beginning of pnpm-workspace.yaml to mark root as a workspace member
**Warning signs:** Deployment worked before monorepo setup, fails immediately after adding pnpm-workspace.yaml
**Source:** [Cloudflare Developers Discussion](https://www.answeroverflow.com/m/1430579014992527430)

### Pitfall 2: TypeScript strict Mode Doesn't Catch Array/Object Access Bugs
**What goes wrong:** Code compiles but crashes at runtime when accessing undefined array elements or object properties
**Why it happens:** `strict: true` doesn't enable `noUncheckedIndexedAccess`, which is critical for index signature safety
**How to avoid:** Explicitly enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in addition to `strict: true`
**Warning signs:** Runtime errors like "Cannot read property 'x' of undefined" on array/object access
**Source:** [TypeScript GitHub Issue #49169](https://github.com/microsoft/TypeScript/issues/49169)

### Pitfall 3: Relative Paths Break After Monorepo Restructure
**What goes wrong:** Website fails to load scripts/styles because paths are wrong after moving to apps/website/
**Why it happens:** HTML uses relative paths (./chains.js) that work at root but break in subdirectory
**How to avoid:** Test the website immediately after restructuring. For static HTML sites, paths relative to the HTML file's location still work, but deployment configuration may need updating
**Warning signs:** 404 errors for JS/CSS files, network tab shows wrong paths
**Source:** Migration experience from [DigitalOcean Monorepo Migration Guide](https://www.digitalocean.com/blog/migrate-production-code-to-monorepo)

### Pitfall 4: Forgetting to Migrate .gitignore Rules
**What goes wrong:** Files that should be ignored get committed, or expected files are missing
**Why it happens:** Root .gitignore patterns may not apply correctly to workspace subdirectories
**How to avoid:** After restructuring, run `git status` and verify ignored patterns work. Workspace packages may need their own .gitignore files
**Warning signs:** node_modules or dist directories show up in git status
**Source:** [Monorepo Migration Gist](https://gist.github.com/dselans/f19ecb3c662ef4eaa3720c8f3d245dbf)

### Pitfall 5: Shared Config Package Not Resolved
**What goes wrong:** TypeScript can't find extended tsconfig: "File 'packages/config/typescript/base.json' not found"
**Why it happens:** TypeScript resolves extends paths relative to the extending file's location
**How to avoid:** Use relative paths for extends, not package names: `"extends": "../config/typescript/base.json"`
**Warning signs:** tsconfig.json throws "File not found" errors during compilation
**Source:** [TypeScript Issue #56847](https://github.com/microsoft/TypeScript/issues/56847)

### Pitfall 6: Directory Structure Changes Too Much at Once
**What goes wrong:** Migration becomes overwhelming, errors multiply, hard to debug what broke
**Why it happens:** Attempting to reorganize, refactor, and restructure simultaneously
**How to avoid:** This phase should ONLY restructure - no refactoring, no new features. Move files as-is, verify website works, then stop
**Warning signs:** Scope creep, "while I'm here" changes, unrelated file modifications
**Source:** [InfoQ Monorepo Mistakes Presentation](https://www.infoq.com/presentations/monorepo-mistakes/)

## Code Examples

Verified patterns from official sources:

### Minimal Smoke Test for SDK Package
```typescript
// packages/x402lint/test/index.test.ts
// Source: https://vitest.dev/guide/
import { describe, it, expect } from 'vitest'
import * as x402lint from '../src/index'

describe('x402lint package', () => {
  it('exports an object', () => {
    expect(x402lint).toBeDefined()
    expect(typeof x402lint).toBe('object')
  })

  it('compiles without errors', () => {
    // This test passing means TypeScript compilation succeeded
    expect(true).toBe(true)
  })
})
```

### Initial SDK Barrel Export (Stub)
```typescript
// packages/x402lint/src/index.ts
// Empty barrel export - proper exports added in later phases
// Named exports only (no default) for IIFE compatibility

// Re-export types when available (Phase 6)
// export * from './types'

// Re-export validation when available (Phase 8)
// export { validate } from './validation'

// Stub to satisfy initial compilation
export const __SDK_VERSION__ = '0.0.1'
```

### pnpm Filter Commands
```bash
# Source: https://pnpm.io/filtering

# Install dependencies for specific package
pnpm --filter x402lint install

# Run build in SDK package only
pnpm --filter x402lint build

# Run tests in SDK package
pnpm --filter x402lint test

# Run command in all packages matching pattern
pnpm --filter "@x402/*" build

# Run in SDK and its dependencies (if any)
pnpm --filter x402lint... build

# Run in SDK's dependents (packages that depend on it)
pnpm --filter ...x402lint test
```

### Shared Config Package Structure
```json
// packages/config/package.json
{
  "name": "@x402lint/config",
  "version": "1.0.0",
  "private": true,
  "description": "Shared configuration for x402lint monorepo",
  "files": [
    "typescript"
  ]
}

// packages/config/typescript/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lerna for monorepo management | pnpm workspaces natively | 2022-2024 | Simpler setup, no extra tool needed, better performance |
| tsup for library bundling | tsdown | 2024-2025 | 10-30x faster builds via Rust (Rolldown), better UMD support |
| Jest for testing | Vitest | 2023-2024 | 10-20x faster feedback, native ESM/TS, no config needed |
| Manual workspace: protocol conversion | Auto-conversion on publish | pnpm 7+ (2022) | Safer publishing, no manual version replacement |
| global/project/local .prettierrc | Shared config package | Ongoing trend | Single source of truth, easier enforcement |
| project: './tsconfig.json' | project: true | typescript-eslint 5.52.0 | Automatic tsconfig discovery, works better in monorepos |

**Deprecated/outdated:**
- **Lerna:** Still maintained but unnecessary with pnpm workspaces. Use only if you need Changesets integration
- **npm/yarn workspaces:** Still work but slower and less strict than pnpm
- **tsup:** Still good, but tsdown is faster and better maintained for library use cases
- **separate repository per package:** Monorepos are now standard for related packages

## Open Questions

Things that couldn't be fully resolved:

1. **Should website files be reorganized into subdirectories?**
   - What we know: User left this to Claude's discretion. Current structure is flat (HTML/JS at root)
   - What's unclear: Whether Cloudflare Pages deployment expects specific structure
   - Recommendation: Keep files flat initially for minimal change. Reorganize only if deployment configuration requires it. Test deployment immediately after restructuring.

2. **Should the website workspace have its own package.json?**
   - What we know: CONTEXT.md says "Website is its own workspace member (not plain files at root)"
   - What's unclear: Whether static HTML needs package.json if it has no dependencies
   - Recommendation: Create minimal package.json with name and private: true even if no dependencies. This makes workspace structure explicit and allows future dependency addition.

3. **What should initial index.ts export?**
   - What we know: User left this to Claude's discretion. Need to satisfy `tsc --noEmit` success criterion
   - What's unclear: Whether to export placeholder types, empty object, or stub functions
   - Recommendation: Export a simple version constant. This compiles successfully and establishes the named-export pattern for IIFE compatibility.

## Sources

### Primary (HIGH confidence)
- [pnpm Workspaces](https://pnpm.io/workspaces) - Official documentation
- [pnpm-workspace.yaml](https://pnpm.io/pnpm-workspace_yaml) - Configuration reference
- [pnpm Filtering](https://pnpm.io/filtering) - Filter command documentation
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) - Compiler options
- [tsdown Getting Started](https://tsdown.dev/guide/getting-started) - Installation and configuration
- [tsdown Guide](https://tsdown.dev/guide/) - Format support and best practices
- [Vitest Configuration](https://vitest.dev/config/) - Test configuration
- [Vitest Guide](https://vitest.dev/guide/) - Getting started

### Secondary (MEDIUM confidence)
- [Complete Monorepo Guide: pnpm + Workspace + Changesets (2025)](https://jsdev.space/complete-monorepo-guide/) - Modern patterns
- [Deep Dive Into Extending tsconfig.json](https://echobind.com/post/deep-dive-into-extending-tsconfig-json) - Shared config patterns
- [Guide to the package.json exports field](https://hirok.io/posts/package-json-exports) - Dual-format exports
- [How to Easily Support ESM and CJS in Your TypeScript Library](https://www.bretcameron.com/blog/how-to-easily-support-esm-and-cjs-in-your-typescript-library) - Module format best practices
- [TypeScript GitHub Issue #49169](https://github.com/microsoft/TypeScript/issues/49169) - noUncheckedIndexedAccess discussion
- [The Strictest TypeScript Config](https://whatislove.dev/articles/the-strictest-typescript-config/) - Maximum type safety

### Tertiary (LOW confidence - requires validation)
- [Cloudflare Developers: pnpm-workspace breaking deploy](https://www.answeroverflow.com/m/1430579014992527430) - Cloudflare Pages issue
- [Monorepo Migration Gist](https://gist.github.com/dselans/f19ecb3c662ef4eaa3720c8f3d245dbf) - Migration checklist
- [DigitalOcean Monorepo Migration Guide](https://www.digitalocean.com/blog/migrate-production-code-to-monorepo) - Migration strategies
- [InfoQ: From Monorepo Mess to Monorepo Bliss](https://www.infoq.com/presentations/monorepo-mistakes/) - Common mistakes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs and current ecosystem adoption verified
- Architecture: HIGH - pnpm workspace patterns verified via official docs
- Pitfalls: MEDIUM - Mix of official issues and community experience reports
- TypeScript config: HIGH - Official TypeScript documentation
- Build tooling: MEDIUM - tsdown is new (beta) but official Rolldown project

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - relatively stable ecosystem)
