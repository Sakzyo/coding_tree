# M3-02 — Injected Session execution gate

**Candidate: fix round 1, frozen for re-review.** Current repair base: `fcf89eb8d6fd40e358c9b559ffd5d1d3b52a2f87`; see the final section and [repair hashes](m3-02/fix1-SHA256SUMS). Earlier sections retain the original reviewed candidate and its historical test/benchmark evidence.

**Original candidate record.** Implementation/test owner `/root/m3_02`; dispatch base `13838cc9778c80c3411e6ff5b0d404aa288a11b4`. No staging, commit, checklist or progress edits by this owner. Root's disjoint M4 and M11 commits advanced the shared HEAD to `7a5d893673e4b4308406ba8ec9ffe55da9cec98d` during verification. Frozen source/test SHA-256 values are in [SHA256SUMS](m3-02/SHA256SUMS).

## Contract and scope

The coordinator approved the proposed narrow port and lifecycle seam. `FtcAgentGate.Port` consumes canonical `FtcProject.ChatRef`, `GateResult`, `GateLease`, `GateError` and `ChatError` records only. It imports no M2 implementation or store. `resolve({sessionID, location})` receives the Session's stored Location and returns explicitly managed/unmanaged membership. A managed root without chat membership must fail; a managed resolution/acquisition failure never falls back to unmanaged. Association IDs are not compared with host Project IDs.

`SessionExecutionLocal.make` is the actual local routing implementation, with narrow injected SessionStore and Location layer ports; `layerWith(port)` binds it to the existing services. The existing uncomposed process-global node explicitly uses `FtcAgentGate.unmanaged` for legacy compatibility. Production FTC host wiring is M2-06 work and is **not** completed here. Independent test instances do not reset globals or boot M2.

Explicit resume retains its void success contract and adds the tagged `FtcAgentGate.Blocked` variant to `SessionRunner.RunError`. Busy errors carry the active ChatRef; rejected membership/acquisition errors retain their canonical error record. Advisory wake remains error-free, fire-and-forget void. A rejected wake starts no runner and is not automatically retried when the blocking chat settles. Ordinary durable Session admission still precedes wake; this gate is not M2's pre-admission draft rejection.

The existing SessionRunCoordinator has one optional scoped `acquire(key)` hook, with no second loop, Session-ID-specific layer or new ownership authority:

- Acquisition happens before Location runner construction. `acquireRelease(..., {interruptible:true})` permits cancellation while atomically registering the returned lease finalizer. The coordinator marks successful acquisition while masked against interruption. A port must leave no claim behind when acquisition is cancelled before returning its lease.
- Concurrent same-Session resumes join one owner and claim. Cancelling a joining waiter does not cancel execution. Successful coalesced wakes keep the scope. Failure/interruption with an already-pending wake transfers the same scope to the successor.
- Location initialization, tool/approval wait fixtures, runner cleanup and interruption cleanup keep the claim. Terminal settlement closes its scope before completing waiters or removing the active entry.
- A wake arriving during asynchronous terminal release is recorded while the entry stays active, then starts a fresh scope after close. A resume arriving during successful release joins that settling execution. Existing interruption/resume behavior remains covered by the coordinator regression suite.
- `release` receives the exact execution lease, including its claim token, once per completed chain. It is the terminal notification boundary. The controlled port demonstrates that stale release cannot remove a newer claim. M2 owns token validation and admission reservation handoff; a future adapter must not drop a reservation merely because advisory wake returned. This task does not implement M2-04 or M2-05.

Session prompt promotion, provider streaming, history reload, Context Epochs, runner LLM implementation, Protocol, Server handlers, Client, Schema definitions, SQL/migrations, host wiring and robot authority are unchanged. Only the six assigned runtime/test files plus this report/evidence were edited. The existing coordinator test file did not need changes: additional lifecycle assertions are exercised through the real local factory in the focused task file.

## Behavioral RED and repairs

The first behavioral test used a mechanical extraction of the existing local layer body as `make`; the gate port was declared but ignored. It reached actual local routing and failed **Expected blockedDrainStarts 0, received 1**, not an import/harness error. [RED log](m3-02/red.log): exit 1, 1 failure, 1 assertion, 8 filtered tests.

Initial implementation passed 9 tests / 48 assertions. Review then found that setting the existing `stopping` flag solely for asynchronous release would cause a same-Session resume to attempt a new execution after release. The [release-join RED](m3-02/join-release-red.log) reproduced that extra acquisition as an unexpected busy failure. Removing that unnecessary flag preserves the join. The final focused suite passes 13 tests / 71 assertions.

An initial Core typecheck found a missing `commit` member on the controlled Project service in the real prompt fixture; the fixture was repaired. Initial lint reported unnecessary non-null assertions in the new tests and a return-consistency warning in the new acquisition generator; these were corrected. The sole remaining lint warning is the pre-existing, unchanged `Fiber.Fiber<void, never>` type argument at coordinator line 19. Two shell attempts used a package-relative evidence path from the repository directory and failed before any test/benchmark process started; they were rerun from the proper package directory. The first benchmark launcher used a package-directory import unsupported by Bun; its import was corrected to the package's existing `dist/index.js`. None of these setup diagnostics is counted as product RED evidence.

## Assertion map

All new cases live in `packages/core/test/ftc/agent-and-context/m3-02.test.ts`.

| Requirement | Test and concrete observation |
| --- | --- |
| Resume/wake exclusion, alias membership, separate projects | Line 125, `resume wake and prompt cannot overlap different chats in one project`: blocked starts 0; other project starts 1; release before cleanup false; busy active identity; only allowed stored Locations are routed. Different fixture Locations resolve to one canonical project ownership key. This is controlled alias mapping, not a filesystem canonicalization test. |
| Same-Session join, cancelled waiter, coalescing | Line 159: two joining resumes plus an interrupted waiter; one acquisition; forces `[true,false]`; one final release. |
| Tool/approval waits and interrupted successor | Line 187: controlled runner waits model tool/approval boundaries; competing chat remains blocked during cleanup and successor; no early release; final active set empty. |
| Failed drain with pending successor | Line 230: controlled runner defect reaches old waiter; successor retains the original claim and finalizes it after completion. |
| Missing managed membership | Line 257: canonical `chat_not_found` rejection; explicit blocked error; error-free advisory wake; no runner, Location construction or claim. |
| Legacy compatibility | Line 274: explicit unmanaged resolution routes stored Location and executes with zero claims. |
| Acquisition error and cancellation | Line 288: canonical acquisition error; separate interrupted pending acquisition observes cancellation; no runner or spurious release; active set empty. |
| Scope disposal | Line 318: real scoped coordinator disposal runs runner cleanup before exact lease release and empties active ownership. |
| Actual prompt and durable admission | Line 349: real SessionV2, SQLite SessionStore and SessionInput; row exists before wake; busy chat receives a durable receipt but no runner; no replay when first chat settles; explicit later resume can run. Draft refusal remains M2's responsibility. |
| Wake during async release, new claim and stale release | Line 419: active entry retained through release; new wake waits for close; new token differs; stale old-token release does not unlock current owner; exact terminal notifications. |
| Location failure and missing Session | Line 470: Location construction defect releases acquired claim; missing Session never calls membership resolver; active set empty. |
| Join during successful release | Line 489: concurrent resume while finalizer waits joins one drain and one acquisition. |
| Location initialization and cleanup waits | Line 509: claim acquired before delayed Location construction; competing chat stays blocked through Location interruption cleanup; no runner starts; exact final release. |
| Existing admission, retry, stream/history, delivery and coordinator invariants | Existing M3-01, session-prompt, session-runner, session-run-coordinator and recorded-runner suites, plus actual Location layer-node construction regressions. These remain unchanged. |

These are real Core routing/coordinator/Session persistence tests with controlled membership, gate and runner ports. Focused tool/approval waits are controlled runner boundaries; the task fixture does not operate real tools, UI approvals, providers, networks or robots. Existing Session runner regressions retain the actual stream/history orchestration coverage. No test imports an M2 implementation to bootstrap M3.

## Commands and results

Pinned runner: `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`, version 1.3.14 (`0d9b296a`), macOS arm64. All Core commands use this prefix unless a row notes otherwise:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH \
OPENCODE_TEST_HOME=/private/tmp/ftc-m3-02/home \
XDG_DATA_HOME=/private/tmp/ftc-m3-02/data \
XDG_CONFIG_HOME=/private/tmp/ftc-m3-02/config \
XDG_CACHE_HOME=/private/tmp/ftc-m3-02/cache \
XDG_STATE_HOME=/private/tmp/ftc-m3-02/state
```

No tests or raw `tsc` were run from repository root. The release-join RED used repository-root `bun --cwd packages/core test ...`, which dispatched the package test script with the same isolated variables. Tests created temporary databases through the existing disposing tmpdir fixture. No user app/server was restarted.

| Command | Cwd | Exit and result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/agent-and-context/m3-02.test.ts --test-name-pattern 'resume wake and prompt'` | `packages/core` | 1; intended missing-gate failure | [RED](m3-02/red.log) |
| `bun test ./test/ftc/agent-and-context/m3-02.test.ts` | `packages/core` | 0; **13 pass, 0 fail, 71 assertions**, final focused source | [focused final](m3-02/focused-final.log) |
| `bun test ./test/ftc/agent-and-context/m3-01.test.ts ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts ./test/session-runner-recorded.test.ts ./test/effect/layer-node/node-build.test.ts` | `packages/core` | 0; **133 pass, 0 fail, 371 assertions**; uses `/private/tmp/ftc-m3-02-regression/{home,data,config,cache,state}` | [existing regressions](m3-02/session-regressions.log) |
| `bun test ./test/ftc/agent-and-context/m3-02.test.ts ./test/ftc/agent-and-context/m3-01.test.ts ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts ./test/session-runner-recorded.test.ts ./test/effect/layer-node/node-build.test.ts` | `packages/core` | 0; **145 pass, 0 fail, 435 assertions** after join repair; before the final Location-initialization case and lint-only edits. Final focused run above covers those additions; this is not claimed as a combined final 146-test run. | [combined regressions](m3-02/final-regressions.log) |
| `bun typecheck` | `packages/core` | 0; final source/test types | [Core](m3-02/core-typecheck-final.log) |
| `bun typecheck` | `packages/server` | 0; new RunError union propagated without consumer edits; unchanged error contract since this check. Pinned PATH; command performs no runtime I/O. | [Server](m3-02/server-typecheck.log) |
| `bun test ./test/ftc/projects-and-chats/m2-03.test.ts --test-name-pattern 'gate records validate'` | `packages/core` | 0; **1 pass, 8 assertions**, 17 filtered; existing canonical Gate records check | [Gate schemas](m3-02/schema-gate-records.log) |
| `bun test ./test/contract-hygiene.test.ts` | `packages/schema` | 0; **5 pass, 10 assertions**; pinned PATH | [Schema hygiene](m3-02/schema-hygiene.log) |
| `bunx --no-install oxlint <six files listed in SHA256SUMS>` | repository | 0; 0 errors; 1 pre-existing unchanged warning | [lint](m3-02/lint-final.log) |
| `bunx --no-install prettier --check <six files listed in SHA256SUMS>` | repository | 0; all matched files formatted | [format](m3-02/format-check.log) |
| `git diff --check -- <six files listed in SHA256SUMS>` | repository | 0 | [diff](m3-02/diff-check.log) |
| `bun run ../../docs/validation/m3-02/benchmark.ts` | `packages/core` | 0; final controlled lifecycle benchmark | [samples](m3-02/benchmark.json), [stderr](m3-02/benchmark.log) |

The Server check is the relevant directly affected external consumer; no Protocol/HttpApi or SDK surface was edited, so Client/SDK regeneration is not applicable. Canonical Schema was consumed without modifications. Full Core/Schema suites and unrelated modules were not rerun.

## Scoped performance comparison

The retained production renderer baseline remains [baseline.md](baseline.md#production-renderer-performance-baseline): 7 passing 30x CPU-throttle renderer scenarios, including 160-delta streaming variants. It does not exercise this new local gate. There are no renderer/timeline source changes in this task, and the coordinator approved a controlled actual-local comparison instead of presenting that fixture as gate coverage.

[benchmark.ts](m3-02/benchmark.ts) runs the actual local implementation with a real LayerMap and coordinator. The baseline is the exact dispatch-base local implementation mechanically exposed as a factory, with the unchanged dispatch-base coordinator ([baseline local](m3-02/benchmark-base-local.ts), [baseline coordinator](m3-02/benchmark-base-coordinator.ts)); original snapshots are retained beside them. Imports are redirected for the evidence script; the drain/coordinator baseline behavior is unchanged. Ten measured samples of 1000 sequential lifecycles follow one warmup sample per mode; mode order alternates. Each sample alternates explicit resume with advisory wake plus resume join. Runner and gate ports complete synchronously. Final source hashes identify the measured implementation.

Final median total times per 1000 lifecycles: baseline **9.671 ms**, explicit unmanaged **12.821 ms**, managed **14.153 ms**. Approximate added time per lifecycle is **3.15 µs unmanaged** and **4.48 µs managed**. All sample distributions are retained in [benchmark.json](m3-02/benchmark.json). An earlier exploratory result is [benchmark-initial.json](m3-02/benchmark-initial.json); the final run followed the small return/format repairs so the reported distribution corresponds to frozen runtime source. This microbenchmark establishes scope overhead only, with no machine-independent budget or user-perceived speed claim. It excludes contention latency, real provider/tool/approval latency, renderer frame behavior, app packaging and Windows. Disjoint task activity may affect timings.

## Review limits and remaining gates

M2-managed production host composition, admission reservation handoff/draft rejection, settled stop facade, real gate+host integration, Windows, packaged Electron, real provider/tool/approval UI, offline inference and physical robots remain their named task/release gates. These tests establish the injected M3 seam, not those downstream outcomes. Importing the gate module starts no I/O; process-global production ownership remains the existing node/coordinator. No ownership is persisted and no crash/provider work recovery was added. Coordinator independent review and commit remain outstanding.


## Fix round 1 — disposal leak I1 and expected diagnostics M1

Review input: [M3-02-review.md](M3-02-review.md). The independent reviewer reproduced an important leak: closing the execution scope with a pending wake caused the interrupted owner to transfer its acquired lease to a successor after FiberSet had closed. FiberSet returned an interrupted fiber without evaluating the successor effect, so neither its terminal cleanup nor ownership release ran. The active Session and project claim remained after disposal. The original ordinary-disposal test did not combine a pending wake with closure.

The repair changes only `packages/core/src/session/run-coordinator.ts` and the assigned focused test, plus this report/evidence. A coordinator-local `closed` flag is set by a finalizer registered after FiberSet construction; reverse finalizer order establishes closure before FiberSet interrupts its owners. All coalesced/successor branches check this flag. During shutdown, owners terminally close their lease scope and settle/remove the entry instead of forking a successor. Late advisory wakes become no-ops; a resume against a disposed coordinator interrupts rather than creating an entry for a closed runtime. Ordinary live join, coalescing, failure-successor and explicit interruption-successor semantics remain covered and passing. The pre-existing Fiber generic lint warning is unchanged.

Four new regressions use the actual local execution factory, real coordinator and explicitly closed Effect scope:

| Current test line | Disposal assertion |
| --- | --- |
| `m3-02.test.ts:571` | An acquired claim plus pending wake closes with exactly one release, one drain, zero project owners and empty active set; post-close wake/resume cannot recreate ownership. |
| `m3-02.test.ts:591` | Closure waits for delayed runner cleanup; same-Session and different-Session wakes during cleanup start no successor; the original claim releases after cleanup. |
| `m3-02.test.ts:619` | Closure cancels delayed acquisition and waits for its interruption cleanup; a pending/cleanup-time wake starts no successor; no lease is released without acquisition. |
| `m3-02.test.ts:652` | Closure waits for asynchronous lease release; wakes registered before or during shutdown cannot transfer ownership into the closed FiberSet; one exact release and empty active registry. |

Before the fix, the four new cases failed while the original uncomplicated scope-disposal case passed: **1 pass, 4 fail, 16 assertions**, exit 1, [RED](m3-02/fix1-red.log). This independently reproduces the reviewed leak through the real local factory. After the fix and log assertions, the focused suite passes **17 tests / 100 assertions**, exit 0, [GREEN](m3-02/fix1-green.log).

For M1, the two intentional defect cases now use the test-local `expectedFailure` logger layer at line 125. Each asserts exactly one Error record, its Session-drain message and expected cause. There is no process-global logger replacement and no blanket suppression of unexpected records. This adds eight assertions and removes those deliberate ERROR records from the focused stdout. Remaining logs in the broader unchanged regression suites are not modified.

Repair checks used the pinned Bun 1.3.14 PATH above. Core tests/types used task-owned `OPENCODE_TEST_HOME=/private/tmp/ftc-m3-02-fix1/home` and corresponding `XDG_{DATA,CONFIG,CACHE,STATE}_HOME=/private/tmp/ftc-m3-02-fix1/{data,config,cache,state}`. Runtime checks were executed from package directories; no user app/server was restarted.

| Command | Cwd | Exit/result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/agent-and-context/m3-02.test.ts --test-name-pattern 'scope disposal'` before repair | `packages/core` | 1; 1 pass, 4 fail, 16 assertions | [RED](m3-02/fix1-red.log) |
| `bun test ./test/ftc/agent-and-context/m3-02.test.ts` | `packages/core` | 0; 17 pass, 0 fail, 100 assertions | [focused](m3-02/fix1-green.log) |
| `bun test ./test/ftc/agent-and-context/m3-02.test.ts ./test/ftc/agent-and-context/m3-01.test.ts ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts ./test/session-runner-recorded.test.ts ./test/effect/layer-node/node-build.test.ts` | `packages/core` | 0; 150 pass, 0 fail, 471 assertions, final repair source | [covering regressions](m3-02/fix1-regressions.log) |
| `bun typecheck` | `packages/core` | 0 | [Core types](m3-02/fix1-core-typecheck.log) |
| `bun typecheck` | `packages/server` | 0; pinned PATH, no runtime work | [Server types](m3-02/fix1-server-typecheck.log) |
| `bunx --no-install oxlint packages/core/src/session/run-coordinator.ts packages/core/test/ftc/agent-and-context/m3-02.test.ts` | repository | 0; 0 errors, one unchanged pre-existing warning | [lint](m3-02/fix1-lint.log) |
| `bunx --no-install prettier --check packages/core/src/session/run-coordinator.ts packages/core/test/ftc/agent-and-context/m3-02.test.ts` | repository | 0 | [format](m3-02/fix1-format-check.log) |
| `git diff --check -- packages/core/src/session/run-coordinator.ts packages/core/test/ftc/agent-and-context/m3-02.test.ts docs/validation/M3-02-implementation.md` | repository | 0 | [diff](m3-02/fix1-diff-check.log) |

No public error contract, Schema, host, M2 facade or renderer behavior changed in this repair. Its normal live path adds boolean disposal guards and one scope finalizer; the measured lifecycle algorithm is otherwise unchanged. This does not materially invalidate the prior bounded overhead comparison, so the scoped benchmark was not repeated. Its distributions remain explicitly historical initial-candidate measurements, not a fresh repair measurement or a shutdown-latency benchmark. The new disposal tests provide the relevant behavioral evidence. All previously listed downstream production/platform/robot gates remain unrun.

Current complete M3 source/test identities are [fix1-SHA256SUMS](m3-02/fix1-SHA256SUMS). No staging, commits, checklist/progress changes or new tasks by the repair owner. Root owns commit, same-reviewer re-review and the user-requested progress update before stopping.
