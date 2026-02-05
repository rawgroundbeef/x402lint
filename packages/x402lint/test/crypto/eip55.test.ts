import { describe, it, expect } from 'vitest'
import { toChecksumAddress, isValidChecksum } from '../../src/crypto/eip55'

describe('toChecksumAddress', () => {
  // EIP-55 reference vectors from the specification
  it('produces correct checksum for reference addresses', () => {
    // All caps
    expect(toChecksumAddress('0x52908400098527886E0F7030069857D2E4169EE7'))
      .toBe('0x52908400098527886E0F7030069857D2E4169EE7')

    // All lower
    expect(toChecksumAddress('0xde709f2102306220921060314715629080e2fb77'))
      .toBe('0xde709f2102306220921060314715629080e2fb77')

    // Mixed case - the canonical test
    expect(toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'))
      .toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')

    expect(toChecksumAddress('0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'))
      .toBe('0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359')

    expect(toChecksumAddress('0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb'))
      .toBe('0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB')

    expect(toChecksumAddress('0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb'))
      .toBe('0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb')
  })
})

describe('isValidChecksum', () => {
  it('returns true for correctly checksummed addresses', () => {
    expect(isValidChecksum('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true)
    expect(isValidChecksum('0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359')).toBe(true)
    expect(isValidChecksum('0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB')).toBe(true)
    expect(isValidChecksum('0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb')).toBe(true)
  })

  it('returns false for incorrectly checksummed addresses', () => {
    // Last char changed from 'd' to 'D'
    expect(isValidChecksum('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD')).toBe(false)
  })

  it('returns false for all-lowercase addresses', () => {
    // Lowercase is valid format but does NOT match checksum
    expect(isValidChecksum('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(false)
  })

  it('returns false for all-uppercase addresses', () => {
    // Uppercase is valid format but does NOT match checksum (unless it happens to)
    // This specific address: 0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED would not match checksum
    expect(isValidChecksum('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED')).toBe(false)
  })
})
