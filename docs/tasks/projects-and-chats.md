# M2 — Projects and chats Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Persist project/chat associations and enforce one active chat per canonical project without changing Session ownership.

**Architecture:** M2 owns its local repository and project gate. Inject folder identity, Session access and execution notifications; never read or write Session tables. The host shares one gate across windows while tests create independent scoped instances.

**Tech Stack:** TypeScript, Effect, SQLite/Drizzle, filesystem identity adapters.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M2 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** PRJ-01–PRJ-04; AC-02, AC-03.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/project.ts`
- `packages/core/src/session.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/run-coordinator.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-project.ts` — browser-safe project/chat/gate records
- `packages/core/src/ftc/projects.ts` — public service and association rules
- `packages/core/src/ftc/projects/sql.ts` — module-owned associations
- `packages/core/src/ftc/projects/gate.ts` — canonical-root execution ownership

`ProjectContext = { projectID, canonicalRoot, location }`; reuse existing Project/Location/Session ID schemas. `ChatRef = { projectID, chatID, sessionID }`. `GateLease = { projectKey, chatID, sessionID, token }`, where `token` is opaque and process-local. `GateResult = { kind: 'acquired', lease } | { kind: 'busy', active: ChatRef }`. Repository results contain no model history.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Folder symlink/case aliases must share ownership (M2-01/M2-03).
- Admission failure must release only its unused reservation (M2-04).
- An old completion callback must not release a newer run (M2-05).
- A draft in a busy chat must never become an admitted input (M2-04).
- Reopening the database restores associations, not active ownership or provider work (M2-02/M2-06).

## Task checklist

- [x] [M2-01 — Associate canonical project folders](#m2-01)
- [x] [M2-02 — Persist separate chat-to-Session membership](#m2-02)
- [ ] [M2-03 — Acquire one atomic project execution lease](#m2-03)
- [ ] [M2-04 — Submit without admitting a busy chat's draft](#m2-04)
- [ ] [M2-05 — Release ownership after settled stop or completion](#m2-05)
- [ ] [M2-06 — Expose project API and compose the execution gate](#m2-06)

## Execution tasks

<a id="m2-01"></a>

### M2-01 — Associate canonical project folders

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-project.ts`, `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/sql.ts`, `packages/core/test/ftc/projects-and-chats/m2-01.test.ts`.

**Interfaces:** Consumes a folder-identity port and private repository. Produces `createProject({ root }): ProjectContext` and `openProject({ root }): ProjectContext`; creation associates an already prepared folder, while M6/M5 own template edits.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-01.test.ts`, add `folder aliases reopen one project`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(alias.projectID).toBe(opened.projectID); expect(afterFiles).toEqual(beforeFiles)
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Resolve canonical filesystem identity before association; inspect folder access without modifying project files. Persist associations with snake_case columns; generate migrations through the existing Core migration workflow and test reopen.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): associate canonical project folders`.

<a id="m2-02"></a>

### M2-02 — Persist separate chat-to-Session membership

**Prerequisites:** [M2-01](projects-and-chats.md#m2-01).

**Files:** `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/sql.ts`, `packages/core/test/ftc/projects-and-chats/m2-02.test.ts`.

**Interfaces:** Consumes injected `createSession({ location })` and Session lookup. Produces `createChat({ projectID }): ChatRef` and `listChats({ projectID }): readonly ChatRef[]`.

- [x] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-02.test.ts`, add `reopen retains distinct chat Sessions`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(a.sessionID).not.toBe(b.sessionID); expect(reopened).toEqual([a, b])
```

- [x] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [x] **3. Implement the smallest behavior:** Create Sessions only through Session access; persist membership without copying history. Reject Session/chat mismatches and test two projects using fresh temporary SQLite repositories.
- [x] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [x] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): persist separate chat-to-session membership`.

<a id="m2-03"></a>

### M2-03 — Acquire one atomic project execution lease

**Prerequisites:** [M2-01](projects-and-chats.md#m2-01), [M2-02](projects-and-chats.md#m2-02).

**Files:** `packages/core/src/ftc/projects/gate.ts`, `packages/core/test/ftc/projects-and-chats/m2-03.test.ts`.

**Interfaces:** Produces `acquire(chat: ChatRef): GateResult`, `release(lease: GateLease): void`, and `activeChat({ projectID }): ChatRef | undefined`; keyed by canonical root, not manifest ID.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-03.test.ts`, add `same project contends while another runs`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(same.kind).toBe('busy'); expect(other.kind).toBe('acquired'); expect(active.chatID).toBe(first.chatID)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Implement the actual scoped gate with atomic acquisition and token-checked release; race concurrent acquisitions, aliases and duplicate views. Importing the module must create no global state.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): acquire one atomic project execution lease`.

<a id="m2-04"></a>

### M2-04 — Submit without admitting a busy chat's draft

**Prerequisites:** [M2-02](projects-and-chats.md#m2-02), [M2-03](projects-and-chats.md#m2-03).

**Files:** `packages/core/src/ftc/projects.ts`, `packages/core/test/ftc/projects-and-chats/m2-04.test.ts`.

**Interfaces:** Consumes a Session admission port with existing prompt/retry semantics. Produces `submitPrompt({ chat, prompt }): { kind: 'admitted', receipt } | { kind: 'busy', active }`; receipt is the existing Session admission receipt.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-04.test.ts`, add `busy submission does not call admission`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(admittedChatIDs).toEqual([first.chatID]); expect(afterIdleAdmissionCount).toBe(1)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Reserve before admission, retain same-chat steer/queue semantics, and reject a different busy chat before durable admission. Roll back an unused lease on failure. Preserve resume:false as explicit admit-only admission, never as storage for a rejected draft.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): submit without admitting a busy chat's draft`.

<a id="m2-05"></a>

### M2-05 — Release ownership after settled stop or completion

**Prerequisites:** [M2-03](projects-and-chats.md#m2-03), [M2-04](projects-and-chats.md#m2-04).

**Files:** `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/gate.ts`, `packages/core/test/ftc/projects-and-chats/m2-05.test.ts`.

**Interfaces:** Consumes execution-settled notifications carrying lease identity. Produces `stopRun({ chat }): void` and lease-aware completion handling; stopping calls Session interruption.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-05.test.ts`, add `stop retains ownership until cleanup settles`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(duringCleanup.kind).toBe('busy'); expect(afterCleanup.kind).toBe('acquired'); expect(afterOldCallback.token).toBe(newLease.token)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Hold the gate during tool/approval waits and interruption cleanup. Handle admission-versus-drain-completion races; stale callbacks cannot unlock a new run. Idle stop is a no-op.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): release ownership after settled stop or completion`.

<a id="m2-06"></a>

### M2-06 — Expose project API and compose the execution gate

**Prerequisites:** [M2-01](projects-and-chats.md#m2-01), [M2-02](projects-and-chats.md#m2-02), [M2-03](projects-and-chats.md#m2-03), [M2-04](projects-and-chats.md#m2-04), [M2-05](projects-and-chats.md#m2-05), [M3-02](agent-and-context.md#m3-02).

**Files:** `packages/protocol/src/groups/ftc-project.ts`, `packages/server/src/handlers/ftc-project.ts`, `packages/core/src/ftc/composition.ts`, `packages/opencode/src/effect/app-runtime.ts`, `packages/core/test/ftc-integration/m2-06.test.ts`.

**Interfaces:** Binds M2 Session ports to M3 and M3 gate ports to M2 only in host wiring. Produces typed commands/events for M1 and one process-wide gate.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m2-06.test.ts`, add `composed duplicate windows cannot bypass gate`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(maxActiveForProject).toBe(1); expect(otherProjectStarted).toBe(true); expect(restartedActive).toBeUndefined()
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m2-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Register handlers in existing API/handler composition and regenerate Client. Add composed prompt/resume/wake/stop race tests with real M2/M3, persist separate histories across reopen, and require explicit post-crash resume. Keep this suite outside module-only selection.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m2-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): expose project api and compose the execution gate`.

## Module completion gate

- [ ] All 6 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/projects-and-chats`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
