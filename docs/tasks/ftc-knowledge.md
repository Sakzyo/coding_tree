# M11 — FTC knowledge Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Provide local, bilingual and version-applicable FTC references/examples without reading project stores.

**Architecture:** Local Markdown/JSON content has stable IDs, language, source and applicability metadata. Queries pass SDK/library/version values explicitly. Use ordinary text search and version filtering; no vector store or sibling service is needed.

**Tech Stack:** TypeScript, Effect Schema, local Markdown/JSON packages, text search.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M11 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** FTC-01–FTC-06; LRN-01–LRN-04; ENV-06; AI-05, AI-06; LNG-01, LNG-02; AC-06, AC-07, AC-12, AC-13.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/reference.ts`
- `packages/core/src/markdown.d.ts`
- `packages/app/src/i18n/en.ts`
- `packages/app/src/i18n/zh.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-knowledge.ts` — content/query/provenance records
- `packages/core/src/ftc/knowledge.ts` — version/language/local lookup
- `packages/core/resources/ftc/content/manifest.json` — content registry
- `packages/core/resources/ftc/content/en/` — English lessons/references
- `packages/core/resources/ftc/content/zh/` — Simplified Chinese equivalents

`ContentRecord = { id, version, language: 'en' | 'zh', topic, sdkRange, library?, libraryRange?, source, license, localPath, digest }`. `ContentQuery = { id?, topic?, sdkVersion, library?, libraryVersion?, language, localOnly }`. `ContentResult = { kind: 'found', records } | { kind: 'missing', reason, requested }`; result never silently substitutes incompatible versions or a missing translation.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- A newer upstream example must not override the installed version (M11-02).
- Missing offline content must remain missing without network fallback (M11-02/M11-09).
- A Chinese translation must preserve code/device/API identifiers (M11-01/M11-07).
- Versioned Road Runner material must retain Dashboard/tuning prerequisites (M11-03).
- Back-to-back queries for different projects cannot share implicit selection state (M11-02).

## Task checklist

- [x] [M11-01 — Validate local content packages and bilingual IDs](#m11-01)
- [ ] [M11-02 — Query references by explicit version and language](#m11-02)
- [ ] [M11-03 — Author version-matched pathing comparisons and setup guides](#m11-03)
- [ ] [M11-04 — Author Java and FTC foundation lessons](#m11-04)
- [ ] [M11-05 — Author driver-control and mechanism exercises](#m11-05)
- [ ] [M11-06 — Author configuration debugging and deployment guidance](#m11-06)
- [ ] [M11-07 — Author the PedroPathing autonomous track and capstone](#m11-07)
- [ ] [M11-08 — Author the Road Runner autonomous track and capstone](#m11-08)
- [ ] [M11-09 — Package references for prepared offline use](#m11-09)
- [ ] [M11-10 — Expose content queries and review complete bilingual coverage](#m11-10)

## Execution tasks

<a id="m11-01"></a>

### M11-01 — Validate local content packages and bilingual IDs

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-knowledge.ts`, `packages/core/src/ftc/knowledge.ts`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`.

**Interfaces:** Produces `validatePack({ manifest, files }): PackResult`; identical content IDs/versions pair en/zh while source/license/digest/version ranges are mandatory.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`, add `translation pair preserves stable IDs and code tokens`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(en.id).toBe(zh.id); expect(en.codeTokens).toEqual(zh.codeTokens); expect(missingSource.code).toBe('invalid_content')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Use small local fixture packs first. Check duplicate IDs, absent files, digests, version ranges and preserved identifiers. Stable lesson IDs and domain error codes are language independent; no module initialization downloads content.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): validate local content packages and bilingual ids`.

Verified 2026-10-06: candidate `446c00550`, reviewed repair `9b71593fb`; [implementation evidence](../validation/M11-01-implementation.md), [independent review](../validation/M11-01-review.md). Synthetic fixtures do not establish published content or supported-library claims.

<a id="m11-02"></a>

### M11-02 — Query references by explicit version and language

**Prerequisites:** [M11-01](ftc-knowledge.md#m11-01).

**Files:** `packages/core/src/ftc/knowledge.ts`, `packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`.

**Interfaces:** Produces `lookup(query: ContentQuery): ContentResult` and `search({ query: ContentQuery, text }): ContentResult`; consumes only content repository/search ports.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`, add `incompatible or absent local reference never appears as current`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.records.map(x => x.id)).toEqual(['sdk-fixture-v1']); expect(missing.kind).toBe('missing'); expect(networkCalls).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Filter by explicit SDK/library applicability before ordinary text search. Return source/version/local availability; do not read M6 or store a global active project. Provide domain Context Source data for M3 through a public adapter.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): query references by explicit version and language`.

<a id="m11-03"></a>

### M11-03 — Author version-matched pathing comparisons and setup guides

**Prerequisites:** [M11-01](ftc-knowledge.md#m11-01).

**Files:** `packages/core/resources/ftc/content/en/pathing.json`, `packages/core/resources/ftc/content/zh/pathing.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-03.test.ts`.

**Interfaces:** Produces `pathingComparison({ sdkVersion, versions, language }): ContentResult` for Pedro/Road Runner/neither, plus Panels/Road Runner tuning prerequisite content.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-03.test.ts`, add `three choices retain documented differences and requirements`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(choices).toEqual(['pedro', 'road-runner', 'neither']); expect(roadRunner.prerequisites).toContain('ftc-dashboard')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Verify selected-version primary sources at implementation time. Explain Pedro correction/dynamic paths/Bézier visualizer and Road Runner Actions/drive/localization/tuning without universal-superiority claims. Explain choosing later and the autonomy-track prerequisite; include source/license metadata and both languages.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author version-matched pathing comparisons and setup guides`.

<a id="m11-04"></a>

### M11-04 — Author Java and FTC foundation lessons

**Prerequisites:** [M11-01](ftc-knowledge.md#m11-01).

**Files:** `packages/core/resources/ftc/content/en/foundations.json`, `packages/core/resources/ftc/content/zh/foundations.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts`.

**Interfaces:** Produces stable paired lessons for Java fundamentals, OpMode lifecycle, hardware/gamepads/telemetry and understandable code organization.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts`, add `foundation lessons require explanation and project application`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(missingRequiredTopics).toEqual([]); expect(exercise.requiresExplanation).toBe(true); expect(exercise.requiresProjectApplication).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Write source-bounded explanations and small versioned examples, with explanation and project-application exercises. Verify terminology using package localization guidance. Keep student hardware names/measurements unknown unless supplied.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author java and ftc foundation lessons`.

<a id="m11-05"></a>

### M11-05 — Author driver-control and mechanism exercises

**Prerequisites:** [M11-04](ftc-knowledge.md#m11-04).

**Files:** `packages/core/resources/ftc/content/en/driver-mechanisms.json`, `packages/core/resources/ftc/content/zh/driver-mechanisms.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-05.test.ts`.

**Interfaces:** Produces bilingual driver-control and mechanism lessons with stable exercise IDs, project application and evidence criteria.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-05.test.ts`, add `exercises teach code purpose and independent application`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(topics).toEqual(['driver-control', 'mechanisms']); expect(exercise.requiresExplanation).toBe(true); expect(exercise.requiresProjectApplication).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use selected-version SDK sources, explain gamepad-to-device control and program structure, and ask for actual hardware definitions. Distinguish code/build exercise completion from student physical tests; do not provide invented tuning values.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author driver-control and mechanism exercises`.

<a id="m11-06"></a>

### M11-06 — Author configuration debugging and deployment guidance

**Prerequisites:** [M11-04](ftc-knowledge.md#m11-04).

**Files:** `packages/core/resources/ftc/content/en/robot-workflow.json`, `packages/core/resources/ftc/content/zh/robot-workflow.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-06.test.ts`.

**Interfaces:** Produces bilingual student Driver Station configuration, telemetry/log diagnosis, tuning and deployment lessons with independent-action boundaries.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-06.test.ts`, add `guidance requires actual observations and separate deployment approval`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(robotConfigWriterInstructions).toEqual([]); expect(requiredEvidence).toContain('observation'); expect(deployIncludesStart).toBe(false)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Explain physical configuration the student performs, missing/stale/zero data, additional measurements, code/build limits and deliberate target-specific deployment. Verify all instructions against the selected SDK/library/controller documentation; preserve unknowns.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author configuration debugging and deployment guidance`.

<a id="m11-07"></a>

### M11-07 — Author the PedroPathing autonomous track and capstone

**Prerequisites:** [M11-03](ftc-knowledge.md#m11-03), [M11-04](ftc-knowledge.md#m11-04), [M11-05](ftc-knowledge.md#m11-05), [M11-06](ftc-knowledge.md#m11-06).

**Files:** `packages/core/resources/ftc/content/en/pedro.json`, `packages/core/resources/ftc/content/zh/pedro.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-07.test.ts`.

**Interfaces:** Produces the PedroPathing track for autonomous setup/tuning/measurement/diagnosis and a capstone covering driver control, a mechanism and autonomous movement.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-07.test.ts`, add `Pedro capstone requires independent explanation and physical evidence`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(trackID).toBe('pedro'); expect(capstoneEvidence).toContain('physical'); expect(capstoneEvidence).toContain('explanation')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-07.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Author the selected Pedro version's workflow and exercises in both languages; require student configuration/tuning/diagnosis/deployment, measurements and independent application. Preserve source/license metadata and code identifiers. Content review does not certify a student's robot.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-07.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author the pedropathing autonomous track and capstone`.

<a id="m11-08"></a>

### M11-08 — Author the Road Runner autonomous track and capstone

**Prerequisites:** [M11-03](ftc-knowledge.md#m11-03), [M11-04](ftc-knowledge.md#m11-04), [M11-05](ftc-knowledge.md#m11-05), [M11-06](ftc-knowledge.md#m11-06).

**Files:** `packages/core/resources/ftc/content/en/road-runner.json`, `packages/core/resources/ftc/content/zh/road-runner.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-08.test.ts`.

**Interfaces:** Produces the Road Runner Actions/drive/localization/tuning track and complete-robot capstone in both languages, retaining required FTC Dashboard/tuning utilities.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-08.test.ts`, add `Road Runner capstone preserves prerequisites and physical evidence`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(trackID).toBe('road-runner'); expect(prerequisites).toContain('ftc-dashboard'); expect(capstoneEvidence).toContain('physical')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-08.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use one selected-version workflow without mixing incompatible examples. Require explanation/application across driver control, mechanism and autonomous motion plus student configuration/tuning/diagnosis/deployment; validate code tokens and sources in both translations.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-08.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author the road runner autonomous track and capstone`.

<a id="m11-09"></a>

### M11-09 — Package references for prepared offline use

**Prerequisites:** [M11-02](ftc-knowledge.md#m11-02), [M11-03](ftc-knowledge.md#m11-03), [M11-04](ftc-knowledge.md#m11-04), [M11-07](ftc-knowledge.md#m11-07), [M11-05](ftc-knowledge.md#m11-05), [M11-06](ftc-knowledge.md#m11-06), [M11-08](ftc-knowledge.md#m11-08).

**Files:** `packages/core/src/ftc/knowledge.ts`, `packages/desktop/electron-builder.config.ts`, `packages/core/test/ftc-adapters/content-package.test.ts`, `packages/core/test/ftc-adapters/m11-09.test.ts`.

**Interfaces:** Produces `contentInventory(): readonly ContentAsset[]` and a packaged local repository usable by M4/M12; ContentAsset reports contentID/version/language/digest/availability.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-adapters/m11-09.test.ts`, add `packaged content works without network and missing packs stay explicit`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(offlineLookup.kind).toBe('found'); expect(missingAsset.available).toBe(false); expect(networkCalls).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-adapters/m11-09.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Bundle selected licensed references/lessons, verify digests and expose availability through a narrow public query. Keep older applicable content when adding newer versions; exclude network fetch from offline lookup and preserve remaining usable local material.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-adapters/m11-09.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Run the same boundary cases against the real adapter and supplied test port.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): package references for prepared offline use`.

<a id="m11-10"></a>

### M11-10 — Expose content queries and review complete bilingual coverage

**Prerequisites:** [M11-02](ftc-knowledge.md#m11-02), [M11-09](ftc-knowledge.md#m11-09), [M11-07](ftc-knowledge.md#m11-07), [M11-08](ftc-knowledge.md#m11-08).

**Files:** `packages/protocol/src/groups/ftc-knowledge.ts`, `packages/server/src/handlers/ftc-knowledge.ts`, `packages/core/src/ftc/composition.ts`, `docs/validation/knowledge-content.md`, `packages/core/test/ftc-evaluation/m11-10.test.ts`.

**Interfaces:** Produces generated lookup/search APIs and reviewed source/language/topic coverage for M1/M3/M6/M12.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m11-10.test.ts` for the automated portion of “every required topic and track has reviewed local content”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Wire public adapters, regenerate Client, run version/offline query checks, and review each lesson/chooser in both languages against selected-version sources. Record terminology corpora and uncertain translations; preserve code/API/device names. Mark absent source/translation/review evidence as pending rather than falling back silently.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m11-10.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 10 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/ftc-knowledge`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
