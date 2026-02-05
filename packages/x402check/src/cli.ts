/**
 * x402check CLI
 *
 * Validate x402 payment configurations from the command line.
 * Supports single configs (v1, v2) and manifests with auto-detection.
 */

import { parseCliArgs } from './cli/args'
import { fetchWithRedirects } from './cli/fetch'
import { resolveInput, readStdin, isUrl } from './cli/detect'
import { formatManifestResult, formatValidationResult, formatCheckResult, calculateExitCode } from './cli/format'
import { validate } from './validation/orchestrator'
import { validateManifest } from './validation/manifest'
import { check } from './check'
import { VERSION } from './index'
import { detect } from './detection/detect'
import { isManifestConfig } from './detection/guards'
import type { ManifestConfig, ManifestValidationResult } from './types/manifest'
import type { CliArgs } from './cli/args'

// ── Help text ────────────────────────────────────────────────────────────

const HELP = `x402check v${VERSION} — validate x402 payment configurations

Usage:
  x402check <json>              Validate inline JSON string
  x402check <file.json>         Validate a JSON file
  x402check <manifest.json>     Validate a manifest with multiple endpoints
  x402check <url>               Fetch URL and check 402 response
  x402check -                   Read from stdin
  echo '...' | x402check        Validate from stdin

Flags:
  --strict        Promote all warnings to errors
  --json          Output raw JSON result
  --quiet, -q     Suppress output, exit code only
  --header <H:V>  Add custom header (repeatable, for URL fetching)
  -h, --help      Show this help
  -v, --version   Show version

Exit codes:
  0  Valid config or majority of endpoints pass
  1  Invalid config or majority of endpoints fail
  2  Input error (no input, bad file, fetch failure)

Examples:
  x402check '{"x402Version":2,"accepts":[...]}'
  x402check config.json
  x402check manifest.json
  x402check https://api.example.com/resource --strict
  x402check https://api.example.com/resource --header "Authorization: Bearer xyz"
  curl -s https://example.com | x402check --json
  echo '{}' | x402check -
`

// ── Strict mode helper for manifests ────────────────────────────────────

/**
 * Apply strict mode to manifest result (promotes warnings to errors)
 *
 * Since validateManifest() doesn't accept options, we apply strict mode
 * post-validation by promoting all warnings to errors and recomputing validity.
 */
function applyStrictMode(result: ManifestValidationResult): ManifestValidationResult {
  // Promote manifest-level warnings to errors
  const manifestErrors = [...result.errors]
  const manifestWarnings: typeof result.warnings = []

  for (const warning of result.warnings) {
    manifestErrors.push({ ...warning, severity: 'error' })
  }

  // Promote endpoint-level warnings to errors
  const newEndpointResults: typeof result.endpointResults = {}

  for (const [endpointId, endpointResult] of Object.entries(result.endpointResults)) {
    const endpointErrors = [...endpointResult.errors]

    for (const warning of endpointResult.warnings) {
      endpointErrors.push({ ...warning, severity: 'error' })
    }

    // Recompute valid flag (invalid if any errors)
    const valid = endpointErrors.length === 0

    newEndpointResults[endpointId] = {
      ...endpointResult,
      valid,
      errors: endpointErrors,
      warnings: [],
    }
  }

  // Recompute manifest-level valid flag
  const allEndpointsValid = Object.values(newEndpointResults).every(r => r.valid)
  const valid = manifestErrors.length === 0 && allEndpointsValid

  return {
    valid,
    errors: manifestErrors,
    warnings: manifestWarnings,
    endpointResults: newEndpointResults,
    normalized: result.normalized,
  }
}

// ── URL handler ──────────────────────────────────────────────────────────

async function handleUrl(url: string, args: CliArgs): Promise<number> {
  try {
    const { status, body, headers } = await fetchWithRedirects(url, {
      headers: args.headers,
    })

    // For URLs, use check() API which handles extraction from headers + body
    // But first detect if the body itself is a manifest (for direct manifest URLs)
    if (typeof body === 'object' && body !== null) {
      const format = detect(body)

      if (format === 'manifest' && isManifestConfig(body)) {
        // Direct manifest URL
        if (!args.quiet && !args.json) {
          const endpointCount = Object.keys((body as ManifestConfig).endpoints).length
          console.log(`Detected: manifest with ${endpointCount} endpoints`)
        }

        let result = validateManifest(body as ManifestConfig)
        if (args.strict) {
          result = applyStrictMode(result)
        }

        const output = formatManifestResult(result, args)
        if (output) console.log(output)

        return calculateExitCode(result, args.strict)
      }
    }

    // Single-config URL (or non-manifest)
    if (status !== 402 && !args.quiet && !args.json) {
      console.log(`HTTP ${status} (expected 402)`)
    }

    if (!args.quiet && !args.json && typeof body === 'object' && body !== null) {
      const format = detect(body)
      if (format === 'v2') {
        console.log('Detected: v2 config')
      } else if (format === 'v1') {
        console.log('Detected: v1 config')
      }
    }

    const result = check({ body, headers }, { strict: args.strict })
    const output = formatCheckResult(result, args)
    if (output) console.log(output)

    return result.valid ? 0 : 1
  } catch (err) {
    console.error(`Fetch failed: ${(err as Error).message}`)
    return 2
  }
}

// ── File or JSON handler ─────────────────────────────────────────────────

async function handleFileOrJson(rawInput: string, args: CliArgs): Promise<number> {
  try {
    const resolved = resolveInput(rawInput)

    // Show normalization warnings if present (wild manifest conversion)
    if (resolved.normalizationWarnings && resolved.normalizationWarnings.length > 0) {
      if (!args.quiet && !args.json) {
        for (const warning of resolved.normalizationWarnings) {
          console.log(`Wild manifest normalization: ${warning}`)
        }
        console.log('')
      }
    }

    // Manifest path
    if (resolved.type === 'manifest') {
      const manifestData = resolved.data as ManifestConfig
      const endpointCount = Object.keys(manifestData.endpoints).length

      if (!args.quiet && !args.json) {
        console.log(`Detected: manifest with ${endpointCount} endpoints`)
      }

      let result = validateManifest(manifestData)
      if (args.strict) {
        result = applyStrictMode(result)
      }

      const output = formatManifestResult(result, args)
      if (output) console.log(output)

      return calculateExitCode(result, args.strict)
    }

    // Single-config path
    if (!args.quiet && !args.json && typeof resolved.data === 'object' && resolved.data !== null) {
      const format = detect(resolved.data)
      if (format === 'v2') {
        console.log('Detected: v2 config')
      } else if (format === 'v1') {
        console.log('Detected: v1 config')
      }
    }

    const result = validate(resolved.data, { strict: args.strict })
    const output = formatValidationResult(result, args)
    if (output) console.log(output)

    return result.valid ? 0 : 1
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    return 2
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2))

  if (args.version) {
    console.log(VERSION)
    return 0
  }

  if (args.help) {
    console.log(HELP)
    return 0
  }

  // Resolve input source
  let rawInput: string | null = args.input

  // Handle dash (-) stdin convention
  if (rawInput === '-') {
    rawInput = await readStdin()
    if (!rawInput.trim()) {
      console.error('No input from stdin.')
      return 2
    }
  }

  // Try stdin if no positional arg
  if (!rawInput) {
    const stdinData = await readStdin()
    if (stdinData.trim()) {
      rawInput = stdinData.trim()
    }
  }

  if (!rawInput) {
    console.error('No input provided. Run x402check --help for usage.')
    return 2
  }

  // URL mode: fetch then detect manifest vs single
  if (isUrl(rawInput)) {
    return handleUrl(rawInput, args)
  }

  // File or inline JSON mode
  return handleFileOrJson(rawInput, args)
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`Unexpected error: ${(err as Error).message}`)
    process.exit(2)
  },
)
