import { describe, test, expect } from 'vitest'
import { validateEvmAddress } from '../../src/validation/evm-address'
import { ErrorCode } from '../../src/types/errors'

describe('validateEvmAddress', () => {
  describe('valid checksummed addresses', () => {
    test('EIP-55 reference address 1', () => {
      const issues = validateEvmAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('EIP-55 reference address 2', () => {
      const issues = validateEvmAddress(
        '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('EIP-55 reference address 3', () => {
      const issues = validateEvmAddress(
        '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('EIP-55 reference address 4', () => {
      const issues = validateEvmAddress(
        '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('all-lowercase address (no checksum)', () => {
    test('produces NO_EVM_CHECKSUM warning', () => {
      const issues = validateEvmAddress(
        '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('warning')
      expect(issues[0]?.code).toBe(ErrorCode.NO_EVM_CHECKSUM)
      expect(issues[0]?.fix).toContain('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
    })
  })

  describe('all-uppercase address (valid format)', () => {
    test('produces no issues', () => {
      const issues = validateEvmAddress(
        '0x52908400098527886E0F7030069857D2E4169EE7',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('all-uppercase zero address', () => {
      const issues = validateEvmAddress(
        '0x0000000000000000000000000000000000000000',
        'test.address'
      )
      // All zeros/digits is not "all-uppercase letters", so should be valid
      expect(issues).toHaveLength(0)
    })
  })

  describe('bad checksum', () => {
    test('produces BAD_EVM_CHECKSUM warning with correct address', () => {
      // Last character changed from 'd' to 'D' (wrong case)
      const issues = validateEvmAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('warning')
      expect(issues[0]?.code).toBe(ErrorCode.BAD_EVM_CHECKSUM)
      expect(issues[0]?.fix).toContain('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
    })
  })

  describe('invalid format', () => {
    test('missing 0x prefix', () => {
      const issues = validateEvmAddress(
        '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })

    test('too short (41 chars)', () => {
      const issues = validateEvmAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeA',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })

    test('too long (44 chars)', () => {
      const issues = validateEvmAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed00',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })

    test('invalid hex characters', () => {
      const issues = validateEvmAddress(
        '0xGGGGb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })

    test('empty string', () => {
      const issues = validateEvmAddress('', 'test.address')

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })
  })
})
