# M3-02 independent task review

## Spec Compliance

- ❌ Issues found: scoped cleanup is incomplete. `packages/core/src/session/run-coordinator.ts:82` transfers an acquired ownership scope to a successor even while the coordinator's enclosing scope is closing; the successor never runs and the lease is never released. This violates the task's scoped ownership/disposal requirement. See Important I1.
- ✅ The remaining inspected task surface matches the dispatch: canonical narrow port and explicit unmanaged compatibility (`packages/core/src/ftc/agent/gate.ts:18`, `:32`); actual-local factory/layer (`packages/core/src/session/execution/local.ts:13`, `:63`); stored placement and gate before Location construction (`:23`, `:29`, `:46`); typed blocked resume without changing void success/advisory wake (`packages/core/src/session/runner/index.ts:12`, `packages/core/src/session/execution.ts:12`); chain ownership through coalesced/successor drains (`packages/core/src/session/run-coordinator.ts:75`, `:82`). All four exact task files have corresponding hunks; the additional coordinator and execution-interface edits are explicitly assigned.
- ⚠️ Cannot verify from this diff: actual M2 membership/root canonicalization, admission reservation transfer, stop composition, and managed production binding. These remain later-task gates, not additional M3-02 defects. The compatibility node is explicitly unmanaged (`packages/core/src/session/execution/local.ts:73`), and the report correctly limits its claims (`docs/validation/M3-02-implementation.md:96`). Root should retain these gates for M2 integration rather than treating the controlled alias fixture as production proof.
- ⚠️ Cannot verify from this diff: Windows, packaged Electron, real provider/tool/approval UI, physical robots, or production renderer performance. The controlled benchmark establishes lifecycle overhead only (`docs/validation/m3-02/benchmark.ts:1`, `:20`). No broader performance conclusion is warranted.

## Strengths

- `packages/core/src/session/execution/local.ts:25`: managed resolution and acquisition failures propagate as typed rejection; there is no fallback after managed resolution. The same implementation is used by `make` and `layerWith`, keeping tests on the actual routing code.
- `packages/core/src/session/run-coordinator.ts:52`, `:92`: successful acquisition is recorded under interruption masking, and ordinary terminal settlement retains the active entry while asynchronous release completes. `packages/core/test/ftc/agent-and-context/m3-02.test.ts:419` and `:489` cover late wakes, exact lease identity, and joins during release.
- `packages/core/test/ftc/agent-and-context/m3-02.test.ts:125`, `:159`, `:187`, `:230`, `:288`, `:509`: meaningful assertions cover cross-chat exclusion, separate projects, joins/cancelled waiters, coalescing, tool/approval wait fixtures, interrupted/failed successors, acquisition cancellation, and Location initialization cleanup. These use real local routing/coordinator behavior with deliberately controlled ports.
- `packages/core/test/ftc/agent-and-context/m3-02.test.ts:349`: the real Session/SQLite integration checks durable admission before advisory wake and absence of automatic retry after another chat settles. Existing stream/history/promotion semantics are retained in the unchanged runner regressions recorded in `docs/validation/m3-02/final-regressions.log:50`.
- `docs/validation/M3-02-implementation.md:67`: final 13-test/71-assertion evidence is distinguished from the earlier 145-test/435-assertion combined run. Core/Server typecheck evidence, RED evidence, and the limited benchmark claim are retained without claiming unrun production gates.

## Issues

### Critical (Must Fix)

- None found.

### Important (Should Fix)

- **I1 — Closing the coordinator with a pending wake leaks the execution claim.** `packages/core/src/session/run-coordinator.ts:82`–`:87` creates a successor holding the same `Scope.Closeable` when the owner is interrupted by enclosing scope disposal. `FiberSet` marks itself closed before interrupting its fibers (`packages/core/node_modules/effect/src/FiberSet.ts:151`), and its captured runtime returns an already-interrupted fiber without evaluating the supplied effect after closure (`:723`). Consequently, `start` at coordinator `:85` never installs/runs that successor's `onExit`, the detached ownership scope never reaches `Scope.close`, and `active` retains the successor. A managed project claim can survive execution-service disposal and block other chats. This is a new resource leak enabled by the new ownership transfer, even though the underlying pending-successor shutdown behavior existed before the task. Add coordinator shutdown state established before the FiberSet finalizer runs; terminally close ownership and settle entries during shutdown instead of starting successors, including wakes arriving during shutdown cleanup/release. Add the combined pending-wake + Scope.close regression; the current disposal test at `packages/core/test/ftc/agent-and-context/m3-02.test.ts:318` has no pending wake.

### Minor (Nice to Have)

- **M1 — Expected failure tests emit unasserted ERROR output.** `packages/core/test/ftc/agent-and-context/m3-02.test.ts:230` and `:470` deliberately trigger defects, but their expected diagnostic records escape into `docs/validation/m3-02/focused-final.log:7` and `:18`. Capture the test logger for these cases and assert the expected records so unexpected errors remain visible. This does not invalidate the passing assertions.
- **M2 — Existing lint warning remains in evidence.** `docs/validation/m3-02/lint-final.log:2` reports the unnecessary default `never` argument at `packages/core/src/session/run-coordinator.ts:19`. The declaration is unchanged in the reviewed diff and root separately verified dispatch-base equivalence. This is pre-existing, non-blocking noise; no unrelated source cleanup is required by this review.

## Checks and reproduction

- Reviewed frozen package `.superpowers/sdd/progress/review-7a5d89367..fcf89eb8d.diff` (base `7a5d89367`, head `fcf89eb8d`) against `docs/validation/M3-02-brief.md`, the implementation report, and `docs/validation/M3-gate-preflight.md`, following the task-reviewer prompt. Root supplied six frozen-hash verification and pre-existing lint provenance. No Git, index, product, ledger, or subagent changes were made.
- The coordinator hunk ends inside `run`; read its omitted tail at `packages/core/src/session/run-coordinator.ts:118` to inspect the wake/interrupt behavior. Named outside-diff risk: whether a shutdown successor actually executes its finalizer. Checked only the relevant installed `FiberSet.make` and `runtime` implementations at `packages/core/node_modules/effect/src/FiberSet.ts:143` and `:719`.
- Did not rerun reported suites. Ran one focused reproduction of I1 from `/Users/dylanxu/coding_tree/packages/core` with `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun -e`, importing the real coordinator and Effect. No database, app/server, filesystem fixture, or product writes were involved. Exit 0; observed `{"released":0,"active":["session"]}` after `Scope.close` completed. Correct result must be one release and no active Session.

```ts
import { Deferred, Effect, Exit, Scope } from "effect"
import { SessionRunCoordinator } from "./src/session/run-coordinator.ts"

let released = 0
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const started = yield* Deferred.make()
    const coordinator = yield* SessionRunCoordinator.make({
      acquire: () =>
        Effect.acquireRelease(Effect.void, () =>
          Effect.sync(() => {
            released += 1
          }),
        ),
      drain: () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
    }).pipe(Effect.provideService(Scope.Scope, scope))
    yield* coordinator.wake("session")
    yield* Deferred.await(started)
    yield* coordinator.wake("session")
    yield* Scope.close(scope, Exit.void)
    return { released, active: Array.from(yield* coordinator.active) }
  }),
)
console.log(JSON.stringify(result))
```

## Assessment

**Spec verdict: Issues found. Task quality: Needs fixes.**

The narrow injection and ordinary ownership transitions are well scoped and meaningfully tested. The reproduced disposal leak prevents approval until shutdown closes every acquired ownership scope despite pending or cleanup-time wakes; root should require that regression and the affected coordinator/local checks on the repaired candidate.

## Fix round 1 re-review — 1aa520e9e

**Spec verdict: Compliant for the assigned M3-02 scope. Task quality: Approved.** This verdict supersedes the original candidate assessment above. Reviewed only the original findings and repair-introduced risks in `.superpowers/sdd/progress/review-7ec20aae5..1aa520e9e.diff` (base `7ec20aae5`, head `1aa520e9e`), plus the appended implementation report and repair evidence. Root matched all six final source/test hashes.

- **I1 resolved:** `packages/core/src/session/run-coordinator.ts:33` registers the shutdown flag finalizer after FiberSet construction, so it runs before FiberSet interrupts owners. All three successor branches now require `!closed` (`:82`, `:89`, `:102`); terminal settlement still closes ownership before deleting the entry and settling waiters. The `run` and `wake` guards (`:118`, `:133`) prevent closed-runtime entries from being recreated. Existing live coalescing and interruption-successor behavior retain their original paths while the coordinator is open.
- **I1 regression evidence:** `packages/core/test/ftc/agent-and-context/m3-02.test.ts:571`, `:591`, `:619`, and `:652` exercise actual-local pending-wake disposal, wakes during delayed runner cleanup, cancelled acquisition, and delayed release. They assert exact releases, no extra drain, and empty ownership/active state; post-close wake/resume is also covered. The recorded RED has all four cases failing (`docs/validation/m3-02/fix1-red.log:34`, `:65`, `:91`, `:117`), followed by final focused 17/100 passing (`docs/validation/m3-02/fix1-green.log:22`) and covering regressions 150/471 passing (`docs/validation/m3-02/fix1-regressions.log:184`). No new concrete doubt required a suite rerun.
- **M1 resolved:** `packages/core/test/ftc/agent-and-context/m3-02.test.ts:125` scopes a collecting logger to each intentional-defect case and asserts one Error record, the drain message, and expected cause. The final focused log contains no uncaptured intentional ERROR records. No global logger mutation or blanket unchecked suppression was added.
- **M2 unchanged and non-blocking:** `packages/core/src/session/run-coordinator.ts:19` remains the confirmed pre-existing Fiber type-argument warning, retained in `docs/validation/m3-02/fix1-lint.log:2`. It is not a repair regression.
- **Critical findings:** None remaining. **Important findings:** None remaining. **New Minor findings:** None.
- **Verification limits:** Core/Server typecheck and format/diff success are retained in the repair evidence; no reported checks were rerun for this re-review. The benchmark remains historical evidence for the original candidate, with no final-repair timing claim. All previously listed M2 composition/reservation, production, platform, real-tool/UI and robot gates remain outside this task and unverified; approval does not close those gates. Only this review file was edited.
