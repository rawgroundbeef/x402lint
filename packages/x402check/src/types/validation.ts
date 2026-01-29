import type { ConfigFormat } from './config'
import type { NormalizedConfig } from './config'
import type { ErrorCode } from './errors'

/**
 * Issue severity level
 */
export type Severity = 'error' | 'warning'

/**
 * Validation issue detail
 */
export interface ValidationIssue {
  code: ErrorCode
  field: string
  message: string
  severity: Severity
  fix?: string | undefined
}

/**
 * Validation result with errors, warnings, and normalized config
 */
export interface ValidationResult {
  valid: boolean
  version: ConfigFormat
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  normalized: NormalizedConfig | null
}

/**
 * Parsed input result (for parseInput utility)
 */
export interface ParsedInput {
  parsed: unknown
  error?: ValidationIssue | undefined
}
