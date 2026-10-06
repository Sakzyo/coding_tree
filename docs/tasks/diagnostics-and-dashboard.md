# M10 — Diagnostics and dashboard Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Expose version-aware telemetry/logs with trustworthy freshness and provenance, independently of dashboard display.

**Architecture:** M10 owns decoding and bounded observations. Inject read-only transport, decoders and clock plus connection/build values; never call Electron, another module's store, the model or control actions. Electron consumes its dashboard descriptor through M1.

**Tech Stack:** TypeScript, Effect, versioned Panels codecs, bounded local buffers.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M10 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** PAN-01–PAN-04; ROB-05, ROB-06; AI-05, AI-07; AC-09.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/system-context/index.ts`
- `packages/desktop/src/main/windows.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-diagnostics.ts` — observation/log/dashboard records
- `packages/core/src/ftc/diagnostics.ts` — public snapshot/subscription facade
- `packages/core/src/ftc/diagnostics/decoders.ts` — version-specific protocol normalization
- `packages/core/src/ftc/diagnostics/context.ts` — domain Context Source

`Observation = { controllerID, projectID?, generation, receivedAt, robotTimestamp?, value, source, protocolVersion, deployedBuildID? }`; unknown deployed build stays absent, never inferred from selected project. `TelemetrySnapshot = { state: 'live' | 'stale' | 'disconnected' | 'missing', observations }`. `DashboardDescriptor = { controllerID, generation, url, allowedOrigins, display: 'embedded' | 'external' | 'unavailable', controls: 'blocked' | 'mediated', reason? }`; no preload or credential capability.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Valid zero must differ from absent telemetry (M10-02).
- Old observations cannot be relabelled after project/target switches (M10-02).
- Malformed/unknown protocol data must remain explicit failures (M10-01).
- No robot logs is an availability state, not proof of no faults (M10-03).
- External dashboard fallback must retain backend telemetry (M10-04/M10-06).

## Task checklist

- [ ] [M10-01 — Decode versioned observation messages](#m10-01)
- [ ] [M10-02 — Maintain bounded provenance-aware snapshots](#m10-02)
- [ ] [M10-03 — Combine available logs and build evidence](#m10-03)
- [ ] [M10-04 — Publish safe dashboard descriptors and fallback](#m10-04)
- [ ] [M10-05 — Expose diagnostic queries and bind read transports](#m10-05)
- [ ] [M10-06 — Validate actual telemetry and fallback data access](#m10-06)

## Execution tasks

<a id="m10-01"></a>

### M10-01 — Decode versioned observation messages

**Prerequisites:** [M8-04](controller-connections.md#m8-04).

**Files:** `packages/schema/src/ftc-diagnostics.ts`, `packages/core/src/ftc/diagnostics/decoders.ts`, `packages/core/test/ftc/diagnostics-and-dashboard/m10-01.test.ts`.

**Interfaces:** Produces `decodeObservation({ raw, protocolVersion, connection, receivedAt }): Observation | DecodeFailure`; consumes versioned raw fixtures from M8-04.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/diagnostics-and-dashboard/m10-01.test.ts`, add `malformed and unsupported messages are distinguishable`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(malformed.code).toBe('malformed_message'); expect(unsupported.code).toBe('unsupported_protocol'); expect(zero.value).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/diagnostics-and-dashboard/m10-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Normalize only actual exposed fields; preserve source timestamps and protocol version. Bound message sizes, reject invalid identity claims, and treat telemetry/log text as untrusted data, not instructions.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/diagnostics-and-dashboard/m10-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): decode versioned observation messages`.

<a id="m10-02"></a>

### M10-02 — Maintain bounded provenance-aware snapshots

**Prerequisites:** [M10-01](diagnostics-and-dashboard.md#m10-01).

**Files:** `packages/core/src/ftc/diagnostics.ts`, `packages/core/test/ftc/diagnostics-and-dashboard/m10-02.test.ts`.

**Interfaces:** Produces `telemetrySnapshot({ controllerID, generation }): TelemetrySnapshot` and `subscribe({ connection }): scoped observation stream`; clock and freshness threshold are explicit inputs.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/diagnostics-and-dashboard/m10-02.test.ts`, add `target switch keeps old data stale and attributed`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(old.controllerID).toBe(originalID); expect(newTarget.state).toBe('missing'); expect(zeroSnapshot.state).toBe('live'); expect(buffer.length).toBeLessThanOrEqual(limit)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/diagnostics-and-dashboard/m10-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use per-source bounded buffers and explicit stale/disconnected states; fixture freshness threshold is configurable test data, not an invented product promise. On disconnect mark affected readings and unsubscribe on disposal. Current project selection cannot rewrite observed provenance.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/diagnostics-and-dashboard/m10-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): maintain bounded provenance-aware snapshots`.

<a id="m10-03"></a>

### M10-03 — Combine available logs and build evidence

**Prerequisites:** [M10-02](diagnostics-and-dashboard.md#m10-02).

**Files:** `packages/core/src/ftc/diagnostics.ts`, `packages/core/src/ftc/diagnostics/context.ts`, `packages/core/test/ftc/diagnostics-and-dashboard/m10-03.test.ts`.

**Interfaces:** Produces `diagnosticSnapshot({ connection, buildEvidence? }): { telemetry, logs, build, deployedBuild }`; logs have available/missing/failed and actual source metadata.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/diagnostics-and-dashboard/m10-03.test.ts`, add `selected project does not prove deployed build identity`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(snapshot.deployedBuild.state).toBe('unknown'); expect(snapshot.logs.state).toBe('missing'); expect(snapshot.build.buildID).toBe(actualBuildID)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/diagnostics-and-dashboard/m10-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Read only supported robot logs; include actual M5 build evidence as supplied values. Record deployment association only when verified. Preserve historical versus live evidence and provide a domain Context Source with freshness/error limits.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/diagnostics-and-dashboard/m10-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): combine available logs and build evidence`.

<a id="m10-04"></a>

### M10-04 — Publish safe dashboard descriptors and fallback

**Prerequisites:** [M10-02](diagnostics-and-dashboard.md#m10-02).

**Files:** `packages/core/src/ftc/diagnostics.ts`, `packages/schema/src/ftc-diagnostics.ts`, `packages/core/test/ftc/diagnostics-and-dashboard/m10-04.test.ts`.

**Interfaces:** Produces `dashboardDescriptor({ connection, capabilities, embeddingEvaluation }): DashboardDescriptor`; capability decisions must derive from evaluated resource/control policy.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/diagnostics-and-dashboard/m10-04.test.ts`, add `external display retains independent telemetry subscription`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(descriptor.display).toBe('external'); expect(activeTelemetrySubscriptions).toBe(1); expect(descriptor.controls).toBe('blocked')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/diagnostics-and-dashboard/m10-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Validate target/resource URLs against the selected descriptor. Report unavailable/unsupported display clearly; select the agreed external fallback after failed embedding validation without disabling backend data or authorizing controls.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/diagnostics-and-dashboard/m10-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): publish safe dashboard descriptors and fallback`.

<a id="m10-05"></a>

### M10-05 — Expose diagnostic queries and bind read transports

**Prerequisites:** [M10-03](diagnostics-and-dashboard.md#m10-03), [M10-04](diagnostics-and-dashboard.md#m10-04), [M8-05](controller-connections.md#m8-05).

**Files:** `packages/protocol/src/groups/ftc-diagnostics.ts`, `packages/server/src/handlers/ftc-diagnostics.ts`, `packages/core/src/ftc/composition.ts`, `packages/core/test/ftc-integration/m10-05.test.ts`.

**Interfaces:** Binds M8 read ports and M10 domain Context Source; produces typed telemetry/log/dashboard APIs/events for M1/M3.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m10-05.test.ts`, add `composed disconnect invalidates current data once`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(afterDisconnect.state).toBe('disconnected'); expect(newTarget.observations).toEqual([]); expect(readersAfterDispose).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m10-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Register handlers/context sources and regenerate Client. Test M8/M10 target-generation ordering and build-evidence provenance with real modules; verify no dependency on UI or a model and no mutation transport binding.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m10-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): expose diagnostic queries and bind read transports`.

<a id="m10-06"></a>

### M10-06 — Validate actual telemetry and fallback data access

**Prerequisites:** [M10-05](diagnostics-and-dashboard.md#m10-05), [M8-06](controller-connections.md#m8-06).

**Files:** `docs/validation/diagnostics.md`, `docs/compatibility-matrix.md`, `packages/core/test/ftc-evaluation/m10-06.test.ts`.

**Interfaces:** Produces real protocol/log/freshness evidence independently of M1 embedded-view validation.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m10-06.test.ts` for the automated portion of “live zero stale logs and external dashboard”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Publish known values including zero from a real robot and confirm the agent-readable result, timestamps and controller association. Disconnect/switch/reconnect over USB/Wi-Fi; test supported logs and unknown deployment association. Repeat with external display. Record unavailable capabilities and do not treat rendered Panels as proof of typed telemetry.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m10-06.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 6 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/diagnostics-and-dashboard`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
