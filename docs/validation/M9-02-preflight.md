# M9-02 exact single-use approval preflight

Date: 2026-10-08. Investigator: `/root/m9_02_preflight`. Read snapshot HEAD: `f3677d94b45fe2ad791f573341cfb9dc787ca575`. Approved prerequisite: M9-01 `768ec206c`.

This report proposes the approval-only implementation boundary. It supplies no product implementation, passing test evidence, actual user consent, robot authority, or completion credit. Only this report was written. The concurrent M12 writer's learning sources were not inspected. No tests/typechecks, providers, host processes, transport, physical robots, Git/index mutations, or ledger edits were performed.

## Contract and stable prerequisite

Read root/Schema instructions, [execution prompt](../prompt.md), [M9 plan](../tasks/robot-approvals-and-operations.md#m9-02), proposal ROB-02–ROB-07 and AC-10/AC-11, the design's standalone ports/state/approval/trust/test sections, shared execution/contract rules, and the M9-01 [brief](M9-01-brief.md), [implementation](M9-01-implementation.md), [review](M9-01-review.md), and preparation preflight. Requirements remain separate: ROB-03 deliberate deployment consent; ROB-04 exact agent control approval; ROB-05 target/project binding; ROB-06 no reconnect replay; ROB-07 no alternate authority. AI-04 code approval and PAN-01 dashboard display grant no robot permission.

The exact M9-02 method is `approveOperation({ userEvent, operationID, contextFingerprint }): PreparedOperation`. Its opaque injected user event cannot be model JSON. A deliberate Deploy click authorizes only the displayed deployment without another confirmation; installation never includes initialization/start. Changed target/generation/artifact/parameters, rejection, restart, expiry, and consumption invalidate consent. Expiry comes from injected policy/clock, not an invented product timeout.

`git diff 768ec206c --` the Operations source, operation Schema, and M9-01 focused test produced no difference. Read-source hashes:

| Source | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/operations.ts` | `090da2676b7ba2298867467004e3cb8a0debf7046b35ec23661a4a6590441bb7` |
| `packages/schema/src/ftc-operation.ts` | `1c2e66f286fced3c1ed251c2f326b96c5fe07af78a990b6168b41a8f18eb4ae5` |

M9-01 independent review approved preparation only, with a minor parameterized-test-name diagnostic issue. Its reported 66 focused tests/194 assertions and 125 combined tests/453 assertions are prior evidence, not reruns here.

## Actual prepared-map access and lifecycle

`Operations.make` owns `pending: Map<OperationID, PreparedOperation>` at `operations.ts:63`. Only accepted immutable preparation inserts at `:120`, after the active guard. This map is private and currently has **no read, approval, status, invalidation, or consumption path**. The facade at `:49` exposes only preparation. M9-02 should look up this same owner-local map inside `make`; never expose the map, accept caller-supplied replacement records, reconstruct contexts from model input, or add a sibling store.

Canonical ingress is decoded with excess-property rejection, copied and recursively frozen before asynchronous policy/semantic waits (`:79–95`). The fingerprint hashes canonical JSON of project/chat, initiator, controller, opaque generation, robot mode, and the entire action (`:111–118`, `:175`). It includes deployment project/build/source/configuration/digest and control field/value/OpMode/expected state. Equal context can have equal fingerprints across different generated operation IDs; approval must compare **both** operation ID and fingerprint. Fingerprints are decision data, not credentials. No meaningful expiry can be inferred from their bytes.

Owner disposal first sets `closed`, clears pending, then closes the owned Scope (`:65–69`). The `owned` helper gives caller cancellation one child wait and joins cleanup through `acquireUseRelease` (`:73–76`). `joinPreparation` locally defers fiber-observer notification to avoid the verified Effect beta.83 mutable-observer-list issue (`:166–172`). Preserve this behavior for approval waits; do not replace it with a superficially simpler join without the held-cleanup regressions. New consent/tombstone state must be cleared before owned waits close. Separate service instances remain independent; no process-global approval singleton or replay storage.

## Smallest sufficient trusted boundary

Add one M9-owned Core-only `approval` consumed port, alongside existing mandatory preparation policy/parameter ports. It needs an atomic event-claim operation and a scoped invalidation feed; a check-only port cannot establish single use, and click validation alone cannot invalidate already accepted consent after a later change.

Suggested conceptual contract (names are recommendations, not existing APIs):

```ts
approval.claim({ userEvent, prepared }): Effect<TrustedDecision, OperationError>
approval.invalidations: scoped stream of trusted exact binding revocations
approval.expiry({ prepared, now }): Effect<deadline, OperationError>
clock.now: Effect<time>
```

The event is an opaque object identity registered by the authenticated narrow user-action adapter. `claim` resolves its own captured facts, validates authenticity, and atomically claims it once. It returns an immutable decision containing the adapter-captured operation ID/fingerprint and kind `deploy`, `approve`, or `reject`; it must not echo input assertions as evidence. The host captures the **displayed** immutable operation before enabling the deliberate action. A plain object, JSON round trip, copied fields, guessed operation ID, matching hash, asserted initiator, or code-approval event cannot become registered consent. A deploy event is valid only for stored action kind `deploy`; a specific approve event binds exactly one stored action, never a group or install-plus-start.

The invalidation feed carries exact owner-known operation ID/fingerprint with a reason, supplied only by trusted binding lifecycle adapters. It carries no execution capability. It revokes pending/accepted bindings on target/project selection, connection generation/disconnect, artifact/source/configuration change, action parameter/state change, or rejection/cancellation as applicable. It must preserve irreversible revocation: switching away and back cannot revive an old consent even when the current fingerprint again matches. An implementation may replace the stream with a narrow scoped callback registration if that matches repository conventions; the contract must still own unregister/join cleanup and make revocation synchronously visible before allowing a late approval commit. Do not expose a public model-callable arbitrary invalidation or approval minting route.

No production invalidation adapter or authenticated event issuer is established by M9-01. These are explicitly supplied ports in isolated M9-02 tests. If dispatch chooses a smaller claim-only port, the brief must state that immediate post-approval invalidation is unimplemented and cannot claim that task assertion; later current-state equality alone misses change-away/change-back. This is an authorization-boundary decision, not permission to invent a producer event source.

Policy supplies a finite deadline in the injected clock's agreed unit/domain. Read the clock when admitting an event and again immediately before approval commit; `now >= deadline` is expired. Validate the supplied deadline and fail closed on absent/malformed/unavailable policy or clock. A required supplied policy avoids a default TTL, UI setting, guessed time constant, or delayed timer. Access-time expiry and scoped clearing suffice here; future execution also checks expiry. No SQL, persistent approval token, database migration, or model-visible bearer field.

## Exact lookup, atomic commit, and invalidation

1. Capture/validate scalar operation ID/fingerprint and opaque event reference before any wait. Check owner active and find the stored immutable preparation. Return a structured missing/context error for absent or mismatched lookup; never redirect to another operation with an equal hash. Unauthenticated bad input must not revoke somebody else's valid approval.
2. Read terminal state. Previously accepted/claimed operation approval rejects another acceptance with `approval_consumed`; rejected, expired, revoked, or cancelled bindings remain terminal for this owner. Do not delete and silently reprepare under the same operation ID.
3. Claim the trusted event and copy/freeze its returned decision before further waits. Compare captured operation ID/fingerprint to the stored pair. Reject untrusted events with `untrusted_approval`; reject authenticated mismatches with `context_changed` and invalidate the event's applicable known binding. No trusted mismatch is retargeted.
4. Apply policy/clock and process the exact decision. `reject` clears consent and leaves a terminal rejection. For `deploy`/specific `approve`, compute no replacement action. Immediately before committing, recheck owner active, the same stored preparation, nonterminal approval state, deadline, and revocation epoch. A short synchronous/uninterruptible compare-and-transition supplies the linearization point; do not hold an uninterruptible mask over external policy/event waits.
5. Store one private accepted-consent record bound to the original preparation and deadline. Mark the event/approval decision used so a repeat approval fails. Return the immutable original descriptor. A failed/cancelled claim must not be retried implicitly. If cancellation happens after the event was claimed but before commit, retire that binding without an accepted consent; a new deliberate action uses a new preparation/event. Cancellation after commit cannot revive or duplicate consent.

Keep event use and future dispatch use distinct. The event is single-use at approval admission. Private consent may be taken exactly once by future M9 execution, after live validation and controller ownership; M9-02 adds no public execute/consume/transport method. Tombstones for terminal decisions may be retained only inside the owner scope so repeat calls give stable errors, and all are cleared on disposal. No cross-restart event re-registration or restoration from outcome history.

## Result/status and required contract assignment

The existing `PreparedOperation` Schema fixes `status` to **`awaiting_approval`** (`ftc-operation.ts:67–75`). The documented status vocabulary has no `approved` literal. Do not quietly label consent `running`, invent success, broaden the enum without a decision, or attach a serializable authorization handle. Recommended minimum: keep this return as the immutable **preparation-time descriptor**, while method success and private consent represent accepted approval. Document that its snapshot status is not the current operation status. M9-05 owns `operationStatus` and execution outcomes. Tests should assert exact binding and replay refusal, not a made-up `approved` state.

Existing `OperationError` lacks the task's mandated `approval_consumed` and `untrusted_approval`, as well as precise missing/rejected/expired/cancelled approval codes. M9-02's task Files list omits Schema, but shared contract conventions require a canonical defined result/error contract when introducing a public method. **Coordinator assignment is needed:** reserve minimal additions to `packages/schema/src/ftc-operation.ts` (no new status or authority schema), exact Core re-export identity, and corresponding focused contract assertions. Do not hide undefined codes behind casts, create a duplicate runtime schema, or modify shared Schema while M12 is its assigned writer. Suggested additional codes are `operation_unknown`, `approval_rejected`, `approval_expired`, and `approval_cancelled`; existing `context_changed`/`owner_closed` cover those failures. Precise code names beyond the two mandated ones need an explicit brief ruling.

Adding `approveOperation` intentionally changes the M9-01 test's exact facade-key assertion (`m9-01.test.ts:78`). Assign that narrow regression update, retaining an exact allowlist and absence of `executeOperation`/transport. This is necessary cleanup, not permission to rework adjacent tests; the prior minor naming issue is separately deferred unless assigned.

## Meaningful RED/GREEN and targeted matrix

This is a future implementation plan; none of these checks ran in this preflight. Write the exact required `Deploy click authorizes only the displayed build and target` test first against real Operations and narrow fixture ports. Preserve `approved.action.artifact.digest === displayedDigest`, reused `approval_consumed`, and forged `untrusted_approval`. Use an importable missing-behavior implementation/scaffold if needed so RED is a behavior failure, not missing import/undefined-method exception; record failing assertion, process exit, and selected test count. Then implement minimal GREEN and expand to the following independently named cases, without copying policy logic into tests or replacing globals.

| Case | Required observation |
| --- | --- |
| Exact Deploy in each robot mode, user or agent preparation | One specific accepted deployment descriptor; no second confirmation wait; no initialize/start action or executable capability. |
| Agent controls and direct-user controls | Observation agent control still rejected by preparation; actions-with-approval receives only specific-action consent. Direct-user preparation alone is not consent. |
| Forged/plain/serialized/copied/code-approval event | `untrusted_approval`, no accepted consent; genuine event remains usable if it was never legitimately claimed. |
| Same fingerprint, different operation IDs/owners | Cannot transfer an event or consent between operations/scopes; different owners cannot resurrect a handle after restart. |
| Changed project/chat/mode/initiator/target/generation | Reject exact mismatch; trusted revocation terminal; no equality-based resurrection after change-away/change-back. |
| Changed build/digest/source/configuration and action kind/OpMode/field/value/state | Bind full stored action; changing one field invalidates; zero/false retain their distinct valid values. No silent artifact substitution. |
| Caller mutates approval envelope or port result during delayed waits | Captured scalars and copied decision survive; no late retargeting or forged expiry. |
| Rejection, expiry boundary, malformed/missing expiry policy | No consent; exact `now == deadline` fails; before deadline may accept; advance clock during claim/policy wait fails at commit; no wall-time sleeps. |
| Two accepts using same event or different genuine events for one operation | Exactly one approval commit, loser consumed; no await between final state check and transition. |
| Reject/revoke versus delayed acceptance | Whichever valid transition linearizes first has defined behavior; a completed revocation/rejection cannot be overwritten by a late accept. |
| Caller cancel during claim/expiry; owner close during either | Await asynchronous resource release; no accepted late commit; used event stays used; other operations/scopes continue. |
| Owner disposal versus concurrent accept completion | Closed state and map clearing precede child cleanup; close waits for held release; post-close calls fail `owner_closed`; no listener/timer/fiber remains. |
| Repeated scope creation/disposal and feed cleanup | Unsubscribe exactly once, join in-flight notification cleanup, no global state or replay registration. Import/construction introduces no mutation/process startup. |
| Return/schema/facade boundary | Original deep-frozen action/fingerprint; canonical errors encode optional omission; only prepare/approve facade; no transport, SQL, coordinator, host bootstrap, or executable handle. |

Run from `packages/core`: `bun test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts`, then the exact existing M9-01 suite plus the new suite. Reuse the pinned Bun/isolated test-home pattern from M9-01, using a new task-specific directory. Run Core `bun typecheck`, and Schema `bun typecheck` if canonical error additions are assigned; scoped lint/format/whitespace, exact facade/schema identity assertions, source hashes, import/port inspection, and frozen review diff. Run affected trust/lifecycle regressions only if changes touch their shared behavior; avoid a blanket suite. Do not claim nonexistent planned boundary files ran.

A zero dispatch counter disconnected from the service is not dispatch evidence. Approval-only evidence is the real facade/port allowlist and inspected absence of execution/transport imports and capabilities. A recording transport belongs to later dispatch tasks, not to this approval service.

## Future M9-04 seam and unrun gates

Approval does not establish current robot state, successful/current APK bytes, controller ownership, or host isolation. M9-03 supplies shared physical-controller leases; **M9-04 must acquire ownership and refresh current project/chat policy, controller identity/generation, action-specific observed state, capability support, artifact currency/digest, pending consent/deadline/revocation, then recheck immediately before the protected transport write**. It must consume only the owner-retained approved context, not the caller's returned descriptor/hash. A changed context fails closed and requires a new deliberate action. M9-05 alone establishes one dispatch, cancellation-before/after-dispatch, durable confirmed/failed/unknown outcomes, and no restart/reconnect replay. A cancellation/stop request never proves robot stop.

Actual user-action issuer/display binding, binding revocation ordering across windows, M2/M3 caller membership composition, M5 successful/current build producer, M8 verified identity/generation/capability producer, real clock-policy configuration, M9-03–06 execution/transport/outcomes, M9-07/08 enforceable host bypass isolation, M9-09 physical robot matrix, and macOS/Windows packaged app checks remain separate **unimplemented/unrun gates**. No supplied approval or revocation fixture is real authorization or physical evidence; AC-10/AC-11 remain unfulfilled by this preflight.

## Decisions needed before dispatch

1. Assign minimal canonical approval-error additions and the M9-01 facade-key regression update alongside the two exact M9-02 files; serialize these against the current Schema writer.
2. Record the opaque atomic event-claim plus scoped binding-revocation port and clock/policy semantics, including cancellation after claim and irreversible change-away/change-back revocation. The production issuer/lifecycle adapter remains explicitly unimplemented.
3. Keep the task's return as the immutable preparation descriptor with private consent, documenting snapshot status; any public approved-state/receipt change needs an explicit contract ruling rather than an invented status.

These are coordinator implementation-contract decisions. They do not authorize product dispatch or actual robot operations, and they do not complete M9-02.
