# Phase 14: CLI Manifest Mode - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI command (`npx x402lint`) that accepts a manifest file or URL and displays per-endpoint validation results in the terminal. Auto-detects manifest vs single-config input. Supports `--json`, `--quiet`, `--strict`, and flag composition. Website integration is Phase 15; publish is Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Terminal output format
- Summary table first, then expanded details for all endpoints
- Summary table columns: status icon (pass/fail), endpoint ID, error count + warning count
- All endpoints expanded below the table (both passing and failing) — developer sees full picture
- Cross-endpoint issues placement: Claude's discretion on where they fit best in the output flow

### Manifest vs single-config UX
- Always announce what was detected: "Detected: manifest with N endpoints" or "Detected: v2 config" (printed before results)
- Single-config output format stays exactly as-is — no regression, two distinct output styles
- Wild manifest normalization warnings shown in output (e.g., "Normalized: biwas-style array converted to manifest format") before validation results
- `--json` output structure for manifest vs single-config: Claude's discretion, aligned with SDK types

### Error & exit behavior
- Exit 0 if majority of endpoints pass; exit 1 if majority fail
- `--strict` treats all warnings (including cross-endpoint) as errors, failing the endpoint/manifest
- Always validate all endpoints — no fail-fast, developer sees complete picture in one run
- Exit 2 for input errors (file not found, network error, invalid JSON) — distinct from validation failure exit code, with human-readable message

### Input sources
- Accept file paths, HTTP(S) URLs, and stdin via dash convention (`x402lint -`)
- Auto-detect file vs URL based on argument format
- Follow HTTP redirects up to 5 hops, then fail
- Support `--header` flag (repeatable) for custom HTTP headers when fetching URLs (e.g., `--header 'Authorization: Bearer xxx'`)
- Stdin indicated by `-` as the positional argument (Unix convention)

### Claude's Discretion
- Cross-endpoint issues placement in output (between table and details, or at end)
- `--json` envelope structure (unified vs distinct shapes matching SDK types)
- Exact progress/loading indicators for URL fetching
- Color scheme and symbol choices for terminal output
- URL fetch timeout value
- How `--help` usage text is structured

</decisions>

<specifics>
## Specific Ideas

- Output should feel CI-friendly: exit codes are meaningful, `--json` is parseable, `--quiet` communicates via exit code only
- Summary table + details pattern gives a quick overview then lets you drill in — similar to how `eslint` or `tsc` report multi-file results
- Detection announcement helps developers confirm the CLI is interpreting their input correctly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-cli-manifest-mode*
*Context gathered: 2026-02-04*
