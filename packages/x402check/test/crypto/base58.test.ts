import { describe, it, expect } from 'vitest'
import { decodeBase58 } from '../../src/crypto/base58'

describe('decodeBase58', () => {
  // CANARY: All-1s address must produce 32 zero bytes
  it('all-1s Solana address decodes to 32 zero bytes', () => {
    const decoded = decodeBase58('11111111111111111111111111111111')
    expect(decoded.length).toBe(32)
    expect(Array.from(decoded).every(b => b === 0)).toBe(true)
  })

  it('preserves leading zero bytes', () => {
    // Leading '1' chars map to 0x00 bytes
    const decoded = decodeBase58('111abc')
    expect(decoded[0]).toBe(0)
    expect(decoded[1]).toBe(0)
    expect(decoded[2]).toBe(0)
  })

  it('decodes a valid Base58 string', () => {
    const decoded = decodeBase58('2NEpo7TZRRrLZSi2U')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(decoded.length).toBeGreaterThan(0)
  })

  it('throws on invalid Base58 characters', () => {
    // 0, O, I, l are not in Base58 alphabet
    expect(() => decodeBase58('0OIl')).toThrow('Invalid Base58')
  })

  it('returns empty array for empty string', () => {
    const decoded = decodeBase58('')
    expect(decoded.length).toBe(0)
  })
})
