/**
 * Terminal output formatting for CLI
 *
 * Provides formatted output for validation results, check results, and manifest results.
 * Handles --json, --quiet, and terminal modes with color support detection.
 */

import Table from 'cli-table3'
import type { ValidationIssue, ValidationResult } from '../types/validation'
import type { CheckResult } from '../types/check'
import type { ManifestValidationResult } from '../types/manifest'
import type { CliArgs } from './args'

// ── Color helpers ────────────────────────────────────────────────────────

const useColor = process.stdout.isTTY && !process.env.NO_COLOR

function green(s: string): string {
  return useColor ? `\x1b[32m${s}\x1b[0m` : s
}

function red(s: string): string {
  return useColor ? `\x1b[31m${s}\x1b[0m` : s
}

function yellow(s: string): string {
  return useColor ? `\x1b[33m${s}\x1b[0m` : s
}

function cyan(s: string): string {
  return useColor ? `\x1b[36m${s}\x1b[0m` : s
}

function dim(s: string): string {
  return useColor ? `\x1b[2m${s}\x1b[0m` : s
}

// ── Issue formatting ─────────────────────────────────────────────────────

/**
 * Format a single validation issue with icon and optional fix suggestion
 */
export function formatIssue(issue: ValidationIssue, colorEnabled: boolean): string {
  const icon = colorEnabled
    ? issue.severity === 'error'
      ? red('✗')
      : yellow('⚠')
    : issue.severity === 'error'
      ? '✗'
      : '⚠'

  const line = `  ${icon} ${issue.code} [${issue.field}]: ${issue.message}`
  if (issue.fix) {
    return line + `\n      ↳ ${issue.fix}`
  }
  return line
}

// ── Single-config validation result ──────────────────────────────────────

/**
 * Format validation result (single-config)
 *
 * Modes:
 * - quiet: Empty string (exit code only) — takes precedence
 * - json: Pure JSON output
 * - terminal: Status + errors + warnings
 */
export function formatValidationResult(result: ValidationResult, args: CliArgs): string {
  if (args.quiet) return ''
  if (args.json) return JSON.stringify(result, null, 2)

  const lines: string[] = []

  // Status line
  if (result.valid) {
    lines.push(`${green('✓ Valid')} x402 config (${result.version})`)
  } else {
    lines.push(`${red('✗ Invalid')} x402 config (${result.version})`)
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('')
    lines.push(`Errors (${result.errors.length}):`)
    for (const e of result.errors) lines.push(formatIssue(e, useColor))
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push(`Warnings (${result.warnings.length}):`)
    for (const w of result.warnings) lines.push(formatIssue(w, useColor))
  }

  return lines.join('\n')
}

// ── Check result (URL extraction + validation) ──────────────────────────

/**
 * Format check result (URL fetch + extraction + validation)
 *
 * Modes:
 * - quiet: Empty string (exit code only) — takes precedence
 * - json: Pure JSON output
 * - terminal: Extraction status + validation + summary
 */
export function formatCheckResult(result: CheckResult, args: CliArgs): string {
  if (args.quiet) return ''
  if (args.json) return JSON.stringify(result, null, 2)

  const lines: string[] = []

  // Extraction status
  if (!result.extracted) {
    lines.push(`${red('✗ No x402 config found')}`)
    if (result.extractionError) {
      lines.push(`  ${result.extractionError}`)
    }
    return lines.join('\n')
  }

  lines.push(`Extracted from: ${result.source}`)

  // Validation status
  if (result.valid) {
    lines.push(`${green('✓ Valid')} x402 config (${result.version})`)
  } else {
    lines.push(`${red('✗ Invalid')} x402 config (${result.version})`)
  }

  // Summary
  if (result.summary.length > 0) {
    lines.push('')
    lines.push('Payment options:')
    for (const s of result.summary) {
      const symbol = s.assetSymbol ?? s.asset
      const net = s.networkName
      lines.push(`  [${s.index}] ${s.amount} ${symbol} on ${net} → ${s.payTo.slice(0, 10)}...`)
    }
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('')
    lines.push(`Errors (${result.errors.length}):`)
    for (const e of result.errors) lines.push(formatIssue(e, useColor))
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push(`Warnings (${result.warnings.length}):`)
    for (const w of result.warnings) lines.push(formatIssue(w, useColor))
  }

  return lines.join('\n')
}

// ── Manifest result ──────────────────────────────────────────────────────

/**
 * Format manifest validation result
 *
 * Modes:
 * - quiet: Empty string (exit code only) — takes precedence
 * - json: Pure JSON output
 * - terminal: Summary table + endpoint details + cross-endpoint issues
 */
export function formatManifestResult(result: ManifestValidationResult, args: CliArgs): string {
  if (args.quiet) return ''
  if (args.json) return JSON.stringify(result, null, 2)

  const lines: string[] = []

  // Summary table
  const table = new Table({
    head: ['Status', 'Endpoint', 'Errors', 'Warnings'],
    style: {
      head: useColor ? ['cyan'] : [],
      border: [],
    },
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: ' ',
    },
  })

  const endpointIds = Object.keys(result.endpointResults)
  for (const endpointId of endpointIds) {
    const endpointResult = result.endpointResults[endpointId]!
    const icon = endpointResult.valid ? (useColor ? green('✓') : '✓') : (useColor ? red('✗') : '✗')
    const errorCount = endpointResult.errors.length
    const warningCount = endpointResult.warnings.length

    table.push([icon, endpointId, errorCount.toString(), warningCount.toString()])
  }

  lines.push(table.toString())
  lines.push('')

  // Endpoint details
  for (const endpointId of endpointIds) {
    const endpointResult = result.endpointResults[endpointId]!

    lines.push(`--- ${endpointId} ---`)

    // Status line
    const icon = endpointResult.valid ? (useColor ? green('✓') : '✓') : (useColor ? red('✗') : '✗')
    const status = endpointResult.valid ? 'Valid' : 'Invalid'
    lines.push(`${icon} ${status} (${endpointResult.version})`)

    // Errors
    if (endpointResult.errors.length > 0) {
      lines.push('')
      lines.push(`Errors (${endpointResult.errors.length}):`)
      for (const e of endpointResult.errors) lines.push(formatIssue(e, useColor))
    }

    // Warnings
    if (endpointResult.warnings.length > 0) {
      lines.push('')
      lines.push(`Warnings (${endpointResult.warnings.length}):`)
      for (const w of endpointResult.warnings) lines.push(formatIssue(w, useColor))
    }

    lines.push('')
  }

  // Cross-endpoint issues
  if (result.errors.length > 0 || result.warnings.length > 0) {
    lines.push('Cross-endpoint issues:')

    if (result.errors.length > 0) {
      lines.push('')
      lines.push(`Errors (${result.errors.length}):`)
      for (const e of result.errors) lines.push(formatIssue(e, useColor))
    }

    if (result.warnings.length > 0) {
      lines.push('')
      lines.push(`Warnings (${result.warnings.length}):`)
      for (const w of result.warnings) lines.push(formatIssue(w, useColor))
    }

    lines.push('')
  }

  return lines.join('\n')
}

// ── Exit code calculation ────────────────────────────────────────────────

/**
 * Calculate exit code for manifest validation result
 *
 * Rules:
 * - Empty endpoints ({}) → 0 (valid)
 * - Manifest-level errors → 1
 * - Manifest-level warnings in strict mode → 1
 * - Majority of endpoints pass → 0
 * - Majority of endpoints fail → 1
 * - Tie (equal pass/fail) → 1 (fail-safe)
 *
 * Strict mode definition:
 * - Endpoint passes if valid && warnings.length === 0
 * - Normal mode: endpoint passes if valid
 */
export function calculateExitCode(result: ManifestValidationResult, strict: boolean): number {
  const endpointIds = Object.keys(result.endpointResults)

  // Empty endpoints is valid (per Phase 11 decision)
  if (endpointIds.length === 0) {
    return 0
  }

  // Manifest-level errors → fail
  if (result.errors.length > 0) {
    return 1
  }

  // Manifest-level warnings in strict mode → fail
  if (strict && result.warnings.length > 0) {
    return 1
  }

  // Count passing vs failing endpoints
  let passingCount = 0
  let failingCount = 0

  for (const endpointId of endpointIds) {
    const endpointResult = result.endpointResults[endpointId]!
    const passes = strict
      ? endpointResult.valid && endpointResult.warnings.length === 0
      : endpointResult.valid

    if (passes) {
      passingCount++
    } else {
      failingCount++
    }
  }

  // Majority pass → success
  return passingCount > failingCount ? 0 : 1
}
