/**
 * Manifest validation
 * Validates entire x402 manifest configurations through per-endpoint validation,
 * cross-endpoint consistency checks, and bazaar method discrimination.
 */

import type { ManifestConfig, ManifestValidationResult } from '../types/manifest'
import type { ValidationResult, ValidationIssue } from '../types/validation'
import type { V2Config } from '../types/config'
import { validate } from './orchestrator'
import { ErrorCode, ErrorMessages } from '../types/errors'
import { getNetworkInfo } from '../registries/networks'

/**
 * Validate an entire x402 manifest configuration
 *
 * Pipeline:
 * 1. Validate each endpoint via existing validate() function
 * 2. Prefix all field paths with endpoint context
 * 3. Perform cross-endpoint consistency checks
 * 4. Validate bazaar method discrimination
 * 5. Aggregate results into unified ManifestValidationResult
 *
 * @param input - ManifestConfig object to validate
 * @returns ManifestValidationResult with per-endpoint and manifest-level issues
 */
export function validateManifest(input: ManifestConfig): ManifestValidationResult {
  try {
    return runManifestValidation(input)
  } catch {
    // Safety net: validateManifest() must never throw
    return {
      valid: false,
      endpointResults: {},
      errors: [
        {
          code: ErrorCode.INVALID_ENDPOINTS,
          field: 'endpoints',
          message: 'Unexpected manifest validation error',
          severity: 'error',
        },
      ],
      warnings: [],
      normalized: input,
    }
  }
}

/**
 * Internal validation implementation
 */
function runManifestValidation(input: ManifestConfig): ManifestValidationResult {
  const endpointResults: Record<string, ValidationResult> = {}
  const manifestErrors: ValidationIssue[] = []
  const manifestWarnings: ValidationIssue[] = []

  // Validate structure
  if (!input.endpoints || typeof input.endpoints !== 'object') {
    return {
      valid: false,
      endpointResults: {},
      errors: [
        {
          code: ErrorCode.MISSING_ENDPOINTS,
          field: 'endpoints',
          message: ErrorMessages.MISSING_ENDPOINTS,
          severity: 'error',
          fix: 'Add endpoints object with at least one endpoint configuration',
        },
      ],
      warnings: [],
      normalized: input,
    }
  }

  // Handle empty endpoints (valid per Phase 11 decision)
  const endpointEntries = Object.entries(input.endpoints)
  if (endpointEntries.length === 0) {
    return {
      valid: true,
      endpointResults: {},
      errors: [],
      warnings: [],
      normalized: input,
    }
  }

  // Per-endpoint validation
  for (const [endpointId, endpointConfig] of endpointEntries) {
    const result = validate(endpointConfig)
    endpointResults[endpointId] = prefixFieldPaths(result, endpointId)
  }

  // Cross-endpoint checks
  const crossChecks = performCrossEndpointChecks(input)
  manifestErrors.push(...crossChecks.errors)
  manifestWarnings.push(...crossChecks.warnings)

  // Bazaar method discrimination checks
  for (const [endpointId, endpointConfig] of endpointEntries) {
    const bazaarIssues = validateBazaarMethodDiscrimination(endpointConfig, endpointId)
    manifestErrors.push(...bazaarIssues)
  }

  // Compute validity
  const allEndpointsValid = Object.values(endpointResults).every((r) => r.valid)
  const noManifestErrors = manifestErrors.length === 0
  const valid = allEndpointsValid && noManifestErrors

  return {
    valid,
    endpointResults,
    errors: manifestErrors,
    warnings: manifestWarnings,
    normalized: input,
  }
}

/**
 * Prefix all field paths in a ValidationResult with endpoint context
 * Transforms "accepts[0].payTo" → "endpoints["api-weather"].accepts[0].payTo"
 */
function prefixFieldPaths(result: ValidationResult, endpointId: string): ValidationResult {
  const prefix = `endpoints["${endpointId}"].`

  return {
    ...result,
    errors: result.errors.map((issue) => ({
      ...issue,
      field: issue.field === '$' ? `endpoints["${endpointId}"]` : prefix + issue.field,
    })),
    warnings: result.warnings.map((issue) => ({
      ...issue,
      field: issue.field === '$' ? `endpoints["${endpointId}"]` : prefix + issue.field,
    })),
  }
}

/**
 * Perform cross-endpoint consistency checks
 * Returns manifest-level errors and warnings
 */
function performCrossEndpointChecks(manifest: ManifestConfig): {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
} {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const endpoints = Object.values(manifest.endpoints)

  // Check 1: Duplicate endpoint URLs (warning per user decision)
  const urlCounts = new Map<string, number>()
  for (const endpoint of endpoints) {
    if (endpoint.resource?.url) {
      const url = endpoint.resource.url
      urlCounts.set(url, (urlCounts.get(url) || 0) + 1)
    }
  }

  for (const [url, count] of urlCounts.entries()) {
    if (count > 1) {
      warnings.push({
        code: ErrorCode.DUPLICATE_ENDPOINT_URL,
        field: 'endpoints',
        message: `${count} endpoints share the same URL: ${url}`,
        severity: 'warning',
        fix: 'Ensure each endpoint has a unique URL, or use different HTTP methods if intentional',
      })
    }
  }

  // Check 2: Mixed networks (mainnet + testnet) (warning per user decision)
  const allNetworks = new Set<string>()
  for (const endpoint of endpoints) {
    for (const acceptsEntry of endpoint.accepts || []) {
      if (acceptsEntry.network) {
        allNetworks.add(acceptsEntry.network)
      }
    }
  }

  let hasKnownMainnet = false
  let hasKnownTestnet = false

  for (const network of allNetworks) {
    const networkInfo = getNetworkInfo(network)
    if (networkInfo) {
      if (networkInfo.testnet) {
        hasKnownTestnet = true
      } else {
        hasKnownMainnet = true
      }
    }
  }

  if (hasKnownMainnet && hasKnownTestnet) {
    warnings.push({
      code: ErrorCode.MIXED_NETWORKS,
      field: 'endpoints',
      message: ErrorMessages.MIXED_NETWORKS,
      severity: 'warning',
      fix: 'Consider separating mainnet and testnet manifests for clarity and safety',
    })
  }

  // Check 3: Duplicate HTTP method + path in bazaar metadata (warning per user decision)
  const bazaarRoutes = new Map<string, number>()
  for (const endpoint of endpoints) {
    const bazaar = endpoint.extensions?.bazaar as Record<string, unknown> | undefined
    if (bazaar?.info) {
      const info = bazaar.info as Record<string, unknown>
      const input = info.input as Record<string, unknown> | undefined
      const method = input?.method as string | undefined
      const path = endpoint.resource?.url

      if (method && path) {
        const routeKey = `${method.toUpperCase()} ${path}`
        bazaarRoutes.set(routeKey, (bazaarRoutes.get(routeKey) || 0) + 1)
      }
    }
  }

  for (const [route, count] of bazaarRoutes.entries()) {
    if (count > 1) {
      warnings.push({
        code: ErrorCode.DUPLICATE_BAZAAR_ROUTE,
        field: 'extensions.bazaar',
        message: `${count} endpoints share the same HTTP method + path: ${route}`,
        severity: 'warning',
        fix: 'Ensure each bazaar endpoint has a unique method+path combination',
      })
    }
  }

  return { errors, warnings }
}

/**
 * Validate bazaar extension method discrimination
 * GET → must have queryParams input shape, no body
 * POST/PUT/PATCH/DELETE → must have body input shape, no queryParams
 *
 * Returns errors (strict validation per user decision)
 */
function validateBazaarMethodDiscrimination(
  endpoint: V2Config,
  endpointId: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const bazaar = endpoint.extensions?.bazaar as Record<string, unknown> | undefined
  if (!bazaar?.info) return issues // Bazaar is optional

  const info = bazaar.info as Record<string, unknown>
  const input = info.input as Record<string, unknown> | undefined
  if (!input) return issues

  const method = (input.method as string | undefined)?.toUpperCase()
  if (!method) return issues

  const fieldPrefix = `endpoints["${endpointId}"].extensions.bazaar.info.input`

  // GET requests must use queryParams shape
  if (method === 'GET') {
    if (input.body !== undefined) {
      issues.push({
        code: ErrorCode.BAZAAR_GET_WITH_BODY,
        field: `${fieldPrefix}.body`,
        message: ErrorMessages.BAZAAR_GET_WITH_BODY,
        severity: 'error',
        fix: 'Remove body field and use queryParams for GET requests, or change method to POST',
      })
    }
    if (input.queryParams === undefined) {
      issues.push({
        code: ErrorCode.BAZAAR_GET_MISSING_QUERY_PARAMS,
        field: `${fieldPrefix}.queryParams`,
        message: ErrorMessages.BAZAAR_GET_MISSING_QUERY_PARAMS,
        severity: 'error',
        fix: 'Add queryParams field with JSON Schema describing query parameters',
      })
    }
  }

  // POST/PUT/PATCH/DELETE requests must use body shape
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (input.queryParams !== undefined) {
      issues.push({
        code: ErrorCode.BAZAAR_POST_WITH_QUERY_PARAMS,
        field: `${fieldPrefix}.queryParams`,
        message: ErrorMessages.BAZAAR_POST_WITH_QUERY_PARAMS,
        severity: 'error',
        fix: `Remove queryParams field and use body for ${method} requests, or change method to GET`,
      })
    }
    if (input.body === undefined) {
      issues.push({
        code: ErrorCode.BAZAAR_POST_MISSING_BODY,
        field: `${fieldPrefix}.body`,
        message: ErrorMessages.BAZAAR_POST_MISSING_BODY,
        severity: 'error',
        fix: 'Add body field with JSON Schema describing request body',
      })
    }
  }

  return issues
}
