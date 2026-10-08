# M2-06 I2 activation fence — candidate frozen for independent review

2026-10-08. Current status: DONE_WITH_CONCERNS (fix round 1 candidate frozen on base `4a8005983782eac8220dc7243167356f79636626`; independent re-review and coordinator acceptance pending). Explicit start received on product source `5b8618d0f`; coordinator docs-only commit `4122d5d54` follows it. This lane is the sole product writer. The following preparation baseline is retained as historical evidence. This report does not close I2 or mark M2-06 complete. Product baseline supplied by coordinator: `11b3fe90e` plus separate in-flight M3 work, which this lane does not inspect. Exact affected source hashes are in `m2-06-activation/baseline-source-sha256.txt`.

## Scope and decisions

Read the activation brief, both preflights, original M2 brief/report/review, repository/package/test/HTTP guidance, M2 contracts and prompt execution rules. Apply required TDD and systematic debugging. Preserve existing managed `legacy_execution_disabled`, unavailable unknown coverage, disabled FTC execution pending M9, real canonical filesystem identity, Session-owned access, read/history and existing association reopen/reconcile.

The planned owner is a pure scoped LegacyActivity factory with root-local exclusion and exact opaque runtime claims. Its live layer builds only that owner through the existing Core memo map under the requesting graph Scope; fresh factories remain isolated. M2 canonicalizes and checks association; the repository decorator holds exclusion through the actual `associate(folder)` commit. Neither Session status nor BackgroundJob completion is proof of cleanup.

Runner and BackgroundJob receive optional runtime ownership seams. Accepted runners/queues and jobs/extensions own claims independently of waiting callers. Terminal release follows actual work-scope closure, including asynchronous and parallel cleanup. Detached producer registration acquires/retains before fork. Task preparation covers parent and resolved stored child roots independently, including promotion and notification/injection. Command shell templates use the existing scoped ChildProcessSpawner and await owned process/output cleanup.

Coordinator conditionally authorized one minimal additional composition path: `packages/opencode/src/tool/registry.ts` import + LegacyActivity node dependency, if TaskTool's added service requirement demands it. ToolRegistry initializes TaskTool. Only the demonstrated import/node dependency is authorized; no tool permission/runtime policy redesign. This was the historical preparation decision; the subsequent explicit start and both activated composition paths are recorded below.

## Fresh baseline

Executed [baseline.py](m2-06-activation/baseline.py); exact commands, package cwd, wall time and exits are in [baseline-commands.json](m2-06-activation/baseline-commands.json). Pinned Bun 1.3.14 on darwin arm64. OPENCODE_TEST_HOME and XDG data/config/cache/state isolated under `/private/tmp/m2-06-activation-home`; existing OpenCode preload substitutes its own PID-owned temporary roots and clears provider credentials. Model fetch and default plugins disabled. No user app/server, remote provider or robot started.

- OpenCode `bun test ./test/effect/runner.test.ts ./test/background/job.test.ts`: exit 0, 36 pass, 95 assertions; [log](m2-06-activation/baseline-legacy.log).
- Core `bun test ./test/background-job.test.ts`: exit 0, 4 pass, 404 assertions; [log](m2-06-activation/baseline-background.log).
- Core cwd, pinned Bun `../../docs/validation/m2-06-activation/benchmark.ts`: exit 0. Two warmups and ten alternating samples of 1000 actual Runner cycles / 1000 actual BackgroundJob cycles, including final owner-scope close. Median 9.512 ms / 42.206 ms; [samples](m2-06-activation/performance-baseline.json). This is the pre-change local engine overhead baseline, not provider, UI, robot or production performance. Final comparison must retain the same script and additionally measure real claims. An initial command used the wrong cwd for script creation and exited 1 without creating the script; corrected command then ran successfully.

## Historical preparation test plan

Use Deferred barriers and real implementation/public ports, with scoped temporary files/SQLite and controlled harmless process fixtures. At preparation time these were pending; the implementation evidence below supersedes that status.

1. Association decorator plus actual repository: legacy-first and commit-first order; symlink aliases, independent root, duplicate open/create; failed/cancelled durable write unlock/reconcile. First meaningful RED changes actual OpenCode new-root activation expectation from unavailable to successful idle association.
2. Entrance mutation refusal: actual prompt/noReply, direct loop/shell/command, HTTP init, summarize and direct compaction; pre-fork HTTP prompt_async accepted registration still excludes activation.
3. Runner terminal ownership: cancel one joiner, pending ShellThenRun and cancelled waiting caller, queue drop, handoff, old terminal callback while replacement run is live, idle publication with asynchronous cleanup paused, scope shutdown.
4. Detached title/summary/prune and Task notification/injection: pause after foreground ends, assert association refusal until exact finalizers finish; stored reused-child directory differs from parent and managed child refuses before mutation.
5. BackgroundJob: duplicate start, rejected extension, accepted waiting extension, failure, promotion escaped callback, completed/done before scope close, parallel finalizers, shutdown and repeated-ID generations. Claims never enter Info/metadata.
6. Command subprocess: controlled marker/pid and output drain, interrupt caller, assert no association until real process/output cleanup completes. No arbitrary detached OS-child containment claim.
7. Actual AppRuntime/webHandler/fresh-listener graph owner identity and exclusion without binding a user socket; one graph disposal leaves another borrower intact; last graph close/reopen with paused cleanup; independently constructed factories do not share.
8. Compatibility: existing association/read/history, failed canonical roots and unknown coverage, standalone/SDK association, disabled raw/facade FTC execution; no replay/interruption/migration.

After focused RED/GREEN, run affected Runner/Session/Background/TaskTool/compaction/M2 composition and host regressions, package-local types for touched packages, scoped lint/format and exact source hashes. Root owns any generated API output, Git/index/commits, ledger and independent review. Unavailable Windows, packaging, production/provider, M9 and physical robot gates stay separate and unrun.


## Frozen implementation and scope

The source base was `5b8618d0f`; coordinator-only documentation commits do not change that product baseline. The candidate is the working tree identified by [final-source-sha256.txt](m2-06-activation/final-source-sha256.txt), exactly 22 product/test paths listed in [source-files.txt](m2-06-activation/source-files.txt). The worker made no Git/index/commit, ledger, Schema/Protocol, generated Client, SQL, V2 coordinator, context-producer, UI, permission-policy or OS-isolation changes. The legacy BackgroundJob wrapper needed no edit: the production TaskTool producer supplies the generic hooks. Root owns diff reconciliation, independent review, commit and checklist acceptance.

The new LegacyActivity owner uses exact volatile claims, root-local exclusion and pending-operation accounting. M2's canonical adapter remains authoritative for filesystem identity; admission resolves the stored Session directory and performs a live unmanaged check under the root lock. The association repository decorator privately captures canonical root plus Location and holds the lock across the actual durable repository effect. Existing associations still reopen/reconcile through the repository. Failed/cancelled writes release exclusion. An owner closing waits for outstanding claims and in-flight association commits; status publication never releases work ownership.

Runner accepts an optional runtime release hook into a dedicated work scope, including queued ShellThenRun ownership independent of the calling waiter. BackgroundJob accepts optional runtime ownership/retain hooks into an outer sequential lifetime scope: inner parallel work cleanup finishes before release. Extensions retain only when accepted; promotion retains while its callback executes outside the job scope. Neither generic engine imports FTC policy, and tokens never enter Info or durable metadata. Prompt/loop/shell/command/compaction, title/summary/prune forks, HTTP async acceptance, and TaskTool parent/stored reused-child/notification/injection paths capture ownership before mutation or accepted detached work. Entry routing snapshots bind mutable internal caller envelopes to the Session admitted before a suspended guard. HTTP summarize and prompt_async also capture their Session scalar before waits.

Command shell-template expansion now uses the already supplied scoped ChildProcessSpawner and consumes process output/exit before scope release. A harmless signal-trap fixture proves cancellation cannot permit association while process cleanup is paused, then verifies the process PID no longer exists. This establishes the owned subprocess path, not containment of arbitrary escaped OS descendants.

Two conditional composition changes were explicitly approved: ToolRegistry imports/adds LegacyActivity because TaskTool initialization consumes that service; top-level AppRuntime imports/adds the same node because downstream-node dependencies alone did not export LegacyActivity for actual host borrowing. Existing Core memo infrastructure remains unchanged. A demonstrated Effect memo-map eviction-before-finalization race required the additionally approved lazy generation semaphore inside only LegacyActivity's live binding. It prevents a newly built graph from creating a second authority before the previous generation's exact claims/commits finish. Cancelled generation waiters do not acquire/release a permit. The semaphore initializes only when building the live layer; pure factories remain independent. This adds one permit per live generation and can make host reopening wait for real old cleanup, which is the required safe behavior.

## Behavioral RED and GREEN evidence

The following are genuine behavioral failures, preserved separately from harness/type debugging:

| Regression | RED observation | GREEN evidence |
| --- | --- | --- |
| Idle actual host activation and accepted Runner claim | Expected HTTP 200, got 409; expected held claim 1, got 0 | `red-entrance-runner.log`; final OpenCode suite and host rerun |
| Background lifetime after completed publication | Expected retained ownership 1, got 0 | `red-background.log`; `background-exact-final.log` and final Core suite |
| Promotion cancellation | Callback failed to observe cancellation within deterministic timeout | `red-promotion-cancel.log`; final Core promotion test verifies callback cancellation and zero retained claims after closure |
| Mutable prompt routing | Mutating suspended caller input wrote a message into managed Session B instead of captured Session A | `red-routing.log`; final OpenCode routing test verifies B remains empty and A receives the message |
| Last-owner disposal/reopen | Successor layer built while old claims were still held | `red-reopen.log`; owner tests plus `actual-host-generation-freeze.log` |
| Cancelled successor waiter | Waiting layer acquisition could not be interrupted | `red-generation-cancel.log`; cancelled waiter, subsequent successor and later reopening tests |
| Owner close during actual association commit | Owner close completed while the commit barrier remained blocked | `red-retiring-commit.log`; final owner shutdown/commit test |

Not every individual fixture was independently RED before implementation. The first meaningful behavior RED preceded product changes; subsequent discovered lifetime/routing failures received their own RED/GREEN. Initial type/harness failures are debugging evidence, not passing checks or fabricated behavior RED. In particular, the first async HTTP plugin fixture stalled waiting for normal dependency installation; the corrected test seeds a task-local node_modules marker and package-lock so the actual host's dependency check stays local. It then pauses the actual chat.message hook and proves prompt_async returns 204 only after registering ownership, blocks activation while admission is paused, and allows activation after noReply completion.

## Acceptance coverage

1. **Atomic association:** real temporary filesystem/SQLite tests cover symlink aliases, legacy-first refusal, commit-first waiting admission, unrelated-root progress, duplicate open/create reconciliation, failed/cancelled writes, exact stale release and immutable canonical root/Location binding. Owner shutdown waits for an in-flight durable commit. Existing M2 tests retain canonical failure and unknown-coverage refusal.
2. **Legacy entrances:** actual OpenCode HTTP routes refuse managed message, prompt_async, command, shell, summarize and init before history mutation. Direct domain prompt/noReply, loop, shell, command, compaction create/process are refused. Managed read/history remains available. The suspended mutable-input regression verifies the actual prompt producer's captured Session identity.
3. **Runner:** real Runner tests cover joiner cancellation, queued waiter cancellation, shell-to-run handoff, explicit cancellation/drop, delayed finalizers while state is Idle, replacement generations and scope shutdown. New ownership assertions complement existing state-machine regressions rather than replacing them with a duplicate model.
4. **Detached work:** actual prompt producer call sites for title, summary and prune are held with Deferred-backed narrow LLM/processor/summary/compaction fixture ports after foreground completion. Association remains unavailable until their work finishes. TaskTool tests hold real notification/result-injection paths after job completion and reject a stored reused child whose root differs from the parent and is already managed, before metadata/prompt mutation. These are controlled producer-port tests, not remote provider execution.
5. **BackgroundJob:** actual engine tests cover duplicate start/rejected extension (no new claim), accepted queued extension, promotion outside job lifetime, promotion cancellation, completed/error publication before parallel cleanup, parent-scope shutdown and repeated job IDs with old cleanup still pending. Explicit final assertions require zero retained claims; old cleanup cannot release the replacement's claim. Info has no ownership field.
6. **Command process:** actual scoped spawner/shell fixture, signal-triggered cleanup barrier, association refusal during cancellation and PID-exit verification pass. Existing configured-shell behavior remains passing.
7. **Actual host binding:** AppRuntime, lazy webHandler and separately constructed listener-route memo graphs share one authority. Closing one borrower leaves another protected. A separate process script builds actual AppLayer graphs and gates last-close/reopen on the exact old claim, cancels one waiting graph, admits a successor only after old cleanup, and closes/reopens normally. Pure factory isolation is separately tested. No user listener/socket is launched by these graph tests.
8. **Compatibility:** Core M2 composition/boundaries, standalone/embedded Server host, generated SDK Client and OpenCode host tests pass. Raw and facade FTC execution remain disabled pending M9; read/history and association reopen remain available. Public Protocol/HttpApi shapes did not change, so Client regeneration is not required.

## Initial candidate executed verification

All commands use pinned Bun 1.3.14. [commands.jsonl](m2-06-activation/commands.jsonl) records exact command arrays, package cwd, exits and elapsed time; [check.py](m2-06-activation/check.py) records environment construction. The table records final relevant runs, not the sum of every repeated debugging run.

| Package / check | Result | Evidence |
| --- | --- | --- |
| OpenCode Runner, legacy BackgroundJob, LegacyActivity, FTC HTTP, prompt, compaction, processor-effect, TaskTool | 206 pass, 2 existing projector-disabled skips, 0 fail, 716 assertions | `regression-opencode-final.log` |
| Core M2 integration, project/chat suites, BackgroundJob | 100 pass, 0 fail, 802 assertions | `regression-core-final.log` |
| Server actual standalone/embedded FTC host | 1 pass, 0 fail, 16 assertions | `regression-server-final.log` |
| SDK generated Client through embedded FTC host | 1 pass, 0 fail, 3 assertions | `regression-sdk-final.log` |
| HTTP handler scalar capture follow-up | 3 pass, 0 fail, 32 assertions | `host-routing-freeze.log` |
| Actual AppLayer last-close/cancel/reopen | PASS | `actual-host-generation-freeze.log` |
| Package-local `bun typecheck` | OpenCode, Core, Server and sdk-next exit 0 | `types-opencode-routing-freeze.log`, `types-core-freeze.log`, `types-server-freeze.log`, `types-sdk-final.log` |
| Scoped oxlint | exit 0, 31 inherited warnings, 0 errors; coordinator baseline comparison found no new diagnostics | `lint-freeze-restored.log` |
| Scoped Prettier check | exit 0, all 22 source/test files formatted | `format-freeze-restored.log` |

The initial sandboxed broad Session run encountered loopback fixture EADDRINUSE failures; it is retained as `regression-session-first.log`, not counted as passing. The required available suites were rerun with approved access to their controlled local HTTP fixtures and passed. No live user server, remote provider, robot or production execution was used. The two retained prompt/compaction skips are the existing disabled V2-projector tests, not newly skipped activation behavior. Source manifest creation follows the final scoped lint/format checks; final source hashes identify the reviewable candidate even though the worker cannot commit.

## Local performance comparison

Historical pre-change samples remain unchanged. The exact original benchmark was rerun after implementation with the same two warmups, ten alternating samples and 1000 actual engine cycles per sample, including final scope close. [performance-final.log](m2-06-activation/performance-final.log) contains every sample and runtime environment. Pre-change Runner/BackgroundJob medians were 9.512/42.206 ms; final without an ownership hook were 7.471/24.945 ms. These short local samples do not establish a production speedup; scheduling/JIT/environment noise limits comparison.

The additional [benchmark-owned.ts](m2-06-activation/benchmark-owned.ts) uses real LegacyActivity acquire/release for Runner admission and exact retained claims for BackgroundJob acceptance. [performance-owned-final.log](m2-06-activation/performance-owned-final.log) records every sample: median 11.781 ms per 1000 Runner cycles and 31.542 ms per 1000 job cycles. Relative to the same candidate without hooks, these fixtures add approximately 4.310/6.597 microseconds per cycle. The verification port succeeds synchronously: this isolates current-process ownership bookkeeping and excludes filesystem canonicalization, SQLite lookup, provider, subprocess, UI and robot cost. No fixed production latency budget or platform performance acceptance is claimed.

## Remaining gates and handoff

No known required software contract remains unimplemented in this candidate. Independent review, scoped Git diff/whitespace reconciliation, commit and ledger acceptance remain with root. Root compared the original `5b8618d0f` diagnostics and confirmed all 31 lint warnings are inherited; see `lint-baseline*` evidence. The pre-existing unused Layer import in TaskTool tests was restored after scope review, without an artificial use or unrelated cleanup. Windows behavior, packaged desktop/release validation, real production/provider performance and M9 host/action/physical-robot isolation remain NOT RUN / outside this bounded current-process task. Separate processes or arbitrary escaped OS children are not covered by these volatile claims. Unknown/uncovered host deployments continue failing closed. This report is candidate evidence and does not itself mark M2-06 or a whole module complete.


## Review fix round 1 — owner-scope shell teardown

The independent review found an Important violation in candidate `4a8005983782eac8220dc7243167356f79636626`: the shell's accepted release scope was attached to the Runner owner while shell execution was a child of the calling fiber. SessionRunState registers cancellation before accepting work, so LIFO owner disposal released the newer claim before invoking the earlier cancellation finalizer and waiting for shell cleanup. The initial candidate's software-complete claim above is superseded by this review finding and repair; I2 remains coordinator-owned pending re-review.

**Amended product/test paths:** only `packages/opencode/src/effect/runner.ts` and `packages/opencode/test/effect/runner.test.ts`. No scope/interface expansion or other product edits. The report/evidence and SHA manifests are refreshed in the assigned validation directory.

**Meaningful RED:** before changing Runner, added `owner disposal holds shell ownership until shell cleanup finishes`. It creates the actual owner Scope, registers real `runner.cancel` first exactly as SessionRunState does, starts the real shell, and holds interruption cleanup behind a Deferred. Running from `packages/opencode` with pinned Bun `test ./test/effect/runner.test.ts -t 'owner disposal holds shell ownership'` exited 1: disposal remained pending but expected held ownership 1 was actually 0. The exact failure is preserved in `fix1-red-shell-disposal.log` (0 pass, 1 fail, 2 assertions). Cleanup barriers release even on assertion failure.

**Smallest repaired boundary:** both Runner execution branches use one local `ownedWork` helper. The accepted lifetime still owns the release finalizer. It first adds a child resource scope, then attaches an actual work fiber to the accepted lifetime and waits for that fiber's full exit, including automatic child cleanup. Owner disposal therefore interrupts/joins work before closing its resources and finally releasing the exact claim, without depending on sibling owner-finalizer ordering. The existing outer shell fiber remains a caller child, preserving caller-cancellation semantics; its cancellation interrupts and joins the inner worker. The worker's actual exit is propagated so interruption cleanup defects are not mistaken for plain cancellation. Immediate worker start preserves the existing accepted-work scheduling behavior. The same boundary protects the normal run branch and works with a parallel parent owner scope. No FTC policy entered Runner.

Five new deterministic cases cover the reproduced shell owner-disposal order, parallel parent disposal of a normal run, shell caller cancellation, and normal run/shell completion while an automatic child is still cleaning up. The latter cases assert exact order `child`, `resource`, `release`, retained ownership while blocked, and zero ownership after completion. Existing queued/handoff/joiner/replacement/cancel/compound-defect tests remain passing. Two initial repair attempts exposed additional scheduling and exit-propagation regressions; `fix1-green-runner-first.log`, `fix1-green-runner-second.log` and `fix1-debug-*` are retained debugging failures, not passing evidence. The corrected focused suite passed in `fix1-green-runner-third.log`, followed by all added lifetime cases in `fix1-green-lifetimes.log`.

### Final repaired candidate checks

Exact commands, cwd, environment wrapper, timing and exits are appended to `m2-06-activation/commands.jsonl`; all following checks exited 0.

| Package / command | Result | Evidence |
| --- | --- | --- |
| `packages/opencode`: pinned Bun `test ./test/effect/runner.test.ts ./test/background/job.test.ts ./test/session/legacy-activity.test.ts ./test/server/httpapi-ftc-project.test.ts ./test/session/prompt.test.ts ./test/session/compaction.test.ts ./test/session/processor-effect.test.ts ./test/tool/task.test.ts` | 211 pass, 2 unchanged projector-disabled skips, 0 fail, 738 assertions; 38.58 s | `fix1-regression-opencode.log` |
| `packages/core`: pinned Bun `test ./test/ftc-integration/m2-06.test.ts` | 13 pass, 0 fail, 75 assertions | `fix1-m2-composition.log` |
| `packages/opencode`: pinned Bun `../../docs/validation/m2-06-activation/actual-host-generation.ts` | PASS actual AppLayer last-close/cancelled waiter/exact release/reopen | `fix1-actual-host-generation.log` |
| `packages/opencode`: pinned Bun `typecheck` | exit 0 | `fix1-types.log` |
| Root local `oxlint` over the explicit 22-path source list | 31 inherited warnings, 0 errors | `fix1-lint.log` |
| Root local `prettier --check` over the same 22 paths | all formatted | `fix1-format.log` |

The broad OpenCode rerun includes the previously added final HTTP scalar-capture changes as well as this Runner repair. Controlled loopback fixture access was approved; no live user server, remote provider or robot ran. Unchanged Core/Server/SDK types and Server/SDK integration checks retain their earlier passing evidence; unrelated checks were not repeated.

The unchanged benchmark scripts were rerun after the regression commands finished. Ten alternating samples after two warmups remain preserved in `fix1-performance.log` and `fix1-performance-owned.log`. Per 1000 actual cycles including scope closure, median unowned Runner/BackgroundJob times are 9.253/25.139 ms; real-owned times are 15.090/33.594 ms. The repaired Runner adds an inner work fiber and resource scope to guarantee termination ordering. This costs approximately 5.837 microseconds per Runner cycle when comparing real-owned to unowned on this candidate; the previous pre-repair owned median was 11.781 ms per 1000 cycles. BackgroundJob source is unchanged, and its differing samples illustrate why these short local observations are not a production speedup/regression budget. All earlier baseline and candidate samples remain intact. Filesystem/SQLite/provider/platform/robot costs remain outside this microbenchmark.

The final 22 source/test hashes are refreshed in both `fix1-source-sha256.txt` and `final-source-sha256.txt`; manifest SHA256 is `441315593885af3a340d081de4b0d4cdd0a1be49a5f988cc7e49030e14978b70`. Product source is frozen for root's independent re-review. No Git/index/commit/ledger action was performed by this worker. Review acceptance, commit and progress reconciliation remain root-owned; all previously stated Windows, packaging, production, external-process and M9/physical limits remain open and unchanged.

## Coordinator evidence clarification — 2026-10-08

The Core 100-test command also listed the proposed `./test/ftc-boundaries.test.ts`, which does not exist at this checkpoint. Bun ignored that unmatched selection while running seven actual files. The 100 passing tests/802 assertions are valid evidence for the actual M2 integration, isolated project/chat and BackgroundJob files; **no dedicated FTC boundary test execution is claimed**. Domain/import/state ownership was examined in the independent source reviews. This clarification changes no product/test source, test count or frozen hash.
