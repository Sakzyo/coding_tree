# M9-02 continuation source audit — 2026-10-10

Worker: `/root/m9_prepare`. Status: **READY for explicit later writer release; read-only preparation**. Root is implementing/reviewing M5-06 first. This audit changes no product/test source, prior evidence, Git/index, progress ledger or checklist and grants no task credit, consent or execution authority. No tests, typechecks, app/server, provider, network, robot, toolchain, production approval or user-action issuer were run. Only this report and new files in `m9-02-continuation-2026-10-10/` are owned by this worker.

Read root and Schema AGENTS, `docs/prompt.md`, shared contract/global rules, the M9 module plan and exact M9-02 task, proposal ROB-02–07/AC-10/11 and design module/port/approval/lifecycle/isolated-test sections; saved M9-02 brief, preflight, resume reconciliation and preparation report; current Operations, operation Schema and M9-01 tests; and root's new [continuation addendum](M9-02-continuation-brief.md). The memory registry was consulted only for workflow orientation; live source documents settle the current contract and all source facts below. Superpowers TDD was read to check the planned implementation order.

## Identity reconciliation

Observed Git baseline: `e99b38f28d1b4b8e8179fd3b06c4d46b9ab0d13b`. Root's ledger/brief and M5 worker evidence are current concurrent work; this is not a clean-tree or whole-checkout freeze claim. The three current M9 sources are byte-identical to reviewed prerequisite `768ec206c` and the prior preparation manifest. All fifteen entries in that old manifest still match, including the unchanged exact brief. The brief copies exactly one M9-02 task excerpt and that excerpt matches the current module plan. The new M9-02 test does not exist yet.

| Current source | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/operations.ts` | `090da2676b7ba2298867467004e3cb8a0debf7046b35ec23661a4a6590441bb7` |
| `packages/schema/src/ftc-operation.ts` | `1c2e66f286fced3c1ed251c2f326b96c5fe07af78a990b6168b41a8f18eb4ae5` |
| `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` | `ae346562f8068fbf3be72c074e00290bdd8f8ac9bfb3d2615d347f4a67108a41` |

Machine-readable observations, empty reviewed-source diffs and exact-excerpt checks are in [source audit](m9-02-continuation-2026-10-10/source-audit.json), [fifteen-source manifest](m9-02-continuation-2026-10-10/source-sha256.txt), and [exact task](m9-02-continuation-2026-10-10/exact-task.md). These are source checks, not behavioral test results. M5 source identities in the audit are read directly from **Git baseline `e99b38f28`**, separately from current M9 hashes; they do not freeze or validate changing live M5-06 writer files. Refresh prerequisite baselines after M5-06 is frozen and independently approved.

## Canonical contract and minimal scope

Current `Operations.make` returns `Effect<Interface, never, Scope>` and supports preparation with only mandatory policy/parameters ports. It owns one private pending map and exposes only `prepareOperation`. Request clone/freeze occurs before external waits; only the validated original prepared descriptor enters the map. Its canonical fingerprint includes project/chat/initiator/controller/generation/mode/action while excluding operation ID. Two different operation IDs can share a hash, so approval must compare both scalars.

The saved exact brief remains valid with the continuation addendum's two corrections below. Add canonical `FtcOperation.ApprovalRequest` using exact `PreparedOperation.fields.operationID` and `.contextFingerprint` identities, same-name readonly interface and stable identifier. Keep the opaque `userEvent: object` solely in the Core method's argument. It must not become a Schema/JSON secret, bearer event ID or source of caller-selected action/target/deadline. Core re-exports the exact canonical value. Existing Schema namespace/barrel wiring already exposes it; no new package/export registry is required.

The seven assigned errors are `approval_consumed`, `untrusted_approval`, `approval_unavailable`, `operation_unknown`, `approval_rejected`, `approval_expired`, `approval_cancelled`; reuse `invalid_operation_input`, `context_changed`, `owner_closed`. Preserve optional omission. `PreparedOperation.status` remains `awaiting_approval` and the returned value remains the preparation-time immutable descriptor. Success commits private consent at one instant; it cannot imply later validity or introduce an `approved` status/authorization token. M9-04/05 own dispatch-time validation/consumption/status.

After root's explicit writer release, the minimal assigned product/test paths are:

1. `packages/core/src/ftc/operations.ts` — optional consumed approval port, exact owner-local transitions, scoped observer/readiness and private consent/deadline.
2. `packages/schema/src/ftc-operation.ts` — canonical ApprovalRequest and the seven errors only.
3. `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts` — new real-owner task/contract/trust/lifetime tests.
4. `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` — only its exact `Object.keys(operations)` assertion at line 78, allowing prepare plus approve while retaining no execute.

Fresh implementation evidence belongs to root-assigned `M9-02-implementation-2026-10-10.md` and `m9-02/implementation-2026-10-10/`. Preserve all historical M9 evidence. No changes to M5/M8 producers, composition, host/API/Protocol/Server/client generation, SQL/migrations, timer, transport, execution, dependencies, package manifests or lockfiles are necessary or assigned. Do not repair the deferred parameterized-test-label diagnostic Minor. Root owns Git and progress/checklists; workers do not commit or delegate.

## Required continuation corrections

**TDD:** The historical preparation report's proposed production method scaffold before meaningful RED is stale and superseded by root's addendum. Write test code first. A test-only expected method shape/guard for absent behavior can let the displayed artifact/target expectation fail against the existing real owner without a missing-import/method exception. It must not simulate approval or duplicate its logic. Preserve the real failed assertion/output before any production Schema or method edits. Subsequent GREEN must exercise the actual implementation and the exact task's displayed digest, reused `approval_consumed` and forged `untrusted_approval` assertions.

**Observer readiness:** The old reconciliation's `observe: Effect<void, never, Scope>` assumes infallible completed registration. Root now explicitly permits a fallible Core-only registration effect. Approval stays unavailable unless trusted registration completed successfully; failed, malformed or partially registered observation must never set readiness. Keep `make`'s existing result and preparation-only constructors valid rather than failing construction, inventing a dummy adapter or silently accepting approval with no listener. Missing readiness yields `approval_unavailable`; preserve distinguishable canonical failures/defects where the operation contract requires them. Tests must prove failure at the real public owner still permits preparation and cannot accept or later restore consent. The worker must document the precise narrow effect/error handling used rather than assert an impossible never-error producer.

Keep registration and all partial listener cleanup in the owner-owned operations Scope. Owner closure first sets closed and clears pending/consent/tombstones, then closes that Scope and joins registration, preparation, approval and unregister cleanup. A held teardown cannot create a period in which the listener is gone but approval remains open. Failed registration grants no readiness before its cleanup; cleanup remains owned and joined. Late success/callbacks after close cannot set readiness or reinsert state. No real producer event protocol is invented by this consumed boundary.

## Trust, transition and lifetime checks for the writer

Keep the adopted synchronous nonthrowing-domain `claim(userEvent)` which atomically consumes a supplied owner-bound event and returns its captured exact pair/decision or canonical error. Snapshot/validate the decision and reserve a legitimate matching claim with no yield between them. An asynchronous hidden event-consumption window would need a different handshake contract and is outside scope. Exact synchronous revocation notifications must irreversibly retire accepted/claimed/pending bindings for target/project/generation/artifact/parameters/state/policy changes and rejection. A change away and back cannot revive consent. Unknown or mismatched notification pairs cannot revoke another preparation; authentic mismatched events may retire only their actual owner-known pair.

Use finite injected `now` and `deadline({ prepared, claimedAt })` in the same documented comparison domain; no TTL, time-unit, wall clock or timer assumption. Recheck after preclaim waits, synchronous claim reentrancy, deadline/clock waits and immediately before the atomic commit. Expire at `now >= deadline` or `deadline <= claimedAt`. A deliberate deploy decision accepts only its stored deployment and no second confirmation, initialization or start. Explicit approve accepts only that stored action; reject never grants consent. First irreversible retirement reason wins, with owner closure first, existing tombstone second and otherwise claimed/accepted consumed. Cancellation after matching claim retires the binding and cannot silently replay or return a value to an interrupted caller.

Private consent has no testing/public accessor. Observe behavior through genuine repeat approvals, exact trusted callback notifications and owned supplied-port release. Keep clock/deadline/registration/cleanup waits interruptible; do not hold a lock or broad uninterruptible region across them. Preserve the beta.83-safe queued fiber observer join already covered by M9-01. Genuine concurrent attempts must have at most one acceptance while unrelated operations can progress.

Required real-owner coverage includes optional no-approval construction, absent/failed/malformed observer readiness, exact Deploy in modes/initiators, fake/copied/serialized/code-approval/wrong-owner events, same hash/different ID, ingress/request/event/result mutation across waits, exact irreversible revocation before/during/after acceptance, rejection including after accepted callback, finite before/equal/after expiry and advancing clock during deadline waits, malformed/unavailable clock/policy, concurrent same/different authentic events, claim reentrancy, postclaim cancellation/no replay, and held registration/caller/owner/observer cleanup with close visible before releases complete. Fresh owners/events are independent; restart never restores authority. No facade/import/source capability may execute or transport an action. A detached zero-dispatch counter is insufficient proof.

## Fresh baseline and verification commands

No fresh behavior baseline ran in this read-only audit. The old **66 pass / 194 assertions** is recorded historical M9-01 evidence; it must not be relabelled current. Required after reviewed M5-06 freeze and before M9 production changes: rerun current M9-01 and record exact argv/cwd/environment/exits/counts with source hashes before/after. Reconcile current M5 canonical producer changes independently; never reduce them into the M9 projection to make a fixture pass.

Pinned Bun exists at `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`; repository package manager remains 1.3.14 and Effect is beta.83. Run Core tests from `/Users/dylanxu/coding_tree/packages/core`, with task-specific `OPENCODE_TEST_HOME` and XDG config/data/cache directories under `/private/tmp/m9-02-continuation-home`; prepend the pinned Bun directory to PATH without assigning HOME/CODEX_HOME.

```sh
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts ./test/ftc/robot-approvals-and-operations/m9-02.test.ts
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun typecheck
```

The second command first establishes actual RED, then GREEN. Run the final package `bun typecheck` separately from `/Users/dylanxu/coding_tree/packages/schema` too. From repository root, scoped hygiene commands may inspect only the four assigned paths (they are not root tests): `node_modules/.bin/oxlint <four paths>`, `node_modules/.bin/prettier --check <four paths>`, `git diff --check -- <four paths>`, `shasum -a 256 <four paths>`, and bounded import/source checks. Root's addendum/execution prompt explicitly scopes test runs to focused/affected work; no whole-package passing claim follows. Expand a named regression only when changed shared behavior justifies it. Preserve failed iterations and exact logs rather than overwrite evidence.

## Remaining production and acceptance gates

M5-05's baseline complete `BuildEvidence.sourceRevision` is a saved-input string identity, while M9's existing artifact `sourceRevision` is a nonempty `FtcJava.Revision[]` projection. This incompatibility is already acknowledged in the current ledger and stays outside isolated M9-02. M5-06's artifact retention/current-query facade does not supply a production user-action issuer, exact synchronous M9 revocation ordering or a safe lossy conversion. Root's continuation addendum correctly keeps the projection fixture-bound and requires future composition to reconcile complete provenance.

Actual displayed-action authentication, cross-window registration/revocation ordering, clock/deadline producer configuration, M2/M3 caller membership, complete successful/current M5 artifact/dirty/input/digest evidence, M8 controller identity/generation/capability/state bindings, M9-03 coordination, M9-04 revalidation, M9-05 execution/outcomes, M9-06 transports, M9-07/08 action isolation, physical USB/Wi-Fi controllers, macOS/Windows packaging and AC-10/AC-11 remain separate unavailable/unrun gates. Supplied synthetic ports establish isolated owner behavior only. Root's frozen source checks, commit and independent spec/quality review must precede task credit and the 32/94 stopping checkpoint; no task33 is authorized here.
