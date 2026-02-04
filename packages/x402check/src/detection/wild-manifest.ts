/**
 * Wild manifest normalization
 * Transforms non-standard manifest formats into canonical ManifestConfig shape
 */

import type { ManifestConfig, V2Config, ValidationIssue } from '../types'
import { isRecord } from './guards'
import { ErrorCode, ErrorMessages } from '../types/errors'

/**
 * Result of wild manifest normalization
 */
export interface WildManifestResult {
  manifest: ManifestConfig
  warnings: ValidationIssue[]
}

/**
 * Generate a stable endpoint ID from config
 *
 * @param config - Config object (potentially wild, not strictly V2Config)
 * @param index - Array index for fallback ID
 * @param existingIds - Set of already-generated IDs to avoid collisions
 * @returns Stable endpoint ID (added to existingIds)
 */
export function generateStableEndpointId(
  config: Record<string, unknown>,
  index: number,
  existingIds: Set<string>
): string {
  let baseId = `endpoint-${index}`

  // Try to extract URL path for more meaningful ID
  if (isRecord(config.resource)) {
    const url = config.resource.url
    if (typeof url === 'string') {
      try {
        const parsed = new URL(url)
        const pathname = parsed.pathname
          .replace(/^\/+|\/+$/g, '') // Strip leading/trailing slashes
          .replace(/[^a-z0-9]+/gi, '-') // Replace non-alphanumeric with dash
          .toLowerCase()

        if (pathname.length > 0) {
          baseId = pathname
        }
      } catch {
        // Invalid URL, fall back to index-based ID
      }
    }
  }

  // Handle collisions by appending -2, -3, etc.
  let finalId = baseId
  let collision = 2
  while (existingIds.has(finalId)) {
    finalId = `${baseId}-${collision}`
    collision++
  }

  existingIds.add(finalId)
  return finalId
}

/**
 * Check if a value contains an accepts array (depth 1)
 */
function hasAcceptsAtDepth1(value: unknown): boolean {
  return isRecord(value) && 'accepts' in value && Array.isArray(value.accepts)
}

/**
 * Normalize a wild (non-standard) manifest to canonical ManifestConfig
 *
 * @param input - Unknown input that might be a wild manifest
 * @returns WildManifestResult with normalized manifest and warnings, or null if not recognizable
 *
 * Detection patterns:
 * 1. Array-style: { paymentEndpoints: [...], payments: [...], configs: [...], endpoints: [...] }
 * 2. Nested-service-style: { service1: {accepts: [...]}, groupKey: { endpoint1: {accepts: [...]}, endpoint2: {...} } }
 *
 * CRITICAL: Never modifies financial data (amount, payTo, network, asset) - copies exactly as-is
 */
export function normalizeWildManifest(input: unknown): WildManifestResult | null {
  if (!isRecord(input)) return null

  // If already canonical (has endpoints Record), don't normalize
  if ('endpoints' in input && isRecord(input.endpoints)) return null

  const manifest: ManifestConfig = { endpoints: {} }
  const warnings: ValidationIssue[] = []
  const existingIds = new Set<string>()
  let foundEndpoints = false

  // Pattern 1: Array-style manifests
  const arrayFields = ['paymentEndpoints', 'payments', 'configs', 'endpoints']
  for (const fieldName of arrayFields) {
    if (fieldName in input && Array.isArray(input[fieldName])) {
      const arr = input[fieldName] as unknown[]
      arr.forEach((item, index) => {
        if (isRecord(item)) {
          const id = generateStableEndpointId(item, index, existingIds)
          manifest.endpoints[id] = item as unknown as V2Config
          foundEndpoints = true
        }
      })

      if (foundEndpoints) {
        warnings.push({
          code: ErrorCode.WILD_MANIFEST_ARRAY_FORMAT,
          message: ErrorMessages.WILD_MANIFEST_ARRAY_FORMAT,
          severity: 'warning',
          field: fieldName,
        })
        break // Only process first matching array field
      }
    }
  }

  // Pattern 2: Nested-service-style manifests
  if (!foundEndpoints) {
    // Check for nested structure with accepts arrays
    const potentialGroups: Array<{ key: string; value: Record<string, unknown> }> = []

    for (const key in input) {
      const value = input[key]
      if (isRecord(value)) {
        potentialGroups.push({ key, value })
      }
    }

    // Check depth-1: direct accepts arrays
    for (const { key, value } of potentialGroups) {
      if (hasAcceptsAtDepth1(value)) {
        manifest.endpoints[key] = value as unknown as V2Config
        foundEndpoints = true
      }
    }

    // Check depth-2: nested within grouping keys
    if (!foundEndpoints) {
      for (const { key: groupKey, value: groupValue } of potentialGroups) {
        for (const nestedKey in groupValue) {
          const nestedValue = groupValue[nestedKey]
          if (hasAcceptsAtDepth1(nestedValue)) {
            const id = `${groupKey}-${nestedKey}`
            manifest.endpoints[id] = nestedValue as unknown as V2Config
            foundEndpoints = true
          }
        }
      }
    }

    if (foundEndpoints) {
      warnings.push({
        code: ErrorCode.WILD_MANIFEST_NESTED_FORMAT,
        field: 'endpoints',
        message: ErrorMessages.WILD_MANIFEST_NESTED_FORMAT,
        severity: 'warning',
      })
    }
  }

  // If no endpoints found via any pattern, can't normalize
  if (!foundEndpoints) return null

  // Extract service metadata
  if ('service' in input && isRecord(input.service)) {
    const service = input.service
    manifest.service = {}

    if ('name' in service && typeof service.name === 'string') {
      manifest.service.name = service.name
    }
    if ('description' in service && typeof service.description === 'string') {
      manifest.service.description = service.description
    }
    if ('version' in service && typeof service.version === 'string') {
      manifest.service.version = service.version
    }
    if ('url' in service && typeof service.url === 'string') {
      manifest.service.url = service.url
    }
    if ('contact' in service && isRecord(service.contact)) {
      manifest.service.contact = {}
      const contact = service.contact
      if ('name' in contact && typeof contact.name === 'string') {
        manifest.service.contact.name = contact.name
      }
      if ('email' in contact && typeof contact.email === 'string') {
        manifest.service.contact.email = contact.email
      }
      if ('url' in contact && typeof contact.url === 'string') {
        manifest.service.contact.url = contact.url
      }
    }
  }

  // Promote top-level metadata to service (only if not already in service object)
  let promotedName = false
  if ('name' in input && typeof input.name === 'string') {
    if (!manifest.service) manifest.service = {}
    if (!manifest.service.name) {
      manifest.service.name = input.name
      promotedName = true
    }
  }
  if ('description' in input && typeof input.description === 'string') {
    if (!manifest.service) manifest.service = {}
    if (!manifest.service.description) {
      manifest.service.description = input.description
    }
  }
  if ('version' in input && typeof input.version === 'string') {
    if (!manifest.service) manifest.service = {}
    if (!manifest.service.version) {
      manifest.service.version = input.version
    }
  }

  if (promotedName) {
    warnings.push({
      code: ErrorCode.WILD_MANIFEST_NAME_PROMOTED,
      field: 'service.name',
      message: ErrorMessages.WILD_MANIFEST_NAME_PROMOTED,
      severity: 'warning',
    })
  }

  // Preserve extensions
  if ('extensions' in input && isRecord(input.extensions)) {
    manifest.extensions = input.extensions
  }

  return { manifest, warnings }
}
