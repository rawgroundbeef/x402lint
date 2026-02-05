# Phase 14: CLI Manifest Mode - Research

**Researched:** 2026-02-04
**Domain:** Node.js CLI development with ESM, terminal output formatting, argument parsing
**Confidence:** HIGH

## Summary

This phase extends the existing CLI (`src/cli.ts`) to support manifest validation in addition to single configs. The core technical challenges are: (1) adding repeatable `--header` flags for HTTP requests, (2) formatting multi-endpoint results as terminal tables, (3) ensuring clean JSON output without ANSI codes in CI environments, and (4) implementing redirect following with limits for URL fetching.

The existing CLI already handles ESM+shebang correctly via tsdown with `banner: { js: '#!/usr/bin/env node' }` and outputs to `dist/cli.mjs`. The current implementation uses manual argument parsing, native `fetch()` for HTTP, and hardcoded ANSI color codes. To support manifest mode, we need to add table formatting (for endpoint summaries) and enhance argument parsing to support repeatable flags.

**Primary recommendation:** Use Node.js native `util.parseArgs()` with `multiple: true` for repeatable `--header` flags, add `cli-table3` for terminal table output, and ensure `--json` mode strips all ANSI codes. Leverage native `fetch()` with `AbortSignal.timeout()` and manual redirect tracking (fetch doesn't expose redirect count directly).

## Standard Stack

The established libraries/tools for Node.js CLI development in 2026:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:util` (parseArgs) | Node.js 20+ | CLI argument parsing | Native to Node.js, stable since v20.0.0, supports repeatable flags via `multiple: true` option |
| `node:fetch` | Node.js 18+ | HTTP requests with redirects | Native Fetch API, supports `AbortSignal.timeout()` and redirect modes |
| `node:tty` | Node.js core | TTY detection for color output | Native API, check `process.stdout.isTTY` to detect terminal vs CI/pipe |
| cli-table3 | ^0.6.5 | Terminal table formatting | Most maintained fork (cli-table and cli-table2 unmaintained), 19M+ weekly downloads, TypeScript types included |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk (optional) | ^5.x | ANSI color management | Only if advanced color support needed; existing CLI uses inline ANSI codes (`\x1b[31m`) |
| strip-ansi (optional) | ^7.x | Strip ANSI codes from strings | Only if `--json` output needs explicit stripping (better to avoid emitting ANSI in JSON mode) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| util.parseArgs | Commander.js (0 deps) | More features (subcommands, help generation) but adds 174KB minified; util.parseArgs is built-in and sufficient |
| cli-table3 | text-table (minimal) | Smaller bundle but no colors, borders, or column spanning; cli-table3 better matches UX needs |
| Inline ANSI codes | chalk library | chalk is safer/cleaner but adds dependency; inline codes work for simple use case |
| Manual redirect tracking | follow-redirects package | Existing fetch handles redirects; manual tracking avoids extra dependency |

**Installation:**
```bash
npm install cli-table3
# util.parseArgs, fetch, tty are Node.js built-ins (no install needed)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli.ts           # Main CLI entry point (already exists)
├── cli/             # CLI-specific modules (new)
│   ├── args.ts      # Argument parsing with util.parseArgs
│   ├── format.ts    # Terminal output formatting (table, colors)
│   ├── fetch.ts     # URL fetching with redirect tracking
│   └── detect.ts    # Manifest vs single-config detection
├── validation/
│   ├── orchestrator.ts  # validate() - single config
│   └── manifest.ts      # validateManifest() - full manifest
```

### Pattern 1: Native Argument Parsing with Repeatable Flags
**What:** Use `util.parseArgs()` with `multiple: true` for `--header` flag to collect all header values in an array
**When to use:** CLI needs to accept the same flag multiple times (e.g., `--header 'Auth: xyz' --header 'Custom: abc'`)
**Example:**
```typescript
// Source: https://2ality.com/2022/08/node-util-parseargs.html
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: {
    strict: { type: 'boolean', short: 's' },
    json: { type: 'boolean' },
    quiet: { type: 'boolean', short: 'q' },
    header: {
      type: 'string',
      multiple: true  // Allows --header to be used multiple times
    },
  },
  allowPositionals: true,
  args: process.argv.slice(2),
});

// values.header is string[] when multiple headers provided
// e.g., ['Authorization: Bearer xxx', 'Custom-Header: value']
```

### Pattern 2: TTY Detection for CI-Friendly Output
**What:** Detect if stdout is a TTY to automatically disable colors in CI environments
**When to use:** CLI should output colors in terminal but plain text when piped or in CI
**Example:**
```typescript
// Source: https://nodejs.org/api/tty.html
const isTTY = process.stdout.isTTY;
const useColor = isTTY && !process.env.NO_COLOR;

function formatStatus(valid: boolean): string {
  if (!useColor) return valid ? 'PASS' : 'FAIL';

  // ANSI color codes only when TTY detected
  return valid
    ? '\x1b[32m✓ PASS\x1b[0m'  // green
    : '\x1b[31m✗ FAIL\x1b[0m';  // red
}
```

### Pattern 3: Redirect Following with Limit
**What:** Native fetch follows redirects automatically, but doesn't expose redirect count; track manually to enforce 5-redirect limit
**When to use:** Fetching URLs that may redirect, need to enforce redirect limit and detect redirect loops
**Example:**
```typescript
// Source: Derived from https://github.com/node-fetch/node-fetch documentation
async function fetchWithRedirectLimit(
  url: string,
  options: RequestInit & { headers?: Record<string, string> },
  maxRedirects = 5
): Promise<Response> {
  let redirectCount = 0;
  let currentUrl = url;

  while (redirectCount <= maxRedirects) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual',  // Handle redirects manually
      signal: AbortSignal.timeout(10000),  // 10s timeout
    });

    // Check for redirect status codes (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without Location header');

      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`Too many redirects (limit: ${maxRedirects})`);
      }

      // Resolve relative URLs
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }

  throw new Error('Redirect loop detected');
}
```

### Pattern 4: Terminal Table Output with cli-table3
**What:** Use cli-table3 to render summary table of endpoint validation results
**When to use:** Multi-endpoint output needs structured table format (summary before details)
**Example:**
```typescript
// Source: https://github.com/cli-table/cli-table3 basic usage
import Table from 'cli-table3';

interface EndpointSummary {
  id: string;
  valid: boolean;
  errorCount: number;
  warningCount: number;
}

function renderSummaryTable(summaries: EndpointSummary[]): string {
  const table = new Table({
    head: ['Status', 'Endpoint ID', 'Errors', 'Warnings'],
    colWidths: [10, 30, 10, 10],
    style: {
      head: ['cyan'],  // Cyan header text
      border: ['gray'], // Gray borders
    }
  });

  for (const s of summaries) {
    const icon = s.valid ? '✓' : '✗';
    const color = s.valid ? '\x1b[32m' : '\x1b[31m';  // green/red
    const reset = '\x1b[0m';

    table.push([
      `${color}${icon}${reset}`,
      s.id,
      s.errorCount.toString(),
      s.warningCount.toString(),
    ]);
  }

  return table.toString();
}
```

### Anti-Patterns to Avoid
- **Bundling CLI with library code:** CLI code must stay in separate tsdown entry (`src/cli.ts`) to avoid Node.js imports leaking into browser bundle (addresses P1 risk from context)
- **Emitting ANSI in `--json` mode:** Always check flags before adding color codes; JSON output must be parseable by `JSON.parse()` with no terminal escape sequences
- **Fail-fast validation:** Always validate all endpoints even after first failure; developers need complete picture in one run (per context decision)
- **Using .cjs for CLI bin:** Use `.mjs` extension for CLI binary when package has `type: "module"` to ensure ESM compatibility (existing pattern in tsdown.config.ts)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing with repeatable flags | Manual argv loop with flag tracking | `util.parseArgs()` with `multiple: true` | Native to Node.js 20+, handles edge cases (short flags, inline values `--key=val`, escaping), stable API |
| Terminal table rendering | String concatenation with padding/alignment | cli-table3 | Handles column width calculation, word wrapping, Unicode alignment, border styles; 19M+ downloads |
| TTY/color detection | Environment variable checks only | `process.stdout.isTTY + NO_COLOR` env var | Standard Node.js API, CI environments set NO_COLOR automatically, respects user preferences |
| HTTP redirect following | Custom redirect loop with manual tracking | Native fetch with `redirect: 'manual'` | Fetch API handles 301/302/307/308, parses Location header, resolves relative URLs |
| ANSI code stripping | Regex to remove escape sequences | Avoid emitting ANSI in JSON mode | Easier to prevent than strip; check flags before formatting |

**Key insight:** Node.js 20+ provides native solutions for most CLI tasks (parseArgs, fetch, tty). Only add dependencies for specialized needs (table formatting). Custom redirect tracking is necessary because native fetch doesn't expose redirect count.

## Common Pitfalls

### Pitfall 1: parseArgs Short Flag Inline Values
**What goes wrong:** Attempting to use inline values with short flags like `-c=green` throws error
**Why it happens:** parseArgs spec doesn't support inline values for short flags (only long flags support `--color=green`)
**How to avoid:** Use long flag format for inline values: `--color=green`, or separate value: `-c green`
**Warning signs:** Error message "option '-c' does not take a value" or similar parseArgs exception

### Pitfall 2: ANSI Codes in Piped/CI Output
**What goes wrong:** JSON output contains escape sequences like `\x1b[32m`, breaking `JSON.parse()`
**Why it happens:** Forgetting to check `--json` flag before applying color codes
**How to avoid:** Structure output formatting as: (1) check flags first, (2) format data, (3) emit. Never embed formatting in data structures.
**Warning signs:** CI logs show `[32m` or similar garbage in JSON output, JSON parsing errors

### Pitfall 3: Fetch Timeout Defaults
**What goes wrong:** URL fetches hang indefinitely on slow/dead servers
**Why it happens:** Native fetch has no default timeout (waits forever unless aborted)
**How to avoid:** Always use `AbortSignal.timeout(ms)` for fetch calls; 10-15 seconds reasonable for config fetching
**Warning signs:** CLI hangs when fetching URLs, no error or timeout

### Pitfall 4: Exit Code 0 on Majority Fail
**What goes wrong:** CI treats validation failure as success because exit code is 0
**Why it happens:** Not calculating majority pass/fail correctly, or forgetting to return exit code from main()
**How to avoid:** Always count passing vs failing endpoints and exit 1 if majority fail. Ensure main() returns exit code and process.exit() is called.
**Warning signs:** CI pipelines pass when they should fail, manual testing shows failures but CI doesn't catch them

### Pitfall 5: stdin.isTTY Check Without Pipe Handling
**What goes wrong:** CLI hangs waiting for stdin when user didn't provide input
**Why it happens:** Reading stdin without first checking if data is piped (stdin.isTTY === undefined means piped)
**How to avoid:** Check `stdin.isTTY` before reading stdin; if true (is TTY), don't wait for input
**Warning signs:** CLI hangs with no output when run without arguments, requires Ctrl+C to exit
**Example from existing cli.ts:**
```typescript
// Existing pattern (CORRECT):
if (stdin.isTTY) {
  resolve('');  // No pipe, don't wait
  return;
}
// Only attach listeners if stdin is piped
stdin.on('data', (chunk) => chunks.push(chunk));
```

### Pitfall 6: ESM Shebang on Windows
**What goes wrong:** Windows ignores shebang, requires explicit `node` invocation
**Why it happens:** Shebang is Unix convention; Windows npm handles it via wrapper scripts
**How to avoid:** npm automatically creates `.cmd` wrapper on Windows when `bin` field in package.json points to `.mjs` file. Trust npm's bin handling; test on Windows via WSL or CI.
**Warning signs:** Works on macOS/Linux but fails on Windows, or requires `node dist/cli.mjs` instead of `x402lint`

## Code Examples

Verified patterns from official sources:

### Parsing Repeatable Headers
```typescript
// Source: https://nodejs.org/api/util.html parseArgs documentation
import { parseArgs } from 'node:util';

interface CliArgs {
  input: string | null;
  strict: boolean;
  json: boolean;
  quiet: boolean;
  headers: Record<string, string>;
}

function parseCliArgs(argv: string[]): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      strict: { type: 'boolean' },
      json: { type: 'boolean' },
      quiet: { type: 'boolean', short: 'q' },
      header: { type: 'string', multiple: true },  // Repeatable
    },
    allowPositionals: true,
    args: argv,
  });

  // Convert header array to object
  const headers: Record<string, string> = {};
  if (values.header && Array.isArray(values.header)) {
    for (const h of values.header) {
      const [key, ...valueParts] = h.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join(':').trim();
      }
    }
  }

  return {
    input: positionals[0] ?? null,
    strict: values.strict ?? false,
    json: values.json ?? false,
    quiet: values.quiet ?? false,
    headers,
  };
}
```

### CI-Friendly Output (No ANSI in JSON Mode)
```typescript
// Source: Derived from existing cli.ts + TTY documentation
import type { ManifestValidationResult } from './types/manifest';

function formatManifestResult(result: ManifestValidationResult, args: CliArgs): string {
  // JSON mode: pure JSON, no ANSI codes
  if (args.json) {
    return JSON.stringify(result, null, 2);
  }

  // Quiet mode: no output
  if (args.quiet) {
    return '';
  }

  // Terminal mode: use colors if TTY detected
  const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

  const lines: string[] = [];

  // Detection announcement (per context decision)
  const endpointCount = Object.keys(result.endpointResults).length;
  lines.push(`Detected: manifest with ${endpointCount} endpoints`);
  lines.push('');

  // Summary table (if multiple endpoints)
  if (endpointCount > 0) {
    lines.push(renderSummaryTable(result, useColor));
    lines.push('');
  }

  // Detailed endpoint results
  for (const [id, endpointResult] of Object.entries(result.endpointResults)) {
    lines.push(formatEndpointDetails(id, endpointResult, useColor));
    lines.push('');
  }

  // Cross-endpoint issues (at end per discretion)
  if (result.errors.length > 0 || result.warnings.length > 0) {
    lines.push('Cross-endpoint issues:');
    result.errors.forEach(e => lines.push(formatIssue(e, useColor)));
    result.warnings.forEach(w => lines.push(formatIssue(w, useColor)));
  }

  return lines.join('\n');
}
```

### Exit Code Calculation (Majority Pass/Fail)
```typescript
// Source: Context decision + standard CLI patterns
function calculateExitCode(result: ManifestValidationResult, strict: boolean): number {
  // Count passing vs failing endpoints
  const endpointResults = Object.values(result.endpointResults);
  if (endpointResults.length === 0) {
    // Empty manifest is valid (per Phase 11 decision)
    return 0;
  }

  // In strict mode, warnings count as failures
  const passingCount = endpointResults.filter(r => {
    if (strict) {
      return r.valid && r.warnings.length === 0;
    }
    return r.valid;
  }).length;

  const failingCount = endpointResults.length - passingCount;

  // Manifest-level errors always cause failure
  if (result.errors.length > 0) {
    return 1;
  }

  // Strict mode: manifest warnings cause failure
  if (strict && result.warnings.length > 0) {
    return 1;
  }

  // Exit 0 if majority pass, exit 1 if majority fail
  return passingCount > failingCount ? 0 : 1;
}

// Usage in main()
async function main(): Promise<number> {
  try {
    const args = parseCliArgs(process.argv.slice(2));

    // ... fetch/load input, detect manifest vs single config ...

    const result = validateManifest(manifestInput);
    const output = formatManifestResult(result, args);

    if (output) console.log(output);

    return calculateExitCode(result, args.strict);
  } catch (err) {
    // Input errors (file not found, network error) exit 2
    console.error(`Error: ${(err as Error).message}`);
    return 2;
  }
}

main().then(code => process.exit(code));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| yargs/minimist for arg parsing | `util.parseArgs()` (native) | Node.js 18.3 (experimental) / 20.0 (stable) | Zero dependencies for CLI args; fewer supply chain risks |
| Manual TTY checks | `process.stdout.isTTY + NO_COLOR` env var | NO_COLOR standard adopted ~2021 | Better CI environment detection; respects user preferences |
| node-fetch package | Native `fetch()` in Node.js | Node.js 18 (stable) | One less dependency; standard Web API |
| Callbacks for HTTP | Promises/async-await with fetch | ES2017+ adoption | Cleaner async code; better error handling |
| String concatenation for tables | cli-table3 / terminal-table libraries | Ongoing best practice | Readable code; handles edge cases (Unicode width, wrapping) |

**Deprecated/outdated:**
- **cli-table / cli-table2:** Both unmaintained; use cli-table3 (actively maintained fork)
- **node-fetch:** Still valid for Node.js <18, but native fetch is preferred for Node.js 18+
- **Manual argv parsing:** Replaced by util.parseArgs for simple CLIs (yargs/commander still valid for complex CLIs with subcommands)

## Open Questions

Things that couldn't be fully resolved:

1. **cli-table3 exact bundle size impact**
   - What we know: cli-table3 has 1 dependency (string-width ^4.2.0); unpacked size is 45.12 KB
   - What's unclear: Exact minified+gzipped size when bundled (Bundlephobia page exists but specific metrics not in search results)
   - Recommendation: Measure bundle size before/after adding cli-table3; if >10KB added to CLI bundle, consider simpler alternative (text-table) or hand-rolled table formatting
   - Confidence: LOW - need actual measurement

2. **Majority pass/fail for empty manifest**
   - What we know: Empty manifest (zero endpoints) is valid per Phase 11 decision
   - What's unclear: Should exit code be 0 (valid) or 1 (no work done)? Context says "exit 0 if majority pass"
   - Recommendation: Exit 0 for empty manifest (it's valid, no errors); consistent with validation result
   - Confidence: MEDIUM - context implies this but doesn't state explicitly

3. **Cross-endpoint issues placement in output**
   - What we know: Context marks this as Claude's discretion
   - What's unclear: Better UX to show cross-endpoint issues between table and details, or at end?
   - Recommendation: Show at end (after all endpoint details); developers read top-to-bottom, cross-endpoint context makes more sense after seeing individual endpoints
   - Confidence: MEDIUM - UX preference, should be tested with users

4. **Timeout value for URL fetching**
   - What we know: Context marks this as Claude's discretion; native fetch has no default timeout
   - What's unclear: Optimal timeout value (5s? 10s? 30s?)
   - Recommendation: 10 seconds for initial request, 5 seconds for redirects; config files are small, should respond quickly
   - Confidence: MEDIUM - common practice for CLI tools, but use case dependent

## Sources

### Primary (HIGH confidence)
- [Node.js util.parseArgs() Official Documentation](https://nodejs.org/api/util.html) - parseArgs API, options, examples
- [Parsing command line arguments with util.parseArgs()](https://2ality.com/2022/08/node-util-parseargs.html) - comprehensive guide with multiple: true examples
- [Node.js TTY Documentation](https://nodejs.org/api/tty.html) - isTTY detection, color depth
- [Creating ESM-based shell scripts for Unix and Windows with Node.js](https://2ality.com/2022/07/nodejs-esm-shell-scripts.html) - ESM shebang patterns

### Secondary (MEDIUM confidence)
- [cli-table3 GitHub Repository](https://github.com/cli-table/cli-table3) - maintained fork, features, examples
- [node-fetch GitHub Documentation](https://github.com/node-fetch/node-fetch) - redirect handling patterns (adapted for native fetch)
- [Better Stack: Timeouts in Node.js](https://betterstack.com/community/guides/scaling-nodejs/nodejs-timeouts/) - AbortSignal.timeout() usage
- [npm-compare: cli-table3 vs alternatives](https://npm-compare.com/cli-table,cli-table3,console-table-printer,table,text-table) - library comparison

### Tertiary (LOW confidence)
- [WebSearch: Node.js CLI libraries 2026](https://byby.dev/node-command-line-libraries) - ecosystem overview
- [WebSearch: Zero dependency CLI libraries](https://www.npmjs.com/search?q=keywords:zero-dependency) - lightweight options
- [WebSearch: Exit code patterns in linters/test runners](https://golangci-lint.run/docs/configuration/cli/) - industry patterns for majority fail

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All recommendations are from official Node.js documentation or well-established libraries
- Architecture: HIGH - Patterns verified with official docs and existing cli.ts implementation
- Pitfalls: HIGH - Documented issues from Node.js issue tracker and library maintainers
- Bundle size impact: LOW - cli-table3 specific metrics not verified; measurement needed
- Exit code edge cases: MEDIUM - Empty manifest handling not explicitly addressed in context

**Research date:** 2026-02-04
**Valid until:** 2026-03-06 (30 days - Node.js CLI patterns are stable)
