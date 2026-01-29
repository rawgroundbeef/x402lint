/**
 * EVM address validation with EIP-55 checksum verification
 */

import { toChecksumAddress, isValidChecksum } from '../crypto/eip55'
import { ErrorCode } from '../types/errors'
import type { ValidationIssue } from '../types/validation'

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/

/**
 * Validate an EVM address format and checksum
 *
 * Returns errors for invalid format, warnings for checksum issues
 *
 * @param address - Address to validate
 * @param field - Field path for error reporting
 * @returns Array of validation issues (empty if valid)
 */
export function validateEvmAddress(
  address: string,
  field: string
): ValidationIssue[] {
  // Check basic format (0x + 40 hex chars)
  if (!EVM_ADDRESS_REGEX.test(address)) {
    return [
      {
        code: ErrorCode.INVALID_EVM_ADDRESS,
        field,
        message: 'EVM address must be 42 hex characters with 0x prefix',
        severity: 'error',
        fix: 'Format: 0x followed by 40 hex digits (0-9, a-f, A-F)',
      },
    ]
  }

  // Check if all-lowercase (no checksum)
  if (address === address.toLowerCase()) {
    return [
      {
        code: ErrorCode.NO_EVM_CHECKSUM,
        field,
        message: 'EVM address is all-lowercase with no checksum protection',
        severity: 'warning',
        fix: `Use checksummed address to detect typos: ${toChecksumAddress(address)}`,
      },
    ]
  }

  // Check if all-uppercase (valid, no checksum info)
  const hexPart = address.slice(2)
  if (/^[0-9A-F]{40}$/.test(hexPart)) {
    // All-uppercase is valid and common, no warning needed
    return []
  }

  // Mixed case - verify checksum
  if (!isValidChecksum(address)) {
    return [
      {
        code: ErrorCode.BAD_EVM_CHECKSUM,
        field,
        message: 'EVM address has invalid checksum (EIP-55)',
        severity: 'warning',
        fix: `Expected: ${toChecksumAddress(address)}`,
      },
    ]
  }

  // Valid checksummed address
  return []
}
