# M4 — Environment and compatibility Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Resolve coherent toolchains and make automatic, guided, and prepared-offline readiness explicit.

**Architecture:** Inject probes, downloads/cache, inventory and a build-verification port. M4 consumes model/content availability snapshots and never owns or starts those modules. Supply M5 a resolved descriptor so setup and builds cannot recurse.

**Tech Stack:** TypeScript, Effect, local catalog files, process/download adapters.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M4 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** ENV-01–ENV-06; PRJ-01; AC-01, AC-02, AC-06.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/opencode/src/lsp/server.ts`
- `packages/core/src/process.ts`
- `packages/core/src/database/database.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-environment.ts` — profile/readiness/toolchain records
- `packages/core/src/ftc/environment.ts` — setup/readiness service
- `packages/core/src/ftc/environment/catalog.ts` — profile validation and selection
- `packages/core/src/ftc/environment/adapters.ts` — probe/download/inventory adapters
- `packages/core/resources/ftc/compatibility.json` — evaluated profiles
- `packages/protocol/src/groups/ftc-environment.ts` — typed setup/readiness API and setup events
- `packages/server/src/handlers/ftc-environment.ts` — project-bound adapters over M4's public service

`ToolchainDescriptor = { profileID, buildJdk, editorJdk, androidSdk, adb, gradleWrapper, versions }`, with resolved local paths and pinned version strings. `Readiness = { state: 'ready' | 'missing' | 'incompatible' | 'failed', steps, missingAssets }`. Steps carry stable ID, state, cause and recovery code. Profiles carry OS/architecture, component versions, checksums/licenses and evidence references; an unevaluated profile cannot be labelled supported.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Different editor/build JDKs must not overwrite each other (M4-01/M4-02).
- Cancelled or corrupt downloads must not become ready assets (M4-04).
- Guided setup cannot complete before a verified build (M4-03/M4-06).
- An imported project outside the matrix must remain unchanged (M4-02).
- Offline readiness must list missing dependencies as well as models/content (M4-05).

## Task checklist

- [x] [M4-01 — Validate compatibility profiles](#m4-01)
- [x] [M4-02 — Inspect tools and imported project requirements](#m4-02)
- [x] [M4-03 — Guide setup through readiness checks](#m4-03)
- [x] [M4-04 — Download and prepare one missing prerequisite](#m4-04)
- [x] [M4-05 — Report prepared offline availability](#m4-05)
- [ ] [M4-06 — Expose setup API and compose build verification](#m4-06)
- [ ] [M4-07 — Evaluate clean-host setup and publish supported profiles](#m4-07)

## Execution tasks

<a id="m4-01"></a>

### M4-01 — Validate compatibility profiles

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-environment.ts`, `packages/core/src/ftc/environment/catalog.ts`, `packages/core/resources/ftc/compatibility.json`, `packages/core/test/ftc/environment-and-compatibility/m4-01.test.ts`.

**Interfaces:** Produces `resolveProfile({ host, projectVersions, catalog }): { kind: 'matched', profile } | { kind: 'unsupported', reasons }`; host contains OS, architecture and available resources.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-01.test.ts`, add `profile pins independent editor and build runtimes`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(selected.editorJdk.version).toBe('21'); expect(selected.buildJdk.version).toBe('17'); expect(unsupported.kind).toBe('unsupported')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Use clearly labelled synthetic test profiles (21/17 are fixture values, not released FTC support claims). Encode coherent combinations, source/license/checksum metadata and evaluation status; never choose independently latest dependencies.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): validate compatibility profiles`.

Verified 2026-10-06 at `f7d2a93eabae724f29875a29840b000cee8749fb`: [implementation evidence](../validation/M4-01-implementation.md), [independent review](../validation/M4-01-review.md).

<a id="m4-02"></a>

### M4-02 — Inspect tools and imported project requirements

**Prerequisites:** [M4-01](environment-and-compatibility.md#m4-01).

**Files:** `packages/core/src/ftc/environment.ts`, `packages/core/src/ftc/environment/adapters.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts`.

**Interfaces:** Consumes read-only process probes and project dependency snapshots. Produces `inspectEnvironment({ host, project, catalog }): Readiness` plus a candidate ToolchainDescriptor.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts`, add `inspection preserves incompatible imported files`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(afterFiles).toEqual(beforeFiles); expect(result.state).toBe('incompatible'); expect(probes).toContain('adb')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Probe build/editor Java separately, Android SDK, ADB and the project's Gradle wrapper. Reuse working tools, identify required permissions/manual steps and distinguish missing binaries from probe failure.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): inspect tools and imported project requirements`.

Verified 2026-10-06: candidate `a94369c4c`, reviewed repair `f075a4348`; [implementation evidence](../validation/M4-02-implementation.md), [independent review](../validation/M4-02-review.md). Real platform/build acceptance remains in later tasks.

<a id="m4-03"></a>

### M4-03 — Guide setup through readiness checks

**Prerequisites:** [M4-02](environment-and-compatibility.md#m4-02).

**Files:** `packages/core/src/ftc/environment.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts`.

**Interfaces:** Produces `prepareEnvironment({ choice: 'guided', profileID }): SetupRun` and `readiness({ projectID }): Readiness`; SetupRun exposes step events and cancellation.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts`, add `guided setup stays incomplete until build evidence`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(beforeBuild.state).not.toBe('ready'); expect(afterVerifiedBuild.state).toBe('ready')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Return actionable localized-message keys with platform/version-specific installation steps. Re-probe on deliberate recheck; consume injected build verification and never execute installers in guided mode.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): guide setup through readiness checks`.

Verified 2026-10-06: candidate `575d0901e`, reviewed repair `c91019968`; [implementation evidence](../validation/M4-03-implementation.md), [independent review](../validation/M4-03-review.md). Actual M5/platform/UI evidence remains later work.

<a id="m4-04"></a>

### M4-04 — Download and prepare one missing prerequisite

**Prerequisites:** [M4-02](environment-and-compatibility.md#m4-02).

**Files:** `packages/core/src/ftc/environment.ts`, `packages/core/src/ftc/environment/adapters.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts`.

**Interfaces:** Extends `prepareEnvironment` with `choice: 'automatic'`; consumes download/cache/probe ports, produces recoverable per-component setup results.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts`, add `retry preserves completed components`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(reinstalledValidTools).toEqual([]); expect(corrupt.state).toBe('failed'); expect(cancelledReadyAssets).toEqual([])
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Implement checksum-verified downloads, explicit license/system-permission steps, staging and deliberate retry for one component at a time. Preserve completed work and avoid silent system-wide Java changes; automatic steps use the same readiness criteria as guided setup.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): download and prepare one missing prerequisite`.

Verified 2026-10-07, reviewed repair `06036d945`; [implementation evidence](../validation/M4-04-implementation.md), [independent review](../validation/M4-04-review.md). Real OS/cache/platform/M5 integration remains later work.

<a id="m4-05"></a>

### M4-05 — Report prepared offline availability

**Prerequisites:** [M4-01](environment-and-compatibility.md#m4-01), [M4-02](environment-and-compatibility.md#m4-02).

**Files:** `packages/schema/src/ftc-environment.ts`, `packages/core/src/ftc/environment.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-05.test.ts`.

**Interfaces:** Produces `offlineReadiness({ tools, dependencies, models, content }): Readiness`; consumes immutable asset inventories with IDs/version/checksum and availability.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-05.test.ts`, add `missing cache entry does not disable available local features`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.missingAssets).toContain('gradle-dependency-fixture'); expect(availableFeatures).toContain('editing')
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Check cached Gradle/Android dependencies, tool binaries, selected model and lesson/reference assets independently. Do not infer offline readiness from a working internet build or start M7/M11 to query their stores.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): report prepared offline availability`.

Verified 2026-10-07 at `af062679b`: [implementation evidence](../validation/M4-05-implementation.md), [independent review](../validation/M4-05-review.md), [settled Core types](../validation/m4-05/core-types-settled.log). Actual offline/product/platform acceptance remains separate.

<a id="m4-06"></a>

### M4-06 — Expose setup API and compose build verification

**Prerequisites:** [M4-03](environment-and-compatibility.md#m4-03), [M4-04](environment-and-compatibility.md#m4-04), [M4-05](environment-and-compatibility.md#m4-05), [M5-05](java-development.md#m5-05).

**Files:** `packages/schema/src/ftc-environment.ts`, `packages/protocol/src/groups/ftc-environment.ts`, `packages/protocol/src/api.ts`, `packages/server/src/handlers/ftc-environment.ts`, `packages/server/src/handlers.ts`, `packages/core/src/ftc/composition.ts`, `packages/core/test/ftc-integration/setup-build.test.ts`, `packages/core/test/ftc-integration/m4-06.test.ts`, `packages/server/test/ftc-environment.test.ts`.

**Interfaces:** Binds `verifyBuild({ project, toolchain }): BuildEvidence` to M5 `build`; returns real build failure/output without changing project dependencies. Owns the Protocol group, Server handlers and generated-client access consumed by M1-11. Exposes `inspectEnvironment({ projectID })`, `prepareEnvironment({ projectID, choice, profileID })`, `readiness({ projectID })` and `offlineReadiness({ projectID })` over the existing M4 results. The host supplies project context, tool probes, catalog and asset inventories; callers cannot assert readiness. `prepareEnvironment` returns a serializable `{ projectID, runID }` reference to its scoped SetupRun; `setupEvents({ projectID, runID })` streams its step results and `cancelSetup({ projectID, runID })` cancels that run. Define request/result/error/event schemas in the owned Schema file; never serialize runtime handles.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m4-06.test.ts`, add `failed build prevents setup completion`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(setup.state).toBe('failed'); expect(setup.buildEvidence.exitCode).not.toBe(0); expect(robotTransportCalls).toEqual([])
```

In `packages/server/test/ftc-environment.test.ts`, add `setup API preserves project-bound readiness and run lifecycle`. Exercise the actual handlers with real M4/M5 services and controlled external ports: cover inspect, both setup choices, readiness, missing offline assets, step events and cancellation. Reject a project/run mismatch without cancelling another run; disposal releases subscriptions. Core assertions:

```ts
expect(apiReadiness).toEqual(serviceReadiness); expect(eventProjectIDs.length).toBeGreaterThan(0); expect(eventProjectIDs.every(id => id === projectID)).toBe(true); expect(cancelledRunID).toBe(requestedRunID); expect(mismatchedRunCancelled).toBe(false); expect(activeSubscriptionsAfterDispose).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m4-06.test.ts`; from `packages/server`, run `bun test ./test/ftc-environment.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Test both choices through M4→M5 with a controlled build process and real module implementations. Register the environment API group and handlers in their existing host layers; expose project-bound results, recoverable failures, setup events and cancellation. Run `bun run generate` from `packages/client`. Keep language-service readiness separate; record that a successful build is not physical robot validation. Core composition must not import Protocol/Server; API tests belong in Server.
- [ ] **4. Verify:** Re-run both commands from their package directories; expected: PASS. Run `bun typecheck` in every changed package, including Protocol, Server and generated Client. These are composed/API suites, not the module-only suite. M1-11 may consume this API only after this task's implementation and checks pass.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): expose setup api and compose build verification`.

<a id="m4-07"></a>

### M4-07 — Evaluate clean-host setup and publish supported profiles

**Prerequisites:** [M4-06](environment-and-compatibility.md#m4-06), [M5-08](java-development.md#m5-08), [M7-08](ai-access-and-local-inference.md#m7-08), [M8-06](controller-connections.md#m8-06), [M11-09](ftc-knowledge.md#m11-09).

**Files:** `docs/validation/environment.md`, `docs/compatibility-matrix.md`, `packages/core/resources/ftc/compatibility.json`, `packages/desktop/electron-builder.config.ts`, `packages/core/test/ftc-evaluation/m4-07.test.ts`.

**Interfaces:** Produces evidence-backed catalog entries and offline packaging inventories consumed by new-project setup.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m4-07.test.ts` for the automated portion of “clean hosts and prepared offline installations”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** On macOS and Windows, run automatic and guided setup from documented clean tool state, intentionally fail/retry a step, and build new/imported projects. Disconnect internet after preparation; verify build, editing, lessons and local robot connections. Record OS/architecture, versions, licenses, actual commands and evidence; update only combinations that passed. Keep missing hardware/platform rows not run.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m4-07.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 7 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/environment-and-compatibility`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
