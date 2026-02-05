# Research Summary — v3.0 Manifest Validation & CLI

**Project:** x402lint
**Milestone:** v3.0
**Researched:** 2026-02-04
**Dimensions:** Stack, Features, Architecture, Pitfalls

## Key Findings

### Stack (HIGH confidence)
Zero-dependency architecture preserved. All additions use vendoring or built-ins:
- **CLI:** `util.parseArgs` (Node.js 18.3+) + raw ANSI codes → 0 KB
- **Stacks c32check:** Vendor using existing @noble/hashes + @scure/base devDeps → +4 KB
- **JSON Schema:** Ajv as devDependency only → 0 KB runtime
- **Manifest validation:** Custom TypeScript logic → +2-3 KB
- **npm publishing:** Already configured (publint + prepublishOnly)
- **Total bundle impact:** +6-7 KB (30 KB → 36-37 KB, within 40 KB target)

### Features (MEDIUM-HIGH confidence)
6 new features build on v2.0 foundation by composition, not replacement:
1. **MF-1:** Manifest validation — per-endpoint `validate()` + aggregate reporting (LOW)
2. **MF-2:** CLI manifest mode — auto-detect via `detect()`, dispatch (LOW)
3. **MF-3:** Cross-endpoint consistency — duplicates, payTo, network checks (LOW-MEDIUM)
4. **MF-4:** Bazaar method discrimination — GET vs POST input shapes (MEDIUM)
5. **MF-5:** Wild manifest normalization — detect/transform non-standard formats (MEDIUM)
6. **MF-6:** Stacks address validation — c32check prefix + decoding (LOW)

**Defer:** Bazaar deep JSON Schema validation (requires Ajv runtime, high complexity)

### Architecture (HIGH confidence)
v2.0 architecture requires no structural changes — all features are additive:
- `validateManifest()` composes existing `validate()` per-endpoint
- `detect()` extended with `'manifest'` return (must check BEFORE v2)
- CLI adds format-based dispatch to appropriate validator
- Stacks extends existing address validation switch statement
- Website uses detection-first rendering pattern
- No build config changes needed

**Build order:** Types/Detection → Stacks (parallel) + Manifest → CLI + Website (parallel) → Publish

**Bundle estimate:** +14 KB total (conservative, includes SHA-256 for c32check) → ~45 KB

### Pitfalls (HIGH confidence)
12 pitfalls identified, 5 critical:
1. **P1:** CLI code leaking into library bundle — keep separate entry points
2. **P2:** Shebang + ESM compatibility — use .mjs, test cross-platform
3. **P3:** c32check version byte confusion — test all 4 mainnet/testnet combinations
4. **P4:** Manifest field paths lose endpoint context — prefix with endpoint ID
5. **P5:** First npm publish missing files — test with npm pack + publint

**Phase-specific risks:** CLI phases need bundle guard, Stacks needs version byte tests, Manifest needs field path prefixing, Publish needs dry-run testing.

## Consensus Across Dimensions

| Topic | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| Manifest validation | Custom logic, +2-3KB | Compose validate() | New orchestrator file | P4: field path context |
| Stacks addresses | Vendor c32check, +4KB | Prefix + c32 decode | Extend address switch | P3: version byte testing |
| Bazaar extensions | Ajv devDep only | Method discrimination | Already partially exists | P6: don't bloat bundle |
| CLI improvements | util.parseArgs, 0KB | Auto-detect dispatch | Modify existing cli.ts | P9: test flag combos |
| npm publish | Already ready | N/A | No changes | P5: npm pack test |
| Wild manifests | No library needed | Detect/transform/warn | Extend normalize() | P7: don't over-normalize |

## Disagreements / Tensions

**Bundle size estimates differ:** Stack estimates +6-7 KB (conservative), Architecture estimates +14 KB (includes SHA-256 overhead). True number depends on tree-shaking effectiveness — measure after implementation.

**Bazaar validation depth:** Features recommends deferring deep schema validation. Stack provides Ajv standalone as option. Architecture says current structural validation is sufficient. **Resolution:** Ship structural validation in v3.0, deep validation is post-MVP.

## Roadmap Implications

**Recommended phases (6):**

| Phase | Description | Parallel? | Key Risk |
|-------|------------|-----------|----------|
| 11. Manifest Types & Detection | ManifestConfig types, extend detect() | No (foundation) | Detection order |
| 12. Stacks Chain Support | Vendor c32check, add validator, extend registry | Parallel with 13 | Version bytes |
| 13. Manifest Validation | Orchestrator, cross-endpoint rules, bazaar method discrimination | Parallel with 12 | Field path context |
| 14. CLI Manifest Mode | Format dispatch, manifest output formatting, util.parseArgs | No | Flag composition |
| 15. Website Manifest UI | Detection-first rendering, per-endpoint cards | Parallel with 14 | Mode switching state |
| 16. Build & Publish | Bundle verification, npm publish, documentation | No | Missing files |

**Critical path:** Types/Detection (11) → Manifest Validation (13) → CLI (14) → Publish (16)

## Open Questions

1. **Bundle size target:** 40 KB hard limit or soft? (Stack says 36-37 KB, Architecture says 45 KB)
2. **Wild manifest examples:** No live examples found (x402.biwas.xyz). Need concrete format to finalize normalization.
3. **Manifest schema:** This is net-new for x402 ecosystem. No official spec — x402lint defines it.

## Research Confidence

| Dimension | Level | Gaps |
|-----------|-------|------|
| Stack | HIGH | Bundle size needs measurement after implementation |
| Features | MEDIUM-HIGH | Wild manifest format unverified, bazaar schema details TBD |
| Architecture | HIGH | All integration points verified against existing codebase |
| Pitfalls | HIGH | Performance thresholds estimated, not measured |

---
*Research complete: 2026-02-04*
*Ready for: Requirements definition → Roadmap creation*
