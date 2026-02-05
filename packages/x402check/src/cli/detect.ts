/**
 * Input detection and loading
 *
 * Handles all input resolution: file reading, stdin, URL detection,
 * JSON parsing, and manifest vs single-config detection.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { detect } from '../detection/detect'
import { normalizeWildManifest } from '../detection/wild-manifest'

/**
 * Input type after detection
 */
export type InputType = 'manifest' | 'single-config' | 'url'

/**
 * Result of input loading and detection
 */
export interface InputResult {
  type: InputType
  data: unknown
  normalizationWarnings?: string[]
}

/**
 * Check if a string is a URL (http:// or https://)
 */
export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

/**
 * Check if a string looks like JSON (starts with { or [)
 */
export function isJsonLike(s: string): boolean {
  const trimmed = s.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

/**
 * Read stdin until EOF
 *
 * @returns Promise<string> with stdin contents, or empty string if TTY
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const { stdin } = process

    // If stdin is a TTY (no pipe), return empty
    if (stdin.isTTY) {
      resolve('')
      return
    }

    stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
    stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    stdin.on('error', reject)
  })
}

/**
 * Resolve input from raw string
 *
 * Takes a raw input string (after determining it's not a URL) and:
 * 1. If not JSON-like, tries to read as a file
 * 2. Parses JSON
 * 3. Detects format (manifest vs single-config)
 * 4. Attempts wild manifest normalization if format is unknown
 *
 * @param rawInput - Input string (file path, JSON string, or file contents)
 * @returns InputResult with type, data, and optional normalization warnings
 * @throws Error if file not found
 */
export function resolveInput(rawInput: string): InputResult {
  let jsonString = rawInput

  // If not JSON-like, try to read as file
  if (!isJsonLike(rawInput)) {
    const filePath = resolve(rawInput)
    try {
      jsonString = readFileSync(filePath, 'utf-8')
    } catch (err) {
      const error = err as NodeJS.ErrnoException
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`)
      }
      throw new Error(`Cannot read file: ${error.message}`)
    }
  }

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    // If parse fails, return as single-config and let validate() handle the error
    return { type: 'single-config', data: rawInput }
  }

  // Detect format (JSON.parse returns unknown, but detect expects string | object)
  const format = detect(parsed as string | object)

  if (format === 'manifest') {
    return { type: 'manifest', data: parsed }
  }

  // Try wild manifest normalization for unknown formats
  if (format === 'unknown') {
    const wildResult = normalizeWildManifest(parsed)
    if (wildResult) {
      return {
        type: 'manifest',
        data: wildResult.manifest,
        normalizationWarnings: wildResult.warnings.map((w) => w.message),
      }
    }
  }

  // Default to single-config (v1, v2, or truly unknown)
  return { type: 'single-config', data: parsed }
}
