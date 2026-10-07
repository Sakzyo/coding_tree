# M7-01 independent task review

## Spec Compliance

- ✅ **Spec compliant** for the pure supplied-record selection task at base `bd45c7cb8`, head `1dd9f1ba320ca21e115196a59d5e217c5509907f`. All four mandated files are present; the canonical barrel and focused Schema suite are directly relevant additions. The selector validates input/catalog separately, accounts for desktop/JDT/Gradle and every concurrent project, and returns eligible/excluded records (`packages/core/src/ftc/inference/catalog.ts:14`, `:21`, `:103`).
- ✅ RAM/GPU/disk accounting follows the supplied contract: shared GPU reservations and profile allocation consume host RAM once; dedicated GPU allocations consume only their own pool; each pool retains its exact remaining budget (`packages/core/src/ftc/inference/catalog.ts:29`, `:38`, `:44`, `:95`). Safe-integer validation rejects unsafe reservation/profile sums, and negative available headroom remains representable (`packages/core/src/ftc/inference/catalog.ts:32`, `:45`; `packages/schema/src/ftc-inference.ts:8`, `:138`).
- ✅ Evaluation provenance, platform, backend, GPU availability, resource/context deficits and selected capability evidence all participate in deterministic selection. Every applicable valid-profile reason is retained in priority order, with numeric facts and caller-ordered missing capabilities (`packages/core/src/ftc/inference/catalog.ts:47`, `:79`, `:88`, `:106`). Catalog provenance does not bypass resource rules.
- ✅ Curated metadata checks include revision/source/digest/license/template, positive model RAM/disk, backend-specific GPU requirements and unique identities/capabilities. Nested unknown properties are rejected at selection (`packages/schema/src/ftc-inference.ts:13`, `:26`, `:59`, `:77`, `:103`; `packages/core/src/ftc/inference/catalog.ts:16`). Canonical root identity is checked directly (`packages/schema/src/index.ts:10`; `packages/schema/test/ftc-inference.test.ts:6`).
- ✅ No measured platform/model support is invented: the shipped production catalog is empty (`packages/core/resources/ftc/models.json:1`), the actual file is exercised (`packages/core/test/ftc/ai-access-and-local-inference/m7-01.test.ts:369`), and fixtures/evidence are explicitly synthetic (`docs/validation/M7-01-implementation.md:84`).
- ⚠️ **Cannot verify from this task:** M7-08 measured runtime/model/platform/capability support, actual resource probes and reservation producers, production facade/host binding, UI integration, downloads/cache/runtime lifecycle, credentials, local-only enforcement or release acceptance. These remain integration gates; the report explicitly excludes them (`docs/validation/M7-01-implementation.md:86`). Eligibility here establishes supplied-fact fit, not installed readiness or measured support.

## Strengths

- The 118-line policy stays pure and imports only canonical Schema and Effect; it introduces no store, process, I/O or alternate agent loop (`packages/core/src/ftc/inference/catalog.ts:3`, `:13`).
- Tests exercise the actual policy and make resource boundaries observable: separate headroom contributors, shared/dedicated GPU behavior, exact remaining budgets, simultaneous reasons, negative deficits and separate-request isolation (`packages/core/test/ftc/ai-access-and-local-inference/m7-01.test.ts:50`, `:65`, `:176`, `:248`, `:272`, `:300`, `:358`).
- The recorded RED fails on the requested missing reason rather than an import/harness error (`docs/validation/m7-01/red-memory.log:13`). Final evidence records 48 Core tests/90 assertions and 9 Schema/hygiene tests/18 assertions, all passing (`docs/validation/m7-01/green-final.log:53`; `docs/validation/m7-01/schema-root-test.log:16`). Final scoped lint/type/format logs are clean.
- Mutation evidence demonstrates failures when JDT reservations, shared GPU accounting or provenance checks are removed (`docs/validation/m7-01/mutation-reservations.log:590`; `docs/validation/m7-01/mutation-shared-gpu.log:174`; `docs/validation/m7-01/mutation-provenance.log:176`). The report correctly places those mutations before the later negative-headroom refinement and records refreshed final checks (`docs/validation/M7-01-implementation.md:59`, `:67`).

## Issues

### Critical (Must Fix)

- None found.

### Important (Should Fix)

- None found.

### Minor (Nice to Have)

- `packages/core/test/ftc/ai-access-and-local-inference/m7-01.test.ts:330`: preserve additional regression cases for the combined shared RAM/GPU sum at `MAX_SAFE_INTEGER`, its overflow, and extreme GPU/disk negative headroom. The current overflow case covers ordinary RAM reservation aggregation and the negative case covers RAM at -1. Focused review probes confirmed the additional branches work; this is coverage improvement, not an observed behavior defect.

## Review Checks

- Reviewed the supplied complete task diff. Initial tool output was truncated by repetitive evidence logs; recovered product hunks and log summaries from that same diff, without separately reopening changed source or broadening into unrelated code.
- Read the required Schema package instructions. No unrelated source inspection, suites, application restart, Git/index/ledger mutation or subagent dispatch occurred.
- Repository cwd: `shasum -a 256 -c docs/validation/m7-01/candidate-sha256.txt`, exit 0: all six frozen candidate hashes match the reviewed checkout.
- `packages/core` cwd: pinned Bun 1.3.14 `bun -e` probe with the documented M7 test/XDG environment, exit 0, six assertions against the real selector and canonical Schema. Confirmed: shared profile sum `MAX_SAFE_INTEGER - 1 + 1` is eligible with zero remaining RAM; `MAX_SAFE_INTEGER + 1` profile sum produces `invalid_catalog`; the analogous shared reservation sum produces `invalid_input`; dedicated RAM/GPU/disk reservations at `MAX_SAFE_INTEGER` against zero host budgets retain three `-MAX_SAFE_INTEGER` available values; those deficits decode through `Recommendation`; and an unknown nested artifact property produces `invalid_catalog`. All model/artifact/evaluation facts in this probe were fixture-only. No passing suite was repeated.

## Assessment

**Task quality: Approved.**

**Reasoning:** The implementation satisfies the task with explicit resource accounting, conservative metadata/provenance validation and stable result details. Hash-bound existing evidence and focused boundary probes support approval of this pure policy; production support and integration gates remain unverified.
