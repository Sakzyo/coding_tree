# M7-01 implementation evidence

## Approved contract before implementation

The coordinator approved this shape before production coding (2026-10-07).
`recommendModels({ hostResources, concurrentWork, catalog })` is a pure policy over supplied immutable records.

- Host: OS/architecture, available RAM/disk bytes, available backends, and optional GPU available bytes with shared/dedicated memory identity. These are available budgets before the explicit reservations below, not total installed capacities.
- Concurrent work: explicit desktop/JDT/Gradle byte reservations plus distinct concurrent project reservations; required context tokens and caller-selected capabilities.
- Profile: one runtime/model/platform/backend/context configuration, exact artifact revisions, HTTPS sources, SHA256 digests, licenses, quantization/template, resources at the entire stated context, tested capabilities, and synthetic/platform evaluation evidence.
- Resources: RAM, GPU and disk bytes. RAM allocations exclude shared GPU allocations, which the policy charges to the same RAM pool once. Reservations follow the same convention. GPU available bytes are additionally checked. Dedicated GPU bytes never consume host RAM. Model disk bytes cover the peak new disk needed before download, including runtime/model staging; cache reuse is not inferred.
- Results: eligible profiles with remaining byte budgets, excluded profiles with deterministic primary reason and every applicable reason, with numeric required/available deficits and missing capability identities where relevant. Exclusion `available` retains negative headroom when concurrent reservations already exceed the host budget. No speed/quality ranking or claims.
- Unknown/malformed resource facts and catalog metadata fail closed. Aggregate reservations must remain safe integers. Duplicate project/profile/backend/capability entries are rejected.
- Synthetic profiles are selectable only in a synthetic catalog. Shipped production `models.json` stays empty pending M7-08 measurements; this task does not promote hardware/model support.

Inputs do not read sibling stores, probe hardware, inspect caches, start processes, or download anything. This contract describes a single supplied GPU budget; heterogeneous GPU pools require a later explicit contract, not guessed allocation. Eligibility is a pre-download fit result, not installed-model readiness, capability verification, or local-only service verification.

## Implementation and scope

The candidate adds canonical browser-safe contracts in `packages/schema/src/ftc-inference.ts`, pure policy in `packages/core/src/ftc/inference/catalog.ts`, an empty production `packages/core/resources/ftc/models.json`, the focused Core suite, and a focused Schema contract suite. Checklist/ledger, Git/index, sibling lanes, processes, models, credentials and downloads were not changed by this worker. After M6-01 commit `f3de7a3c7`, the coordinator added the canonical `FtcInference` root export to `packages/schema/src/index.ts` and authorized including that file in this candidate's checks/hashes. The worker did not edit the barrel. The coordinator owns subsequent commit/review/ledger integration.

Catalog `kind` records the provenance of supplied curated data. It is not an inference-mode control or test-mode bypass: synthetic and production records execute the same resource/context/platform/backend/capability policy. Selection-time `evaluation_kind` excludes mismatched provenance per profile, so other valid profiles can still be assessed. Schema shape validation alone is not a production-support declaration. The production provenance branch is exercised with explicitly fixture-prefixed unit records and `fixture-only` evidence; those inputs establish policy behavior only. No platform measurement or measured model is represented by the shipped catalog.

Primary exclusion priority is `unevaluated_profile`, `evaluation_kind`, `unsupported_platform`, `unsupported_backend`, `gpu_unavailable`, RAM, GPU RAM, disk, context, then caller-ordered missing capabilities. All applicable reasons are retained. Invalid envelopes/catalogs fail closed. Profile IDs preserve catalog order; policy does not rank, mutate or persist inputs. Available quantities are budgets before the explicit concurrent reservations; callers must not double-count reservations in their supplied available quantities. Required model memory covers its entire evaluated context, even when the requested context is smaller. Missing capability evidence excludes only capabilities required by the selected workload.

The standalone initial Core module was an empty-result skeleton to establish meaningful RED rather than an import/harness error. The 33 policy cases then failed before production behavior was added. Supplemental assertions cover exact deficit/result values, serialization, independent requests and data boundary. Self-review added a RED/GREEN regression for negative available headroom; hiding overcommit would make the exclusion quantity imprecise.

## Commands, environments and results

Every test ran from its package directory using Bun 1.3.14 (`0d9b296a`). Tests used this exact environment prefix:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH OPENCODE_TEST_HOME=/private/tmp/m7-01-home XDG_CONFIG_HOME=/private/tmp/m7-01-xdg/config XDG_CACHE_HOME=/private/tmp/m7-01-xdg/cache XDG_DATA_HOME=/private/tmp/m7-01-xdg/data
```

Type/lint/format commands used the same pinned PATH. Log paths in the table are relative to `docs/validation/m7-01/`. Final product and test files are frozen at the hashes below.

| Cwd | Command following the environment prefix | Exit | Evidence |
| --- | --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/ai-access-and-local-inference/m7-01.test.ts` | 1 | `red-memory.log`: 0 pass, 1 fail, 2 assertions; expected `insufficient_memory`, received undefined |
| `packages/core` | same focused command | 1 | `red-policy.log`: 0 pass, 33 fail, 66 assertions against empty policy |
| `packages/core` | same focused command | 0 | `green-policy.log`: 47 pass, 0 fail, 88 assertions after implementation and supplemental assertions |
| `packages/core` | `bun test ./test/ftc/ai-access-and-local-inference/m7-01.test.ts --test-name-pattern 'overcommitted reservations'` | 1 | `red-overcommit.log`: 0 pass, 1 fail, 47 filtered; expected available -1, received 0 |
| `packages/core` | `bun test ./test/ftc/ai-access-and-local-inference/m7-01.test.ts` | 0 | `green-final.log`: **48 pass, 0 fail, 90 assertions** |
| `packages/schema` | `bun test ./test/ftc-inference.test.ts` | 0 | `schema-test.log`: **3 pass, 0 fail, 6 assertions** |
| `packages/schema` | `bun test ./test/ftc-inference.test.ts ./test/contract-hygiene.test.ts` | 0 | `schema-root-test.log`: final **9 pass, 0 fail, 18 assertions** across 2 files, including 4 inference tests and 5 relevant hygiene tests |
| `packages/core` | `bun typecheck` | 0 | `core-typecheck.log`; package script `tsgo --noEmit`, no diagnostics |
| `packages/schema` | `bun typecheck` | 0 | `schema-typecheck.log`; package script `tsgo --noEmit`, no diagnostics |
| `packages/core` | `bun ../../node_modules/oxlint/bin/oxlint -c ../../.oxlintrc.json --type-aware src/ftc/inference/catalog.ts test/ftc/ai-access-and-local-inference/m7-01.test.ts` | 0 | `core-lint.log`: 0 warnings/errors, 2 files |
| `packages/schema` | `bun ../../node_modules/oxlint/bin/oxlint -c ../../.oxlintrc.json --type-aware src/ftc-inference.ts test/ftc-inference.test.ts` | 0 | `schema-lint.log`: 0 warnings/errors, 2 files |
| `packages/core` | `bun ../../node_modules/prettier/bin/prettier.cjs --check src/ftc/inference/catalog.ts test/ftc/ai-access-and-local-inference/m7-01.test.ts resources/ftc/models.json ../schema/src/ftc-inference.ts ../schema/test/ftc-inference.test.ts` | 0 | `format-check.log`: all 5 matched files pass |
| `packages/core` | `bun typecheck` | 0 | final `core-root-typecheck.log`: includes coordinator's root export |
| `packages/schema` | `bun typecheck` | 0 | final `schema-root-typecheck.log`: includes root export and identity test |
| `packages/schema` | `bun ../../node_modules/oxlint/bin/oxlint -c ../../.oxlintrc.json --type-aware src/index.ts src/ftc-inference.ts test/ftc-inference.test.ts` | 0 | final `schema-root-lint.log`: 0 warnings/errors, 3 files |
| `packages/core` | `bun ../../node_modules/prettier/bin/prettier.cjs --check src/ftc/inference/catalog.ts test/ftc/ai-access-and-local-inference/m7-01.test.ts resources/ftc/models.json ../schema/src/ftc-inference.ts ../schema/src/index.ts ../schema/test/ftc-inference.test.ts` | 0 | final `format-root-check.log`: all 6 matched files pass |

Formatting applied the same five-file selection with `--write`; `format-write.log` records the final targeted formatting. Initial oxlint discovery from package directories returned exit 1 before source analysis (`options.typeAware` supported only in root config). Explicitly passing the existing root configuration with `-c ../../.oxlintrc.json` resolved that harness issue; both final scoped lint runs are clean. An initial relative log-directory setup was corrected before the meaningful RED run and its accidentally created empty package-local directories were removed.

Mutation checks used a Python driver from `packages/core`: preserve the exact catalog source, replace one exact expression, execute the focused Core command with the test environment above to a dedicated log, assert exit 1, then restore the original source in `finally`. These checks ran on the 47-test resource implementation before the subsequent negative-headroom refinement, and establish that the tests detect the named regressions:

| Source mutation | Exit | Test result | Log |
| --- | --- | --- | --- |
| Omit `work.jdt` from reservation aggregation | 1 | 38 pass, 9 fail | `mutation-reservations.log` |
| Replace shared GPU detection with `false` | 1 | 45 pass, 2 fail | `mutation-shared-gpu.log` |
| Replace evaluation provenance mismatch expression with `false` | 1 | 45 pass, 2 fail | `mutation-provenance.log` |

The restored final source then passed all 48 Core tests. Final Schema tests, both package type checks, both scoped lints and format check were refreshed after the negative-headroom source refinement. After the coordinator root export, Schema tests gained an exact canonical identity assertion, both package type checks and Schema lint were refreshed, and final formatting covered all six candidate files. No foreign-lane errors were present in those final commands.

## Assertion map and evidence boundaries

| Behavior | Focused assertion evidence |
| --- | --- |
| RAM and exact boundary | `insufficient resources exclude model with a reason`; exact memory boundary test; independent desktop/JDT/Gradle table; every concurrent project test |
| Disk before download | Gradle disk reservation excludes; simultaneous deficits report required 100 / available 99 |
| GPU pool accounting | Shared and dedicated boundary table; dedicated GPU does not consume RAM; concurrent GPU headroom; missing GPU facts; exact remaining RAM 100 / GPU 0 / disk 300 |
| Working context | Requirement 4097 is excluded at profile capacity 4096 with both numeric values |
| Selected capabilities | Missing structured tools excluded; caller-ordered English/Simplified Chinese/tool capability checks; unrequired capabilities do not block |
| Platform/backend | Distinct OS, architecture, backend cases; GPU resource availability; unavailable resources do not become assumed budgets |
| Curated metadata | Digest, HTTPS source, license, template, revision and evidence validation; invalid CPU GPU requirement; duplicate profile identity; provenance mismatch and unevaluated profile exclusions |
| Exact budget facts | Multiple simultaneous reasons and stable order; negative -1 available budget survives recommendation Schema decoding; fractional/NaN/infinite/overflow facts rejected |
| Isolation/data boundary | Repeated separate requests do not leak selection state; supplied JSON remains identical; real shipped catalog file returns no model recommendation |
| Public contracts | Recommendation JSON round-trip, undefined optional property omission, unknown-versus-zero resource rejection, unique domain-qualified identifiers, canonical root/direct Schema identity |

All model sizes, context capacities, runtime/model revisions, digests, capabilities and resource budgets in unit inputs are synthetic. The `example.invalid` HTTPS URLs are never fetched. Reading the real empty JSON file is data-boundary evidence only. Both production/synthetic branches use the actual policy; tests do not mock the subject or reset globals. This code imports only canonical Schema and Effect, and performs no I/O at import or selection time. The pure policy has no service/lifecycle resources to dispose and therefore requires no artificial Effect service layer.

Not run or credited: full application or unrelated broad regression suites (the dispatch explicitly limits reruns), M7-08 runtime/model measurements, hardware minimums, platform/backend runtime execution, throughput/quality, verified bilingual/tool performance, downloads/cache/lifecycle/credentials/local-only enforcement, M7 production facade/host binding, UI integration and release acceptance. Runtime OS-version/vendor/driver specifics and heterogeneous GPU pools are future measured configuration/binding questions. Capability/evaluation evidence is consumed as supplied producer facts, not reverified by the selector. Shipped production recommendations remain empty until actual M7-08 evidence is curated.

## Frozen candidate hashes

Produced by `shasum -a 256` from repository cwd, exit 0; machine-readable copy: `m7-01/candidate-sha256.txt`. Any later source/test/data edit requires refreshed verification and hashes.

| File | SHA256 |
| --- | --- |
| `packages/schema/src/index.ts` (coordinator export) | `f3233bd0c40a4d47f387da03cdd3d6242decfe4c825a092ee3f1aaae0dba2c0b` |
| `packages/schema/src/ftc-inference.ts` | `f5314080899d7b7baa1c42b1fab8d7d34f0fe5850d6303f0613944e25db53684` |
| `packages/schema/test/ftc-inference.test.ts` | `2b6b0c831c7516f8d8657618e193cc5f648e993d153398166f2e07eb9c4505f0` |
| `packages/core/src/ftc/inference/catalog.ts` | `bddafca589ef0819b60e44d760b0437127e68d795d5486e9114af77deb458613` |
| `packages/core/resources/ftc/models.json` | `bc2b32994d18c54618f2759a948e455c847f82c3a988c5e17b8d785bec5de7e5` |
| `packages/core/test/ftc/ai-access-and-local-inference/m7-01.test.ts` | `7f2373fba93faef65c7a71e272835764c309dced53b70d2a7d05ad476de83f57` |
