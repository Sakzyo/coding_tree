# M3-04 implementation candidate

Date: 2026-10-08. Product review base: `11b3fe90e` on `ftc-workspace`.

Status: **DONE_WITH_CONCERNS** — isolated implementation and required local checks pass; candidate awaits independent review. No module/task checklist or ledger completion credit is claimed. Root owns staging, commits, exports and ledger reconciliation.

## Scope and assumptions

Implemented only the four planned FTC context producer/adapter paths, the planned M3-04 test, the approved unavailable-only diagnostics Schema record, and the coordinator-approved shared `packages/core/src/ftc/context-sanitizer.ts` infrastructure file. The coordinator added the one-line `FtcDiagnostics` root Schema export; its exact bytes are included in the frozen source manifest. No public configuration/knowledge Schema wrappers were necessary: private codec compositions reuse their nested canonical values.

Read root/package instructions, the dispatch brief and preflight, `docs/prompt.md`, the M3 task plan, AI-05/06, the design's M3/System Context/state-ownership sections, and the Superpowers TDD skill/reference before implementation. Source-backed memory reinforced the module ownership and isolated-test constraints; current repository documents were authoritative.

The supplied `FtcProject.ProjectContext` is an already-authorized association/root/Location capability. This code neither recanonicalizes paths nor grants filesystem access. M5/M6/M11 observations are immutable public records or narrow lookup ports; the test replaces fixture observations to simulate refresh. No sibling implementation/store, bootstrap or production composition is consumed by the adapter. No import starts observation or I/O.

## Resulting behavior

- `FtcAgentContext.source` captures project, language and inference selection; adapts supplied canonical Java documents lazily; preserves independent buffer/disk revisions and dirty state, explicit missing facts, supplied freshness and online disclosure/offline limits. It rejects a document from another association. It marks displayed text as a sanitized context projection, so original revisions remain source provenance.
- `FtcConfigurationContext.source` preserves the canonical manifest revision/hardware/pathing and inspection SDK/dependencies/versions/conflicts/source-revision states/unknowns. Initialization proposals retain their missing-manifest/proposal identity; proposed values are never relabelled installed hardware. Project/root/Location observations must match the binding.
- `FtcKnowledgeContext.bound` captures a canonical query, invokes the existing `source(...).load` path through a lookup-only port, and preserves the query beside canonical results. It retains language, SDK/library applicability, local-only selection, missing-reference reasons and source/version/digest/license/provenance/code-token fields. Source digests identify original bytes, not sanitized displayed bodies. A missing response must reconcile the same query.
- Legacy `FtcKnowledgeContext.source` keeps its existing snapshot/rendering shape and lookup-failure/unavailable behavior. Its consumed service type narrows to `Pick<Interface, "lookup">`. It remains a compatibility path, not an implicitly sanitized model-context path; M3-06 must bind the new safe path explicitly.
- `FtcDiagnostics.ContextUnavailable` contains only `kind: unavailable`, `reason: observation_adapter_unavailable`, unknown freshness/logs/deployed-build state. No controller identity, project measurement association, generation, timestamps, telemetry or positive deployed-build evidence is fabricated. The producer validates the allowlisted observation before snapshots; malformed observations become temporary unavailability with no raw decoder-cause disclosure.
- Producers return project-bound opaque contexts under stable FTC keys. The M3 adapter verifies all source project/root/Location bindings and the supplied Location before registration. It uses the real scoped `SystemContextRegistry`; duplicate source keys reject before registration. A child registration scope rolls back partial registration when a later existing-key conflict occurs and closes normally with the owner scope.

## Trusted sanitization boundary

All arbitrary string fields in the new code/configuration/reference model projection are explicitly projected from canonical fields and passed through the required caller-supplied sanitizer. Text and identifier roles are assigned at their owning fields, not guessed from key names. Credential Values, keys, tokens, stores and arbitrary extra record properties are not projected. Nested reference bodies, lesson titles/bodies, prompts and criteria are covered.

Safe identifiers are retained exactly. An attempted identifier rewrite rejects with the safe explicit limit `context_identifier_rejected: sensitive identifier cannot be preserved`, without echoing the identifier. Missing, failing or throwing sanitizer capabilities become `SystemContext.unavailable`; first admission blocks and reconciliation retains only a previously safe admitted snapshot. Sanitizer defects are reduced to a safe generic unavailable result, without exposing their supplied cause. Source decoding, encoding, rendering and Session epoch persistence receive the sanitized projection. Undefined optional keys are omitted only after that projection is safe.

External repository/reference/log text is labelled observed data with no approval authority. Hostile fixture instructions remain visible as observations; no approval field or action capability is produced. No source revision/freshness change grants deployment/start/tuning authority.

The fixture sanitizer recognizes one explicit synthetic token and preserves the tested English/Chinese/API/device identifiers. It proves the supplied-capability boundary for these cases, not general secret discovery, production code-token preservation, OS credential access or a completed production sanitizer. M3-06 must supply the trusted implementation and correctly align Session selection, inference mode and local-only knowledge queries.

## Verification

Environment: macOS 26.5.2 build 25F84, Darwin 25.5.0 arm64. Pinned runtime: `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`, Bun 1.3.14 (`0d9b296a`). Dependencies were already installed; no new dependency or manifest/lockfile changes.

Test commands prefixed `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`, `OPENCODE_TEST_HOME=/private/tmp/m3-04-home` and `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME` under that same owned temporary directory. `HOME` and `CODEX_HOME` were not changed. Logs redirect output, capture the command's real status immediately, then exit with that captured status.

| Check | Cwd | Result / evidence |
| --- | --- | --- |
| Coordinator pre-edit baseline: SystemContext index/registry + M11-02 | `packages/core` | 52 pass, 101 assertions; `docs/validation/resume-2026-10-08/context-baseline.log` |
| Initial behavioral RED, `bun test ./test/ftc/agent-and-context/m3-04.test.ts` | `packages/core` | Exit 1, expected baseline token leak in existing knowledge source; `m3-04/red.log` |
| Captured-selection RED | `packages/core` | 11 pass / 1 fail; input mutation retargeted language/inference; `m3-04/red-selection.log` |
| Registration/malformed-diagnostics RED | `packages/core` | 12 pass / 2 fail; partial registrations remained and malformed diagnostic decoder exposed token; `m3-04/red-boundaries.log` |
| Throwing-sanitizer RED | `packages/core` | 14 pass / 1 fail; sanitizer defect cause exposed token; `m3-04/red-sanitizer-defect.log` |
| Final exact focused command, `bun test ./test/ftc/agent-and-context/m3-04.test.ts` | `packages/core` | Exit 0; 15 pass, 67 assertions; `m3-04/focused-final.log` |
| `bun test ./test/ftc/agent-and-context/m3-04.test.ts ./test/system-context/index.test.ts ./test/system-context/registry.test.ts ./test/ftc/ftc-knowledge/m11-02.test.ts ./test/ftc/agent-and-context/m3-01.test.ts ./test/ftc/agent-and-context/m3-02.test.ts` | `packages/core` | Exit 0; 85 pass, 284 assertions, six files; `m3-04/tests-final.log` |
| `bun typecheck` | `packages/core` | Exit 0; `m3-04/core-typecheck-final.log` |
| `bun typecheck` | `packages/schema` | Exit 0; `m3-04/schema-typecheck-final.log` |
| Scoped `bun node_modules/oxlint/bin/oxlint` over the eight source-manifest paths | repository root | Exit 0; zero warnings/errors; `m3-04/lint-final.log` |
| Scoped `bun ../../node_modules/prettier/bin/prettier.cjs --check` over the eight source-manifest paths | `packages/core` | Exit 0; `m3-04/format-final.log` |
| Scoped `git diff --check` | repository root | Exit 0; `m3-04/diff-check-final.log`; new files also covered by formatting |

Intermediate `green-1.log` records a corrected syntax error, `green-2.log` a corrected Location class equivalence issue, `green-3.log` corrected undefined optional wire fields, and `green-4.log` corrected optional-query shape equivalence. `core-typecheck-1.log` records corrected heterogeneous-source typing and test-layer issues; `green-5.log`/`green-6.log` record the subsequent passing states. They are debugging records, not acceptance logs. The final logs above supersede them. Package-relative lint initially failed on `..` paths/root-config discovery; the corrected repository-root invocation is the passing final evidence.

Tests use actual producer constructors/codecs, actual scoped registry instances and actual `SessionContextEpoch.initialize/prepare`. The epoch test creates two Sessions through the real public Session facade with execution disabled, uses a real owned temporary SQLite database and EventV2/Session projection, then reads persisted rows/history only for assertions. It proves retained durable baseline, safe `ContextUpdated` history, snapshot advancement, unchanged-input deduplication, prior safe snapshot retention on transient observation loss and separate epochs. It performs no runner/model/provider/server execution. The temporary database is disposed with its owned fixture.

## Freeze, limits and handoff

Frozen tested SHA256 paths: `docs/validation/m3-04/source-sha256.txt`. It includes seven implementer product/test paths and the coordinator's Schema barrel export. No product source edits are intended after this freeze.

Self-review checked namespace/import boundaries, explicit allowlists, no sibling runtime imports, preservation of safe identifiers/unknowns/revisions, lazy supplied observations, scoped cleanup/rollback, no action authority, and unchanged Session/SystemContext algebra/registry ownership. No generated clients, root exports other than the coordinator's diagnostics export, composition, manifests, lockfiles, runner/history/timeline, ledger or task checkboxes were edited by this worker. No commit, push, delegation, server/app restart or deployment occurred.

Remaining limits: independent review is pending; actual M3-06 host composition/trusted sanitization/Session-specific selection remains unimplemented by this task. Independently constructed registry scopes do not establish simultaneous selections in one production Location registry. No M10 positive observations/telemetry/log decoding, controller protocol promotion, verified deployed-build association, real robot or model/provider acceptance, Windows execution, SDK/native platform evaluation or release acceptance is credited. The task does not alter Session/timeline paths, so existing performance evidence is retained. No package-wide suite was run, as the task brief explicitly bounds regression commands and unrelated baseline failures do not require exhaustive reruns.
