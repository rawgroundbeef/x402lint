/**
 * Config normalization pipeline
 * API-03: Transform any config format to canonical v2 shape
 */

import type {
  NormalizedConfig,
  AcceptsEntry,
  ConfigFormat,
  V2Config,
  V1Config,
  FlatLegacyConfig,
} from '../types'
import { parseInput } from '../types'
import { detect } from './detect'
import { getCanonicalNetwork } from '../registries'
import { isRecord } from './guards'

/**
 * Normalize any x402 config format to canonical v2 shape
 *
 * @param input - JSON string or parsed object
 * @returns NormalizedConfig or null if format is unknown/invalid
 *
 * Normalization rules:
 * - v2: Pass through with new object (FMT-07)
 * - v1: Map maxAmountRequired → amount, lift per-entry resource (FMT-06)
 * - flat-legacy: Wrap in accepts array, map simple names to CAIP-2 (FMT-05)
 * - unknown: Return null
 *
 * All transformations preserve extensions and extra fields (FMT-08)
 */
export function normalize(input: string | object): NormalizedConfig | null {
  const { parsed, error } = parseInput(input)
  if (error) return null

  const format = detect(parsed as object)

  switch (format) {
    case 'v2':
      return normalizeV2(parsed as V2Config)
    case 'v1':
      return normalizeV1ToV2(parsed as V1Config)
    case 'flat-legacy':
      return normalizeFlatToV2(parsed as FlatLegacyConfig)
    case 'unknown':
      return null
    default: {
      const _exhaustive: never = format
      return _exhaustive
    }
  }
}

/**
 * Normalize v2 config (pass-through with new object)
 * FMT-07: v2 configs are already canonical, just create new object
 */
function normalizeV2(config: V2Config): NormalizedConfig {
  const result: NormalizedConfig = {
    x402Version: 2,
    accepts: [...config.accepts],
    resource: config.resource,
  }

  if (config.error !== undefined) {
    result.error = config.error
  }

  if (config.extensions !== undefined) {
    result.extensions = config.extensions
  }

  return result
}

/**
 * Normalize v1 config to v2
 * FMT-06: Map maxAmountRequired → amount, lift per-entry resource to top level
 */
function normalizeV1ToV2(config: V1Config): NormalizedConfig {
  let topLevelResource: NormalizedConfig['resource'] = undefined

  const mappedAccepts: AcceptsEntry[] = config.accepts.map((entry) => {
    // Lift first resource to top level
    if (entry.resource && !topLevelResource) {
      topLevelResource = entry.resource
    }

    const mapped: AcceptsEntry = {
      scheme: entry.scheme,
      network: entry.network,
      amount: entry.maxAmountRequired,
      asset: entry.asset,
      payTo: entry.payTo,
    }

    if (entry.maxTimeoutSeconds !== undefined) {
      mapped.maxTimeoutSeconds = entry.maxTimeoutSeconds
    }

    if (entry.extra !== undefined) {
      mapped.extra = entry.extra
    }

    return mapped
  })

  const result: NormalizedConfig = {
    x402Version: 2,
    accepts: mappedAccepts,
  }

  if (topLevelResource !== undefined) {
    result.resource = topLevelResource
  }

  if (config.error !== undefined) {
    result.error = config.error
  }

  if (config.extensions !== undefined) {
    result.extensions = config.extensions
  }

  return result
}

/**
 * Normalize flat-legacy config to v2
 * FMT-05: Wrap in accepts array, map simple names to CAIP-2, set scheme: 'exact'
 */
function normalizeFlatToV2(config: FlatLegacyConfig): NormalizedConfig {
  let accepts: AcceptsEntry[]

  if (config.payments && Array.isArray(config.payments)) {
    // Handle payments array variant
    accepts = config.payments.map((payment) => {
      if (!isRecord(payment)) {
        // Fallback for invalid payment entry
        return {
          scheme: 'exact',
          network: '',
          amount: '',
          asset: '',
          payTo: '',
        }
      }

      const recipient = (payment.payTo ?? payment.address ?? '') as string
      const amount = (payment.amount ?? payment.minAmount ?? '') as string
      const rawNetwork = (payment.network ?? payment.chain ?? '') as string
      const asset = (payment.currency ?? payment.asset ?? '') as string

      // Try to map simple name to CAIP-2
      const network = getCanonicalNetwork(rawNetwork) ?? rawNetwork

      const entry: AcceptsEntry = {
        scheme: 'exact',
        network,
        amount,
        asset,
        payTo: recipient,
      }

      if (payment.maxTimeoutSeconds !== undefined) {
        entry.maxTimeoutSeconds = payment.maxTimeoutSeconds as number
      }

      if (payment.extra !== undefined) {
        entry.extra = payment.extra as Record<string, unknown>
      }

      return entry
    })
  } else {
    // Single payment variant
    const recipient = config.payTo ?? config.address ?? ''
    const amount = config.amount ?? config.minAmount ?? ''
    const rawNetwork = config.network ?? config.chain ?? ''
    const asset = config.currency ?? config.asset ?? ''

    // Try to map simple name to CAIP-2
    const network = getCanonicalNetwork(rawNetwork) ?? rawNetwork

    const entry: AcceptsEntry = {
      scheme: 'exact',
      network,
      amount,
      asset,
      payTo: recipient,
    }

    if (config.maxTimeoutSeconds !== undefined) {
      entry.maxTimeoutSeconds = config.maxTimeoutSeconds
    }

    if (config.extra !== undefined) {
      entry.extra = config.extra
    }

    accepts = [entry]
  }

  const result: NormalizedConfig = {
    x402Version: 2,
    accepts,
  }

  // flat-legacy has no resource concept, omit it

  if (config.extensions !== undefined) {
    result.extensions = config.extensions
  }

  return result
}
