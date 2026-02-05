import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { check } from '../src/check'
import type { CheckResult } from '../src/types/check'
import type { ResponseLike } from '../src/extraction/extract'

/** Load a JSON fixture file */
function loadFixture(name: string): unknown {
  const path = resolve(__dirname, 'fixtures', name)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/** Wrap a config object as a ResponseLike body */
function asResponse(config: unknown): ResponseLike {
  return { body: config }
}

describe('check() — valid v2 config', () => {
  test('valid-v2-base.json: extracted, valid, version v2, summary populated', () => {
    const fixture = loadFixture('valid-v2-base.json')
    const result = check(asResponse(fixture))

    expect(result.extracted).toBe(true)
    expect(result.source).toBe('body')
    expect(result.extractionError).toBeNull()
    expect(result.valid).toBe(true)
    expect(result.version).toBe('v2')
    expect(result.errors).toHaveLength(0)
    expect(result.normalized).not.toBeNull()
    expect(result.raw).not.toBeNull()
    expect(result.summary).toHaveLength(1)
  })

  test('summary has registry-resolved network and asset info for Base', () => {
    const fixture = loadFixture('valid-v2-base.json')
    const result = check(asResponse(fixture))

    const s = result.summary[0]!
    expect(s.index).toBe(0)
    expect(s.network).toBe('eip155:8453')
    expect(s.networkName).toBe('Base')
    expect(s.networkType).toBe('evm')
    expect(s.assetSymbol).toBe('USDC')
    expect(s.assetDecimals).toBe(6)
    expect(s.scheme).toBe('exact')
    expect(s.payTo).toBeTruthy()
    expect(s.amount).toBe('1000000')
  })

  test('valid-v2-solana.json: Solana network and asset resolved', () => {
    const fixture = loadFixture('valid-v2-solana.json')
    const result = check(asResponse(fixture))

    expect(result.valid).toBe(true)
    expect(result.summary).toHaveLength(1)

    const s = result.summary[0]!
    expect(s.networkName).toBe('Solana Mainnet')
    expect(s.networkType).toBe('solana')
    expect(s.assetSymbol).toBe('USDC')
    expect(s.assetDecimals).toBe(6)
  })
})

describe('check() — valid v1 config', () => {
  test('valid-v1.json: extracted, valid, version v1, normalized to v2', () => {
    const fixture = loadFixture('valid-v1.json')
    const result = check(asResponse(fixture))

    expect(result.extracted).toBe(true)
    expect(result.valid).toBe(true)
    expect(result.version).toBe('v1')
    expect(result.normalized!.x402Version).toBe(2)
    expect(result.summary).toHaveLength(1)
  })

  test('v1 config produces legacy format warning', () => {
    const fixture = loadFixture('valid-v1.json')
    const result = check(asResponse(fixture))

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some((w) => w.code === 'LEGACY_FORMAT')).toBe(true)
  })

  test('v1 summary has correct amount (mapped from maxAmountRequired)', () => {
    const fixture = loadFixture('valid-v1.json')
    const result = check(asResponse(fixture))

    expect(result.summary[0]!.amount).toBe('500000')
  })
})

describe('check() — invalid config', () => {
  test('config with no accepts: extracted but invalid', () => {
    const result = check(asResponse({ x402Version: 2, resource: { url: 'https://example.com' } }))

    expect(result.extracted).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.summary).toHaveLength(0)
  })

  test('config with bad network format: errors include INVALID_NETWORK_FORMAT', () => {
    const result = check(
      asResponse({
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'base',
            amount: '1000000',
            asset: '0xabc',
            payTo: '0xdef',
            maxTimeoutSeconds: 60,
          },
        ],
        resource: { url: 'https://example.com' },
      }),
    )

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_NETWORK_FORMAT')).toBe(true)
  })

  test('empty object: extracted but unknown format', () => {
    const result = check(asResponse({}))

    // Empty object has no x402 fields, so extraction finds nothing
    // Actually, hasX402Fields checks for accepts/payTo/x402Version - {} has none
    expect(result.extracted).toBe(false)
  })

  test('config with invalid amount: errors include INVALID_AMOUNT', () => {
    const result = check(
      asResponse({
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: 'not-a-number',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
        resource: { url: 'https://example.com' },
      }),
    )

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_AMOUNT')).toBe(true)
    // Summary is still built from normalized config even when invalid
    expect(result.summary.length).toBeGreaterThan(0)
  })
})

describe('check() — extraction failure', () => {
  test('empty response: not extracted', () => {
    const result = check({})

    expect(result.extracted).toBe(false)
    expect(result.source).toBeNull()
    expect(result.extractionError).toBeTruthy()
    expect(result.valid).toBe(false)
    expect(result.version).toBe('unknown')
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.normalized).toBeNull()
    expect(result.summary).toHaveLength(0)
    expect(result.raw).toBeNull()
  })

  test('response with non-x402 body: not extracted', () => {
    const result = check({ body: { hello: 'world' } })

    expect(result.extracted).toBe(false)
    expect(result.extractionError).toBeTruthy()
  })

  test('response with config in header: extracted from header', () => {
    const config = {
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
          maxTimeoutSeconds: 60,
        },
      ],
      resource: { url: 'https://example.com' },
    }
    const encoded = Buffer.from(JSON.stringify(config)).toString('base64')
    const result = check({ headers: { 'payment-required': encoded } })

    expect(result.extracted).toBe(true)
    expect(result.source).toBe('header')
    expect(result.valid).toBe(true)
  })
})

describe('check() — strict mode', () => {
  test('warnings promoted to errors in strict mode', () => {
    // This config is valid but has warnings (unknown asset, missing timeout)
    const config = {
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x0000000000000000000000000000000000000001',
          payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        },
      ],
    }

    const normal = check(asResponse(config))
    expect(normal.valid).toBe(true)
    expect(normal.warnings.length).toBeGreaterThan(0)

    const strict = check(asResponse(config), { strict: true })
    expect(strict.valid).toBe(false)
    expect(strict.errors.length).toBeGreaterThan(0)
    expect(strict.warnings).toHaveLength(0)
  })
})

describe('check() — registry lookups in summary', () => {
  test('unknown network: networkName falls back to raw CAIP-2, networkType is null', () => {
    const result = check(
      asResponse({
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:999999',
            amount: '1000000',
            asset: '0x0000000000000000000000000000000000000001',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
        resource: { url: 'https://example.com' },
      }),
    )

    // Valid config (unknown network is a warning, not an error)
    expect(result.summary).toHaveLength(1)
    const s = result.summary[0]!
    expect(s.networkName).toBe('eip155:999999')
    expect(s.networkType).toBeNull()
  })

  test('unknown asset: assetSymbol and assetDecimals are null', () => {
    const result = check(
      asResponse({
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x0000000000000000000000000000000000000001',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
        resource: { url: 'https://example.com' },
      }),
    )

    const s = result.summary[0]!
    expect(s.assetSymbol).toBeNull()
    expect(s.assetDecimals).toBeNull()
  })

  test('known asset on Base: USDC resolved with 6 decimals', () => {
    const result = check(
      asResponse({
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
        resource: { url: 'https://example.com' },
      }),
    )

    const s = result.summary[0]!
    expect(s.assetSymbol).toBe('USDC')
    expect(s.assetDecimals).toBe(6)
  })
})

describe('check() — return type contract', () => {
  test('always returns all fields, never undefined', () => {
    const inputs: ResponseLike[] = [
      {},
      { body: 'not json' },
      { body: { x402Version: 2, accepts: [] } },
      asResponse(loadFixture('valid-v2-base.json')),
    ]

    for (const input of inputs) {
      const result: CheckResult = check(input)
      expect(typeof result.extracted).toBe('boolean')
      expect(typeof result.valid).toBe('boolean')
      expect(typeof result.version).toBe('string')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(Array.isArray(result.summary)).toBe(true)
      expect('source' in result).toBe(true)
      expect('extractionError' in result).toBe(true)
      expect('normalized' in result).toBe(true)
      expect('raw' in result).toBe(true)
    }
  })
})
