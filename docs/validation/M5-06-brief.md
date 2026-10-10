# M5-06 exact implementation brief — 2026-10-10

Role: implement task M5-06 within M5. Sole product writer; no delegation, Git mutations, ledger/checklist changes, sibling implementations, host/API wiring or production tool/robot execution. Root owns commits and review. Read root/package instructions, the exact task below, relevant M5 design, and [frozen-producer reconciliation](M5-06-producer-reconciliation.md).

Baseline: `e99b38f28`; prerequisite M5-05 `03fd63ebd` independently approved. All five producer source hashes must match `m5-06/reconciliation/source-snapshot.json` before edits. Existing evidence is immutable.

## Exact source task

### M5-06 — Issue and revalidate immutable artifact references

**Prerequisites:** [M5-05](../tasks/java-development.md#m5-05).

**Files:** `packages/core/src/ftc/java/build.ts`, `packages/schema/src/ftc-java.ts`, `packages/core/test/ftc/java-development/m5-06.test.ts`.

**Interfaces:** Produces `artifact({ buildID }): ArtifactRef | undefined` and `verifyArtifact({ ref, currentProject }): { valid: boolean, reason? }` for M9's live verification port.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-06.test.ts`, add `failed or changed artifacts cannot authorize deployment`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(failedArtifact).toBeUndefined(); expect(tampered.valid).toBe(false); expect(stale.valid).toBe(false)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Hash only the APK produced by a successful current build; bind project/source/configuration/build identities. Recheck content digest and current input revisions on query. Preserve old artifacts as historical evidence, never silently substitute them.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](../tasks/progress.md). Commit: `feat(ftc): issue and revalidate immutable artifact references`.

## Assigned paths and compatibility

Root deliberately assigns two additional paths needed by the public facade and canonical contract checks: `packages/core/src/ftc/java.ts`, new `packages/schema/test/ftc-java-artifact.test.ts`. Only these five product/test paths may change. Reports: `docs/validation/M5-06-implementation.md` and new files under `docs/validation/m5-06/implementation/`; preserve earlier preflight/reconciliation evidence. Do not edit prior tests, documents owner, package/lock manifests or barrels. Preserve Java.layer(documentPorts), Java.layerWithBuilds, old three required build ports, build/start/read/cancel behavior and immutable BuildEvidence. Construction/import starts no work. Capture/artifact errors must not rewrite truthful saved-compilation status.

## Reconciled minimal runtime contract

Adopt the reconciliation's provisional run-output capture option; no released lease reuse or new execution snapshot for query. Add one optional opaque APK-output capability to BuildProcess, captured with its existing handles before asynchronous work. Add one optional complete `artifacts` port group to JavaBuild.Ports with scoped `capture({buildID,basis,execution,output})` and `current({basis})` operations. Existing adapters without these additions remain compatible and report typed artifact_unavailable. Both members are required when the group is supplied.

The trusted capture producer verifies output against the exact execution, complete immutable basis and fixed recipe. It returns explicit no output or retained immutable metadata (exact generated build/project/source/configuration identity and owner-issued absolute local locator), protected byte read capability and idempotent release, registering fallback cleanup in a separate owner-lifetime artifact Scope. Never read a pathname supplied through model/query JSON or logs. Core hashes the actual protected retained bytes with SHA-256; the port cannot assert digest, success or currency. Validate/capture returned metadata and method handles before waiting. Mismatched/ambiguous/provenance/capture failures are typed artifact failures, not no APK.

Capture only after joined complete successful process observations while process/execution are still live, before the existing process/lease retirement. It is provisional: preserve existing cancellation/outdated/failure precedence through all cleanup and terminal publication, then discard retention on ineligible outcomes. Clean observed initial AND settlement exclusions are required for issuance; absent settlement observation is not clean. Capture remains interruptible and joined cleanup remains unconditional. Successful clean known builds with explicit no APK return no artifact; missing feature reports unavailable.

`current` consumes the retained original basis and freshly observes complete source/configuration/generation, canonical project/root/Location/toolchain/recipe authority and dirty exclusions. Its generation must carry trusted comparable continuity from original basis across lease retirement, including later A-B-A; unsupported continuity fails closed. Use the existing InputValidation value shape with this strengthened producer contract. Never call released lease.revalidate or manufacture current authority from endpoint hashes. Relevant generation changes invalidate the original basis permanently. Output/cache writes count only if declared inputs. Do not implement the production producer here.

Artifact queries are owner-scoped, cancellable and joined; retain allocations only for this owner lifetime, release each exactly once on discard/close, prevent late publication and join public owner Scope closure including held asynchronous query/capture cleanup. Retain issued immutable ref/history after invalidation, never substitute another build. New owners have no old history. Do not keep execution/process leases alive for queries or delete user/project outputs.

## Canonical public contracts and observable results

Define FtcJava.ArtifactRef, ArtifactQuery, ArtifactVerificationRequest/Result, ArtifactError once and re-export exact schema identities through Java. Reuse BuildID and Project.ID; reference fields are buildID, projectID, complete string sourceRevision, configurationRevision, digest (64 lowercase hex SHA-256), path (owner-issued local absolute locator). Runtime capabilities remain Core-only. Same-name interfaces for Structs, stable unique identifiers, readonly contracts, package optional helper and strict owner-boundary decode; preserve documented internal Location normalization. Reason/code vocabulary may be chosen narrowly and documented in the report; reasons are stable domain values. No public API/Client generation is assigned.

- `artifact({buildID})`: resolve only exact owner record and authorize its original project freshly. With feature available, known running/failed/cancelled/outdated/dirty/unobserved/no-output records yield undefined. Unknown/foreign/malformed/closed/unavailable or capture/read/current/cleanup errors yield typed failures. Eligible clean successful provenance plus actual protected digest plus fresh complete current/continuity/dirty checks issue one immutable ref. Repeated queries re-read/revalidate; cached identity does not cache validity. Established tampering/missing retained bytes/stale/dirty/generation change gives artifact_invalid, retains historical identity, never falls back.
- `verifyArtifact({ref,currentProject})`: strict capture of ref and canonical project; validate owner lookup and every field including locator before reading. Unknown/no-issued/wrong-field claims yield valid:false with reason after project authorization; no arbitrary path read. Established content/current/dirty change yields valid:false. Authority/infrastructure/owner/invalid-input failures remain typed failures; failure to establish facts is not proof of change. Valid queries freshly authorize and protected-read/hash then check current authority at the publication boundary. Caller interruption and defects remain observable.

M9's current document-revision-array preparation projection does not encode M5 complete saved-source identity. Keep it unchanged here and in isolated M9-02; future owning integration must reconcile it without lossy conversion. M4 setup/current-build and M9 execution composition remain unavailable.

## Verification and evidence contract

Use Superpowers TDD and verification-before-completion, including writing-good-tests reference. Pinned Bun `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun` (prepend its directory to PATH for scripts). Run commands from packages; capture exact argv/cwd/exit and full bounded output in new owned evidence. No tests at repository root. Required baseline: existing m5-05 plus m5-01/m5-02 Core tests and existing Schema ftc-java-build contracts. Then actual callable-owner behavioral RED before production edits; a missing import or selector is not sufficient RED. Preserve original logs, including failures; never present an excerpt as full output.

Required coverage: exact source assertion; successful exact artifact/digest; failed/cancelled/outdated/dirty/no-output/unavailable; output/execution mismatch; capture failure; source/configuration/generation A-B-A and current dirty invalidity; distinct builds with identical bytes; exact identity/path tampering without caller-path reads; historical no fallback; unknown/fresh/foreign owners; protected byte failures; interruption/owner close during capture/read/current with held cleanup and once-only release; document-only and old build-enabled facade compatibility; strict canonical schema/omission/identifier/exact facade identity. Temporary real files and trusted external port fixtures exercise the real owner, no sibling runtime.

Final required commands from `packages/core`: `bun test ./test/ftc/java-development/m5-06.test.ts`, affected `m5-05.test.ts`, document `m5-01.test.ts`/`m5-02.test.ts`; from `packages/schema`: focused new artifact and existing build/hygiene tests. `bun typecheck` from both changed packages; repository scoped lint/format/import/whitespace checks. Follow docs/prompt.md's relevant-check rule over skill generic package-wide testing; no whole-package or whole-branch success claim. Freeze five source hashes plus evidence command/log hashes before reporting a review candidate.

Report DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED with exact tested source identities, diff/paths, each task substep/assertion, commands/results, assumptions and unrun gates. Root commits and provides fresh independent spec/quality review; no credit until approved.

Retain NOT RUN/unavailable gates: real complete-input/dirty/recipe/output/cache/protected-path/current authority adapters; actual FTC Gradle/JDK/SDK/offline builds; M4-06/M5-08/M9-04 composition; M5-03, M9-07/08 production isolation; Windows/native/packaging and physical robot/release acceptance. No fixture result authorizes production execution.

## Fix round 1 — publication boundary

Independent review of candidate `7bcada6d9` reproduces artifact issuance and valid verification after complete input generation changes during held query cleanup. Read the review/probe under `docs/validation/m5-06/review/` and the final report `M5-06-review.md` when delivered. Repair this task only; the user requests stopping after its required repair/re-review/checkpoint.

Root ruling supersedes the original standalone scoped InputValidation observation at publication: use the smallest runtime-only settled observation/token boundary that can synchronously confirm both protected bytes and complete current-input/dirty/generation/project/tool/recipe continuity after all query cleanup and final async project authorization, immediately before publishing/returning validity. Repeating a scoped call with another finalizer wait does not close this gap. Trusted producers must support that final confirmation or fail typed; no fabricated producer capability or production support claim. Any opaque confirmation remains Core-only and bound to the exact retained bytes and original basis, never caller ref/path/JSON authority. You may refine only the newly introduced artifact runtime port/result shapes; existing three build ports, document/build constructors, canonical public artifact Schema/query/facade shapes and old tests stay compatible. Do not add a general workflow, polling/watch service or production adapter.

Preserve all implementation/review/final2 evidence. New fix report: `docs/validation/M5-06-fix1-implementation.md`; new commands/logs/five-source manifest under `docs/validation/m5-06/fix1/`. Required behavioral RED then GREEN for generation/source/configuration/dirty and protected-byte changes during read/current cleanup and final async authorization. Preserve the original reviewer probe files; reproduce their exact scenarios/assertions in new fix coverage, adapting only trusted fixture return shapes if the new runtime confirmation contract requires it. Do not hide that adaptation or weaken the assertions. Preserve no-issued-on-interruption, once-only joined public owner/caller cleanup and typed inability to verify. Run affected M5-06, M5-05 and document/Schema checks justified by changed paths, both package types and scoped hygiene; freeze complete repair and evidence. Root owns Git/checklists/ledger and original reviewer re-review. Return final candidate with explicit new runtime guarantees and unrun producer gate.
