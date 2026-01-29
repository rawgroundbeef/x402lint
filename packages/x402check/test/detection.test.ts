import { describe, it, expect } from 'vitest'
import { detect, normalize } from '../src/index'
import type { NormalizedConfig } from '../src/index'

// ---- detect() tests ----

describe('detect', () => {
  describe('v2 format', () => {
    it('detects v2 config with accepts + x402Version:2 + resource', () => {
      expect(
        detect({
          x402Version: 2,
          accepts: [
            { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
          ],
          resource: { url: 'https://example.com/api' },
        })
      ).toBe('v2')
    })

    it('detects v2 even without resource (resource absence is validation error, not detection)', () => {
      expect(
        detect({
          x402Version: 2,
          accepts: [
            { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
          ],
        })
      ).toBe('v2')
    })

    it('detects v2 from JSON string', () => {
      const json = JSON.stringify({
        x402Version: 2,
        accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' }],
        resource: { url: 'https://example.com' },
      })
      expect(detect(json)).toBe('v2')
    })
  })

  describe('v1 format', () => {
    it('detects v1 config with accepts + x402Version:1', () => {
      expect(
        detect({
          x402Version: 1,
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453',
              maxAmountRequired: '100',
              asset: '0xabc',
              payTo: '0xdef',
            },
          ],
        })
      ).toBe('v1')
    })
  })

  describe('flat-legacy format', () => {
    it('detects flat config with payTo + amount + network', () => {
      expect(
        detect({
          payTo: '0xabc',
          amount: '100',
          network: 'base',
        })
      ).toBe('flat-legacy')
    })

    it('detects flat config with address + minAmount + chain', () => {
      expect(
        detect({
          address: '0xabc',
          minAmount: '100',
          chain: 'base',
        })
      ).toBe('flat-legacy')
    })

    it('detects flat config with payments array', () => {
      expect(
        detect({
          payments: [{ address: '0xabc', amount: '100', chain: 'base' }],
        })
      ).toBe('flat-legacy')
    })
  })

  describe('unknown format', () => {
    it('returns unknown for empty object', () => {
      expect(detect({})).toBe('unknown')
    })

    it('returns unknown for invalid JSON string', () => {
      expect(detect('not json')).toBe('unknown')
    })

    it('returns unknown for array', () => {
      expect(detect('[]')).toBe('unknown')
    })

    it('returns unknown for null-ish JSON', () => {
      expect(detect('null')).toBe('unknown')
    })

    it('returns unknown for number', () => {
      expect(detect('42')).toBe('unknown')
    })
  })
})

// ---- normalize() tests ----

describe('normalize', () => {
  describe('v2 pass-through', () => {
    it('passes v2 config through with new object', () => {
      const input = {
        x402Version: 2 as const,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '100',
            asset: '0xabc',
            payTo: '0xdef',
            maxTimeoutSeconds: 30,
          },
        ],
        resource: { url: 'https://example.com/api' },
        extensions: { custom: true },
      }
      const result = normalize(input)
      expect(result).not.toBeNull()
      expect(result!.x402Version).toBe(2)
      expect(result!.accepts).toHaveLength(1)
      expect(result!.accepts[0]!.amount).toBe('100')
      expect(result!.resource).toEqual({ url: 'https://example.com/api' })
      expect(result!.extensions).toEqual({ custom: true })
      // Should be a new object, not same reference
      expect(result).not.toBe(input)
    })
  })

  describe('v1 to v2', () => {
    it('maps maxAmountRequired to amount', () => {
      const result = normalize({
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            maxAmountRequired: '500',
            asset: '0xabc',
            payTo: '0xdef',
            resource: { url: 'https://example.com' },
          },
        ],
      })
      expect(result).not.toBeNull()
      expect(result!.x402Version).toBe(2)
      expect(result!.accepts[0]!.amount).toBe('500')
      expect(result!.accepts[0]).not.toHaveProperty('maxAmountRequired')
    })

    it('lifts per-entry resource to top level', () => {
      const result = normalize({
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            maxAmountRequired: '500',
            asset: '0xabc',
            payTo: '0xdef',
            resource: { url: 'https://example.com' },
          },
        ],
      })
      expect(result!.resource).toEqual({ url: 'https://example.com' })
    })

    it('preserves extensions', () => {
      const result = normalize({
        x402Version: 1,
        accepts: [
          { scheme: 'exact', network: 'eip155:8453', maxAmountRequired: '100', asset: '0xabc', payTo: '0xdef' },
        ],
        extensions: { facilitator: 'custom' },
      })
      expect(result!.extensions).toEqual({ facilitator: 'custom' })
    })
  })

  describe('flat-legacy to v2', () => {
    it('wraps flat config in accepts array with scheme:exact', () => {
      const result = normalize({
        payTo: '0xdef',
        amount: '100',
        network: 'eip155:8453',
        asset: '0xabc',
      })
      expect(result).not.toBeNull()
      expect(result!.x402Version).toBe(2)
      expect(result!.accepts).toHaveLength(1)
      expect(result!.accepts[0]!.scheme).toBe('exact')
      expect(result!.accepts[0]!.payTo).toBe('0xdef')
      expect(result!.accepts[0]!.amount).toBe('100')
      expect(result!.accepts[0]!.network).toBe('eip155:8453')
    })

    it('maps simple chain name to CAIP-2', () => {
      const result = normalize({
        payTo: '0xdef',
        amount: '100',
        network: 'base',
        asset: '0xabc',
      })
      expect(result!.accepts[0]!.network).toBe('eip155:8453')
    })

    it('maps legacy field names (address, minAmount, chain, currency)', () => {
      const result = normalize({
        address: '0xdef',
        minAmount: '200',
        chain: 'base',
        currency: '0xabc',
      })
      expect(result!.accepts[0]!.payTo).toBe('0xdef')
      expect(result!.accepts[0]!.amount).toBe('200')
      expect(result!.accepts[0]!.network).toBe('eip155:8453')
      expect(result!.accepts[0]!.asset).toBe('0xabc')
    })

    it('preserves extra and extensions', () => {
      const result = normalize({
        payTo: '0xdef',
        amount: '100',
        network: 'eip155:8453',
        asset: '0xabc',
        extra: { domain: 'test.com' },
        extensions: { custom: true },
      })
      expect(result!.accepts[0]!.extra).toEqual({ domain: 'test.com' })
      expect(result!.extensions).toEqual({ custom: true })
    })

    it('keeps unrecognized network as-is (validation catches it later)', () => {
      const result = normalize({
        payTo: '0xdef',
        amount: '100',
        network: 'unknown-chain',
        asset: '0xabc',
      })
      expect(result!.accepts[0]!.network).toBe('unknown-chain')
    })
  })

  describe('unknown/garbage', () => {
    it('returns null for garbage input', () => {
      expect(normalize({})).toBeNull()
      expect(normalize('not json')).toBeNull()
      expect(normalize('null')).toBeNull()
      expect(normalize('42')).toBeNull()
    })
  })

  describe('string input (API-04)', () => {
    it('normalizes JSON string identically to object', () => {
      const obj = {
        x402Version: 2,
        accepts: [
          { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
        ],
        resource: { url: 'https://example.com' },
      }
      const fromObj = normalize(obj)
      const fromStr = normalize(JSON.stringify(obj))
      expect(fromObj).toEqual(fromStr)
    })
  })
})
