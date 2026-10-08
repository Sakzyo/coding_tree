# M2-06 I2 activation fence implementation brief — 2026-10-08

Status: PREPARED ONLY. Dispatch only after M3-04 product writer is frozen/committed; one product writer at a time. Root fills actual source base at dispatch. This completes the open Important I2 from M2-06 review; I1 lost-wake is already fixed/reviewed and is not redispatched.

Read first: AGENTS.md, package/test/HTTP instructions, docs/prompt.md, M2 module/requirements/high-level contracts, M2-06 original brief/report/review, M2-06-activation-preflight.md and M2-06-activation-resume-preflight.md. The resumed preflight is a concrete current-source supplemental acceptance map, not passing evidence.

## Scope and implementation decisions

Adopt the recommended legacy-domain process-local root activity owner in `packages/opencode/src/session/legacy-activity.ts`, independently constructible scoped factories plus a narrowly shared live binding. Existing legacy execution engines remain owners of work; no new loop, daemon, universal registry or durable claims. The approved architecture is current-process. Do not claim OS-wide/external-process ownership, arbitrary escaped child containment or M9 robot isolation. Unknown/uncovered independently hosted deployment retains activation_unavailable.

M2 consumes a scoped association commit-through port. Replace the current precheck FolderIdentity activation adapter with a same-domain Repository/Lookup decorator around actual associate(folder), holding root exclusion throughout durable commit. Keep existing FtcProjects public facade signatures, canonical filesystem/root producer, Session access ownership and association tables. Existing association reopen/reconcile remains available. Canonicalize via M2 public adapter, never treat metadata strings/caller booleans as root authority. Recheck unmanaged association while holding root exclusion immediately before accepting exact volatile work claims.

Use existing stable `activation_unavailable` for unresolved or occupied activation (safe structured detail optional); do not add activation_busy/public Protocol schema/client changes merely for a UI distinction. Existing managed legacy work still refuses `legacy_execution_disabled`. FTC provider/tool/robot execution remains disabled pending M9-07/08. Read/history operations stay available, and no history conversion or provider-work replay is introduced.

Opaque exact runtime claims retain foreground, queued, detached, background/promotion and asynchronous terminal cleanup until the actual owner finishes. Publish/retain claims before acceptance or fork, including HTTP prompt_async before 204, Task reused-child root resolution, result notification/injection and onPromote outside job scope. A joiner's cancellation cannot relinquish runner ownership; status Idle/completed is not actual cleanup. Stale exact releases cannot clear newer ownership. Parallel job finalizers must not release before other cleanup. Generic Runner/BackgroundJob may gain minimal optional runtime ownership hooks, never FTC imports in those engines or wire Info tokens.

Use existing shared Core memo infrastructure to share only the narrow legacy owner across AppRuntime/webHandler/fresh listener memo graphs, with requesting graph Scope and exact last-owner cleanup. No import-time database/service/process construction, no broad memo-map replacement or app-wide cache reset. Distinct explicit test factories stay isolated.

Command shell-template expansion's Process.text cancellation must retain ownership until actual process/output cleanup. Prefer already supplied scoped ChildProcessSpawner; no unrelated Process utility cleanup/refactor. Work only with controlled harmless test processes in task-owned temporary roots, never start user app/server/provider/robot.

## Assigned write paths

All required product paths in the resumed preflight's Exact path assignment table are assigned to this one writer: legacy-activity.ts, legacy prompt/run-state/Runner/processor/compaction/TaskTool/background wrapper, generic Core background-job.ts, Core M2 project adapters/composition, Server routes, OpenCode actual HTTP host/session handlers; focused test paths from that table. Conditional app-runtime.ts/server.ts only if actual binding cannot use existing node dependencies; explain evidence first. No changes to Schema contracts, SQL/migrations, V2 Session coordinator, context, root barrels, UI, PTY, permission policy or OS isolation.

Evidence only: docs/validation/M2-06-activation-implementation.md and docs/validation/m2-06-activation/*.
Root alone owns Git/index/commits, shared ledger/checklists, generated artifacts, and any required public API generation. No subagents/reviewer. Report source SHA256 manifest and stable tested candidate; do not mark task complete. Preserve all coordinator/other-worker files.

## Required verification

Follow all eight deterministic RED/GREEN categories in the resumed preflight: atomic real association and aliases/failed-cancelled writes; every legacy entrance before mutation; real Runner/queue/join/cancel terminal ownership; detached title/summary/prune/notifications/injection; BackgroundJob accepted extensions/promotion/parallel scope cleanup/repeated generation; actual command subprocess cleanup; same owner across actual host graphs and isolated factories; existing association/read/history/disabled-host/standalone/SDK compatibility.

Tests must call actual implementation and public narrow ports, not duplicate admission/lifetime decisions. First meaningful behavior RED, then minimal GREEN. Read Superpowers TDD/systematic-debugging. Package-local focused tests, affected Runner/Session/Background/TaskTool/compaction/M2 composition suites and all touched package `bun typecheck`; scoped lint/format/diff checks. Canonical consumer/type/API signatures must remain aligned; regenerate Client only if Protocol/HttpApi actually changes and coordinate that with root. Refresh scoped ownership-performance baseline before changes and compare frozen revision; historical renderer evidence is not a new ownership benchmark.

Pinned Bun path: `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64`. Dependencies installed. Isolate OPENCODE_TEST_HOME and XDG_* under `/private/tmp/m2-06-activation-home`; never HOME/CODEX_HOME. Root current baseline logs (before affected source edits) are `docs/validation/resume-2026-10-08/legacy-ownership-baseline.log` (36 pass/95 assertions) and `core-background-baseline.log` (4 pass/404 assertions). These are baseline-only, not new acceptance. Run owned commands and record real exit codes.

Report tested revision/hashes, each task assertion, commands/cwd/counts, behavioral RED/GREEN, actual-host vs controlled fixtures, known unrelated baseline failures and every unrun platform/physical/production gate. Status DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Any missing required software contract is explicit and keeps task unchecked; independently unavailable platform/action-isolation gates never become fixture acceptance.

## Original exact M2-06 task excerpt

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
