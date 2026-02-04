# Phase 12: Stacks Chain Support - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Stacks blockchain address validation (SP/SM/ST/SN prefixes with c32check encoding) to the existing address validation registry, matching the depth of EVM and Solana chain support. Mainnet and testnet networks only. Other chain additions or validation pipeline changes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Network mapping
- Use numeric CAIP-2 identifiers: `stacks:1` (mainnet) and `stacks:2147483648` (testnet)
- Strictly require numeric form — reject `stacks:mainnet` / `stacks:testnet`
- If someone uses human-readable form, error should suggest the numeric equivalent (e.g., "Did you mean stacks:1?")
- Only mainnet and testnet — no devnet/mocknet support

### Error messages & fix suggestions
- Keep error messages simple and clear, not overly technical (e.g., "Invalid Stacks address checksum. Double-check the address.")
- No external documentation links in errors — messages should be self-contained
- c32check validity implies correct length — no separate length warnings needed

### Contract address handling
- Don't distinguish between standard (SP/ST) and contract (SM/SN) addresses in validation output — just "Stacks address"
- Validate base addresses only — contract name suffixes (e.g., `.my-contract`) are not parsed
- Whether SM/SN addresses are accepted as payTo targets: Claude's discretion based on how Stacks payments work
- How to handle full contract identifiers (SM123.contract-name) passed as payTo: Claude's discretion

### c32check dependency
- Use `@stacks/common` package for c32check encoding/decoding
- Must work in the browser IIFE bundle — not Node-only
- If @stacks/common pushes bundle over 45KB target: Claude's discretion on fallback (vendor vs raise limit)
- Version pinning strategy: Claude's discretion based on existing dependency patterns

### Claude's Discretion
- Whether SM/SN contract addresses are valid payTo targets
- Handling of full contract identifiers (address.contract-name) in payTo fields
- Bundle size fallback if @stacks/common is too large
- @stacks/common version pinning strategy
- Network mismatch error message wording (consistent with existing EVM/Solana patterns)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that match existing EVM/Solana validation patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-stacks-chain-support*
*Context gathered: 2026-02-04*
