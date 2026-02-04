import { describe, it, expect } from 'vitest'
import { validateManifest } from '../src/index'
import type { ManifestConfig, V2Config } from '../src/index'
import { ErrorCode } from '../src/types/errors'

/**
 * Helper to build a valid V2Config endpoint for reuse across tests
 */
function makeEndpoint(overrides?: Partial<V2Config>): V2Config {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '100',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 60,
      },
    ],
    resource: { url: 'https://example.com/api' },
    ...overrides,
  }
}

/**
 * Helper to build a ManifestConfig
 */
function makeManifest(endpoints: Record<string, V2Config>, extras?: Partial<ManifestConfig>): ManifestConfig {
  return { endpoints, ...extras }
}

describe('validateManifest', () => {
  describe('basic validation', () => {
    it('single valid endpoint returns valid:true with 1 endpointResult entry', () => {
      const manifest = makeManifest({
        'weather-api': makeEndpoint(),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(Object.keys(result.endpointResults)).toHaveLength(1)
      expect(result.endpointResults['weather-api']).toBeDefined()
      expect(result.endpointResults['weather-api']!.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('multiple valid endpoints returns valid:true with correct endpointResults count', () => {
      const manifest = makeManifest({
        'weather-api': makeEndpoint({ resource: { url: 'https://example.com/weather' } }),
        'data-api': makeEndpoint({ resource: { url: 'https://example.com/data' } }),
        'sports-api': makeEndpoint({ resource: { url: 'https://example.com/sports' } }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(Object.keys(result.endpointResults)).toHaveLength(3)
      expect(result.endpointResults['weather-api']!.valid).toBe(true)
      expect(result.endpointResults['data-api']!.valid).toBe(true)
      expect(result.endpointResults['sports-api']!.valid).toBe(true)
    })

    it('empty endpoints ({}) returns valid:true with empty endpointResults and no errors/warnings', () => {
      const manifest = makeManifest({})

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.endpointResults).toEqual({})
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('result includes normalized field equal to input manifest', () => {
      const manifest = makeManifest({
        'api': makeEndpoint(),
      })

      const result = validateManifest(manifest)

      expect(result.normalized).toEqual(manifest)
    })

    it('result has correct structure (valid, errors, warnings, endpointResults, normalized)', () => {
      const manifest = makeManifest({
        'api': makeEndpoint(),
      })

      const result = validateManifest(manifest)

      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('endpointResults')
      expect(result).toHaveProperty('normalized')
      expect(typeof result.valid).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(typeof result.endpointResults).toBe('object')
    })

    it('manifest with service metadata validates normally', () => {
      const manifest = makeManifest(
        {
          'api': makeEndpoint(),
        },
        {
          service: {
            name: 'Test Service',
            description: 'Test Description',
            version: '1.0.0',
          },
        }
      )

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.normalized.service).toEqual({
        name: 'Test Service',
        description: 'Test Description',
        version: '1.0.0',
      })
    })
  })

  describe('per-endpoint validation', () => {
    it('invalid endpoint (missing required fields) returns valid:false', () => {
      const manifest = makeManifest({
        'bad-api': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://example.com' },
        } as V2Config,
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.endpointResults['bad-api']!.valid).toBe(false)
    })

    it('error field paths are prefixed with endpoints["endpointId"].', () => {
      const manifest = makeManifest({
        'weather-api': {
          x402Version: 2,
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453',
              amount: '', // missing amount triggers MISSING_AMOUNT
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
          resource: { url: 'https://example.com' },
        } as V2Config,
      })

      const result = validateManifest(manifest)

      const endpointResult = result.endpointResults['weather-api']!
      const amountError = endpointResult.errors.find((e) => e.code === ErrorCode.MISSING_AMOUNT)
      expect(amountError).toBeDefined()
      expect(amountError!.field).toBe('endpoints["weather-api"].accepts[0].amount')
    })

    it('root-level field path ($) is transformed to endpoints["endpointId"]', () => {
      const manifest = makeManifest({
        'api': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://example.com' },
        } as V2Config,
      })

      const result = validateManifest(manifest)

      const endpointResult = result.endpointResults['api']!
      const emptyAcceptsError = endpointResult.errors.find((e) => e.code === ErrorCode.EMPTY_ACCEPTS)
      expect(emptyAcceptsError).toBeDefined()
      // EMPTY_ACCEPTS has field 'accepts', so it becomes endpoints["api"].accepts
      expect(emptyAcceptsError!.field).toContain('endpoints["api"]')
    })

    it('multiple endpoints where one fails: valid:false, failing endpoint has errors, passing endpoint is valid', () => {
      const manifest = makeManifest({
        'good-api': makeEndpoint(),
        'bad-api': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://example.com' },
        } as V2Config,
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.endpointResults['good-api']!.valid).toBe(true)
      expect(result.endpointResults['bad-api']!.valid).toBe(false)
      expect(result.endpointResults['bad-api']!.errors.length).toBeGreaterThan(0)
    })

    it('per-endpoint warnings are preserved with correct field path prefix', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:999999', // unknown network
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
      })

      const result = validateManifest(manifest)

      const endpointResult = result.endpointResults['api']!
      const unknownNetworkWarning = endpointResult.warnings.find((w) => w.code === ErrorCode.UNKNOWN_NETWORK)
      expect(unknownNetworkWarning).toBeDefined()
      expect(unknownNetworkWarning!.field).toBe('endpoints["api"].accepts[0].network')
    })

    it('endpoint ID with special characters uses bracket notation correctly', () => {
      const manifest = makeManifest({
        'api.v2.weather': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453',
              amount: '', // missing amount
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
      })

      const result = validateManifest(manifest)

      const endpointResult = result.endpointResults['api.v2.weather']!
      const amountError = endpointResult.errors.find((e) => e.code === ErrorCode.MISSING_AMOUNT)
      expect(amountError).toBeDefined()
      expect(amountError!.field).toBe('endpoints["api.v2.weather"].accepts[0].amount')
    })
  })

  describe('cross-endpoint checks', () => {
    it('duplicate resource URLs produce DUPLICATE_ENDPOINT_URL warning', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
        'api-2': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true) // warnings don't affect valid flag
      expect(result.warnings.some((w) => w.code === ErrorCode.DUPLICATE_ENDPOINT_URL)).toBe(true)
      const warning = result.warnings.find((w) => w.code === ErrorCode.DUPLICATE_ENDPOINT_URL)
      expect(warning!.message).toContain('2 endpoints')
      expect(warning!.message).toContain('https://example.com/api')
    })

    it('non-duplicate URLs produce no DUPLICATE_ENDPOINT_URL warning', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({ resource: { url: 'https://example.com/api1' } }),
        'api-2': makeEndpoint({ resource: { url: 'https://example.com/api2' } }),
      })

      const result = validateManifest(manifest)

      expect(result.warnings.some((w) => w.code === ErrorCode.DUPLICATE_ENDPOINT_URL)).toBe(false)
    })

    it('mixed networks (mainnet eip155:8453 + testnet eip155:84532) produce MIXED_NETWORKS warning', () => {
      const manifest = makeManifest({
        'mainnet-api': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453', // Base mainnet
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
        'testnet-api': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:84532', // Base testnet
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true) // warnings don't affect valid flag
      expect(result.warnings.some((w) => w.code === ErrorCode.MIXED_NETWORKS)).toBe(true)
    })

    it('same network across endpoints produces no MIXED_NETWORKS warning', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453',
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
        'api-2': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453',
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
      })

      const result = validateManifest(manifest)

      expect(result.warnings.some((w) => w.code === ErrorCode.MIXED_NETWORKS)).toBe(false)
    })

    it('unknown networks (not in registry) do NOT trigger MIXED_NETWORKS', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:999999', // unknown network
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
        'api-2': makeEndpoint({
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:888888', // another unknown network
              amount: '100',
              asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
              maxTimeoutSeconds: 60,
            },
          ],
        }),
      })

      const result = validateManifest(manifest)

      expect(result.warnings.some((w) => w.code === ErrorCode.MIXED_NETWORKS)).toBe(false)
    })

    it('duplicate bazaar routes (same method+URL) produce DUPLICATE_BAZAAR_ROUTE warning', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({
          resource: { url: 'https://example.com/api' },
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
        'api-2': makeEndpoint({
          resource: { url: 'https://example.com/api' },
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true) // warnings don't affect valid flag
      expect(result.warnings.some((w) => w.code === ErrorCode.DUPLICATE_BAZAAR_ROUTE)).toBe(true)
      const warning = result.warnings.find((w) => w.code === ErrorCode.DUPLICATE_BAZAAR_ROUTE)
      expect(warning!.message).toContain('GET https://example.com/api')
    })

    it('cross-endpoint warnings do NOT affect valid flag (valid:true despite warnings)', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
        'api-2': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('bazaar method discrimination', () => {
    it('GET endpoint with body input shape produces BAZAAR_GET_WITH_BODY error', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET', body: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_WITH_BODY)).toBe(true)
    })

    it('GET endpoint without queryParams produces BAZAAR_GET_MISSING_QUERY_PARAMS error', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET' },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_MISSING_QUERY_PARAMS)).toBe(true)
    })

    it('GET endpoint with queryParams and no body produces no bazaar errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_WITH_BODY)).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_MISSING_QUERY_PARAMS)).toBe(false)
    })

    it('POST endpoint with queryParams input shape produces BAZAAR_POST_WITH_QUERY_PARAMS error', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'POST', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_WITH_QUERY_PARAMS)).toBe(true)
    })

    it('POST endpoint without body produces BAZAAR_POST_MISSING_BODY error', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'POST' },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_MISSING_BODY)).toBe(true)
    })

    it('POST endpoint with body and no queryParams produces no bazaar errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'POST', body: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_WITH_QUERY_PARAMS)).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_MISSING_BODY)).toBe(false)
    })

    it('PUT endpoint with queryParams produces BAZAAR_POST_WITH_QUERY_PARAMS error', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'PUT', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_WITH_QUERY_PARAMS)).toBe(true)
    })

    it('PATCH endpoint with body and no queryParams produces no bazaar errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'PATCH', body: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('DELETE endpoint with body and no queryParams produces no bazaar errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'DELETE', body: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('endpoint without bazaar extension produces no bazaar errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint(),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.errors.some((e) => e.code.startsWith('BAZAAR_'))).toBe(false)
    })

    it('bazaar errors make valid:false (they are errors, not warnings)', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET', body: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('single endpoint with all warnings but no errors returns valid:true', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
        'api-2': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('large manifest (10+ endpoints, all valid) returns valid:true with correct endpointResults count', () => {
      const endpoints: Record<string, V2Config> = {}
      for (let i = 0; i < 15; i++) {
        endpoints[`api-${i}`] = makeEndpoint({ resource: { url: `https://example.com/api${i}` } })
      }
      const manifest = makeManifest(endpoints)

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(Object.keys(result.endpointResults)).toHaveLength(15)
      for (let i = 0; i < 15; i++) {
        expect(result.endpointResults[`api-${i}`]!.valid).toBe(true)
      }
    })

    it('GET with both body and missing queryParams produces both errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'GET', body: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_WITH_BODY)).toBe(true)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_MISSING_QUERY_PARAMS)).toBe(true)
    })

    it('POST with both queryParams and missing body produces both errors', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'POST', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_WITH_QUERY_PARAMS)).toBe(true)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_POST_MISSING_BODY)).toBe(true)
    })

    it('multiple endpoints with 3+ duplicate URLs produces single warning with count', () => {
      const manifest = makeManifest({
        'api-1': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
        'api-2': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
        'api-3': makeEndpoint({ resource: { url: 'https://example.com/api' } }),
      })

      const result = validateManifest(manifest)

      const duplicateWarning = result.warnings.find((w) => w.code === ErrorCode.DUPLICATE_ENDPOINT_URL)
      expect(duplicateWarning).toBeDefined()
      expect(duplicateWarning!.message).toContain('3 endpoints')
    })

    it('case-insensitive HTTP method (get/GET) works identically', () => {
      const manifest = makeManifest({
        'api': makeEndpoint({
          extensions: {
            bazaar: {
              info: {
                input: { type: 'application/json', method: 'get', queryParams: { type: 'object' } },
                output: { type: 'application/json' },
              },
              schema: { type: 'object', properties: {} },
            },
          },
        }),
      })

      const result = validateManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.errors.some((e) => e.code === ErrorCode.BAZAAR_GET_WITH_BODY)).toBe(false)
    })
  })
})
