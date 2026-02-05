import { describe, test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const CLI = resolve(__dirname, '../dist/cli.mjs')
const FIXTURES = resolve(__dirname, 'fixtures')

/** Run the CLI and return { stdout, stderr, exitCode } */
function run(args: string[], opts?: { input?: string }): {
  stdout: string
  stderr: string
  exitCode: number
} {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      input: opts?.input,
      timeout: 10_000,
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    }
  }
}

describe('cli --version', () => {
  test('prints version and exits 0', () => {
    const { stdout, exitCode } = run(['--version'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('-v also works', () => {
    const { stdout, exitCode } = run(['-v'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('cli --help', () => {
  test('prints help text and exits 0', () => {
    const { stdout, exitCode } = run(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('x402lint')
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('Flags:')
    expect(stdout).toContain('Exit codes:')
  })

  test('-h also works', () => {
    const { stdout, exitCode } = run(['-h'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
  })
})

describe('cli with no input', () => {
  test('prints error and exits 2', () => {
    const { stderr, exitCode } = run([])
    expect(exitCode).toBe(2)
    expect(stderr).toContain('No input provided')
  })
})

describe('cli — file input', () => {
  test('valid v2 fixture: exits 0, prints Valid', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
  })

  test('valid v1 fixture: exits 0, prints Valid with warnings', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'valid-v1.json')])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
    expect(stdout).toContain('LEGACY_FORMAT')
  })

  test('nonexistent file: exits 2', () => {
    const { stderr, exitCode } = run(['nonexistent-file-12345.json'])
    expect(exitCode).toBe(2)
    expect(stderr).toContain('File not found')
  })
})

describe('cli — inline JSON', () => {
  test('valid inline JSON: exits 0', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 60,
      }],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run([json])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
  })

  test('invalid inline JSON (empty accepts): exits 1', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run([json])
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Invalid')
    expect(stdout).toContain('EMPTY_ACCEPTS')
  })

  test('malformed JSON: exits 1', () => {
    const { stdout, exitCode } = run(['{not valid json'])
    // This starts with { so it's treated as JSON-like, then validate() parses it
    expect(exitCode).toBe(1)
  })
})

describe('cli — stdin input', () => {
  test('valid JSON from stdin: exits 0', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 60,
      }],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run([], { input: json })
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
  })
})

describe('cli — --json flag', () => {
  test('outputs valid JSON', () => {
    const { stdout, exitCode } = run(['--json', resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout)
    expect(parsed.valid).toBe(true)
    expect(parsed.version).toBe('v2')
    expect(Array.isArray(parsed.errors)).toBe(true)
    expect(Array.isArray(parsed.warnings)).toBe(true)
  })

  test('outputs valid JSON for invalid config too', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run(['--json', json])
    expect(exitCode).toBe(1)
    const parsed = JSON.parse(stdout)
    expect(parsed.valid).toBe(false)
    expect(parsed.errors.length).toBeGreaterThan(0)
  })
})

describe('cli — --quiet flag', () => {
  test('no output on valid config, exits 0', () => {
    const { stdout, exitCode } = run(['--quiet', resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe('')
  })

  test('no output on invalid config, exits 1', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run(['--quiet', json])
    expect(exitCode).toBe(1)
    expect(stdout.trim()).toBe('')
  })
})

describe('cli — --strict flag', () => {
  test('warnings promoted to errors, exits 1', () => {
    // Config that is valid normally but has warnings
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x0000000000000000000000000000000000000001',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      }],
    })

    // Normal: valid with warnings
    const normal = run([json])
    expect(normal.exitCode).toBe(0)

    // Strict: warnings become errors
    const strict = run(['--strict', json])
    expect(strict.exitCode).toBe(1)
  })
})

describe('cli — manifest detection', () => {
  test('valid manifest file: exits 0, shows summary table', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'valid-manifest.json')])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Detected: manifest with 2 endpoints')
    expect(stdout).toContain('api/weather')
    expect(stdout).toContain('api/maps')
  })

  test('manifest with majority pass: exits 0', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'invalid-manifest.json')])
    expect(exitCode).toBe(0) // 2 valid + 1 invalid = majority pass
    expect(stdout).toContain('Detected: manifest with 3 endpoints')
  })

  test('manifest with majority fail: exits 1', () => {
    // Create inline JSON with 1 valid + 2 invalid endpoints
    const manifest = JSON.stringify({
      x402Version: 2,
      service: { name: 'Test', url: 'https://api.example.com' },
      endpoints: {
        'api/valid': {
          x402Version: 2,
          accepts: [{
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          }],
          resource: { url: 'https://api.example.com/valid' },
        },
        'api/broken1': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://api.example.com/broken1' },
        },
        'api/broken2': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://api.example.com/broken2' },
        },
      },
    })
    const { exitCode } = run([manifest])
    expect(exitCode).toBe(1) // 1 valid + 2 invalid = majority fail
  })

  test('single config still detected correctly', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Detected:')
    expect(stdout).toContain('config')
  })
})

describe('cli — manifest --json', () => {
  test('manifest --json outputs parseable JSON', () => {
    const { stdout, exitCode } = run(['--json', resolve(FIXTURES, 'valid-manifest.json')])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout)
    expect(parsed).toHaveProperty('endpointResults')
    expect(parsed).toHaveProperty('valid')
    expect(typeof parsed.valid).toBe('boolean')
    // No ANSI codes in --json output
    expect(stdout).not.toContain('\x1b')
  })

  test('manifest --json with invalid: parseable JSON with errors', () => {
    const { stdout, exitCode } = run(['--json', resolve(FIXTURES, 'invalid-manifest.json')])
    expect(exitCode).toBe(0) // Majority pass
    const parsed = JSON.parse(stdout)
    expect(parsed).toHaveProperty('endpointResults')
    expect(Object.keys(parsed.endpointResults).length).toBe(3)
  })
})

describe('cli — manifest --quiet', () => {
  test('manifest --quiet: no output, exit 0 on majority pass', () => {
    const { stdout, exitCode } = run(['--quiet', resolve(FIXTURES, 'valid-manifest.json')])
    expect(stdout.trim()).toBe('')
    expect(exitCode).toBe(0)
  })

  test('manifest --quiet: no output, exit 1 on majority fail', () => {
    // Create inline JSON manifest with majority invalid
    const manifest = JSON.stringify({
      x402Version: 2,
      service: { name: 'Test', url: 'https://api.example.com' },
      endpoints: {
        'api/valid': {
          x402Version: 2,
          accepts: [{
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          }],
          resource: { url: 'https://api.example.com/valid' },
        },
        'api/broken1': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://api.example.com/broken1' },
        },
        'api/broken2': {
          x402Version: 2,
          accepts: [],
          resource: { url: 'https://api.example.com/broken2' },
        },
      },
    })
    const { stdout, exitCode } = run(['--quiet', manifest])
    expect(stdout.trim()).toBe('')
    expect(exitCode).toBe(1)
  })
})

describe('cli — manifest --strict', () => {
  test('--strict promotes manifest warnings to errors', () => {
    // Create a manifest with unknown asset (produces warnings)
    const manifest = JSON.stringify({
      x402Version: 2,
      service: { name: 'Test', url: 'https://api.example.com' },
      endpoints: {
        'api/test': {
          x402Version: 2,
          accepts: [{
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x0000000000000000000000000000000000000001',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          }],
          resource: { url: 'https://api.example.com/test' },
        },
      },
    })

    // Normal: valid with warnings, exit 0
    const normal = run([manifest])
    expect(normal.exitCode).toBe(0)

    // Strict: warnings promoted to errors, exit 1
    const strict = run(['--strict', manifest])
    expect(strict.exitCode).toBe(1)
  })

  test('--strict --json outputs strict-mode JSON', () => {
    const manifest = JSON.stringify({
      x402Version: 2,
      service: { name: 'Test', url: 'https://api.example.com' },
      endpoints: {
        'api/test': {
          x402Version: 2,
          accepts: [{
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x0000000000000000000000000000000000000001',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          }],
          resource: { url: 'https://api.example.com/test' },
        },
      },
    })

    const { stdout, exitCode } = run(['--strict', '--json', manifest])
    expect(exitCode).toBe(1)
    const parsed = JSON.parse(stdout)
    expect(parsed.valid).toBe(false)
  })
})

describe('cli — manifest flag composition', () => {
  test('--quiet takes precedence over --json', () => {
    const { stdout, exitCode } = run(['--quiet', '--json', resolve(FIXTURES, 'valid-manifest.json')])
    expect(stdout.trim()).toBe('')
    expect(exitCode).toBe(0)
  })

  test('--strict --quiet: exit code reflects strict validation', () => {
    // Manifest with warnings
    const manifest = JSON.stringify({
      x402Version: 2,
      service: { name: 'Test', url: 'https://api.example.com' },
      endpoints: {
        'api/test': {
          x402Version: 2,
          accepts: [{
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x0000000000000000000000000000000000000001',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          }],
          resource: { url: 'https://api.example.com/test' },
        },
      },
    })

    const { stdout, exitCode } = run(['--strict', '--quiet', manifest])
    expect(stdout.trim()).toBe('')
    expect(exitCode).toBe(1) // Strict mode promotes warnings to errors
  })
})

describe('cli — dash stdin for manifest', () => {
  test('dash reads manifest from stdin', () => {
    const manifest = JSON.stringify({
      x402Version: 2,
      service: { name: 'Test', url: 'https://api.example.com' },
      endpoints: {
        'api/weather': {
          x402Version: 2,
          accepts: [{
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          }],
          resource: { url: 'https://api.example.com/weather' },
        },
      },
    })

    const { stdout, exitCode } = run(['-'], { input: manifest })
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Detected: manifest')
  })
})
