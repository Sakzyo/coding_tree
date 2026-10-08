# M9 — Robot approvals and operations Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Make every app-issued robot mutation pass exact authorization, current-context validation and shared controller coordination.

**Architecture:** M9 alone owns robot mutation authority, pending approvals, controller leases and durable operation outcomes. Inject trusted user events, live connection/state/artifact queries, protected mutation transport, clock and private repository. Scope one controller coordinator across application windows; no durable approval replay.

**Tech Stack:** TypeScript, Effect, SQLite/Drizzle, protected ADB/Panel adapters, evaluated OS process isolation.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M9 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** ROB-02–ROB-07; PAN-01; AI-04; AC-10, AC-11.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/tool/bash.ts`
- `packages/core/src/tool/application-tools.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/src/session/runner/index.ts`
- `packages/desktop/src/main/windows.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-operation.ts` — operation/context/status records
- `packages/core/src/ftc/operations.ts` — public preparation/approval/execution policy
- `packages/core/src/ftc/operations/sql.ts` — durable outcomes only
- `packages/core/src/ftc/operations/coordinator.ts` — per-controller ownership
- `packages/core/src/ftc/operations/transport.ts` — protected mutation dispatch
- `packages/core/src/ftc/execution-boundary.ts` — evaluated subprocess authority boundary

`OperationRequest = { projectID, chatID?, initiator: 'user' | 'agent', controllerID, generation, action }`; action is `{ kind: 'deploy', artifact }`, `{ kind: 'initialize' | 'start', opMode, expectedState }`, or `{ kind: 'tune', field, value, expectedState }`. `PreparedOperation` adds operationID and an immutable context fingerprint. Status is requested/awaiting_approval/running/succeeded/failed/cancelled/unknown. `UserApprovalEvent` comes exclusively from the authenticated user-action adapter; its exact operation/context cannot be supplied as a model assertion. Pending approvals are process-local and single-use.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Observation mode rejects agent initialize/start/tune, while deployment still needs explicit authorization (M9-01).
- Changing artifact, target, generation, parameters or state invalidates approval (M9-02/M9-04).
- USB/Wi-Fi aliases contend across projects (M9-03).
- Disconnect after dispatch produces unknown unless evidence establishes a result (M9-05).
- Shell/build/extension/dashboard paths must fail closed rather than bypass M9 (M9-07/M9-08).

## Task checklist

- [x] [M9-01 — Prepare typed operations under independent action policy](#m9-01)
- [ ] [M9-02 — Bind single-use approval to exact operation context](#m9-02)
- [ ] [M9-03 — Serialize mutations per physical controller](#m9-03)
- [ ] [M9-04 — Revalidate current action preconditions immediately before dispatch](#m9-04)
- [ ] [M9-05 — Execute once and persist confirmed or unknown outcomes](#m9-05)
- [ ] [M9-06 — Implement versioned mutation transport adapters](#m9-06)
- [ ] [M9-07 — Evaluate enforceable process and dashboard isolation](#m9-07)
- [ ] [M9-08 — Enforce the evaluated boundary in every production entry point](#m9-08)
- [ ] [M9-09 — Validate deployment and controls on physical robots](#m9-09)

## Execution tasks

<a id="m9-01"></a>

### M9-01 — Prepare typed operations under independent action policy

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-operation.ts`, `packages/core/src/ftc/operations.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts`.

**Interfaces:** Produces `prepareOperation({ request, robotMode }): PreparedOperation`; robotMode is observation/actions-with-approval and cannot be changed by code/layout/inference settings.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts`, add `observation blocks agent control but not separately approved deployment`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(start.code).toBe('observation_only'); expect(deploy.status).toBe('awaiting_approval'); expect(dispatchCount).toBe(0)
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Validate action-specific parameters and trusted project/chat identity; reject missing identity or unsupported capabilities. Store requested context without dispatching. Direct user commands and agent requests remain distinguishable at the trusted boundary.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): prepare typed operations under independent action policy`.

Verified 2026-10-08 at `768ec206c`: [implementation evidence](../validation/M9-01-implementation.md), [independent review](../validation/M9-01-review.md). Preparation only; producer/approval/dispatch/host/platform/physical gates remain separate. Minor parameterized test-name diagnostics are deferred.

<a id="m9-02"></a>

### M9-02 — Bind single-use approval to exact operation context

**Prerequisites:** [M9-01](robot-approvals-and-operations.md#m9-01).

**Files:** `packages/core/src/ftc/operations.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts`.

**Interfaces:** Produces `approveOperation({ userEvent, operationID, contextFingerprint }): PreparedOperation`; userEvent is an injected trusted capability, not a JSON secret.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts`, add `Deploy click authorizes only the displayed build and target`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(approved.action.artifact.digest).toBe(displayedDigest); expect(reused.code).toBe('approval_consumed'); expect(forged.code).toBe('untrusted_approval')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Treat a deliberate Deploy click as authorization without a redundant confirmation. Invalidate on changed target/generation/artifact/parameters, rejection, restart or consumption; define expiry via injected policy/clock rather than inventing a product timeout. Installation approval never includes start.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): bind single-use approval to exact operation context`.

<a id="m9-03"></a>

### M9-03 — Serialize mutations per physical controller

**Prerequisites:** [M9-01](robot-approvals-and-operations.md#m9-01).

**Files:** `packages/core/src/ftc/operations/coordinator.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-03.test.ts`.

**Interfaces:** Produces `acquireController({ operationID, controllerID }): OperationLease | BusyOperation` and token-checked release; consume verified canonical ControllerIdentity.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-03.test.ts`, add `same robot aliases cannot mutate concurrently`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(second.code).toBe('controller_busy'); expect(differentController.acquired).toBe(true); expect(maxConcurrentForRobot).toBe(1)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Share one scoped production coordinator across projects and windows. Hold ownership through dispatch/cleanup; release only the matching lease. Unknown identity cannot acquire mutation authority.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): serialize mutations per physical controller`.

<a id="m9-04"></a>

### M9-04 — Revalidate current action preconditions immediately before dispatch

**Prerequisites:** [M9-02](robot-approvals-and-operations.md#m9-02), [M9-03](robot-approvals-and-operations.md#m9-03).

**Files:** `packages/core/src/ftc/operations.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-04.test.ts`.

**Interfaces:** Consumes live `currentConnection(controllerID)`, `currentRobotState(controllerID)` and `verifyArtifact(ref)` ports. Produces validated dispatch input bound to the approved fingerprint.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-04.test.ts`, add `stale live state blocks dispatch even after approval`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(dispatchCount).toBe(0); expect(changedGeneration.code).toBe('context_changed'); expect(tamperedArtifact.code).toBe('artifact_invalid')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Refresh target/connection generation, expected OpMode/tuning state and artifact currency/digest after acquiring ownership. Recheck before transport write so a concurrent target change cannot redirect consent. Never trust snapshots supplied by an agent as current state.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): revalidate current action preconditions immediately before dispatch`.

<a id="m9-05"></a>

### M9-05 — Execute once and persist confirmed or unknown outcomes

**Prerequisites:** [M9-04](robot-approvals-and-operations.md#m9-04).

**Files:** `packages/core/src/ftc/operations.ts`, `packages/core/src/ftc/operations/sql.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-05.test.ts`.

**Interfaces:** Produces `executeOperation({ operationID }): OperationOutcome`, `operationStatus({ operationID }): OperationOutcome`, and cancellation; repository stores context/outcomes, not reusable authorization.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-05.test.ts`, add `disconnect and restart never replay a dispatched command`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(afterDisconnect.status).toBe('unknown'); expect(totalDispatchesAfterReconnect).toBe(1); expect(reopenedApproval).toBeUndefined()
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Record running before one protected dispatch; retain actual response/evidence. A lost response or stop request is not proof of robot stop. On startup mark interrupted running records unknown, invalidate pending approvals, and require new user action for any retry. Test cancellation before/after dispatch.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): execute once and persist confirmed or unknown outcomes`.

<a id="m9-06"></a>

### M9-06 — Implement versioned mutation transport adapters

**Prerequisites:** [M9-04](robot-approvals-and-operations.md#m9-04), [M9-05](robot-approvals-and-operations.md#m9-05), [M8-04](controller-connections.md#m8-04).

**Files:** `packages/core/src/ftc/operations/transport.ts`, `packages/core/test/ftc-adapters/robot-mutations.test.ts`, `packages/core/test/ftc-adapters/m9-06.test.ts`.

**Interfaces:** Consumes only validated dispatch inputs from M9; produces ADB install or Panels initialize/start/tune outcome records with protocol/version provenance.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-adapters/m9-06.test.ts`, add `transport sends exactly one approved action to exact target`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(sent).toEqual([expectedAuthorizedMessage]); expect(unsupported.code).toBe('unsupported_operation'); expect(extraStartCalls).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-adapters/m9-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Implement the evaluated protocol and structured ADB argument arrays, not shell command strings. Separate install from init/start and tuning. The adapter is bound only inside the trusted host and never exposed as a generic Core tool capability.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-adapters/m9-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Run the same boundary cases against the real adapter and supplied test port.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): implement versioned mutation transport adapters`.

<a id="m9-07"></a>

### M9-07 — Evaluate enforceable process and dashboard isolation

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `docs/validation/robot-action-isolation.md`, `packages/core/test/ftc-adapters/action-boundary-probe.test.ts`, `packages/desktop/src/main/panels-policy.ts`, `packages/core/test/ftc-evaluation/m9-07.test.ts`.

**Interfaces:** Produces a platform-specific execution-boundary decision with reproducible allow/deny probes; this is a prerequisite for production agent-controlled builds and command tools.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m9-07.test.ts` for the automated portion of “unapproved process cannot reach controller or broker”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Probe direct ADB binary paths, USB APIs, robot HTTP/WebSockets, Gradle tasks, extensions/MCP and dashboard writes on macOS and Windows. Choose a mechanism that denies controller/broker authority to unapproved subprocesses while permitting required development, or restrict the exposed execution surface and record the unresolved gate. PATH filtering and prompts alone cannot pass. Prove mediated/blocked embedded controls before enabling them.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m9-07.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

<a id="m9-08"></a>

### M9-08 — Enforce the evaluated boundary in every production entry point

**Prerequisites:** [M9-06](robot-approvals-and-operations.md#m9-06), [M9-07](robot-approvals-and-operations.md#m9-07), [M8-05](controller-connections.md#m8-05), [M5-06](java-development.md#m5-06), [M3-05](agent-and-context.md#m3-05), [M1-09](desktop-workspace.md#m1-09).

**Files:** `packages/core/src/ftc/execution-boundary.ts`, `packages/core/src/tool/bash.ts`, `packages/core/src/tool/application-tools.ts`, `packages/core/src/ftc/composition.ts`, `packages/protocol/src/groups/ftc-operation.ts`, `packages/server/src/handlers/ftc-operation.ts`, `packages/desktop/src/main/panels-policy.ts`, `packages/core/test/ftc-integration/m9-08.test.ts`.

**Interfaces:** Binds the chosen execution restrictions to command/build/extension hosts and M9 transport; exposes prepare/execute/status APIs while keeping approval input user-authenticated.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m9-08.test.ts`, add `every app-issued mutation reaches the same authority`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(bypassDispatches).toBe(0); expect(authorisedBrokerDispatches).toBe(1); expect(untrustedApprovalAccepted).toBe(false)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m9-08.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Add composed bypass regressions for M3 tools, M5 builds and dashboard controls, using M9-07's real isolation probe in platform adapter checks. Register typed API/events and regenerate Client. Do not enable a path whose mediation cannot be established.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m9-08.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): enforce the evaluated boundary in every production entry point`.

<a id="m9-09"></a>

### M9-09 — Validate deployment and controls on physical robots

**Prerequisites:** [M9-08](robot-approvals-and-operations.md#m9-08), [M8-06](controller-connections.md#m8-06), [M10-06](diagnostics-and-dashboard.md#m10-06).

**Files:** `docs/validation/robot-operations.md`, `docs/compatibility-matrix.md`, `packages/core/test/ftc-evaluation/m9-09.test.ts`.

**Interfaces:** Produces AC-10/AC-11 evidence linked to exact project/build/controller/action and platform.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m9-09.test.ts` for the automated portion of “physical deployment approvals aliases and disconnects”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** On the supported matrix, deploy to Control Hub and compatible phone over USB/Wi-Fi from both OSes; exercise observed init/start/tuning, observation rejection, target/artifact changes, concurrent projects and lost responses. Record confirmed/failed/unknown separately and demonstrate zero replay after reconnect. Build/unit/screenshot evidence cannot mark this task complete.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m9-09.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 9 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/robot-approvals-and-operations`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
