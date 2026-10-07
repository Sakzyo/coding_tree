# M5-02 implementation evidence

Candidate frozen on 2026-10-07 for coordinator review. Dispatch base: `1dd9f1ba3`; reviewed M5-01 prerequisite: `9bcb23ce6`. This report does not mark the ledger complete or claim production composition. Coordinator owns review, Git and task checks.

## Implemented contract and scope

- Canonical Schema `Revision = {documentID, bufferRevision, diskRevision}`, `SaveRequest`, `EditProposal = {projectID, edits: [{path, expectedRevision: Revision, replacement}], explanation}`, `EditConflict`, `EditResult`, and extended `DocumentError`/`DocumentEvent`. Java facade re-exports the exact canonical values. Existing numeric `changeDocument` API stays intact.
- `saveDocument(SaveRequest)` saves the owned buffer only against the complete matching pair/identity; `applyEdits({proposal, authorization})` uses an injected trusted `CodeChanges.check` port. The port receives a captured deeply frozen full proposal plus opaque runtime object and returns authorized project ID, canonical root and canonical paths. No JSON approval/bearer contract, M3 approval policy or local plan identity store is introduced. M3 owns binding the exact full proposal/revisions to its approval identity.
- A fresh owner creates new DocumentIDs, so old revisions cannot authorize restarted documents even when numerical revisions coincide. Disposed owners reject escaped commands and interrupt pending trusted authorization/preflight reads.
- Mutation-enabled filesystem bindings supply byte reads and conditional writes. Original bytes are copied at document open, never reconstructed later from a text-only read. Missing capabilities fail visibly. The conditional adapter must recheck root/target placement and exact expected bytes at its commit boundary; a conflict writes nothing. Source remains UTF-8, preserves an existing BOM, keeps supplied line endings, and rejects invalid UTF-8/unpaired Unicode rather than silently encoding different bytes.
- Each save/edit checks trusted canonical project membership and canonical path, expected document identity, buffer revision and observed disk revision. Agent edits also reject a dirty buffer even with matching revisions. Multi-file proposals reject duplicate canonical aliases and preflight every admitted file before any write; sorted canonical locks serialize owner mutations without deadlock.
- On observing changed disk bytes, only the disk revision/baseline and dirty comparison change; buffer text/revision survive. `disk_changed` publishes that exact observed snapshot. Conflicts preserve the original proposal and buffer/disk versions and offer `save`, `merge`, `defer`: defer does nothing; save explicitly uses the returned fresh pair; merge uses `changeDocument` then guarded save. No automatic overwrite/force-save is provided.
- Authorization and scope are checked again after the final disk observation and before each commit. Compare/write plus confirmed snapshot/event publication form one cancellation boundary; caller cancellation after write cannot leave an old snapshot describing a confirmed new disk state.
- Results distinguish `applied`, `conflict` (including earlier committed snapshots), and `failed`. Write failures carry `outcome: unknown` and failed `uncertainPaths`; confirmed earlier commits remain reported and no rollback overwrites later external bytes. A save failure preserves the dirty buffer and marks an unknown filesystem outcome. No saved event is credited to a failed write.
- Existing opened files only. Missing/new-file targets are rejected; existing unopened targets cannot be adopted by a proposal. **M6-04 new-template composition requires a later producer-owned create contract and verification** before it can pass. No FileMutation, host, language service, build, UI, M3 policy or robot authority edits were made.

## Verification environment and commands

Pinned Bun: `1.3.14 (0d9b296a)`, via `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH` for every command below. Core tests use task-owned `OPENCODE_TEST_HOME=/private/tmp/m5-02-home`, `XDG_DATA_HOME=/private/tmp/m5-02-data`, `XDG_CONFIG_HOME=/private/tmp/m5-02-config`, `XDG_CACHE_HOME=/private/tmp/m5-02-cache`, `XDG_STATE_HOME=/private/tmp/m5-02-state`. No app/server restart or downloads.

| Working directory | Command (after environment above) | Exit / evidence |
| --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/java-development/m5-02.test.ts` | 0; **28 pass, 0 fail, 110 assertions**, `m5-02/focused-final.log` |
| `packages/core` | `bun test ./test/ftc/java-development ./test/file-mutation.test.ts` | 0; **61 pass, 0 fail, 204 assertions**, `m5-02/affected-final.log`; includes unchanged M5-01 and shared FileMutation regressions |
| `packages/core` | `bun typecheck` | 0, `m5-02/core-types-final.log` |
| `packages/schema` | `bun test ./test/ftc-java.test.ts ./test/contract-hygiene.test.ts` | 0; **23 pass, 0 fail, 52 assertions**, `m5-02/schema-final.log` |
| `packages/schema` | `bun typecheck` | 0, `m5-02/schema-types-final.log` |
| `packages/core` | `bunx --no-install oxlint --config ../../.oxlintrc.json src/ftc/java.ts src/ftc/java/documents.ts test/ftc/java-development/m5-02.test.ts` | 0; **0 warnings, 0 errors**, `m5-02/core-lint-final.log` |
| `packages/schema` | `bunx --no-install oxlint --config ../../.oxlintrc.json src/ftc-java.ts test/ftc-java.test.ts` | 0; **0 warnings, 0 errors**, `m5-02/schema-lint-final.log` |
| repo (format only) | `bunx --no-install prettier --check packages/core/src/ftc/java.ts packages/core/src/ftc/java/documents.ts packages/schema/src/ftc-java.ts packages/core/test/ftc/java-development/m5-02.test.ts packages/schema/test/ftc-java.test.ts` | 0, `m5-02/format-final.log` |
| repo (diff only) | `git diff --check -- packages/core/src/ftc/java.ts packages/core/src/ftc/java/documents.ts packages/schema/src/ftc-java.ts packages/core/test/ftc/java-development/m5-02.test.ts packages/schema/test/ftc-java.test.ts` | 0, `m5-02/diff-check-final.log` |

### RED/GREEN and retained attempts

- Initial focused test was written before production edits. `bun test ./test/ftc/java-development/m5-02.test.ts` in Core: **exit 1, 0 pass/1 fail/1 assertion**, `red.log`: real layer/temp-file harness loads, explicit assertion finds missing `applyEdits`. This proves absent API scaffolding, not by itself the later conflict algorithm.
- First conflict/save/partial-write implementation: **exit 0, 15 pass/64 assertions**, `green-attempt-1.log`.
- A new final-read authorization revocation regression exposed a real missing recheck: `bun test ./test/ftc/java-development/m5-02.test.ts --test-name-pattern 'authorization revoked during'`: **exit 1, 0 pass/1 fail**, `revocation-red.log` (mutation incorrectly succeeds), then **exit 0, 1 pass/3 assertions**, `revocation-green.log` after adding the recheck before commit.
- A new unpaired-Unicode regression exposed real encoding normalization: `bun test ./test/ftc/java-development/m5-02.test.ts --test-name-pattern 'unpaired Unicode'`: **exit 1, 0 pass/1 fail**, `unicode-red.log` (replacement incorrectly applied), then **exit 0, 1 pass/3 assertions**, `unicode-green.log`. Invalid input now fails on the Effect domain-error channel before proposal preflight; the final assertion checks that classification and unchanged disk/owned snapshot. Later matrix additions that already passed are coverage additions, not claimed as prior RED cycles.
- `green-attempt-2.log`: **exit 1, 19 pass/1 fail** from an owner-disposal fixture obtaining a service after its temporary provider lifetime closed, not a product failure. Fixture changed to `JavaDocuments.make(...).pipe(Scope.provide(scope))`, giving the owner the explicit tested lifetime. `core-types-attempt-2.log` documents the associated missing Scope environment on the trusted port. Corrected with an explicit scoped port; `green-attempt-3.log` passes **20/84**.
- `affected-state-root-attempt.log`: **exit 1, 48 pass/1 fail/1 error**, imported existing FileMutation test attempted default user state-root mkdir. Adding task-owned `XDG_STATE_HOME` resolves it; complete affected selection passes 61/204.
- Initial Core types (`core-types-attempt-1.log`) fail on new local choice literal/outcome narrowing; corrected. Initial Schema types (`schema-types-attempt-2.log`) fail on added test brand/kind/event literal widening; corrected. A subsequent lint cleanup revealed new local generator control-flow narrowing (`core-types-narrowing-attempt.log`); explicit returns restore narrowing and both types/lint are green. These are owned-lane attempts, not foreign failures.
- Automatic package-directory lint config discovery fails (`core-lint-config-attempt.log`, `schema-lint-config-attempt.log`); explicit repository root config succeeds. `core-lint-warnings-attempt.log` preserves new unused bindings/return-style warnings; final lint is clean. Format write/green attempt logs remain retained; no prior passing evidence was deleted.

## Assertion map

| Requirement | Real implementation test evidence |
| --- | --- |
| Dirty/external bytes and proposal survive stale edits | `dirty or externally changed files reject stale edits`; `preflight rejects the whole multifile proposal when a later file is dirty`; clean-buffer external-change event test |
| Save rechecks buffer and disk revisions and exposes current versions | `save rejects external changes and stale buffer or disk revision without losing either version`; conditional-write race test |
| Conflict choices are actionable | `observed disk conflict permits explicit merge or save with the returned fresh pair`; closed owners/fresh-owner stale identity tests |
| Trusted authority and exact captured proposal | forged token/wrong-file grant test; immutable proposal during async authorization test; revocation after preflight and during final read tests |
| Canonical scope and multi-file preflight | duplicate-alias/new-file test; save/apply symlink escape test; all-or-none dirty-file preflight test; unchanged M5-01 traversal/sibling/project membership cases |
| Honest partial filesystem state | partial real second-file write failure reports first commit plus uncertain path; later conditional conflict reports first commit and external second bytes; save failure preserves dirty snapshot |
| Cancellation and owner resources | caller cancellation releases preflight resource; owner disposal releases authorization resource; post-write cancellation keeps snapshot/disk consistent; all escaped new APIs reject owner_closed |
| Source bytes and revisions/events | raw-byte BOM/CRLF save test; agent BOM/line-ending test; invalid UTF8/unpaired Unicode rejection; saved/disk_changed event identity assertions; concurrent proposals admit one write |
| Canonical Schema/facade behavior | exact facade/schema identity test; full revision/request/result JSON tests; optional undefined omission; invalid revisions/empty edits/conflicts rejected; stable identifiers and hygiene |

## Evidence limits and unrun gates

Tests exercise the actual Java facade/documents owner with real temporary files and explicit external ports. The filesystem fixture uses real canonical-path resolution, real bytes, expected-byte comparison and real writes; failure/race ports deliberately inject a real external write or real partial second-file write. Trusted authorization and controlled suspension/resource ports are fixture code, not production user approval. No globals or mock of the Java implementation.

The conditional-write fixture is an in-process check/write boundary; this evidence does not claim an operating-system transaction across files or atomic exclusion against arbitrary external processes after the adapter's final check. Production composition must bind and evaluate a filesystem adapter honoring canonical placement and conditional commit, plus an authenticated code-owner boundary binding full proposals/revisions. No production enablement credited.

Unrun: actual Monaco/editor integration, production authenticated authorization adapter, production filesystem adapter race evaluation, host/bootstrap wiring, native Windows filesystem behavior, packaged application acceptance, JDT LS/build/artifact integration, M6-04 create/new-template composition, crash/transaction recovery. Session orchestration and robot mutation rights are untouched; unrelated broad suites were not rerun.

## Frozen source SHA256

`m5-02/source-sha256.txt` is the machine-checkable source/test manifest. No edits to these five paths after the final tests/types/lint/format checks and manifest generation.

```
c4e6c2704a24b39bcb95c49d0e085f90ebd287499808c25d56397547d7ec830b  packages/core/src/ftc/java.ts
38a14f167f0837130e7d27dc22dd2c6af57189d8d156aa528eba3b2e18bb5792  packages/core/src/ftc/java/documents.ts
d88d6d719d8c32cf090e37cbb6fe757b1f1cf31c64b6b3d63b76ababdb059a13  packages/schema/src/ftc-java.ts
a506c72aa3c5c37fde381c895c5313ed67e38a9ec7f9984948958426fa8f2387  packages/core/test/ftc/java-development/m5-02.test.ts
2879422b2d5f66283e8b59b50024b2944c7955b41137b43f3310b28b5c1c9a23  packages/schema/test/ftc-java.test.ts
```

## Fix round 1 — Important I1, final authority ordering

Review baseline: `23eed3535`. Read the full independent report `docs/validation/M5-02-review.md`, including the real-file probe showing `{result: applied, checks: 3, revoked: true, writes: 1, disk: agent}`. Root cause: the final `checkChanges` preceded `checkScope`, whose project/root/target resolution awaits allowed revocation after the last authority check. This is a Core admission defect, separate from the production filesystem atomicity gate.

The fix only reorders that final boundary: finish `checkScope` first, then revalidate the trusted full-proposal grant against project/root/all canonical paths, then enter conditional commit. The conditional adapter's commit-time placement and byte checks remain intact. No new-file semantics, host adapters, approval policy, Schema contracts, shared files or deferred Minor M1 coverage were changed. Source change is limited to `packages/core/src/ftc/java/documents.ts`; the regression addition is limited to `packages/core/test/ftc/java-development/m5-02.test.ts`.

TDD regression `revocation during final scope resolution stops file %s before its conditional write` runs twice against the real owner, real canonical root/target resolutions, real temporary files and real conditional filesystem writes. Its controlled realpath port revokes authority during the final root resolution after the mutation's disk read and its post-read scope validation. It asserts revocation occurred, the affected conditional writer was never invoked, disk/buffer are preserved, and trusted authorization rejects the operation. First-file case asserts zero conditional writes and `edit_unauthorized` on the error channel. Second-file case asserts only the first confirmed write, a `failed` result carrying that first snapshot, `edit_unauthorized`, no uncertain write path, and unchanged second-file bytes/snapshot.

Same pinned Bun and task-owned environment as above. No Git/index/ledger/checklist/subagent actions. Commands, working directories, exit/counts:

| Working directory | Command | Exit / evidence |
| --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/java-development/m5-02.test.ts --test-name-pattern 'revocation during final scope'` before production edit | **1; 0 pass, 2 fail, 4 assertions**, `m5-02/fix-1-red.log`; both failures prove the revoked target still reached conditional write |
| `packages/core` | same scoped command after ordering fix | **0; 2 pass, 15 assertions**, `m5-02/fix-1-green.log` |
| `packages/core` | `bun test ./test/ftc/java-development/m5-02.test.ts` | **0; 30 pass, 125 assertions**, `m5-02/fix-1-focused.log` |
| `packages/core` | `bun test ./test/ftc/java-development ./test/file-mutation.test.ts` | **0; 63 pass, 219 assertions**, `m5-02/fix-1-affected.log` |
| `packages/schema` | `bun test ./test/ftc-java.test.ts ./test/contract-hygiene.test.ts` | **0; 23 pass, 52 assertions**, `m5-02/fix-1-schema.log` |
| `packages/core` | `bun typecheck` | **0**, `m5-02/fix-1-core-types.log` |
| `packages/schema` | `bun typecheck` | **0**, `m5-02/fix-1-schema-types.log` |
| `packages/core` | same scoped `bunx --no-install oxlint --config ../../.oxlintrc.json` command above | **0; 0 warnings/errors**, `m5-02/fix-1-core-lint.log` |
| `packages/schema` | same scoped lint command above | **0; 0 warnings/errors**, `m5-02/fix-1-schema-lint.log` |
| repo | same five-path `bunx --no-install prettier --check` command above | **0**, `m5-02/fix-1-format.log` |
| repo | same five-path `git diff --check -- ...` command above | **0**, `m5-02/fix-1-diff-check.log` |

Retained `fix-1-core-types-attempt.log` documents one new regression assertion comparing a branded canonical path to an unbranded fixture filename. The expectation now uses the opened canonical snapshot path; production behavior and substantive assertions remain unchanged. Core tests/types/lint/format were refreshed after that correction. No failing gate is waived.

Candidate frozen after these checks. Existing evidence limits and unrun production/editor/Windows/create gates remain unchanged. This fix addresses I1; independent re-review is still required before task completion. The preceding initial SHA256 block is historical; `m5-02/source-sha256-before-fix-1.txt` preserves it. The current `m5-02/source-sha256.txt` and following block supersede it:

```
c4e6c2704a24b39bcb95c49d0e085f90ebd287499808c25d56397547d7ec830b  packages/core/src/ftc/java.ts
b33fbbd4711417f7dcf2c38a490de64802f059ce277ec12e30d96a47e88dfce7  packages/core/src/ftc/java/documents.ts
d88d6d719d8c32cf090e37cbb6fe757b1f1cf31c64b6b3d63b76ababdb059a13  packages/schema/src/ftc-java.ts
a17c5c86f805ddbe19bf7a84d2ef60995ef922245cc89307c4ab98d283312af4  packages/core/test/ftc/java-development/m5-02.test.ts
2879422b2d5f66283e8b59b50024b2944c7955b41137b43f3310b28b5c1c9a23  packages/schema/test/ftc-java.test.ts
```
