# M1 — Desktop workspace Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Present FTC projects, editing, setup, hardware, learning and robot workflows in one bilingual desktop workspace.

**Architecture:** Reuse the Solid workspace and Electron shell. Components receive narrow typed facades; domain state remains with its owning module. M5 owns dirty documents, M10 publishes dashboard descriptors and M9 owns action authority.

**Tech Stack:** SolidJS, existing typed i18n, generated Client, Electron WebContentsView, Monaco view adapter.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M1 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** PRJ-01–PRJ-05; EDT-01, EDT-02; ENV-01; HW-01, HW-02; PAN-01; ROB-03, ROB-04; LRN-01; LNG-01, LNG-02; AC-01–AC-13 user-facing flows.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/session-panel-layout.ts`
- `packages/app/src/context/sdk.tsx`
- `packages/app/src/context/language.tsx`
- `packages/app/src/i18n/en.ts`
- `packages/app/src/i18n/zh.ts`
- `packages/desktop/src/main/windows.ts`
- `packages/desktop/src/main/ipc.ts`
- `packages/desktop/src/preload/index.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/app/src/ftc/workspace.tsx` — layout and module view composition
- `packages/app/src/ftc/facades.ts` — consumed command/query/event interfaces
- `packages/app/src/ftc/client.ts` — generated client adapter
- `packages/app/src/ftc/setup.tsx` — environment and independent AI/mode settings
- `packages/app/src/ftc/hardware.tsx` — shared hardware form
- `packages/app/src/ftc/robot.tsx` — diagnostics and operation presentation
- `packages/app/src/ftc/learning.tsx` — lesson/exercise/progress view
- `packages/desktop/src/main/panels.ts` — isolated dashboard host

`WorkspaceView = { projectID?, chatID?, layout: 'chat' | 'chat-editor', language: 'en' | 'zh' }`; domain snapshots stay in injected facades. UI commands use the exact public signatures in M2–M12. Editor view state is selection/scroll/tabs, not authoritative document text. Settings are independent fields: setup choice, inference mode, code mode, robot mode, language and layout.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Switching layout/language must not reset dirty buffers or mode choices (M1-02/M1-13).
- Busy chat drafts stay local and never auto-submit (M1-01).
- Approval controls must emit the displayed project/artifact/controller context (M1-08).
- Panels must never receive the privileged preload bridge (M1-09).
- Window/component disposal must unsubscribe without losing owned documents (M1-02/M1-12).

## Task checklist

- [ ] [M1-01 — Show project/chat selection and busy ownership](#m1-01)
- [ ] [M1-02 — Preserve state across layout and view changes](#m1-02)
- [ ] [M1-03 — Present automatic and guided environment setup](#m1-03)
- [ ] [M1-04 — Present provider and local-model setup](#m1-04)
- [ ] [M1-05 — Present independent code and robot permission modes](#m1-05)
- [ ] [M1-06 — Render a Driver Station-style hardware form and chooser](#m1-06)
- [ ] [M1-07 — Display Java editor and actual diagnostic/build status](#m1-07)
- [ ] [M1-08 — Render diagnostics and exact robot operation controls](#m1-08)
- [ ] [M1-09 — Host the isolated Panels view and external fallback](#m1-09)
- [ ] [M1-10 — Render lessons and personal progress](#m1-10)
- [ ] [M1-11 — Connect workspace facades to generated APIs](#m1-11)
- [ ] [M1-12 — Check module boundaries and fresh-scope cleanup](#m1-12)
- [ ] [M1-13 — Audit complete bilingual UI and independent settings](#m1-13)
- [ ] [M1-14 — Verify packaged workspace and release acceptance](#m1-14)

## Execution tasks

<a id="m1-01"></a>

### M1-01 — Show project/chat selection and busy ownership

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/app/src/ftc/facades.ts`, `packages/app/src/ftc/workspace.tsx`, `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts`.

**Interfaces:** Consumes M2 ProjectContext/ChatRef/status contracts through fixture facades. Produces create/open/chat/submit/stop commands and local unsent drafts.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts`, add `busy project identifies active chat without submitting drafts`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(view.activeChatID).toBe(activeChatID); expect(submittedDrafts).toEqual([]); expect(otherProjectEnabled).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Reuse existing chat presentation and createStore state. Separate project histories and show the active owner, allowing another project to run; no automatic submission when busy status clears. Read package instructions and record required benchmark baseline before changing existing session/timeline code.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-01.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): show project/chat selection and busy ownership`.

<a id="m1-02"></a>

### M1-02 — Preserve state across layout and view changes

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/workspace.tsx`, `packages/app/src/pages/session/session-panel-layout.ts`, `packages/app/test-browser/ftc/desktop-workspace/m1-02.test.ts`.

**Interfaces:** Consumes M5 document facade contracts without starting M5. Produces chat/chat-editor layout controls and persistent selection/scroll/tab view state.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-02.test.ts`, add `layout switch retains dirty document and independent settings`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(after.projectID).toBe(before.projectID); expect(after.chatID).toBe(before.chatID); expect(after.document.dirty).toBe(true); expect(after.modes).toEqual(before.modes)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Mount/detach views without disposing document ownership or resetting conversation. Keep layout independent of AI/code/robot modes. Remove event subscriptions on unmount and preserve original layout behavior outside FTC.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-02.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): preserve state across layout and view changes`.

<a id="m1-03"></a>

### M1-03 — Present automatic and guided environment setup

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/setup.tsx`, `packages/app/src/ftc/facades.ts`, `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts`, `packages/app/test-browser/ftc/desktop-workspace/m1-03.test.ts`.

**Interfaces:** Consumes M4 readiness/setup contracts. Produces independent automatic/guided setup, recheck/retry and asset-preparation commands.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-03.test.ts`, add `startup setup reuses ready tools and exposes missing assets`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(reinstallCalls).toEqual([]); expect(missingAssets).toContain('model-fixture'); expect(failedStep.recoveryVisible).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Offer automatic/guided startup setup, present missing/incompatible tools and reuse detected readiness. Show license/OS permission/manual steps, actual build readiness and deliberate recovery. Render prepared-offline asset gaps. Use localized keys for all copy.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-03.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): present automatic and guided environment setup`.

<a id="m1-04"></a>

### M1-04 — Present provider and local-model setup

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/inference-settings.tsx`, `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts`, `packages/app/test-browser/ftc/desktop-workspace/m1-04.test.ts`.

**Interfaces:** Consumes M7 selection/catalog/credential-reference/runtime contracts. Produces provider selection, write-only credential entry, model download/start/stop and existing-service connection commands.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-04.test.ts`, add `model setup discloses resources and offline verification`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(resourceDisclosureVisible).toBe(true); expect(secretInListedSettings).toBeUndefined(); expect(unverifiedOfflineEnabled).toBe(false)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Show team-account cost/data-sharing information, visible online/offline choice, resource/license/disk requirements and managed/external runtime ownership. Present actual provider/tool-support failures and never silently switch modes.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-04.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): present provider and local-model setup`.

<a id="m1-05"></a>

### M1-05 — Present independent code and robot permission modes

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/mode-settings.tsx`, `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts`, `packages/app/test-browser/ftc/desktop-workspace/m1-05.test.ts`.

**Interfaces:** Consumes M3 CodeMode and M9 robot-mode contracts. Produces explicit independent setting changes; neither setting grants a particular robot approval.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-05.test.ts`, add `direct-work choice does not change robot permissions`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(codeMode).toBe('direct'); expect(robotMode).toBe('observation'); expect(deploymentApproved).toBe(false); expect(inferenceMode).toBe('offline')
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Provide separate plan-first/direct and observation/actions-with-approval controls. Explain their distinct scope, preserve other settings, and show plan review without encoding authorization in UI state.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-05.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): present independent code and robot permission modes`.

<a id="m1-06"></a>

### M1-06 — Render a Driver Station-style hardware form and chooser

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/hardware.tsx`, `packages/app/src/ftc/setup.tsx`, `packages/app/test-browser/ftc/desktop-workspace/m1-06.test.ts`.

**Interfaces:** Consumes M6 manifest/events/updateHardware and M11 comparison records. Produces revision-bearing shared configuration commands, never source/robot writes.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-06.test.ts`, add `form reflects chat update and preserves device name identifiers`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(renderedName).toBe('leftDrive'); expect(command.expectedRevision).toBe(displayedRevision); expect(robotConfigCalls).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Organize hubs, categories, numbered ports, types and names recognizably. Render conflicts, pending Java mappings and remaining Driver Station steps. Show Pedro/Road Runner/neither comparison and required tools without silently resolving imported conflicts.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-06.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): render a driver station-style hardware form and chooser`.

<a id="m1-07"></a>

### M1-07 — Display Java editor and actual diagnostic/build status

**Prerequisites:** [M1-02](desktop-workspace.md#m1-02), [M5-07](java-development.md#m5-07).

**Files:** `packages/app/src/ftc/workspace.tsx`, `packages/app/src/ftc/editor-panel.tsx`, `packages/app/test-browser/ftc/desktop-workspace/m1-07.test.ts`.

**Interfaces:** Consumes M5 editor view/document/LSP/build public contracts. Produces explicit save/build/definition commands and conflict resolution choices.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-07.test.ts`, add `failed language service never renders no errors`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(statusLabel).toBe(translations.languageServiceFailed); expect(buildBasis).toBe('saved-revision'); expect(saveConflictVisible).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-07.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Show Java editing/navigation/completion, dirty state, save/merge/defer conflicts and build output. Distinguish loading/unavailable/failed tooling from zero diagnostics and show when unsaved code was excluded or build evidence is outdated.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-07.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): display java editor and actual diagnostic/build status`.

<a id="m1-08"></a>

### M1-08 — Render diagnostics and exact robot operation controls

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/robot.tsx`, `packages/app/test-browser/ftc/desktop-workspace/m1-08.test.ts`.

**Interfaces:** Consumes M8 connection, M9 operation and M10 diagnostic contracts. Emits deliberate user events with exact operationID/context fingerprint; UI cannot manufacture backend approval.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-08.test.ts`, add `Deploy click identifies exact build target and project`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(command).toEqual(displayedOperationCommand); expect(unknownOutcomeLabel).toBe(translations.unknownOutcome); expect(autoStartCalls).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-08.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Show target/transport/authorization, stale/zero/missing data, available logs and build identity. Separate Deploy from initialize/start/tune, render busy/rejected/unknown results, and require a fresh deliberate action after context changes. Observe-only blocks agent controls in UI as well as backend.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-08.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): render diagnostics and exact robot operation controls`.

<a id="m1-09"></a>

### M1-09 — Host the isolated Panels view and external fallback

**Prerequisites:** [M9-07](robot-approvals-and-operations.md#m9-07), [M10-04](diagnostics-and-dashboard.md#m10-04).

**Files:** `packages/desktop/src/main/panels.ts`, `packages/desktop/src/main/panels-policy.ts`, `packages/desktop/src/main/ipc.ts`, `packages/desktop/src/preload/index.ts`, `packages/desktop/src/preload/types.ts`, `packages/desktop/src/main/ftc/m1-09.test.ts`.

**Interfaces:** Consumes validated M10 DashboardDescriptor and M9-mediated application controls. Produces narrow show/resize/hide/dispose dashboard IPC; no application bridge is loaded in dashboard content.

- [ ] **1. Write the focused test:** In `packages/desktop/src/main/ftc/m1-09.test.ts`, add `dashboard has no preload and unsupported writes are blocked`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(options.webPreferences.preload).toBeUndefined(); expect(options.webPreferences.nodeIntegration).toBe(false); expect(unmediatedWrites).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/desktop`, run `bun test ./src/main/ftc/m1-09.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use WebContentsView with context isolation/sandbox, constrained navigation/permissions/resources and evaluated control-write mediation. Test sizing/focus/lifecycle, assets/WebSockets and USB URLs in actual Electron; fall back externally when embedding fails while retaining backend telemetry.
- [ ] **4. Verify:** Re-run `bun test ./src/main/ftc/m1-09.test.ts` from `packages/desktop`; expected: PASS. Run `bun typecheck` in each changed package. Run Electron-dependent checks in the actual host as well; a plain Bun policy test does not establish OS/view behavior.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): host the isolated panels view and external fallback`.

<a id="m1-10"></a>

### M1-10 — Render lessons and personal progress

**Prerequisites:** [M1-01](desktop-workspace.md#m1-01).

**Files:** `packages/app/src/ftc/learning.tsx`, `packages/app/test-browser/ftc/desktop-workspace/m1-10.test.ts`.

**Interfaces:** Consumes M11 content and M12 entry/lesson/exercise/progress contracts. Produces entry/skip/request/attempt commands via normal application workflows.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-10.test.ts`, add `lesson view distinguishes reading from physical completion`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(buildOnlyLabel).not.toBe(translations.physicalComplete); expect(neitherPromptVisible).toBe(true); expect(progressAfterLanguageSwitch).toEqual(beforeProgress)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-10.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Show contextual help, entry levels, skippable lessons, project-linked exercises and both pathing tracks. Preserve identifiers and distinguish missing local content from no lessons; show outstanding explanation/application/robot evidence.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-10.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): render lessons and personal progress`.

<a id="m1-11"></a>

### M1-11 — Connect workspace facades to generated APIs

**Prerequisites:** [M1-03](desktop-workspace.md#m1-03), [M1-06](desktop-workspace.md#m1-06), [M1-07](desktop-workspace.md#m1-07), [M1-08](desktop-workspace.md#m1-08), [M1-10](desktop-workspace.md#m1-10), [M2-06](projects-and-chats.md#m2-06), [M4-06](environment-and-compatibility.md#m4-06), [M6-06](ftc-configuration-and-libraries.md#m6-06), [M7-07](ai-access-and-local-inference.md#m7-07), [M8-05](controller-connections.md#m8-05), [M10-05](diagnostics-and-dashboard.md#m10-05), [M12-06](learning-and-progress.md#m12-06), [M5-08](java-development.md#m5-08), [M9-08](robot-approvals-and-operations.md#m9-08), [M11-10](ftc-knowledge.md#m11-10), [M1-04](desktop-workspace.md#m1-04), [M1-05](desktop-workspace.md#m1-05).

**Files:** `packages/app/src/ftc/client.ts`, `packages/app/src/context/sdk.tsx`, `packages/app/src/pages/session.tsx`, `packages/app/package.json`, `packages/app/test-browser/ftc-integration/m1-11.test.ts`.

**Interfaces:** Produces production facade adapters over generated Client APIs and narrow window.api IPC, including the environment setup/readiness/run APIs supplied by M4-06. Backend task owners supply and register their API groups; this task owns the frontend bindings. Browser runtime never imports Core/Server implementations.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc-integration/m1-11.test.ts`, add `actual APIs propagate domain revisions and errors to UI`. Exercise the real workspace/client adapter against an isolated composed test backend with controlled external ports; core assertions:

```ts
expect(uiManifestRevision).toBe(serverRevision); expect(failedOperationLabel).toBe(expectedLocalizedError); expect(uiSetupReadiness).toEqual(apiSetupReadiness); expect(coreRuntimeImports).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc-integration/m1-11.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Wire FTC views into the existing workspace and reconcile the app's current vendored Client consumption with generated APIs deliberately. Consume the registered APIs/events from prerequisite backend tasks, including M4-06; regenerate Client if contracts change rather than hand-editing generated files. Verify two projects end-to-end with controlled external ports, including setup/readiness updates. Test-owned backend resources are started and disposed by the integration harness.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc-integration/m1-11.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. This composed suite stays outside `test-browser/ftc/desktop-workspace`; run the isolated suite separately and confirm it starts no backend.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): connect workspace facades to generated apis`.

<a id="m1-12"></a>

### M1-12 — Check module boundaries and fresh-scope cleanup

**Prerequisites:** [M1-11](desktop-workspace.md#m1-11), [M3-06](agent-and-context.md#m3-06), [M4-06](environment-and-compatibility.md#m4-06).

**Files:** `packages/core/test/ftc-boundaries.test.ts`, `packages/core/test/ftc-integration/composition.test.ts`, `packages/app/test-browser/ftc/workspace/lifecycle.test.ts`, `packages/core/test/ftc-integration/m1-12.test.ts`.

**Interfaces:** Produces module-boundary and production-lifetime checks across M1–M12; module-only suites remain independently runnable.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m1-12.test.ts`, add `module implementation imports no sibling store or bootstrap`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(forbiddenEdges).toEqual([]); expect(leakedHandles).toEqual([]); expect(globalCoordinatorCount).toBe(1)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m1-12.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Check sibling implementation imports, private table/store access, Core/Server browser imports and bootstrap imports. Construct/dispose each real module twice with fresh scopes; run port contracts against production and controlled adapters. Verify M2/M3, M4/M5, M6/M3/M5, M8/M9/M10 and M12 composition tests separately.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m1-12.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): check module boundaries and fresh-scope cleanup`.

<a id="m1-13"></a>

### M1-13 — Audit complete bilingual UI and independent settings

**Prerequisites:** [M1-11](desktop-workspace.md#m1-11), [M11-10](ftc-knowledge.md#m11-10).

**Files:** `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts`, `packages/app/src/i18n/desktop-native.ts`, `docs/validation/localization.md`, `packages/core/test/ftc-evaluation/m1-13.test.ts`.

**Interfaces:** Produces English/Simplified Chinese coverage and contextual localization evidence; all UI uses language.t/plural or nativeT.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m1-13.test.ts` for the automated portion of “switching languages preserves state identifiers and permissions”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Review setup, workspace, devices, errors, chooser, lessons and AI explanations in both languages. Verify placeholders, code/API/device names and all independent choices; audit exact-English leftovers and terminology with the package-required corpora. Record benchmark comparison for touched session/timeline code and actual screenshots/manual observations.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m1-13.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

<a id="m1-14"></a>

### M1-14 — Verify packaged workspace and release acceptance

**Prerequisites:** [M1-09](desktop-workspace.md#m1-09), [M1-12](desktop-workspace.md#m1-12), [M1-13](desktop-workspace.md#m1-13), [M3-07](agent-and-context.md#m3-07), [M4-07](environment-and-compatibility.md#m4-07), [M7-08](ai-access-and-local-inference.md#m7-08), [M9-09](robot-approvals-and-operations.md#m9-09), [M10-06](diagnostics-and-dashboard.md#m10-06), [M12-07](learning-and-progress.md#m12-07).

**Files:** `packages/desktop/electron-builder.config.ts`, `docs/validation/release.md`, `docs/compatibility-matrix.md`, `packages/core/test/ftc-evaluation/m1-14.test.ts`.

**Interfaces:** Produces packaged macOS/Windows acceptance evidence and the final compatibility matrix, with every AC-01–AC-13 linked to its responsible module's evidence.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m1-14.test.ts` for the automated portion of “all first-version acceptance scenarios have passing evidence”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Build/package using existing desktop scripts on the target OS, validate local editor/content/runtime assets and their licenses, then execute the proposal's complete acceptance matrix. Test actual Panels focus/resize/isolation or record its validated fallback. Keep not-run/failed platform or robot rows open; stages and unit tests cannot mark the first release complete.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m1-14.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 14 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/app`: `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
