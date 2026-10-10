# M9-02 contract and lifetime audit — 2026-10-10

Worker: `/root/m9_contract_audit`. Verdict: **DONE_WITH_CONCERNS — contract is implementable; retain the rulings below.** This is a pre-implementation contract audit, not a review of the changing implementation or behavioral verification. Product sources and source documents were read through `git show 7f9e23cea:<path>`, using full baseline `7f9e23cea771d3660f32c1f1b5799b92dcfa1719`. Only this report was written. No product/test, Git/index, ledger/checklist, prior evidence, host, provider, toolchain or robot changes; no tests, typechecks, baseline reruns or subagents. Root owns writer, independent review, commits and the task32 checkpoint; no task33 is authorized here.

Read root and Schema AGENTS; the exact M9-02 task; `docs/prompt.md`; the exact brief, continuation addendum, continuation source audit and resume reconciliation; frozen Operations, operation Schema and relevant M9-01 contract/lifetime tests. Memory registry entries were used only to orient module ownership and isolated-test boundaries; frozen source settles every ruling below. The Superpowers entrypoint explicitly exempts dispatched subagents, so no implementation skill workflow was started for this focused audit.

## Result and compatibility

There is no inherent need to widen `Operations.make` from `Effect<Interface, never, Scope>` or alter the mandatory `policy`/`parameters` preparation ports. Frozen `operations.ts:31–60` establishes those contracts, and the continuation addendum at `:9` expressly adopts optional fallible observer registration while preserving them. `never` is the typed error channel; it is not proof that an effect cannot defect or be interrupted.

A registration outcome can be retained privately while the constructor returns the unchanged service shape. Readiness starts false, becomes true only after valid registration success while the owner remains active, and stays false after failed/malformed/partial registration. Missing readiness produces `approval_unavailable`. The old preparation-only constructor needs no dummy approval adapter. Holding registration must not hold an uninterruptible constructor region or make preparation depend on approval readiness. No retry or late completion may restore readiness after registration failure or owner closure. The precise implementation mechanism and behavior while registration is still pending must be documented and tested through the real owner; there is no permission to invent a production issuer.

Effect beta.83 supports preserving the `never` constructor channel without conflating errors: installed `Effect.ts:3479–3481` defines `exit` as `Effect<Exit<A,E>, never,R>`, and `catchCause` at `:5197` handles the full cause including typed failures, defects and interruptions. These are available mechanisms, not instructions to swallow every failure in approval. Registration not becoming ready is the adopted unavailable behavior; clock/deadline operation failures and caller interruption retain their operation-level meaning. A blanket conversion of all port causes to `approval_unavailable` would erase those distinctions.

## Concrete lifecycle concern: supervision does not supply Scope

**Ruling: bind observer resource finalizers to the private Operations scope as well as supervising its fiber there.** `Effect.forkIn(effect, operations)` alone is insufficient. Installed beta.83 `Effect.ts:16963–17038` retains the effect's environment `R`; `internal/effect.ts:5110–5154` starts the fiber and adds its interruption finalizer to the supplied scope, without replacing `Scope.Scope`. `Scope.provide` at `Scope.ts:287–347` supplies the service explicitly. `Effect.addFinalizer` captures the current Scope service (`internal/effect.ts:3857–3867`).

Consequently, merely forking `observe` in `operations` can leave its unregister finalizer in the ambient construction scope. That scope can run listener teardown before the Operations finalizer has set `closed`, opening exactly the window forbidden by the continuation addendum at `:10`. A private child scope supplied to observation and itself closed only after Operations retires admission is also valid; a short-lived `Effect.scoped(observe(...))` that unregisters when registration returns is not.

Frozen Operations already sets `closed` and clears pending before closing its private scope (`operations.ts:65–69`), and uses an owned fiber plus release join (`:73–76`). Preserve that order for pending, claims, consent and tombstones, then join registration, observer, preparation and approval cleanup. Late callbacks or registration completion must see closed and cannot recreate state. Keep the beta.83 deferred observer join (`:166–172`); replacing it with a direct join changes an already identified lifetime boundary. The existing asynchronous release is intentionally joined: held cleanup may delay close/interruption completion, but must not delay the synchronous retirement of admission.

## Trusted adapter postconditions that types cannot prove

The fallible signature `observe(revoke): Effect<void, OperationError, Scope>` is possible, but success must mean the trusted callback is installed and remains valid until its owner-scope cleanup. The type alone cannot distinguish real registration from a successful `Effect.void` that installed nothing, nor detect an adapter unregistering itself after success. Malformed effect/result values can fail closed; semantic false success cannot be inferred from `void`. This is a required supplied-port postcondition and future adapter verification gate, not a reason to add a host protocol, startup probe or new authority token in M9-02. Tests must supply an actual registry/callback lifetime, not merely a successful registration flag.

Likewise, `claim` must synchronously consume one owner-bound opaque event and return immutable captured data or a canonical error, with no asynchronous hidden-consumption interval (`resume-reconciliation.md:61–65`, exact brief `:11`). Core must snapshot/validate the returned pair/decision and record a legitimate matching claim with no yield between claim and bookkeeping. Synchronous claim may deliver revocation reentrantly; recheck active/exact state after it before reserving or committing (`continuation source audit:46–48`). Do not overwrite a callback's prior tombstone. Readonly TypeScript records alone do not establish immutable, nonthrowing captured values; that is also an explicit adapter postcondition. An asynchronous issuer or one that consumes then throws before disclosing its owner binding cannot promise equivalent retirement under this interface and requires a future handshake design.

The clock/deadline numbers are a trusted comparison domain, not proof of elapsed physical time. Finite validation cannot establish the actual clock producer's accuracy or ordering. The adopted interface is sufficient for isolated owner behavior using supplied trusted values; real clock configuration remains a future producer gate. Do not invent a unit, TTL, wall clock, timer or monotonicity assertion to compensate.

## Transition, failure and retirement rulings

The exact brief `:15–19`, continuation source audit `:46–50`, and reconciliation `:83–96` support the following order. It is a coordinator-adopted diagnostic order, not an additional ordering found in the original task.

| Boundary | Required consequence |
| --- | --- |
| Ordinary approval entry after owner close | `owner_closed` takes precedence over local lookup/readiness/repeat errors. |
| Existing exact tombstone | Return its first irreversible reason; do not consume another event or overwrite it. |
| Unretired claimed/accepted binding | `approval_consumed`; an accepted deadline may first be lazily checked and irreversibly expired. |
| Unknown operation or caller fingerprint mismatch | Reject without claiming or retiring another operation based on caller data. |
| Preclaim clock failure/cancellation | No legitimate event has been claimed; do not invent a consumed binding or tombstone. |
| Authenticated event with a different exact pair | Never retarget it; consume/retire only its actual owner-known exact pair as the brief permits. |
| Matching claim, then reject/revocation/expiry | Retire immediately with that explicit reason; later acceptance cannot overwrite it. |
| Matching claim, then operation failure or caller interruption before commit | No accepted consent; retire permanently, preserve an already earlier reason, and join held cleanup. Caller interruption stays an interrupted effect; repeat can observe `approval_cancelled`. |
| Successful commit | Store only original binding/deadline privately, return the original immutable preparation snapshot, and remain revocable/expirable. |

**Concern to check in the implementation review:** successful external waits are not the only recheck paths. A failed clock/deadline effect can enter held cleanup while a synchronous rejection/revocation or owner close occurs. Any later ordinary domain-error decision must still respect closed/first-tombstone precedence and cannot insert a cancellation tombstone into the cleared owner. Actual caller interruption must not be rewritten into `owner_closed` or a synthetic successful error response just to satisfy ordinary diagnostic ordering. Defects remain distinguishable from canonical domain failures. These are compatible requirements when lifecycle state and the original effect exit are treated separately.

Time checks use the captured preclaim reading as `claimedAt`, reject nonfinite values, expire at `deadline <= claimedAt` or final `now >= deadline`, and recheck state after deadline/clock waits immediately before one synchronous compare-and-transition. No per-operation lock or broad mask may cover these waits. At most one operation acceptance commits, including two authentic events; losing unused events need not be consumed. A reject event fast path that reports consumed after acceptance is permissible only because the required exact trusted rejection callback remains able to retire accepted consent (`reconciliation:94,137`). Both routes cannot be absent.

## Canonical surface and limits

Schema instructions retain browser-safe serializable contracts and forbid service lifetime/authority in Schema. Frozen `ftc-operation.ts:67–75` fixes preparation status to `awaiting_approval` and explicitly says the fingerprint is decision data only. Canonical ApprovalRequest can reuse the existing `operationID` and fingerprint field schemas; the opaque event stays Core-only. Add only the assigned error codes and same-name readonly canonical contract. Existing preparation test `m9-01.test.ts:78–79` needs only its permitted two-method key assertion adjustment, retaining no execute. Neither successful preparation nor the unchanged returned snapshot is a current consent accessor or dispatch authority.

This contract audit validates no actual user-action issuer, cross-window notification ordering, successful/current M5 provenance conversion, M8 identity/generation/capability/state producer, controller lease, dispatch-time revalidation, execution consumption, transport/isolation, packaged host or physical robot. All remain separate gates. Source inspection cannot count as M9-02 task/substep completion.

## Read-only evidence identity

All bounded source reads/hash commands exited 0, except an initial inventory lookup reported that the root-level `node_modules/effect` entry does not exist; the actual Core dependency was read at `packages/core/node_modules/effect`. No command executed product code. Source documents/product source were frozen Git reads; installed dependency source was inspected separately and is not claimed to be part of the Git baseline.

| Source | SHA-256 |
| --- | --- |
| Frozen `packages/core/src/ftc/operations.ts` | `090da2676b7ba2298867467004e3cb8a0debf7046b35ec23661a4a6590441bb7` |
| Frozen `packages/schema/src/ftc-operation.ts` | `1c2e66f286fced3c1ed251c2f326b96c5fe07af78a990b6168b41a8f18eb4ae5` |
| Frozen `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` | `ae346562f8068fbf3be72c074e00290bdd8f8ac9bfb3d2615d347f4a67108a41` |
| Installed beta.83 `Effect.ts` | `645893de9b7ed737f57ef47a391231f2bd1a90b7c23e2a608fb3b7200920dae5` |
| Installed beta.83 `Scope.ts` | `7454a86440c0c8514f3c08dbd02f62c6bb6b190086d51e2808381673083384f2` |
| Installed beta.83 `internal/effect.ts` | `950ff82f5819647bfd09328ef766fb37504ce870b3cfc942e2854b9aca237d14` |

Commands used from `/Users/dylanxu/coding_tree`: bounded `git show 7f9e23cea:<path>`, `git ls-tree`, `git rev-parse 7f9e23cea`, `rg`, `nl`, `sed`, dependency `cat`, frozen `git show ... | shasum -a 256`, and dependency `shasum -a 256`. Initial `git status --short` was a read-only inventory, not a candidate-source freeze. No changing product implementation was read. The final report content/whitespace check does not establish behavior.
