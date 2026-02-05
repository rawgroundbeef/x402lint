/**
 * c32check decoder wrapper
 * Uses c32check for audited, standard implementation
 */

import { c32addressDecode } from 'c32check'

/**
 * Decode a c32check-encoded Stacks address
 *
 * Returns version byte and hash160 payload
 *
 * @param address - c32check-encoded Stacks address
 * @returns Tuple of [version byte, hash160 hex string]
 * @throws Error if address has invalid c32check encoding or checksum
 */
export function decodeC32Address(address: string): [number, string] {
  try {
    return c32addressDecode(address)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid c32check encoding: ${message}`)
  }
}
