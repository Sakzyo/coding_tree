# M5 — Java development Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Preserve document revisions, provide dependency-aware Java services, and produce trustworthy build/artifact evidence.

**Architecture:** M5 owns documents, language-service sessions and builds; views consume document facades. Inject filesystem, language-service, build and artifact ports plus toolchain values. Code authorization arrives through a trusted caller, while M5 independently enforces revision/scope.

**Tech Stack:** TypeScript, Effect, Monaco adapter, Eclipse JDT LS candidate, project Gradle wrappers.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M5 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** EDT-01, EDT-02; ENV-04–ENV-06; HW-03; ROB-02; AC-04, AC-08, AC-10.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/app/src/context/file.tsx`
- `packages/opencode/src/lsp/server.ts`
- `packages/core/src/file-mutation.ts`
- `packages/core/src/process.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-java.ts` — document/edit/build/artifact records
- `packages/core/src/ftc/java.ts` — document/build facade
- `packages/core/src/ftc/java/documents.ts` — revision and save rules
- `packages/core/src/ftc/java/language-service.ts` — scoped language-service adapter
- `packages/core/src/ftc/java/build.ts` — build evidence and artifacts
- `packages/app/src/ftc/editor.tsx` — Monaco view adapter

`DocumentSnapshot = { documentID, projectID, path, bufferRevision, diskRevision, text, dirty }`. `EditProposal = { projectID, edits: readonly { path, expectedRevision, replacement }[], explanation }`; revisions distinguish disk from buffer. `BuildEvidence = { buildID, projectID, sourceRevision, configurationRevision, inputChanged, exitCode, status, logs, artifact? }`; status is succeeded/failed/cancelled/outdated. `ArtifactRef = { buildID, projectID, sourceRevision, configurationRevision, digest, path }` is a local reference; public responses redact host paths where unnecessary. All evidence IDs resolve through an owner query, never an agent-supplied success flag.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Dirty buffers survive layout changes and proposed agent edits (M5-01/M5-02).
- External edits during save must not be overwritten (M5-02).
- Unavailable LSP is not an empty successful diagnostic result (M5-04).
- A source/config change during a build makes its APK outdated (M5-05).
- A failed build must not reuse yesterday's APK (M5-06).

## Task checklist

- [x] [M5-01 — Own documents independently of editor views](#m5-01)
- [x] [M5-02 — Save and apply edits with conflict checks](#m5-02)
- [ ] [M5-03 — Evaluate FTC-aware Java import before building the full editor](#m5-03)
- [ ] [M5-04 — Adapt scoped language-service requests](#m5-04)
- [ ] [M5-05 — Build saved revisions and retain actual output](#m5-05)
- [ ] [M5-06 — Issue and revalidate immutable artifact references](#m5-06)
- [ ] [M5-07 — Connect Monaco to document and language-service facades](#m5-07)
- [ ] [M5-08 — Expose Java API and validate real editor/build integration](#m5-08)

## Execution tasks

<a id="m5-01"></a>

### M5-01 — Own documents independently of editor views

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-java.ts`, `packages/core/src/ftc/java.ts`, `packages/core/src/ftc/java/documents.ts`, `packages/core/test/ftc/java-development/m5-01.test.ts`.

**Interfaces:** Produces `openDocument({ project, path }): DocumentSnapshot`, `changeDocument({ path, expectedRevision, text }): DocumentSnapshot`, `readDocument({ projectID, path }): DocumentSnapshot`.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-01.test.ts`, add `detaching a view preserves dirty buffer`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(reopened.text).toBe('unsaved'); expect(reopened.dirty).toBe(true); expect(diskText).toBe('saved')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Use project-scoped canonical file identities; preserve dirty buffers separately from saved revisions and publish revisioned document events. Reject paths outside the authorized project scope, including symlink escapes.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): own documents independently of editor views`.

Verified 2026-10-07 at `9bcb23ce6`: [implementation evidence](../validation/M5-01-implementation.md), [independent review](../validation/M5-01-review.md), [settled Core types](../validation/m5-01/core-types-settled.log). Actual editor/production/Windows acceptance remains separate.

<a id="m5-02"></a>

### M5-02 — Save and apply edits with conflict checks

**Prerequisites:** [M5-01](java-development.md#m5-01).

**Files:** `packages/core/src/ftc/java/documents.ts`, `packages/core/src/ftc/java.ts`, `packages/core/test/ftc/java-development/m5-02.test.ts`.

**Interfaces:** Produces `saveDocument({ projectID, path, expectedRevision }): DocumentSnapshot` and `applyEdits({ proposal: EditProposal, authorization }): EditResult`; authorization is supplied by the trusted code-change adapter, not arbitrary tool JSON.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-02.test.ts`, add `dirty or externally changed files reject stale edits`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.kind).toBe('conflict'); expect(bufferText).toBe('unsaved'); expect(externalDiskText).toBe('external')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Check buffer/disk revisions and authorized file scope before writing. Preserve the proposal and both versions; return save/merge/defer choices. Preflight every file in a multi-file proposal and report partial filesystem failure honestly; never silently discard changes.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): save and apply edits with conflict checks`.

Verified 2026-10-07: candidate `23eed3535`, authorization repair `a82570d5f`; [implementation evidence](../validation/M5-02-implementation.md), [independent review and scoped re-review](../validation/M5-02-review.md). Actual auth/filesystem adapter composition and new-file/template creation remain separate.

<a id="m5-03"></a>

### M5-03 — Evaluate FTC-aware Java import before building the full editor

**Prerequisites:** [M4-01](environment-and-compatibility.md#m4-01).

**Files:** `packages/core/src/ftc/java/language-service.ts`, `packages/core/test/ftc-adapters/java-import.test.ts`, `docs/validation/java-import.md`, `packages/core/test/ftc-evaluation/m5-03.test.ts`.

**Interfaces:** Consumes explicit editor/build runtimes and representative project fixtures. Produces a pinned JDT LS launch/import decision and dependency resolution evidence.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m5-03.test.ts` for the automated portion of “FTC Android and pathing symbols resolve”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Run the actual candidate server against FTC, Android, generated-source, PedroPathing and Road Runner examples on both platforms. Record completion/definition/diagnostic results and exact versions. Evaluate a Gradle-derived classpath adapter only if needed; do not rewrite team builds to hide import failures. An unresolved required symbol keeps this gate open.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m5-03.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

<a id="m5-04"></a>

### M5-04 — Adapt scoped language-service requests

**Prerequisites:** [M5-01](java-development.md#m5-01), [M5-03](java-development.md#m5-03).

**Files:** `packages/core/src/ftc/java/language-service.ts`, `packages/core/src/ftc/java.ts`, `packages/opencode/src/lsp/server.ts`, `packages/core/test/ftc/java-development/m5-04.test.ts`.

**Interfaces:** Produces `completion({ document, position })`, `definition({ document, position })`, and `diagnostics({ projectID }): { state: 'loading' | 'ready' | 'unavailable' | 'failed', items }`; consume an injected LSP port.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-04.test.ts`, add `failed server remains distinct from zero diagnostics`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(failed.state).toBe('failed'); expect(ready.items).toEqual([]); expect(ready.state).toBe('ready')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use the evaluated pinned editor JDK/server path, dependency-aware workspace initialization, cancellation and disposal. Reuse/extract narrow legacy LSP behavior behind the Core port without importing the legacy agent loop or relying on global java/latest downloads.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): adapt scoped language-service requests`.

<a id="m5-05"></a>

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

<a id="m5-06"></a>

### M5-06 — Issue and revalidate immutable artifact references

**Prerequisites:** [M5-05](java-development.md#m5-05).

**Files:** `packages/core/src/ftc/java/build.ts`, `packages/schema/src/ftc-java.ts`, `packages/core/test/ftc/java-development/m5-06.test.ts`.

**Interfaces:** Produces `artifact({ buildID }): ArtifactRef | undefined` and `verifyArtifact({ ref, currentProject }): { valid: boolean, reason? }` for M9's live verification port.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-06.test.ts`, add `failed or changed artifacts cannot authorize deployment`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(failedArtifact).toBeUndefined(); expect(tampered.valid).toBe(false); expect(stale.valid).toBe(false)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Hash only the APK produced by a successful current build; bind project/source/configuration/build identities. Recheck content digest and current input revisions on query. Preserve old artifacts as historical evidence, never silently substitute them.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): issue and revalidate immutable artifact references`.

<a id="m5-07"></a>

### M5-07 — Connect Monaco to document and language-service facades

**Prerequisites:** [M5-01](java-development.md#m5-01), [M5-02](java-development.md#m5-02), [M5-04](java-development.md#m5-04).

**Files:** `packages/app/src/ftc/editor.tsx`, `packages/app/package.json`, `packages/desktop/electron.vite.config.ts`, `packages/app/test-browser/ftc/java-development/m5-07.test.ts`.

**Interfaces:** Consumes M5 document/LSP public contracts through an injected frontend facade. Produces an editor component with local workers, Java syntax, save, completion, diagnostics and definition navigation.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/java-development/m5-07.test.ts`, add `view recreation retains document identity`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(after.documentID).toBe(before.documentID); expect(after.text).toBe('unsaved'); expect(definition.path).toBe(expectedProjectPath)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/java-development/m5-07.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Pin the evaluated editor dependency, map URI models to authoritative documents, and dispose views independently from dirty state. Use typed client calls and bundle workers/assets for the actual Electron URL scheme.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/java-development/m5-07.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): connect monaco to document and language-service facades`.

<a id="m5-08"></a>

### M5-08 — Expose Java API and validate real editor/build integration

**Prerequisites:** [M5-04](java-development.md#m5-04), [M5-05](java-development.md#m5-05), [M5-06](java-development.md#m5-06), [M5-07](java-development.md#m5-07).

**Files:** `packages/protocol/src/groups/ftc-java.ts`, `packages/server/src/handlers/ftc-java.ts`, `packages/core/src/ftc/composition.ts`, `docs/validation/java-development.md`, `packages/core/test/ftc-evaluation/m5-08.test.ts`.

**Interfaces:** Produces generated client access and real dependency-aware editor/build evidence for M1/M3/M4/M9.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m5-08.test.ts` for the automated portion of “packaged editor offline and current build evidence”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Wire public methods and events, regenerate Client, run module/adapter suites, then exercise packaged macOS/Windows editor workers, completion, definitions, deliberate Java errors, save conflicts and offline Gradle builds. Record actual commands/results; manually changing code during a build must invalidate currency. M5-03's server evaluation alone does not satisfy this end-to-end gate.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m5-08.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 8 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/java-development`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
