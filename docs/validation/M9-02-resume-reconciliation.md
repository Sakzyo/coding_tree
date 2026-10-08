# M9-02 resume reconciliation — approval only

Date: 2026-10-08. Investigator: `/root/m9_02_prepare`. Read HEAD: `00a6067ccd4aaa341a951ccc1d81d5c1acd0efef`; reviewed prerequisite M9-01: `768ec206c`. This is read-only preparation for the coordinator's future exact brief, not an implementation dispatch, actual consent, passing test result, or task completion. M1 remains the sole product writer during this preparation. Only this report was written; no product/test, index, ledger, commit, app, M5 implementation, provider, host, toolchain, or robot operation was changed or started. No subagents or tests/typechecks were run.

Read [prior preflight](M9-02-preflight.md), the M9-01 [exact brief](M9-01-brief.md), [implementation evidence](M9-01-implementation.md), and [approved review](M9-01-review.md); the exact [M9-02 task](../tasks/robot-approvals-and-operations.md#m9-02), [requirements](../proposal.md) ROB-02–07 and AC-10/11, [design](../high-level-design.md) sections 3, 5, 7, 8, 10, [execution prompt](../prompt.md), [shared rules](../tasks/progress.md#contract-conventions), root/Schema instructions, and only the stable Operations/operation Schema/M9-01 test sources. The memory registry query for this task returned no relevant entry; no memory facts inform this ruling.

## Stable prerequisite and source-backed boundary

Current source hashes match the prior preflight's Operations/Schema hashes, and the M9-01 test remains the approved preparation test:

| Source | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/operations.ts` | `090da2676b7ba2298867467004e3cb8a0debf7046b35ec23661a4a6590441bb7` |
| `packages/schema/src/ftc-operation.ts` | `1c2e66f286fced3c1ed251c2f326b96c5fe07af78a990b6168b41a8f18eb4ae5` |
| `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` | `ae346562f8068fbf3be72c074e00290bdd8f8ac9bfb3d2615d347f4a67108a41` |

Read-only commands from `/Users/dylanxu/coding_tree`: `git rev-parse HEAD`, `shasum -a 256` over the three sources above, and bounded `cat`, `sed`, `nl`, and `rg` source reads. The HEAD lookup and hash command exited 0. No baseline rerun was needed for this source-only assignment. The prior **66 focused tests / 194 assertions** and **125 combined tests / 453 assertions** are M9-01's recorded evidence, not fresh results here.

The current service owns one private `pending` map (`operations.ts:63`) and has only `prepareOperation` (`:49`). Only accepted immutable preparation enters that map after the final active guard (`:110–120`). Canonical request copy/freeze precedes external waits (`:79–95`); the fingerprint binds the full project/chat/initiator/controller/generation/mode/action context but excludes operation ID (`:111–118`, `:175`). Both operation ID and fingerprint are required for approval. Different operation IDs can have equal fingerprints.

Disposal sets closed and clears contexts before closing the owned Scope (`:65–69`). Caller cancellation owns one child wait and joins resource release (`:73–76`). Preserve the beta.83-safe deferred observer join (`:166–172`) and its held-cleanup regressions. Extending that helper's use to approval is sufficient; no sibling lifecycle import or new global registry is needed.

`PreparedOperation.status` is fixed to `awaiting_approval` (`ftc-operation.ts:67–75`), and the documented Status vocabulary has no approved literal. The return stays the original immutable preparation-time descriptor. Method success means private consent was accepted at its linearization point; the snapshot cannot promise that consent remains valid later. It carries no bearer token, expiry capability, mutable approval field, or new Status literal. M9-05 owns public current status/outcomes.

Source requirements already settle these points: deliberate Deploy authorizes the displayed project/build/target without a second confirmation; installation never includes initialization/start; code/layout/inference approval grants no robot authority; observation still blocks agent controls at preparation; context changes, rejection, restart, expiry, and consumption must invalidate consent. M9-04/05 separately own live revalidation, protected dispatch, dispatch consumption and durable outcomes. These are not unresolved product decisions.

## Minimal consumed approval boundary recommended for the exact brief

Keep `Ports.policy` and `Ports.parameters` unchanged. Add **optional** Core-only `Ports.approval` so existing preparation-only `Operations.make({ policy, parameters })` and layer constructors remain valid. Its absence allows preparation and makes `approveOperation` fail with `approval_unavailable`; it must not silently mint a consent or start a production issuer. The facade always exposes exactly prepare/approve once M9-02 exists, whether the optional port is supplied or absent.

Prefer the following narrow conceptual signatures. These are coordinator recommendations, not APIs that already exist:

```ts
interface ApprovalDecision {
  readonly operationID: FtcOperation.OperationID
  readonly contextFingerprint: string
  readonly decision: "deploy" | "approve" | "reject"
}

interface ApprovalRevocation {
  readonly operationID: FtcOperation.OperationID
  readonly contextFingerprint: string
  readonly reason: "context_changed" | "approval_rejected"
}

interface ApprovalPorts {
  readonly claim: (userEvent: object) => ApprovalDecision | FtcOperation.OperationError
  readonly observe: (
    revoke: (input: ApprovalRevocation) => void,
  ) => Effect.Effect<void, never, Scope.Scope>
  readonly now: Effect.Effect<number, FtcOperation.OperationError>
  readonly deadline: (input: {
    readonly prepared: FtcOperation.PreparedOperation
    readonly claimedAt: number
  }) => Effect.Effect<number, FtcOperation.OperationError>
}
```

The private decision/revocation types are Core-only consumed records, not Schema authorization payloads. The clock values share the injected port's documented comparison domain/unit; they are not asserted to be wall timestamps, milliseconds, generation numbers, or producer protocol facts. Validate finite clock/deadline values; accept only `now < deadline`, expire at equality. Policy supplies the entire deadline; no default TTL, guessed offset, system clock fallback, guessed timeout, timer, or product setting. Missing/unavailable/malformed clock or policy fails approval closed as `approval_unavailable`. `deadline <= claimedAt` is already expired, never extended automatically.

`claim` resolves an opaque object identity registered by a trusted user-action adapter and atomically claims that event exactly once. It returns the adapter-captured operation ID, fingerprint and deliberate action kind; it does not receive a caller-asserted target to echo as authority. Passing a plain/copied/serialized object, guessed operation ID/hash, code-approval object, or a handle from another owner cannot create registration. Events must be owner-bound by the supplied adapter instance; a registry shared across owners must explicitly bind owner identity rather than treating the fingerprint as authority. M9-02 does not invent or implement a production event issuer.

**Make this claim synchronous and non-throwing at its expected domain boundary.** Calling it, copying/validating the returned decision, and recording the owner-local claimed state happen with no yield between them. The narrow adapter returns structured canonical errors. This is smaller and safer than an asynchronous claim which consumes an event before returning: if cancellation falls in that hidden interval, Operations cannot know which binding to retire. Such an asynchronous issuer would require an explicit synchronous claim-notification/ownership handshake and cancellation contract; it cannot be substituted under this signature. No broad uninterruptible mask covers clock, expiry, registration, or release waits.

`observe` registers the callback in the owned operations Scope and supplies scoped unregister/held cleanup. Its notifications synchronously make exact revocation visible in Operations before producer completion; asynchronous cleanup is a separate lifetime. This is an M9-owned consumed boundary, not an invented M5/M8 stream protocol. Its never-error signature means a supplied adapter must establish the scoped registration; an unavailable adapter is represented by the omitted approval port. If the actual future adapter needs fallible registration, explicitly revise readiness handling so preparation stays usable while approval is unavailable; do not silently discard listener failures. A stream replacing this callback must prove equivalent delivery ordering and joined cleanup before acceptance.

The callback receives trusted exact owner-known binding revocations. It is not a public/model-callable `invalidateOperation`, minting function, or execution capability. Retain the first invalidation irreversibly; changing away and back never restores consent. The owner may ignore unknown exact pairs; a notification with a mismatched fingerprint cannot retarget or revoke a different stored preparation. A callback after the closed flag is set does nothing and cannot reinsert cleared state. Events spanning a scope restart are unregistered/invalid in the new adapter instance.

## Canonical public request/error additions and assigned paths

Shared conventions require the first public method's request/result/error contracts. Assign the minimal Schema additions despite the original task Files list omitting Schema:

- Add canonical `FtcOperation.ApprovalRequest` with only `operationID` and `contextFingerprint`, reusing `PreparedOperation.fields` for the exact field definitions. Add a same-name readonly interface and stable identifier `FtcOperation.ApprovalRequest`.
- Core re-exports that exact value. Its method accepts `FtcOperation.ApprovalRequest & { readonly userEvent: object }` and returns `Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError>`.
- The serializable Schema request intentionally excludes `userEvent`: the opaque capability is a separate Core-only argument member. Neither `Schema.Unknown`, JSON secrets nor an encoded event ID become an authenticated host input. A future Protocol/host route must supply that member through the narrow authenticated adapter.
- Extend existing canonical `OperationError.code` with mandated `approval_consumed`, `untrusted_approval` and recommended `approval_unavailable`, `operation_unknown`, `approval_rejected`, `approval_expired`, `approval_cancelled`. Reuse `invalid_operation_input`, `context_changed`, `owner_closed`; do not duplicate errors or cast undefined codes into the union. Preserve optional omission and exact facade identity.
- Change only the existing exact facade-key assertion in `m9-01.test.ts:78` to allow `prepareOperation` and `approveOperation`; preserve its no-execute assertion. Existing constructors/fixtures require no dummy approval adapter. The deferred test-label diagnostic issue stays outside this task.

Recommended sole-writer product paths: `packages/core/src/ftc/operations.ts`, `packages/schema/src/ftc-operation.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts`, plus that one M9-01 assertion. Existing Schema namespace export already exposes canonical additions; no barrel, Protocol/Server/client generation, manifest, database, SQL, host, app, build, transport or producer changes are needed. Serialize Schema ownership before dispatch.

## Atomic transitions, cancellation and concurrent decisions

Operate on the existing stored preparation; callers never submit a replacement action. Capture canonical approval request scalars and the opaque event reference before any wait. Reject malformed/excess data and missing port before using authority. Owner closure always fails `owner_closed`; absent stored operation fails `operation_unknown`; a caller fingerprint mismatch fails `context_changed` without revoking another binding merely from an untrusted assertion.

Private approval bookkeeping distinguishes waiting/claimed/accepted/retired without modifying public Status. A map entry or a small private record adjacent to the existing map is sufficient; no durable store, global singleton, public consent accessor, sibling store, process startup or timer. Each attempt keeps a local indication of a legitimately claimed matching event for its cancellation finalizer. Do not hold a per-operation mutex across external waits: it would prevent a trusted rejection/revocation from retiring a delayed acceptance.

1. Inspect the stored pair and irreversible tombstone. An accepted decision cannot be accepted again, and a previously claimed acceptance reserves that operation while expiry waits run. A read of the injected clock may lazily expire an existing accepted deadline before returning a repeat error; no wall-time timer is necessary.
2. For a pending operation, read the injected clock interruptibly, then recheck active/exact pending state after that wait. Perform synchronous `claim`, snapshot and validate its result and exact pair, and immediately retain its private claimed state. `claimedAt` is this pre-claim injected reading, not an asserted physical/user/robot timestamp; a stale reading never extends the supplied deadline. Claim errors never create consent or tombstone an unrelated caller-selected operation. An authenticated mismatched event is consumed but never retargeted; retire its original exact binding only when it is owner-known. Return `context_changed` for that mismatch. A deploy decision must match a deploy action; approve covers exactly one stored action; reject never grants consent.
3. Call injected deadline policy for an accepted kind, and perform all external waits interruptibly. Reject has no accepted-consent deadline to mint and retires the binding immediately. Re-read clock after policy waits. Validate all values and recheck the same preparation, owner active, claimed reservation, deadline and revocation state immediately before commit.
4. A short synchronous/uninterruptible compare-and-transition is the consent linearization point. There is no await between the final state/deadline guard and inserting private accepted consent. Store only the original binding and deadline; return the exact stored immutable descriptor.
5. Interruption/failure after a legitimate matching claim and before commit leaves no accepted consent and irreversibly retires that claim. Caller interruption remains an interrupted Effect, not a synthetic successful error result; a later call can observe `approval_cancelled`. The event remains used. Owner disposal supersedes local bookkeeping by setting closed and clearing pending/consent/tombstones before joining owned cleanup.
6. After commit, caller cancellation cannot duplicate/revive consent and executes nothing. An already committed consent remains subject to trusted revocation/expiry; the return snapshot does not change. M9-05 will define cancellation around actual dispatch.

Two accepts, whether sharing an event or using two genuine events for one operation, have at most one commit; the other observes `approval_consumed`. An unused losing event need not be consumed by Core when the operation is already reserved/accepted. This distinction preserves event single-use versus operation single-consent. An authentic rejection supplied through the trusted invalidation callback can retire claimed or accepted consent immediately, including after a prior success return. A reject user event before acceptance does the same. If the implementation accepts reject events after acceptance through `approveOperation`, it must authenticate/claim that event and retire accepted consent rather than taking the acceptance-only consumed fast path; the simpler required route is the trusted rejection notification. No second acceptance can overwrite rejection/revocation.

Recommended brief ruling: the first irreversible retire reason wins; owner closure has precedence over all local repeat errors, revocation/rejection/expiry/cancellation tombstones are checked before a new claim, and a valid unretired claimed/accepted binding produces `approval_consumed` on repeat acceptance. This diagnostic precedence is an implementation choice, not a source-defined error ordering. Forged input on a pending valid binding returns `untrusted_approval`; a closed/retired binding may report its prior lifecycle error without claiming the supplied object.

## What this approve-only task can actually observe

| Requirement | M9-02 observation and limit |
| --- | --- |
| Changed target/generation/artifact/parameters, including change-away/change-back | Exact trusted revocation reaches the synchronous callback, clears private consent and leaves an irreversible tombstone; a later approve attempt observes `context_changed`. Mutating the returned frozen snapshot or comparing only final equality is not evidence. Producer selection/source/change delivery is still an unimplemented composition gate. |
| Changed asserted request fingerprint | Mismatching lookup rejects without retargeting. This alone proves mismatch rejection, not observation of the real target/artifact changing. |
| Rejection | Trusted reject decision or exact rejection notification leaves no usable private consent; a delayed acceptance loses. A forged object cannot revoke another valid binding. |
| Restart | Owner close clears all authorization state; a fresh owner/adapter cannot approve an old handle/ID/hash. This establishes process-local non-restoration, not durable interrupted-running recovery, which belongs to M9-05. |
| Expiry | Before/equal/after injected deadline at admission and final commit, plus clock advance while policy waits, are directly observable. Later repeated approve can lazily retire an accepted deadline. There is no public `operationStatus`/consent read or execution check yet; future dispatch must recheck time. |
| Consumption | Success followed by another approval attempt rejects, and concurrent calls cannot both commit. This is approval/event consumption; there is no dispatch take/consume or mutation in M9-02. |
| Cancellation after event claimed | Synchronous claim followed immediately by private reservation makes the boundary observable; a held deadline/clock resource lets the test interrupt after claim, await release and prove no late acceptance. The same event cannot be retried. |
| Owner retirement | Closed/cleared state is visible before held caller/subscription cleanup completes. Scope close joins the cleanup; independent owners remain usable. |
| No extra confirmation/no start | The genuine deploy event succeeds without invoking another user-action request. Real facade/port allowlist and inspected imports contain no execution/transport/initialize/start capability. A disconnected constant dispatch counter is not evidence. |

Private accepted state has no direct public accessor. Approval-only tests may observe retirement via repeat calls with known bindings and may observe supplied claim/observer cleanup directly; they must not add a public testing backdoor or claim dispatch protection from a recording transport that the service cannot access.

## Required future behavior and held-cleanup tests

Write the exact task test `Deploy click authorizes only the displayed build and target` against real Operations and narrow supplied ports. Preserve the displayed digest, reused `approval_consumed`, forged `untrusted_approval` assertions. Meaningful RED must fail an intended behavior assertion, not a missing import/method exception or empty selection. No RED/GREEN was performed in this report.

The minimal covering cases are:

- Exact Deploy in each mode and initiator; no second confirmation; install descriptor cannot approve an initialize/start sibling. Specific agent control approval only for preparation-eligible actions; direct-user declaration alone grants no consent.
- Plain/copied/serialized/code-approval events; same hash with different operation IDs; separate owners; malformed/excess approval request; absent approval port; immutable request envelope/result under delayed clock/policy waits; caller data cannot choose a deadline or action.
- All context/action fields remain fingerprint-bound, including build/source/configuration/digest, OpMode, expected state, tuning field/value with valid zero/false. Trusted exact change notifications before claim, during expiry wait, and after success; change-away/change-back remains retired. Unknown/mismatched notifications cannot retarget another operation.
- Trusted rejection before claim/during delayed accept/after acceptance via callback; delayed accept never overwrites rejection. Forged rejection does not retire a pending valid binding. Pin repeat-error precedence as the brief rules it.
- Injected before/equal/after deadline; clock advances while deadline waits; malformed/unavailable policy and clock; no fallback TTL or wall sleep. Accepted consent later expires on a repeat check. Policy receives the frozen original preparation.
- Same-event and different-event concurrent accepts; exactly one success and consumed loser; unrelated operations and owners progress while one approval waits. A failed or cancelled legitimately claimed event never silently retries.
- Caller interrupt while deadline or clock resource release is deliberately held: prove interruption has not finished until release, the binding is retired, later completion cannot approve, and other operations remain usable. The synchronous claim has no asynchronous wait to hold; do not invent one in fixtures.
- Owner close while deadline/clock cleanup is held: post-close calls fail immediately, close itself remains pending until release, cleared state cannot be reinserted, and independent owner succeeds. Retain the existing observer-safe join and preparation held-cleanup tests.
- Owner close while revocation-subscription release is held; callback delivery immediately preceding close/commit; unsubscribe exactly once; repeated fresh scopes show no global registrations/timers/fibers. The producer must finish notification only after synchronous revocation becomes visible.
- Canonical ApprovalRequest identity/identifier, optional OperationError omission, no opaque userEvent in Schema, immutable original return/status, exact two-method facade and no execution/transport/SQL/host imports.

For a future dispatched writer, from `packages/core` run the exact new suite, then the named M9-01 and M9-02 suites together. Run Core and Schema `bun typecheck` from their package directories, scoped lint/format/whitespace, canonical identity assertions and source hashes. Use the pinned Bun 1.3.14 path and a fresh task-specific isolated test home from M9-01's evidence; do not reuse a producer's live state. Expand to existing affected trust/lifecycle regressions only if the shared implementation changes justify it. No blanket suite, sibling startup or production authority is required for isolated M9-02.

## Coordinator decisions and separate gates

The proposed exact brief can resolve minimal signatures, the optional-approval constructor behavior, the serializable request projection plus Core-only event, the seven additional error codes, the one facade assertion, synchronous claim/notification ordering, injected clock domain/deadline and private retirement precedence. These are routine source-preserving implementation choices for the coordinator; they do not require product scope expansion or actual-user approval. The report is ready for review before adoption.

One scope point must be explicit: source M9-02 says rejection invalidates but does not prescribe a public rejection method. The recommended trusted rejection notification supplies the mandatory behavior even after consent acceptance. A `reject` event accepted through the same method is useful before acceptance, but supporting that event after acceptance is optional only if the notification route is mandatory and tested. Do not leave both post-acceptance rejection routes absent. A claim-only port without trusted revocation is insufficient for the task's change/rejection assertion.

No actual authenticated displayed-action issuer, cross-window revocation adapter, producer event ordering, real clock policy configuration, M2/M3 membership composition, M5 successful/current artifact freshness/provenance, M8 verified identity/generation/capability producer, controller ownership, or transport is established here. M9-04 must acquire M9-03 ownership and refresh current project/chat/action policy, controller/generation, observed preconditions/capabilities, artifact currency/digest and private consent/deadline/revocation immediately before the protected write. M9-05 must consume once, retain confirmed/failed/unknown outcomes and prohibit restart/reconnect replay. No public descriptor/fingerprint can substitute for that owner-held consent.

M9-07/08 enforceable command/build/extension/dashboard isolation, M9-09 physical USB/Wi-Fi controllers, macOS/Windows packaged hosts/releases, real toolchain/provider/credential/model checks, and AC-10/AC-11 remain separate unimplemented/unrun gates. This preparation changes no checklist, module/task count, user consent, robot state or production exposure.
