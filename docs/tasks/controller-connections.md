# M8 — Controller connections Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Discover, identify and reconnect controllers while keeping transport aliases and connection generations explicit.

**Architecture:** M8 owns connection identity/status and provides read capabilities. Inject ADB/protocol transport and identity resolution. Only M9's protected adapter receives mutation capabilities; M8 discovery never installs or starts a program.

**Tech Stack:** TypeScript, Effect, ADB, versioned Panels connection adapters.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M8 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** ROB-01, ROB-05, ROB-06; PAN-01–PAN-03; AC-09–AC-11.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/process.ts`
- `packages/desktop/src/main/server.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-controller.ts` — identity/connection/status records
- `packages/core/src/ftc/controllers.ts` — discovery/selection facade
- `packages/core/src/ftc/controllers/adb.ts` — read/connect ADB adapter
- `packages/core/src/ftc/controllers/identity.ts` — transport alias resolution

`ControllerIdentity = { controllerID, kind: 'control-hub' | 'phone', verified, aliases }`; an endpoint string alone is not a controller ID. `ConnectionDescriptor = { controllerID, generation, transport: 'usb' | 'wifi', authorization, state, readEndpoints, capabilities }`. Generations change on reconnect/target change; descriptors contain no mutation function or reusable approval.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- USB and Wi-Fi aliases must lock the same physical device (M8-02).
- Unknown/ambiguous identity remains ineligible for mutation (M8-02).
- ADB unauthorized differs from missing/disconnected (M8-01).
- Reconnect changes generation and never replays a command (M8-05).
- USB install success does not establish Panels/WebSocket reachability (M8-04/M8-06).

## Task checklist

- [ ] [M8-01 — Parse discovery and authorization states](#m8-01)
- [ ] [M8-02 — Resolve controller identity across transport aliases](#m8-02)
- [ ] [M8-03 — Connect and select a target with generation tracking](#m8-03)
- [ ] [M8-04 — Evaluate and implement read endpoints and USB forwarding](#m8-04)
- [ ] [M8-05 — Publish disconnect and read-only reconnect events](#m8-05)
- [ ] [M8-06 — Validate the real controller and transport matrix](#m8-06)

## Execution tasks

<a id="m8-01"></a>

### M8-01 — Parse discovery and authorization states

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-controller.ts`, `packages/core/src/ftc/controllers.ts`, `packages/core/src/ftc/controllers/adb.ts`, `packages/core/test/ftc/controller-connections/m8-01.test.ts`.

**Interfaces:** Produces `discoverControllers(): readonly ControllerCandidate[]`; candidates include transport address, device kind if known, authorization and explanatory error codes.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/controller-connections/m8-01.test.ts`, add `unauthorized device is visible without deployment side effects`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(candidate.authorization).toBe('unauthorized'); expect(mutationCalls).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/controller-connections/m8-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use recorded ADB responses through an injected transport; distinguish unauthorized/offline/available devices, multiple targets and empty discovery. Include Control Hub/phone guidance and attached Expansion Hub context without inventing physical configuration.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/controller-connections/m8-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): parse discovery and authorization states`.

<a id="m8-02"></a>

### M8-02 — Resolve controller identity across transport aliases

**Prerequisites:** [M8-01](controller-connections.md#m8-01), [M8-04](controller-connections.md#m8-04).

**Files:** `packages/core/src/ftc/controllers/identity.ts`, `packages/core/test/ftc/controller-connections/m8-02.test.ts`.

**Interfaces:** Produces `resolveIdentity({ observations }): ControllerIdentity | { kind: 'ambiguous', candidates }`; consumes trusted device facts, never a user display label alone.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/controller-connections/m8-02.test.ts`, add `aliases converge while ambiguous identities remain blocked`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(usb.controllerID).toBe(wifi.controllerID); expect(ambiguous.kind).toBe('ambiguous')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/controller-connections/m8-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Select identity evidence using the protocol evaluation in M8-04; unit fixtures model verified/ambiguous results. Handle reused addresses, indistinguishable devices and changed device facts conservatively. Never use project/manifest identity as robot identity.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/controller-connections/m8-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): resolve controller identity across transport aliases`.

<a id="m8-03"></a>

### M8-03 — Connect and select a target with generation tracking

**Prerequisites:** [M8-01](controller-connections.md#m8-01), [M8-02](controller-connections.md#m8-02).

**Files:** `packages/core/src/ftc/controllers.ts`, `packages/core/test/ftc/controller-connections/m8-03.test.ts`.

**Interfaces:** Produces `connect({ candidate }): ConnectionDescriptor`, `selectTarget({ projectID, controllerID }): ConnectionDescriptor`, and `connectionStatus({ controllerID }): ConnectionDescriptor`.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/controller-connections/m8-03.test.ts`, add `target change advances generation without control commands`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(next.generation).not.toBe(previous.generation); expect(mutationCalls).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/controller-connections/m8-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Track selection and connection states with explicit subscriptions. Validate authorization and identity, publish generation changes, and expose guidance for deliberate USB/Wi-Fi recovery.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/controller-connections/m8-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): connect and select a target with generation tracking`.

<a id="m8-04"></a>

### M8-04 — Evaluate and implement read endpoints and USB forwarding

**Prerequisites:** [M8-01](controller-connections.md#m8-01).

**Files:** `packages/core/src/ftc/controllers/adb.ts`, `packages/core/src/ftc/controllers/panels.ts`, `packages/core/test/ftc-adapters/controller-endpoints.test.ts`, `docs/validation/controller-protocol.md`, `packages/core/test/ftc-evaluation/m8-04.test.ts`.

**Interfaces:** Produces versioned identity/capability evidence and `readEndpoints` for dashboard/data/log access; forwarding is owned and scoped.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m8-04.test.ts` for the automated portion of “dashboard and data endpoints resolve for supported protocol”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Inspect selected pinned Panels/ADB versions and capture protocol fixtures with provenance. Verify all required HTTP/WebSocket/plugin resources, identity evidence and USB forwarding; ports 8001/8002 are the proposal's inspected revision, not universal constants. Record missing telemetry/control features explicitly and use findings in M9/M10.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m8-04.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

<a id="m8-05"></a>

### M8-05 — Publish disconnect and read-only reconnect events

**Prerequisites:** [M8-02](controller-connections.md#m8-02), [M8-03](controller-connections.md#m8-03), [M8-04](controller-connections.md#m8-04).

**Files:** `packages/core/src/ftc/controllers.ts`, `packages/protocol/src/groups/ftc-controller.ts`, `packages/server/src/handlers/ftc-controller.ts`, `packages/core/src/ftc/composition.ts`, `packages/core/test/ftc/controller-connections/m8-05.test.ts`.

**Interfaces:** Produces identity/generation-bound connection events and generated read/connect/select APIs. Consumers M9/M10 subscribe through public ports.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/controller-connections/m8-05.test.ts`, add `reconnect publishes new generation but never a mutation`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(reconnected.generation).not.toBe(original.generation); expect(mutationCalls).toEqual([]); expect(disposedSubscriptions).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/controller-connections/m8-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Mark connection unavailable promptly, close owned forwards/readers, permit only read-only reconnection, and retain useful recovery causes. Ensure repeated construction/disposal does not leak handles and transport fixtures match production adapter contracts.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/controller-connections/m8-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): publish disconnect and read-only reconnect events`.

<a id="m8-06"></a>

### M8-06 — Validate the real controller and transport matrix

**Prerequisites:** [M8-05](controller-connections.md#m8-05).

**Files:** `docs/validation/controller-connections.md`, `docs/compatibility-matrix.md`, `packages/core/test/ftc-evaluation/m8-06.test.ts`.

**Interfaces:** Produces tested Control Hub/phone and USB/Wi-Fi connection rows for M4/M9/M10.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m8-06.test.ts` for the automated portion of “macOS Windows and both controller transport types”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Verify discovery, authorization, aliases, endpoint forwarding, target changes, disconnect/reconnect and cleanup on real documented configurations. Record OS/architecture/controller/transport/SDK/Panel versions, including unsupported phones explicitly. This connection gate does not claim deployment or physical program correctness.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m8-06.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 6 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/controller-connections`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
