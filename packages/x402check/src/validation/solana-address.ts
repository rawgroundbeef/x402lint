/**
 * Solana address validation (Base58 + 32-byte length)
 */

import { decodeBase58 } from '../crypto/base58'
import { ErrorCode } from '../types/errors'
import type { ValidationIssue } from '../types/validation'

// Solana addresses are 32-44 Base58 characters
// Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
// (excludes 0, O, I, l to avoid confusion)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * Validate a Solana address (Base58 encoded public key)
 *
 * Checks Base58 format and verifies decoded length is exactly 32 bytes
 *
 * @param address - Address to validate
 * @param field - Field path for error reporting
 * @returns Array of validation issues (empty if valid)
 */
export function validateSolanaAddress(
  address: string,
  field: string
): ValidationIssue[] {
  // Check Base58 format and length
  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return [
      {
        code: ErrorCode.INVALID_SOLANA_ADDRESS,
        field,
        message: 'Solana address must be 32-44 Base58 characters',
        severity: 'error',
        fix: 'Valid characters: 1-9, A-H, J-N, P-Z, a-k, m-z (no 0, O, I, l)',
      },
    ]
  }

  // Attempt to decode and verify byte length
  try {
    const decoded = decodeBase58(address)
    if (decoded.length !== 32) {
      return [
        {
          code: ErrorCode.INVALID_SOLANA_ADDRESS,
          field,
          message: `Solana address must decode to 32 bytes, got ${decoded.length}`,
          severity: 'error',
          fix: 'Verify address is a valid Solana public key',
        },
      ]
    }
  } catch (error) {
    return [
      {
        code: ErrorCode.INVALID_SOLANA_ADDRESS,
        field,
        message: 'Invalid Base58 encoding',
        severity: 'error',
        fix: error instanceof Error ? error.message : 'Check Base58 encoding',
      },
    ]
  }

  // Valid Solana address
  return []
}
