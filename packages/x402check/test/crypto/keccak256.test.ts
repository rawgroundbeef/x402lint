import { describe, it, expect } from 'vitest'
import { keccak256 } from '../../src/crypto/keccak256'

describe('keccak256', () => {
  // CANARY: Empty string must produce Keccak-256 (NOT SHA-3)
  it('empty string produces Keccak-256 hash (not SHA-3)', () => {
    expect(keccak256('')).toBe('c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
  })

  it('empty string does NOT produce SHA-3-256 hash', () => {
    expect(keccak256('')).not.toBe('a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a')
  })

  it('hello world produces correct hash', () => {
    expect(keccak256('hello world')).toBe('47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad')
  })

  it('accepts Uint8Array input', () => {
    const bytes = new TextEncoder().encode('')
    expect(keccak256(bytes)).toBe('c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
  })

  it('returns 64-char hex string without 0x prefix', () => {
    const hash = keccak256('test')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
