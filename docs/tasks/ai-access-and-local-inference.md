# M7 — AI access and local inference Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Support team-owned online providers and verified local inference with explicit resource, credential and capability handling.

**Architecture:** M7 adapts model streams only; OpenCode remains the tool executor. Inject protected credential access, provider HTTP, model store/download, resource probing and runtime control. App-owned and externally owned runtimes have different lifecycles.

**Tech Stack:** TypeScript, Effect, existing provider adapters, Electron safeStorage, evaluated llama.cpp server.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M7 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** AI-01–AI-03, AI-06, AI-07; ENV-06; AC-05, AC-06.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/credential.ts`
- `packages/core/src/credential/sql.ts`
- `packages/core/src/provider.ts`
- `packages/desktop/src/main/ipc.ts`
- `packages/desktop/src/preload/index.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-inference.ts` — mode/catalog/status/capability records
- `packages/core/src/ftc/inference.ts` — public model/runtime facade
- `packages/core/src/ftc/inference/catalog.ts` — compatibility/resource selection
- `packages/core/src/ftc/inference/runtime.ts` — managed process lifecycle
- `packages/core/src/ftc/inference/local-only.ts` — endpoint/service verification
- `packages/desktop/src/main/credentials.ts` — protected credential adapter

`InferenceSelection = { mode: 'online' | 'offline', providerID, modelID, credentialRef? }`. `ModelProfile` records runtime/model revision, digest, license, quantization, template, context limit, resource estimates, backend/platform and tested capabilities. `RuntimeStatus` distinguishes missing/downloading/starting/ready/stopped/failed and owned/external. `OfflineVerification` records validated service configuration/model identity and a verified boolean plus rejection reason; loopback by itself is not verification.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Encryption unavailable must never trigger plaintext storage (M7-02).
- A loopback service proxying cloud inference must fail offline verification (M7-04).
- Stopping a managed runtime must not kill a user-owned service (M7-06).
- A cancelled or checksum-failed download cannot be selected as ready (M7-05).
- Unsupported structured tools must be reported before claiming agent compatibility (M7-07/M7-08).

## Task checklist

- [ ] [M7-01 — Select model profiles from available resources](#m7-01)
- [ ] [M7-02 — Protect provider credentials in the desktop host](#m7-02)
- [ ] [M7-03 — Adapt online provider streaming and failures](#m7-03)
- [ ] [M7-04 — Enforce verified local-only inference](#m7-04)
- [ ] [M7-05 — Download models into a verified local inventory](#m7-05)
- [ ] [M7-06 — Start and stop app-owned inference processes](#m7-06)
- [ ] [M7-07 — Expose AI settings and bind M3 model streams](#m7-07)
- [ ] [M7-08 — Evaluate model/runtime configurations on supported laptops](#m7-08)

## Execution tasks

<a id="m7-01"></a>

### M7-01 — Select model profiles from available resources

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-inference.ts`, `packages/core/src/ftc/inference/catalog.ts`, `packages/core/resources/ftc/models.json`, `packages/core/test/ftc/ai-access-and-local-inference/m7-01.test.ts`.

**Interfaces:** Produces `recommendModels({ hostResources, concurrentWork, catalog }): { eligible, excluded }`; consumes RAM/GPU/backend/disk facts and explicit working-context requirements.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ai-access-and-local-inference/m7-01.test.ts`, add `insufficient resources exclude model with a reason`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.eligible).toEqual([]); expect(result.excluded[0].reason).toBe('insufficient_memory')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ai-access-and-local-inference/m7-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Validate curated catalog metadata and account for desktop/JDT/Gradle/concurrent-project headroom. Use synthetic unit-test values; pin actual models and minimum hardware only after M7-08 measurements. Return trade-offs for UI before download.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ai-access-and-local-inference/m7-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): select model profiles from available resources`.

<a id="m7-02"></a>

### M7-02 — Protect provider credentials in the desktop host

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/desktop/src/main/credentials.ts`, `packages/desktop/src/main/ipc.ts`, `packages/desktop/src/preload/index.ts`, `packages/desktop/src/preload/types.ts`, `packages/core/src/credential.ts`, `packages/desktop/src/main/ftc/m7-02.test.ts`.

**Interfaces:** Produces a credential port `store({ providerID, secret }): CredentialRef`, `use({ ref, providerOperation })`, and `remove({ ref })`; only the authorized backend provider operation receives plaintext.

- [ ] **1. Write the focused test:** In `packages/desktop/src/main/ftc/m7-02.test.ts`, add `unavailable encryption never saves plaintext`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(plaintextWrites).toEqual([]); expect(listed).toEqual([{ providerID, credentialRef }]); expect(result.code).toBe('credential_storage_unavailable')
```

- [ ] **2. Establish the baseline:** From `packages/desktop`, run `bun test ./src/main/ftc/m7-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use safeStorage and narrowly authenticated host/backend access. Keep secrets out of renderer-readable listings, tool-visible files, logs and context. Handle decryption failure and migrate only explicitly selected existing provider credentials; do not bulk rewrite unrelated credentials.
- [ ] **4. Verify:** Re-run `bun test ./src/main/ftc/m7-02.test.ts` from `packages/desktop`; expected: PASS. Run `bun typecheck` in each changed package. Run Electron-dependent checks in the actual host as well; a plain Bun policy test does not establish OS/view behavior.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): protect provider credentials in the desktop host`.

<a id="m7-03"></a>

### M7-03 — Adapt online provider streaming and failures

**Prerequisites:** [M7-01](ai-access-and-local-inference.md#m7-01), [M7-02](ai-access-and-local-inference.md#m7-02).

**Files:** `packages/core/src/ftc/inference.ts`, `packages/core/src/ftc/inference/provider.ts`, `packages/core/test/ftc/ai-access-and-local-inference/m7-03.test.ts`.

**Interfaces:** Consumes protected credentials and existing model stream request/response types. Produces `stream({ selection, request }): Stream` with typed provider/model/unsupported-tool failures and cancellation.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ai-access-and-local-inference/m7-03.test.ts`, add `provider failure preserves category and redacts credentials`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(failure.code).toBe('provider_failed'); expect(serializedFailure).not.toContain(secret); expect(cancelledHandles).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ai-access-and-local-inference/m7-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Reuse the existing provider path; emit capability information and actual failures, preserving history at the M3 boundary. Expose team-account billing/data-sharing disclosure keys and never execute tool calls inside M7.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ai-access-and-local-inference/m7-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): adapt online provider streaming and failures`.

<a id="m7-04"></a>

### M7-04 — Enforce verified local-only inference

**Prerequisites:** [M7-03](ai-access-and-local-inference.md#m7-03).

**Files:** `packages/core/src/ftc/inference/local-only.ts`, `packages/core/src/ftc/inference.ts`, `packages/core/test/ftc/ai-access-and-local-inference/m7-04.test.ts`.

**Interfaces:** Produces `verifyLocalService({ endpoint, serviceKind, configuration, modelID }): OfflineVerification`; offline `stream` accepts only verified local services/models.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ai-access-and-local-inference/m7-04.test.ts`, add `remote redirects and cloud-backed local models are refused`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(onlineDispatchCount).toBe(0); expect(redirect.code).toBe('offline_violation'); expect(cloudProxy.verified).toBe(false)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ai-access-and-local-inference/m7-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Reject remote inference/redirects and unverified cloud-proxy modes. Validate supported existing Ollama/LM Studio local-only configurations; arbitrary loopback URLs remain unverified. Failure never changes the selected mode or falls back online.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ai-access-and-local-inference/m7-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): enforce verified local-only inference`.

<a id="m7-05"></a>

### M7-05 — Download models into a verified local inventory

**Prerequisites:** [M7-01](ai-access-and-local-inference.md#m7-01).

**Files:** `packages/core/src/ftc/inference/download.ts`, `packages/core/src/ftc/inference.ts`, `packages/core/test/ftc/ai-access-and-local-inference/m7-05.test.ts`.

**Interfaces:** Produces `downloadModel({ profileID }): DownloadRun` and `modelInventory(): readonly ModelAsset[]`; ModelAsset includes profileID/digest/path/availability.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ai-access-and-local-inference/m7-05.test.ts`, add `corrupt download remains unavailable and retry is deliberate`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(corrupt.available).toBe(false); expect(cancelled.available).toBe(false); expect(valid.digest).toBe(expectedDigest)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ai-access-and-local-inference/m7-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Show license, disk and resource requirements before setup, stage partial files, verify checksums and publish availability only after completion. Surface disk-full/network failures and deliberate resume/retry without deleting another model.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ai-access-and-local-inference/m7-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): download models into a verified local inventory`.

<a id="m7-06"></a>

### M7-06 — Start and stop app-owned inference processes

**Prerequisites:** [M7-04](ai-access-and-local-inference.md#m7-04), [M7-05](ai-access-and-local-inference.md#m7-05).

**Files:** `packages/core/src/ftc/inference/runtime.ts`, `packages/core/src/ftc/inference.ts`, `packages/core/test/ftc/ai-access-and-local-inference/m7-06.test.ts`.

**Interfaces:** Produces `startRuntime({ profileID }): RuntimeStatus`, `stopRuntime({ runtimeID }): RuntimeStatus`, `connectExisting({ verification }): RuntimeStatus`; each handle carries ownership.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ai-access-and-local-inference/m7-06.test.ts`, add `scope cleanup terminates only app-owned processes`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(killedPIDs).toEqual([managedPID]); expect(externalAlive).toBe(true); expect(runtimeToolExecutors).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ai-access-and-local-inference/m7-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use versioned app-managed llama.cpp binaries and local model paths; bind verified local endpoints, detect readiness/port conflicts, and clean up owned children. Disable server-side shell/file tools, agents and MCP. Use a tiny fixture process in isolated tests.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ai-access-and-local-inference/m7-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): start and stop app-owned inference processes`.

<a id="m7-07"></a>

### M7-07 — Expose AI settings and bind M3 model streams

**Prerequisites:** [M7-03](ai-access-and-local-inference.md#m7-03), [M7-04](ai-access-and-local-inference.md#m7-04), [M7-06](ai-access-and-local-inference.md#m7-06), [M3-02](agent-and-context.md#m3-02).

**Files:** `packages/protocol/src/groups/ftc-inference.ts`, `packages/server/src/handlers/ftc-inference.ts`, `packages/core/src/ftc/composition.ts`, `packages/core/test/ftc-integration/m7-07.test.ts`.

**Interfaces:** Produces generated settings/status/download/runtime APIs and an adapter from M3's model-stream port to M7 `stream`; mode changes are explicit.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m7-07.test.ts`, add `offline provider outage never dispatches online in composed runner`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(providerCalls).toEqual(['verified-local']); expect(outcome.code).toBe('provider_failed'); expect(selectedMode).toBe('offline')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m7-07.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Wire scoped cancellation and capabilities; return unsupported-tool/model failure separately from build/robot outcomes. Test actual M3+M7 with controlled transport, including bilingual explanation language and mode independence from layout.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m7-07.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): expose ai settings and bind m3 model streams`.

<a id="m7-08"></a>

### M7-08 — Evaluate model/runtime configurations on supported laptops

**Prerequisites:** [M7-06](ai-access-and-local-inference.md#m7-06), [M7-07](ai-access-and-local-inference.md#m7-07).

**Files:** `docs/validation/local-inference.md`, `packages/core/resources/ftc/models.json`, `docs/compatibility-matrix.md`, `packages/core/test/ftc-evaluation/m7-08.test.ts`.

**Interfaces:** Produces measured supported model/runtime/backend profiles, offline verification records and credential OS integration evidence.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m7-08.test.ts` for the automated portion of “representative bilingual agent tasks with internet unavailable”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Measure download/start/stop, RAM/GPU/context behavior and structured tool tasks on macOS/Windows; test managed llama.cpp and supported existing local services with internet unavailable. Verify safeStorage on both OSes. Record model/quantization/template/runtime/version/hardware and actual results; do not generalize to arbitrary local models.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m7-08.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 8 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/ai-access-and-local-inference`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
