<p align="center">
  <img src="assets/banner.png" alt="x402lint — Lint for x402" width="100%" />
</p>

# x402lint

Validate [x402](https://www.x402.org/) payment configurations. Checks structure, address formats, network identifiers, and more — with zero dependencies.

**[x402lint.com](https://www.x402lint.com)** — validate in the browser
**[npm](https://www.npmjs.com/package/x402lint)** — `npm i x402lint`

## What it does

- Validates v1 and v2 x402 payment configs
- Verifies EVM addresses (EIP-55 checksums) and Solana addresses (base58)
- Checks CAIP-2 network identifiers against a known registry
- Extracts configs from HTTP 402 responses (body or `PAYMENT-REQUIRED` header)
- Normalizes any supported format to canonical v2
- Returns structured errors and warnings with fix suggestions

## Claude Skill

Teach Claude Code to create and validate x402 configs:

```
npx skills add https://github.com/rawgroundbeef/x402lint --skill x402lint
```

## Monorepo structure

```
packages/
  x402lint/       SDK — published to npm as x402lint
  x402check/      Thin alias — re-exports x402lint
  config/         Shared TypeScript config
apps/
  website/        x402lint.com — hosted on Cloudflare Pages
    worker/       CORS proxy — Cloudflare Worker
```

## Development

```bash
pnpm install
pnpm build:sdk
pnpm test:sdk
```

## Links

- [x402 protocol](https://www.x402.org/)
- [x402lint.com](https://www.x402lint.com)
- [npm package](https://www.npmjs.com/package/x402lint)

## License

MIT
