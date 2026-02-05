import { describe, test, expect } from 'vitest'
import { validateSolanaAddress } from '../../src/validation/solana-address'
import { ErrorCode } from '../../src/types/errors'

describe('validateSolanaAddress', () => {
  describe('valid Solana addresses', () => {
    test('system program (all 1s)', () => {
      const issues = validateSolanaAddress(
        '11111111111111111111111111111111',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('SPL Token program', () => {
      const issues = validateSolanaAddress(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('typical wallet address', () => {
      const issues = validateSolanaAddress(
        'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('invalid Base58 characters', () => {
    test('special characters', () => {
      const issues = validateSolanaAddress('invalid!@#$%', 'test.address')

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })

    test('excluded Base58 chars (0, O, I, l)', () => {
      const issues = validateSolanaAddress(
        '0OIl111111111111111111111111111111',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })
  })

  describe('length validation', () => {
    test('too short (less than 32 chars)', () => {
      const issues = validateSolanaAddress('abc', 'test.address')

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })

    test('too long (more than 44 chars)', () => {
      const issues = validateSolanaAddress(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DAextralong',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })
  })

  describe('decoded byte length validation', () => {
    test('valid Base58 but wrong decoded length', () => {
      // This is a valid Base58 string but should decode to wrong byte length
      // Using a very short Base58 string that's 32+ chars
      const issues = validateSolanaAddress(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'test.address'
      )

      // This should either fail regex (if actually less than 32 chars after checking)
      // or fail the decoded length check
      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })
  })

  describe('empty string', () => {
    test('produces INVALID_SOLANA_ADDRESS error', () => {
      const issues = validateSolanaAddress('', 'test.address')

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })
  })
})
