# M6 — FTC configuration and libraries Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Keep one shareable hardware/pathing manifest and return version-correct code proposals without directly changing Java or robot configuration.

**Architecture:** A versioned project JSON repository is authoritative. M6 consumes read-only project inspection plus compatibility/reference values; form and chat use the same commands. It returns EditProposal values for M3/M5 rather than writing source files.

**Tech Stack:** TypeScript, Effect Schema, JSON/filesystem adapters, Gradle/Java inspection.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M6 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** FTC-02–FTC-06; HW-01–HW-04; ENV-05; PRJ-01; AC-02, AC-07, AC-08.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/file-mutation.ts`
- `packages/schema/src/schema.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-configuration.ts` — manifest/validation/proposal records
- `packages/core/src/ftc/configuration.ts` — shared commands
- `packages/core/src/ftc/configuration/manifest.ts` — atomic revisioned JSON storage
- `packages/core/src/ftc/configuration/inspection.ts` — read-only dependency/code inspection
- `packages/core/src/ftc/configuration/proposals.ts` — Java/Gradle edit proposals

`Manifest = { schemaVersion: 1, hardware: readonly Hub[], managedPathing: 'pedro' | 'road-runner' | 'neither' }`; Hub has stable local ID and devices `{ category, port, type, name }`, validated against the selected SDK/device catalog. `ManifestSnapshot = { revision, manifest }`, revision hashes current bytes. `MappingStatus = { state: 'consistent' | 'pending' | 'conflict', affectedPaths, manifestRevision }`. Project-local `ftc-project.json` excludes machine paths, credentials, chats, progress, observations and approvals.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- External manifest edits must not be lost (M6-01).
- Duplicate names and invalid category/port/type combinations must fail (M6-02).
- Hardware rename must report stale Java references until an authorized edit lands (M6-05).
- Both detected libraries require a decision without deleting team code (M6-03/M6-04).
- Choosing neither cannot accidentally add pathing dependencies (M6-04).

## Task checklist

- [x] [M6-01 — Read and update a shareable manifest by revision](#m6-01)
- [x] [M6-02 — Validate shared hardware commands](#m6-02)
- [ ] [M6-03 — Inspect imported SDK and pathing dependencies](#m6-03)
- [ ] [M6-04 — Propose new-project and managed-library changes](#m6-04)
- [ ] [M6-05 — Propose consistent Java hardware mappings](#m6-05)
- [ ] [M6-06 — Connect manifest commands to authorized editing](#m6-06)

## Execution tasks

<a id="m6-01"></a>

### M6-01 — Read and update a shareable manifest by revision

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-configuration.ts`, `packages/core/src/ftc/configuration.ts`, `packages/core/src/ftc/configuration/manifest.ts`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts`.

**Interfaces:** Produces `readManifest({ root }): ManifestSnapshot` and `updateManifest({ root, expectedRevision, change }): ManifestSnapshot`; absent manifests return an explicit initialization proposal.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts`, add `stale manifest update preserves external bytes`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(stale.code).toBe('revision_conflict'); expect(afterBytes).toBe(externalBytes); expect(secretFields).toEqual([])
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Validate schema version and allowed shared fields; reject unsupported newer versions without replacing them. Use atomic file replacement, revisioned events and external-file detection. Treat any database projection as rebuildable, not another authority.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): read and update a shareable manifest by revision`.

Verified 2026-10-07 at `f3de7a3c7`: [implementation evidence](../validation/M6-01-implementation.md), [independent review](../validation/M6-01-review.md). Production/platform/composed gates remain separate.

<a id="m6-02"></a>

### M6-02 — Validate shared hardware commands

**Prerequisites:** [M6-01](ftc-configuration-and-libraries.md#m6-01).

**Files:** `packages/core/src/ftc/configuration.ts`, `packages/schema/src/ftc-configuration.ts`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-02.test.ts`.

**Interfaces:** Produces `updateHardware({ root, expectedRevision, change, deviceCatalog }): ManifestSnapshot`; changes identify hub/category/port/type/name and are identical for form/chat callers.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/ftc-configuration-and-libraries/m6-02.test.ts`, add `form and chat enforce the same port and name rules`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(formError.code).toBe(chatError.code); expect(duplicateName.code).toBe('duplicate_name'); expect(invalidPort.code).toBe('invalid_port')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Validate missing names, duplicate names, hub/category/port/type relationships using versioned SDK rules. Return localized error codes and fields. Preserve device/API identifiers byte-for-byte and explain that these records do not prove wiring.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): validate shared hardware commands`.

Verified 2026-10-07: candidate `e4d498ca0`, scoped I1 repair `6620d1bc1`; [implementation evidence](../validation/M6-02-implementation.md), [independent review](../validation/M6-02-review.md). Actual SDK/catalog binding, physical wiring and composed/platform gates remain separate.

<a id="m6-03"></a>

### M6-03 — Inspect imported SDK and pathing dependencies

**Prerequisites:** [M6-01](ftc-configuration-and-libraries.md#m6-01).

**Files:** `packages/core/src/ftc/configuration/inspection.ts`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`.

**Interfaces:** Produces `inspectProject({ root }): { sdkVersion, dependencies, detectedPathing, conflicts, sourceRevisions }`; unresolved dynamic Gradle expressions are explicit unknowns.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`, add `ambiguous imports stay untouched`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.conflicts.length).toBeGreaterThan(0); expect(afterFiles).toEqual(beforeFiles); expect(dynamic.version).toBeUndefined()
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Read representative Java/Gradle/project layouts without executing arbitrary build code. Detect Pedro/Road Runner/neither and conflicts with the manifest. Do not claim unsupported Gradle syntax was fully understood or silently migrate existing code.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): inspect imported sdk and pathing dependencies`.

<a id="m6-04"></a>

### M6-04 — Propose new-project and managed-library changes

**Prerequisites:** [M6-01](ftc-configuration-and-libraries.md#m6-01), [M6-03](ftc-configuration-and-libraries.md#m6-03), [M4-01](environment-and-compatibility.md#m4-01), [M11-03](ftc-knowledge.md#m11-03).

**Files:** `packages/core/src/ftc/configuration/proposals.ts`, `packages/core/resources/ftc/templates/manifest.json`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-04.test.ts`.

**Interfaces:** Produces `proposeProject({ inspection, profile, references, choice }): EditProposal` and `proposePathing({ snapshot, inspection, profile, references, choice }): EditProposal`; consumes M5 EditProposal and immutable M11 comparisons.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-configuration-and-libraries/m6-04.test.ts`, add `each library choice preserves required dependencies`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(neither.edits.some(x => /pedro|roadrunner/.test(x.replacement))).toBe(false); expect(roadRunnerText).toContain('dashboard'); expect(conflict.code).toBe('pathing_conflict')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use a pinned template/profile for new projects and narrow diffs for imports; support adding one library later. Include Panels setup where selected, retain version-required Road Runner tuning utilities/FTC Dashboard, and never return an approved migration or two managed libraries implicitly.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): propose new-project and managed-library changes`.

<a id="m6-05"></a>

### M6-05 — Propose consistent Java hardware mappings

**Prerequisites:** [M6-02](ftc-configuration-and-libraries.md#m6-02), [M6-03](ftc-configuration-and-libraries.md#m6-03).

**Files:** `packages/core/src/ftc/configuration/proposals.ts`, `packages/core/src/ftc/configuration.ts`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-05.test.ts`.

**Interfaces:** Produces `proposeMappings({ snapshot, inspectedSources }): { proposal: EditProposal, mappingStatus: MappingStatus }`; no Java writes occur in M6.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-configuration-and-libraries/m6-05.test.ts`, add `rename proposes edits without claiming synchronization`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.mappingStatus.state).toBe('pending'); expect(afterJava).toBe(beforeJava); expect(proposalText).toContain('leftDrive')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Inspect custom Java before suggesting targeted mappings and references. Ask for unknown hardware details, preserve custom structure, and require save/merge/defer on conflicting source revisions. Include the remaining student Driver Station steps in explanation data.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): propose consistent java hardware mappings`.

<a id="m6-06"></a>

### M6-06 — Connect manifest commands to authorized editing

**Prerequisites:** [M6-04](ftc-configuration-and-libraries.md#m6-04), [M6-05](ftc-configuration-and-libraries.md#m6-05), [M3-03](agent-and-context.md#m3-03), [M5-02](java-development.md#m5-02).

**Files:** `packages/protocol/src/groups/ftc-configuration.ts`, `packages/server/src/handlers/ftc-configuration.ts`, `packages/core/src/ftc/composition.ts`, `packages/core/test/ftc-integration/configuration-edit.test.ts`, `packages/core/test/ftc-integration/m6-06.test.ts`.

**Interfaces:** Binds form/chat commands to the same M6 facade and routes EditProposal through M3 policy into M5. Produces manifest/mapping events and generated clients.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m6-06.test.ts`, add `rejected plan writes no Java and approved plan updates mapping status`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(beforeApprovalJava).toBe(originalJava); expect(afterApprovedMapping.state).toBe('consistent'); expect(robotConfigWrites).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m6-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Test plan-first/direct behavior, external manifest edits, hardware rename and partial code-apply failure. Re-read resulting revisions instead of optimistically marking code consistent. Run real builds for new Pedro/Road Runner/neither and later-add flows in M4-07/M5-08.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m6-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): connect manifest commands to authorized editing`.

## Module completion gate

- [ ] All 6 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/ftc-configuration-and-libraries`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
