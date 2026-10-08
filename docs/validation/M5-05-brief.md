# M5-05 saved-build implementation brief — 2026-10-08

Assigned to `/root/m5_05` for read-only preparation at `87fffe434`. Product/test edits require explicit root release after M1-01 review. Only owned unchanged baseline/report evidence is permitted before release. Active session stops at32/94 completed tasks; this is the intended task30. Read root/Schema AGENTS.md, docs/prompt.md, M5 module/exact task, relevant EDT/ENV/ROB and high-level M5 build/ownership/currency sections, docs/validation/M5-05-preflight.md and M5-05-resume-reconciliation.md. M5-01 and M5-02 are independently reviewed; production M5-03/M9-08/platform gates remain unavailable.

Allowed product paths: packages/core/src/ftc/java/build.ts, packages/core/src/ftc/java.ts, packages/core/test/ftc/java-development/m5-05.test.ts, canonical first-method packages/schema/src/ftc-java.ts and new packages/schema/test/ftc-java-build.test.ts. Evidence docs/validation/M5-05-implementation.md and docs/validation/m5-05/* only. Root owns exports/Git/index/ledger/checklists; no worker commits/subagents, JavaDocuments/private map/old-test edits, Schema root barrel, migration, Protocol/Client, host/composition, app or production adapter edits.

## Adopted source-backed contracts

Define BuildID/BuildRequest/BuildEvidence/BuildError and necessary build query/record contracts once in FtcJava; Core re-exports exact identities. Reuse canonical FtcProject.ProjectContext, FtcEnvironment.ToolchainDescriptor and existing document IDs/revisions for exclusion provenance. sourceRevision is an explicit producer-owned complete saved-input identity; do not substitute open-file disk revisions. Configuration identity is an independent exact producer revision. Keep request fields limited to planned project/toolchain/configuration; no shell/task/env/output selector, artifact or bearer capability supplied by model JSON.

Use JavaBuild.make scoped owner with three required narrow Core ports: authoritative project resolution, complete scoped saved-input/fixed-recipe lease acquisition+revalidation, scoped process observations/cancel-and-join. No sibling runtime/store import or filesystem crawler/toolchain detection. The complete retained lease must guarantee immutable snapshot inputs or complete change-aware interval protection, include a captured generation/change identity to catch A-B-A and config changes, bind root/Location/descriptor/wrapper/build JDK/SDK recipe, reject unsupported external/incomplete input scope, and report initial/settlement dirty exclusions without text. Actual recipe and JDK path convention come from the trusted runtime port; no guessed Gradle task or global Gradle. No OS/production Gradle execution is enabled.

Choose immutable complete snapshot execution for this isolated owner. Trusted revalidation covers current live source/configuration and intervening changes through settlement, not endpoint digest equality alone. Real temporary fixture files/declared complete fixture inventory and public document reads may support isolated tests; they prove only that fixture's scope. Required production inventory/dirty-document/recipe authority remains explicit unimplemented binding, never a manufactured supported profile. Runtime execution capability stays opaque/Core-only and bound to the exact lease.

Add only build()/startBuild()/readBuild() with the reconciled owner-issued ID/real runtime handle/query semantics. BuildRun is Core-only {buildID,result,cancel}; canonical BuildQuery is {projectID,buildID}, BuildRecord is running/settled with evidence only in settled. startBuild returns a scoped owner-held run; long acquisition is interruptible, short admission bookkeeping masked, resource Scope transfers to retained worker. The convenience build captures/adopts the admitted run, waits and cancels/joins on caller interruption while preserving interruption; query/cancel yields truthful settled cancelled evidence. No test-only accessor, durable history/recovery or automatic retry. Unknown/foreign IDs fail typed, caller JSON evidence never history. Same-canonical-root builds reject busy; distinct roots remain independent. Root/Location authority is rechecked at execution/query/currency boundaries.

Adopt terminal precedence: accepted cancellation before publication wins cancelled; otherwise established saved-source/configuration/interval change wins outdated even with nonzero exit; otherwise fully observed unchanged exit0/output+cleanup succeeds for the saved basis; all other executions fail with stable observed causes. Revalidation failure cannot prove unchanged currency or invent inputChanged. Preserve actual/absent exit and signal, ordered stdout/stderr text and output completeness; typed cleanup/output/termination failures cannot masquerade as success. Settle one immutable owner record only after scoped process/pipe/lease cleanup; cancellation/finish races and repeated result/cancel/query reuse that record. Owner disposal retires admissions, cancels/joins active work and prevents late retention.

Unsaved buffers stay untouched and excluded. Evidence explicitly identifies savedInputsOnly and initial/settlement exclusion summaries including paths/document/revisions, never text. Successful saved-snapshot compilation with dirty exclusions is historical saved-basis success; it cannot authorize current displayed-program readiness/deployment. M4 verified exchange stays unavailable until M5-06 supplies actual owner-issued APK digest/current validation; M5-05 produces no artifact.

Keep Java.layer(documentPorts) source-compatible with no build acquisition. Add explicit Java.layerWithBuilds({documents,builds}) under same Location Scope; combined facade has typed build_unavailable methods in document-only mode. Construction/import starts no external I/O/build/tool setup. Existing document interface/ports/method behavior remains owned by JavaDocuments.

## Verification

TDD intended source-change behavioral RED using real callable owner plus narrow ports, then minimum GREEN. Preserve exact task assertions and include actual public cancelled-evidence path, complete fixture inventory/config/ABA/output-cache distinctions, dirty-before/during and untouched real document buffers, immutable ingress/port/logs/records, project/root/Location/lease/descriptor mismatches, acquisition/start/stream/exit/revalidation/cleanup failures, actual partial outputs, explicit/caller/owner cancellation with held async cleanup, same-root busy/different-root parallel, fresh owner/unknown queries, facade compatibility and canonical Schema hygiene/optional omission. No copied status/applicability logic in fixtures. A harmless owned process fixture may verify its own child/pipe cancellation; no actual product build scripts, unrelated processes, provider/robot/toolchain download.

Pinned executable /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun; isolate OPENCODE_TEST_HOME/XDG under /private/tmp/m5-05-home, never HOME/CODEX_HOME. From packages/core run exact focused test and M5-01/02 affected facade regressions plus bun typecheck; from packages/schema focused ftc-java-build and owning hygiene selection plus bun typecheck. Scope lint/format/actual import/whitespace checks and source freezes to assigned paths, preserve raw diagnostics. Check public owner Scope cleanup, not only low-level port release; known Effect beta.83 mutable-observer behavior must be reproduced/fixed locally if present, no M6 sibling import. Freeze command/cwd/exit/count evidence and tested source/report identities for independent spec+quality review; candidate only, never task credit.

## Exact original task excerpt

### M5-05 — Build saved revisions and retain actual output

**Prerequisites:** [M5-01](java-development.md#m5-01).

**Files:** `packages/core/src/ftc/java/build.ts`, `packages/core/src/ftc/java.ts`, `packages/core/test/ftc/java-development/m5-05.test.ts`.

**Interfaces:** Produces `build({ project, toolchain: ToolchainDescriptor, configurationRevision }): BuildEvidence`; consumes a build process and saved input snapshot/hash port.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-05.test.ts`, add `source change during build makes evidence outdated`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(changed.status).toBe('outdated'); expect(changed.inputChanged).toBe(true); expect(cancelled.status).toBe('cancelled')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use the project's Gradle wrapper and build JDK. Build a stable saved snapshot or verify relevant input revisions before/after execution; show unsaved-buffer exclusion. Capture exit status/logs and terminate owned child processes on cancellation. Production process access remains subject to M9-08.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): build saved revisions and retain actual output`.
