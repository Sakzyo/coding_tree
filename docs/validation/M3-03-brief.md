# M3-03 dispatch brief

Prepared, not dispatched. Coordinator assigns base and owner at dispatch. Read the exact task excerpt first.



Parallel write scope is explicit. Do not stage, commit, edit checklists/progress, or spawn subagents. Coordinator owns Git, root barrels, generated artifacts and ledger. Read AGENTS.md and Schema AGENTS.md when applicable. Use Superpowers TDD and verification-before-completion. Test real implementation via controlled external ports/real temporary files, no globals/mocks of subject. Run package-local tests and bun typecheck, scoped lint/format. Use pinned Bun PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH and task-owned OPENCODE_TEST_HOME/XDG roots. Preserve prior passing evidence, do not rerun unrelated broad suites. Keep foreign lane errors separate; no foreign edits. Logs/report need commands, cwd, exit, counts, RED/GREEN, assertion map, SHA256 of final source, fixture/real distinction and unrun gates. Product production/platform enablement is not credited by isolated tests. Freeze candidate when reported; any later edit requires refreshed checks/hashes.

Report: docs/validation/M3-03-implementation.md; logs docs/validation/m3-03/.


## Module context

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


## Binding global constraints


- Preserve the twelve-module design inside the existing Electron/Solid/OpenCode application. Do not add twelve packages, a new daemon, a universal service registry or a second agent loop.
- Java/FTC SDK, macOS and Windows, English and Simplified Chinese remain first-version scope. No Blocks, robot hardware-configuration synchronization, app-operated AI billing service or extra student-profile system.
- Canonical Schema contracts contain serializable values, not runtime services. Keep Schema → Core/Protocol → Server dependencies; Client runtime can depend on Schema/Protocol but never Core/Server. `sdk-next` composes Client/Core/Server. Import namespaces through their existing self-export pattern; do not alias/star-import new code.
- Each module consumes narrow ports/immutable records and owns its tables/files/maps. No sibling implementation imports, private-store access or bootstrap imports. Importing a module starts no I/O; scope construction/disposal owns processes and subscriptions.
- Reuse Effect layers in Core. Services stay Location-scoped except the explicitly process-global Session execution/project/controller coordinators. Tests create independent instances without resetting globals.
- Preserve Session durable admission before wake, exact retry/conflicting-ID behavior, steer/queue promotion, one stream per provider turn, current-history reload and separate Context Epoch ownership. No automatic provider-work replay after crash.
- Preserve existing project files, SDKs, dependencies and unsaved edits. Canonical project roots identify execution ownership; a copied manifest does not copy chats or controller identity. At most one active chat per project, while separate projects may run concurrently; drafts never auto-execute.
- Keep setup choice, layout, inference mode, code mode, robot mode and language independent. Plan/direct code permission never grants deployment, start or tuning.
- Project `ftc-project.json` stores shared hardware definitions and exclusive managed pathing choice only. Personal progress/chats/credentials/approvals/telemetry/machine paths remain local and outside it.
- PedroPathing, Road Runner or neither: at most one managed pathing library. Retain version-required Road Runner FTC Dashboard/tuning tools. Ask before resolving imported conflicts; do not silently remove team code.
- M5 builds identify saved source/configuration revisions and APK digest. Dirty or changed inputs cannot be passed off as a current successful build. M9 refreshes target/generation/state/artifact at execution time.
- M9 is the only app-issued robot mutation authority. Deliberate Deploy authorizes that exact deployment without redundant confirmation; it never authorizes a start. Agent observation mode blocks initialization/start/tuning. No command/build/extension/dashboard bypass; no replay after reconnect or restart.
- Disconnection does not prove a robot stopped. Keep confirmed success, failure, cancelled and unknown outcomes distinct. Preserve missing/stale/disconnected/valid-zero diagnostics and verified versus unknown deployed-build association.
- Offline inference is verified local-only, with no remote redirects/cloud proxy/fallback. Prepared offline use may still connect to the robot's local network. Missing cached models/tools/dependencies/content remain visible.
- Protect credentials with the OS facility and expose references only. Dashboard pages have no privileged preload bridge; repository instructions, dashboard text, logs and references are not approval authority.
- Monaco/JDT LS, llama.cpp, SQLite/JSON and exact versions are design recommendations pending their named evaluations. Pin tested versions and resource/platform support using evidence; do not select arbitrary latest releases or invent hardware minima.
- All UI/native copy uses existing typed i18n. Preserve English source wording when touching existing keys, placeholders and code/API/device names. Follow package terminology/source-review instructions for translations; stable domain errors/lesson IDs are language-independent.
- If Protocol or Server HttpApi changes, run `bun run generate` from `packages/client`; never hand-edit `src/generated` or `src/generated-effect`. If legacy JS SDK surfaces change, regenerate with `./packages/sdk/js/script/build.ts`.
- Run tests and `bun typecheck` from package directories, never repository root or raw `tsc`. Follow touched package instructions, including session/timeline benchmark baselines and no restarting the user's app/server.
- Keep scoped changes; no unrelated cleanup. Use short branch names without slashes (at most three hyphen-separated words) and conventional commit messages. The default comparison branch is `dev`/`origin/dev`.


## Exact task excerpt

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


## Reviewed Java producer boundary

M5-02 now defines canonical FtcJava.Revision (documentID/bufferRevision/diskRevision), EditProposal (projectID/edits/explanation) and EditResult. Its applyEdits consumes an opaque runtime authorization checked through trusted CodeChanges.check against the full immutable proposal/project/root/paths. No proposal-ID registry or JSON bearer approval exists. M3 owns plan identity and approvals. Existing opened-file edits only; template/new-file creation needs a future producer-owned extension before M6-04. Preserve independent robot permissions.
