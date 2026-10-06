# M3 — Agent and context Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Adapt the existing Session engine to FTC context and code modes while preserving durable admission and execution semantics.

**Architecture:** Reuse Session V2; inject a minimal project-gate/model/context/tool contract rather than sibling implementations. Keep runner/model/tool/permission services Location-scoped and SessionExecution process-global. Domain sources produce facts; M9 alone decides robot authorization.

**Tech Stack:** TypeScript, Effect, existing Session repositories/runner/System Context/tool registry.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M3 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** AI-04–AI-07; PRJ-02–PRJ-04; EDT-02; HW-02, HW-03; PAN-04; ROB-07; AC-03–AC-06, AC-08, AC-11.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/session.ts`
- `packages/core/src/session/input.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/runner/index.ts`
- `packages/core/src/session/context-epoch.ts`
- `packages/core/src/system-context/index.ts`
- `packages/core/src/tool/application-tools.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/core/src/ftc/agent.ts` — FTC coding policy/facade
- `packages/core/src/ftc/agent/gate.ts` — consumed project-gate port only
- `packages/core/src/ftc/agent/context.ts` — FTC context composition adapter
- `packages/core/src/ftc/agent/tools.ts` — structured domain tool adapters
- `packages/schema/src/ftc-agent.ts` — independent mode/plan/result records

Reuse existing Session prompt, receipt, events and stream types; do not invent a second prompt store. `CodeMode = 'plan-first' | 'direct'`. `CodePlan = { planID, projectID, sessionID, proposal: EditProposal, explanation, expectedRevisions }`; trusted plan approval binds these values. Gate port `acquire(chat): GateResult`, `release(lease): void`, execution notifications carry the same lease token as M2. `RunOutcome` preserves provider/tool/build/robot failure categories and source evidence IDs.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Exact retries must not add a second durable prompt (M3-01).
- Advisory wakes and explicit resume must use the same project gate (M3-02).
- Steer/queue promotion and provider-turn allowances must retain existing semantics (M3-01).
- Changed revisions invalidate plan approval instead of overwriting user work (M3-03).
- Untrusted repo/log/reference text cannot approve robot actions or reveal credentials (M3-04/M3-05).

## Task checklist

- [x] [M3-01 — Pin Session admission and continuation invariants](#m3-01)
- [x] [M3-02 — Apply an injected gate at every Session execution entry](#m3-02)
- [ ] [M3-03 — Implement plan-first and direct code-change policy](#m3-03)
- [ ] [M3-04 — Assemble versioned FTC context from public sources](#m3-04)
- [ ] [M3-05 — Expose structured FTC tools with honest evidence](#m3-05)
- [ ] [M3-06 — Bind real model and domain adapters in the host](#m3-06)
- [ ] [M3-07 — Verify user-visible coding and AI failure workflows](#m3-07)

## Execution tasks

<a id="m3-01"></a>

### M3-01 — Pin Session admission and continuation invariants

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/core/test/session-prompt.test.ts`, `packages/core/test/session-runner.test.ts`, `packages/core/test/session-run-coordinator.test.ts`, `packages/core/test/ftc/agent-and-context/m3-01.test.ts`.

**Interfaces:** Consumes existing SessionV2 prompt/execution public contracts and real temporary repositories. Produces focused regression coverage; change runtime only if a test exposes a violated required invariant.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-01.test.ts`, add `admission precedes wake and exact retry reconciles`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(inputRowsForMessage).toHaveLength(1); expect(order).toEqual(['admit', 'wake']); expect(streamCalls).toBe(providerTurns)
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-01.test.ts`. Expected: the new behavior fails for the intended missing behavior. Existing Session invariants may already pass: record that baseline and reuse their assertions without forcing a failure.
- [x] **3. Implement the smallest behavior:** Cover conflicting message IDs, historical projected retry reconciliation, resume:false, same-Session join, steer safe-boundary promotion, one-at-a-time queue promotion, provider allowance reset and history reload. Preserve EventV2 replay ownership and no automatic post-crash provider retry; reuse current passing tests rather than duplicating them.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `test(ftc): pin session admission and continuation invariants`.

Verified 2026-10-06: candidate `97b5f4ee6`, reviewed repair `13838cc97`; [implementation evidence](../validation/M3-01-implementation.md), [independent review](../validation/M3-01-review.md). Existing Session runtime/tests remain unchanged; actual production gate/placement integration is later work.

<a id="m3-02"></a>

### M3-02 — Apply an injected gate at every Session execution entry

**Prerequisites:** [M3-01](agent-and-context.md#m3-01).

**Files:** `packages/core/src/ftc/agent/gate.ts`, `packages/core/src/session/execution/local.ts`, `packages/core/src/session/runner/index.ts`, `packages/core/test/ftc/agent-and-context/m3-02.test.ts`.

**Interfaces:** Consumes gate port records specified in M2, not its implementation. Produces gated explicit resume/advisory wake paths using SessionStore placement lookup at drain start.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-02.test.ts`, add `resume wake and prompt cannot overlap different chats in one project`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(blockedDrainStarts).toBe(0); expect(otherProjectDrainStarts).toBe(1); expect(releaseBeforeCleanup).toBe(false)
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Bind a scoped lease to the existing process-global coordinator ownership chain; do not add Session-ID-specific layers or a second loop. Location resolution, tool/approval waits and interruption cleanup retain ownership. Isolated tests supply a controlled gate port.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): apply an injected gate at every session execution entry`.

Verified 2026-10-07, reviewed repair `1aa520e9e`; [implementation evidence](../validation/M3-02-implementation.md), [independent review](../validation/M3-02-review.md). Actual production M2 admission/host composition remains later work.

<a id="m3-03"></a>

### M3-03 — Implement plan-first and direct code-change policy

**Prerequisites:** [M3-01](agent-and-context.md#m3-01).

**Files:** `packages/schema/src/ftc-agent.ts`, `packages/core/src/ftc/agent.ts`, `packages/core/test/ftc/agent-and-context/m3-03.test.ts`.

**Interfaces:** Produces `proposeCodeChange({ sessionID, mode, proposal }): CodePlan | EditResult` and `approveCodePlan({ trustedUserEvent, planID, expectedRevisions }): EditResult`; consumes an edit-application port.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-03.test.ts`, add `plan-first waits and stale approval cannot edit`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(writesBeforeApproval).toBe(0); expect(staleApproval.code).toBe('revision_conflict'); expect(directResult.applied).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Present intended edits before plan approval; direct work may perform requested edits/local builds. Preserve the actual proposal/revisions and scope on approval. Neither mode grants deployment/start/tuning rights; missing robot facts become questions or explicit limits.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): implement plan-first and direct code-change policy`.

<a id="m3-04"></a>

### M3-04 — Assemble versioned FTC context from public sources

**Prerequisites:** [M3-01](agent-and-context.md#m3-01).

**Files:** `packages/core/src/ftc/agent/context.ts`, `packages/core/src/ftc/configuration/context.ts`, `packages/core/src/ftc/knowledge/context.ts`, `packages/core/src/ftc/diagnostics/context.ts`, `packages/core/test/ftc/agent-and-context/m3-04.test.ts`.

**Interfaces:** Consumes immutable project code/configuration/reference/diagnostic records through registered domain Context Sources. Produces context inputs for existing System Context and Session-owned Context Epoch persistence.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-04.test.ts`, add `context preserves project version freshness and missing facts`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(context.projectID).toBe(requestProjectID); expect(context.missingFacts).toContain('wheel-diameter'); expect(context.text).not.toContain(secret)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Keep producers with their domains; adapt in host wiring without moving System Context algebra or history selection. Tag sources/versions/freshness, preserve unknown facts and language/identifiers, and include online disclosure/offline missing references. Treat external text as data, not action authority.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): assemble versioned ftc context from public sources`.

<a id="m3-05"></a>

### M3-05 — Expose structured FTC tools with honest evidence

**Prerequisites:** [M3-03](agent-and-context.md#m3-03), [M3-04](agent-and-context.md#m3-04).

**Files:** `packages/core/src/ftc/agent/tools.ts`, `packages/core/src/tool/application-tools.ts`, `packages/core/test/ftc/agent-and-context/m3-05.test.ts`.

**Interfaces:** Produces inspect/configure/propose-edit/build/read-diagnostics/prepare-operation tool adapters over injected M5/M6/M9/M10/M11 public ports. Tool results carry owner-generated evidence IDs and categorized failures.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-05.test.ts`, add `failed tool is reported as failed and never fabricated success`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.kind).toBe('build_failed'); expect(result.artifact).toBeUndefined(); expect(robotDispatchesWithoutApproval).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Route source edits through code policy and revision checks; robot requests only through M9. Explain generated changes and actual results. Do not expose unrestricted shell/network/ADB/dashboard tools; production enablement requires M9-08.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): expose structured ftc tools with honest evidence`.

<a id="m3-06"></a>

### M3-06 — Bind real model and domain adapters in the host

**Prerequisites:** [M3-02](agent-and-context.md#m3-02), [M3-05](agent-and-context.md#m3-05), [M2-03](projects-and-chats.md#m2-03), [M5-06](java-development.md#m5-06), [M6-05](ftc-configuration-and-libraries.md#m6-05), [M7-07](ai-access-and-local-inference.md#m7-07), [M9-08](robot-approvals-and-operations.md#m9-08), [M10-05](diagnostics-and-dashboard.md#m10-05), [M11-02](ftc-knowledge.md#m11-02).

**Files:** `packages/core/src/ftc/composition.ts`, `packages/opencode/src/effect/app-runtime.ts`, `packages/core/src/location-services.ts`, `packages/sdk-next/src/opencode.ts`, `packages/core/test/ftc-integration/m3-06.test.ts`.

**Interfaces:** Produces FTC production composition using public services and existing host/AppNode lifetimes; adapt only actual hosts that need FTC, never import Server into Core.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m3-06.test.ts`, add `real wiring preserves global coordinators and Location tools`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(projectGateInstances).toBe(1); expect(controllerCoordinatorInstances).toBe(1); expect(toolLocations).toEqual(expectedLocations)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m3-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Wire model streams, sources, tools and project gate; keep private module state unreachable. Add real-module composition tests for failures/cancellation and repeated scope disposal. Do not route through legacy SessionPrompt.loop; preserve the desktop's Node-bundled backend integration.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m3-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): bind real model and domain adapters in the host`.

<a id="m3-07"></a>

### M3-07 — Verify user-visible coding and AI failure workflows

**Prerequisites:** [M3-06](agent-and-context.md#m3-06), [M1-03](desktop-workspace.md#m1-03), [M1-07](desktop-workspace.md#m1-07), [M1-11](desktop-workspace.md#m1-11), [M1-04](desktop-workspace.md#m1-04), [M1-05](desktop-workspace.md#m1-05).

**Files:** `docs/validation/agent-workflows.md`, `packages/core/test/ftc-integration/agent-workflows.test.ts`, `packages/core/test/ftc-evaluation/m3-07.test.ts`.

**Interfaces:** Produces AC-05/AC-06 coding evidence and categorized model/tool/build/robot failure transcripts.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m3-07.test.ts` for the automated portion of “plan direct online offline and interrupted runs”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Exercise plan rejection/approval, direct edits, Java/build errors, missing robot facts, unsupported local tool capability, provider outage and interruption on a representative project. Confirm both explanation languages, no credential/context leaks and no online fallback. Attach actual tool outcomes and distinguish fixture integration from real-model runs.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m3-07.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 7 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/agent-and-context`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
