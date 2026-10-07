# M2-06 integration preflight

Source-only investigation by `/root/m2_06_preflight`, 2026-10-07, starting source `e4d498ca0adcbf8842c4cabb4da8ccb80818a0be`. No product, index, Git, task ledger or checklist changes; no test suite, build, host restart, provider, credential, model, robot or network process. This document is an ownership/contract recommendation, not implementation or passing integration evidence.

## Recommendation and enablement boundary

Implement a small **M2-owned reservation adapter** over a new generic M3/coordinator terminal-notification seam. Keep exact admission reservations until their applicable complete coordinator ownership chain settles. Bind one process-wide gate and execution coordinator in each actual application host, and expose association/chat APIs plus controlled-runtime composition tests. Production managed FTC prompt/model/tool execution must remain explicitly disabled until real M9 enforcement and its required evidence exist.

Do not substitute `panelsPolicy`, an `enabled: true` flag, successful gate tests, or a caller-supplied boolean for that authority. [M9-07-implementation.md](M9-07-implementation.md) explicitly records unrestricted generic Bash and an unused disabled policy; [robot-action-isolation.md](robot-action-isolation.md) lists the unresolved real OS/broker/extension/dashboard/build/controller gates. A concurrency gate cannot establish action isolation. Association APIs may be reviewable now; claiming an executable FTC production workflow is blocked.

Prefer an explicit **disabled host binding** with a stable typed unavailable reason for managed execution commands, alongside a separately constructed factory exercised only with controlled runner/model/tool ports in tests. Refuse a disabled managed prompt before durable admission, including `resume:false`; otherwise its saved input could become runnable later. Preserve read-only associations/history and safe stop cleanup. A future production binding must supply the actual proven execution boundary, not just flip a flag. Do not provide a live production runner to the test factory by default.

## Inspected contract and source

- Exact task: `docs/tasks/projects-and-chats.md:174–199`; required behavior includes real M2/M3 prompt/resume/wake/stop races, independent histories/reopen, no restart replay and Client generation.
- Global constraints and ownership: `docs/tasks/progress.md:55–92`; `docs/high-level-design.md:142–174,230–260`. Module owners define public ports/data; composition contains binding only, never membership policy, claim maps, approval rules or another loop.
- Reviewed prerequisite reports: [M2-04](M2-04-implementation.md), [M2-05](M2-05-implementation.md), [M3-02](M3-02-implementation.md), and historical [M3 gate preflight](M3-gate-preflight.md). The old preflight's statement that coordinator has no acquisition hook is superseded by current M3-02 source. Its missing admission-terminal observation remains relevant.
- `packages/core/src/ftc/projects.ts:42–75`: submitter acquires first, refuses busy before admission, uses canonical `SessionV2.prompt(...resume:false)`, then transfers exact reservation responsibility through bounded masked handoff. Admit-only releases its unused claim. Admission failure must never delete already committed Session data.
- `packages/core/src/ftc/projects.ts:77–213`: lifecycle tracks admission/execution claims separately. `settled` checks the exact full lease and defers terminal intent during pending registration. Stop/disposal wait pending registration before interrupt; interruption return alone does not settle an admission.
- `packages/core/src/ftc/agent/gate.ts:18–35` and `session/execution/local.ts:21–60`: local execution resolves stored placement, obtains a distinct execution claim, and releases that claim when its ownership scope closes. Managed resolution failure cannot fall back to unmanaged. `unmanaged` is an explicit compatibility binding only.
- `packages/core/src/session.ts:360–385`: raw prompt admits before advisory wake. `resume:false` suppresses only wake. `session/runner/llm.ts:392–414` can consume eligible input in an already active runner; therefore admit-only is not a draft store.
- `session/runner/llm.ts:187–200,241`: preserve promotion/allowance boundaries, reloaded history and one explicit provider stream per turn. The adapter needs no runner-loop change.

## Smallest missing terminal seam

Add a generic, bounded tracked-wake registration to `SessionRunCoordinator` and expose it through a narrow public M3 local-execution capability. One workable shape is `wakeWithSettlement(sessionID, onSettled): Effect<void>` where the callback captures the **exact admission lease** in the M2-owned adapter. Preserve existing untracked advisory `wake`, explicit `resume`, active snapshot and interrupt signatures where possible. The callback is runtime-only; no Schema callback, serialized drain ID, per-Session layer, durable drain record, Session table access, or polling/subscription bus is needed.

The M2 adapter's handoff registers `() => lifecycle.settled(admissionLease)` through this seam. It must be registered atomically with selecting/scheduling the relevant chain, before a drain can finish. M3's existing gate release remains `lifecycle.settled(executionLease)` and never guesses which admission tokens to release. A mere wrapper around `wake`, a `resume` waiter, a per-drain finalizer, or “release all claims for Session” cannot prove correct mapping.

Coordinator-owned runtime chain state should retain terminal callbacks independently of whether acquisition succeeded. The following distinctions are required by actual `packages/core/src/session/run-coordinator.ts`:

| Current boundary | Required tracked-wake behavior |
| --- | --- |
| Idle start, lines 140–142 | Attach callback before starting owner; one callback for each accepted registration, including repeated exact prompt retries with distinct reservation tokens. |
| Running/coalescing, lines 82–85 | Attach to the current ownership chain; success with pending wake reuses it. Do not settle on each successful drain. |
| Failure/interruption with pending successor, lines 88–94 | Transfer callbacks with the inherited ownership scope. Old `entry.done` settlement is not ownership-chain terminality. |
| Entry starts asynchronous scope close, lines 97–113 | Mark the chain as settling **before** closing it. A wake arriving during release belongs to a distinct successor chain/bucket, not the closing chain's callbacks. Old callback delivery must not release that newer admission token. Current `pendingWake` alone does not express this distinction. |
| Interrupt, lines 145–151 | Existing pending wakes are cleared; accepted callbacks still require terminal notification after cleanup. New wake during interruption may create an inherited successor before close, or a fresh chain once close started; use the same boundary above. |
| Acquisition rejects/fails/is interrupted | Deliver terminal callbacks even if no execution lease was acquired. Otherwise M2 holds its accepted reservation forever. |
| Advisory no-work | Local execution may acquire and the real runner may immediately return at `llm.ts:398`; settle normally, with no forced provider turn. |
| Coordinator already closed, lines 133–134 | Tracked registration must explicitly settle without scheduling, or reject before acceptance with a documented typed outcome. Silent no-op is insufficient for a held reservation. Prefer terminal no-work notification to preserve advisory behavior. |
| Scope shutdown | Disable successors before owner interruption, close execution resources, then settle all accepted current and queued-successor callbacks, including callbacks whose successor will never start. No callback or claim may be stranded. |

Callback delivery must be exact-once logically (M2 remains idempotent defensively), masked during cleanup, and cover defects as well as typed failures. Do not await provider completion inside registration. A rejected/defective registration must leave no accepted callback or scheduled wake; after atomic acceptance, later terminal failure is delivered by the callback rather than reclassified as registration rejection. Define callback cleanup failure handling explicitly so one defective notification cannot strand the remaining notifications or mutate another chain. Internal object identity is sufficient; no public/durable drain identity is needed.

M2 lifecycle construction and M3 execution construction currently reference one another through ports. Resolve that at a scoped factory with explicit public capabilities and narrowly delayed method closures, or a two-phase bind with no work possible before binding; never install a temporary unmanaged/noop execution service. Construct gate before lifecycle and ensure lifecycle shutdown completes before gate disposal. Tests must establish actual finalizer order and coordinator shutdown behavior, not infer it from declarations.

## Canonical membership lookup

Current `FtcProjects.Interface` (`projects.ts:245–259`) exposes lookup by association Project ID and chat listing only. Local execution receives Session ID plus stored `Location.Ref`, and the host cannot derive the association ID from `session.projectID`: SQL stores distinct `project_id` and `host_project_id` (`projects/sql.ts:14–30`). Reading M2 tables from M3 or composition violates ownership.

Add an M2-owned public resolution operation, such as `resolveSession({sessionID, location})`, returning an immutable managed/unmanaged membership value or canonical domain error. Add narrow repository lookups by canonical root and by Session as needed in `projects/sql.ts`; no migration is necessary for those existing unique keys. The resolver must:

- Canonicalize path aliases through the owner-supplied filesystem identity port; validate actual stored Session identity/placement against the association and membership.
- Return unmanaged only when the actual canonical root is not associated. A managed root without this Session's membership (including a raw newly created Session) fails closed. A recorded member with mismatched placement also fails closed.
- Preserve repository/unavailable/canonicalization failures as rejection, not unmanaged fallback; a raw root string, copied manifest, or host Project ID is not membership authority.
- Avoid scanning every project's chats in composition. M2 owns query/validation/error translation. The serializable result/errors belong in `packages/schema/src/ftc-project.ts` if newly public; current `ChatError` requires `projectID`, so failures before an association is found need an honest contract rather than a fabricated ID.

No production FolderIdentity adapter currently exists under `packages/core/src/ftc`: M2-01's realpath implementation is a test fixture (`test/ftc/projects-and-chats/m2-01.test.ts:24`). Reserve a narrow M2-owned adapter file (for example `ftc/projects/adapters.ts`) that resolves filesystem identity/access and uses the public `ProjectV2.resolve`/Location conventions without rewriting team files or calling `Project.commit`. Do not bury canonicalization policy in `composition.ts`.

## Entry paths and actual hosts

| Entry | Required handling |
| --- | --- |
| New FTC submit API | M2 public submission facet: validate membership, enforce disabled binding or reserve before admission, then tracked handoff. Never accept caller-provided GateLease as authority. |
| Raw V2 `session.prompt` | `packages/server/src/handlers/session.ts:140–170` directly calls raw admission today; Protocol at `groups/session.ts:205–221` declares only NotFound/Conflict errors. Resolve managed membership before admission, including `resume:false`. Minimal safe policy is reject managed callers with a typed error directing them to FTC submit; routing through the M2 facet is a viable alternative but needs busy-result/error mapping while preserving canonical receipt success. This is a contract choice to approve. |
| Core V2 explicit resume | `session.ts:426–429` → execution.resume → coordinator.run. No public HTTP resume endpoint exists in the current V2 Session group. Keep actual execution gated and disabled for managed roots; any new FTC explicit resume command must use this public runtime path. |
| Raw/internal advisory wake | `session.ts:382`, M2 lifecycle handoff at `projects.ts:181`, and public `SessionExecution.wake` all reach the same local coordinator. Bind the actual managed resolver in every host, not only the new FTC endpoint. Admission handoffs require tracked registration; raw wakes still require normal gate/disabled resolution. No automatic retry after gate rejection. |
| Raw V2 interrupt | `handlers/session.ts:366–368` → `session.ts:430–432` currently interrupts directly. Route managed stops through M2 lifecycle so pending handoffs are awaited and ownership is verified. Preserve unmanaged idle no-op behavior. |
| Direct Core Session prompt capability | Current production source search finds canonical admission callers in the Server handler and M2 submitter. Keep raw canonical admission a deliberately internal capability supplied to M2; do not claim a guarded HTTP handler also enforces arbitrary new in-process consumers. If public Core callers must be covered, reserve a narrow public admission-routing port/facade separation rather than recursively calling a decorated `prompt`. |
| Raw Session creation | V2 `session.create` can create an unassociated Session in a managed root. Membership resolution must reject its subsequent execution/admission; raw creation cannot create a bypass by labeling it unmanaged. |
| Existing legacy Session routes | `packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts` has `cancel:233`, `init → command:243`, `summarize → loop:291`, `prompt`, `promptAsync → prompt:316`, `command:337`, `shell:346`. These use legacy SessionPrompt rather than V2 execution. Reject managed-root operations at a domain-owned guard, or keep the host unable to expose managed FTC execution. Their presence is an explicit production integration blocker, not evidence they share the V2 gate. |

Two actual V2 host registrations must be reserved:

1. `packages/server/src/routes.ts:26–61` builds SessionV2 and installs the current unmanaged `SessionExecutionLocal.node`. `packages/sdk-next/src/opencode.ts:23` uses `createEmbeddedRoutes`, so it inherits this path.
2. **Additional host missed by the older preflight:** `packages/opencode/src/server/routes/instance/httpapi/server.ts:177–178,299–302` mounts Server handlers and independently builds SessionV2 with `SessionExecutionLocal.node` and a host Location map. The standard OpenCode server uses this host. Editing only standalone Server routes leaves it unchanged.

`packages/opencode/src/effect/app-runtime.ts` primarily supplies legacy services and is not sufficient evidence for either V2 binding. Desktop source chooses sidecar version at `packages/desktop/src/main/index.ts:64`; this preflight did not run or infer the user's actual sidecar. Do not claim desktop-wide execution coverage until the selected host and legacy routes are tested.

One gate per request/window/Location would be wrong. Keep a shared gate/lifecycle/execution graph in the host scope, with existing Location-scoped Session runner/model/tool services. Also test multiple windows using the same host; separately constructed embedded hosts are separate process-local scopes, so do not claim cross-host mutual exclusion without an explicit shared host owner.

## Ownership additions before dispatch

The task's five-file list is insufficient for its stated behavior. Reserve the following narrowly, with one product writer and independently reviewable changes:

| Owner | Files/additions |
| --- | --- |
| M2 domain | `core/src/ftc/projects.ts`, `projects/sql.ts`, a small `projects/execution.ts` reservation adapter and `projects/adapters.ts` folder adapter if needed. Existing gate should need no policy expansion. `schema/src/ftc-project.ts` for newly public request/result/error/status records. |
| M3 runtime seam | `core/src/session/run-coordinator.ts`, `session/execution/local.ts`, `session/execution.ts` (or a narrow exported companion capability), focused coordinator/local tests. Change `session.ts` only if choosing to guard public in-process prompt calls; do not alter durable admission semantics or runner LLM loop. |
| Wiring | Planned `core/src/ftc/composition.ts` binds public facades only. Actual host `server/src/routes.ts` **and** `opencode/src/server/routes/instance/httpapi/server.ts`; appropriate existing node/layer construction with no per-Session layers. Legacy handler/guard paths need explicit ownership if exposing managed roots there. |
| API | Planned `protocol/src/groups/ftc-project.ts`, `server/src/handlers/ftc-project.ts`; required registration in `protocol/src/api.ts`, `server/src/handlers.ts`; raw prompt/stop policy in `server/src/handlers/session.ts` and declared errors in `protocol/src/groups/session.ts`/owning Protocol errors as needed. |
| Client | `client/src/contract.ts` owns group name mapping. Run `bun run generate` from `packages/client`; own actual `src/generated` and `src/generated-effect` output, never edit it manually. Legacy HttpApi changes may also require the prescribed legacy SDK generation; assess that explicitly if guarding legacy endpoints changes their public contract. |
| Verification | Planned `core/test/ftc-integration/m2-06.test.ts`; focused M2 resolver/adapter and coordinator tests; Server handler/route-construction tests proving actual registration and refusal, SDK embedded-host coverage where relevant. Own evidence report plus hashes separately from root's ledger. |

Use existing typed event infrastructure if exposing active-owner changes. Currently `ProjectGate` offers a snapshot only and no event stream; the task's “typed commands/events” wording needs an explicit choice between typed command results plus canonical Session events, or new M2 process-local ownership events. Do not invent an application event bus or persist gate state.

## Required composed verification

Use real M2 gate/lifecycle/submission, actual M3 local execution/coordinator and durable Session admission with controlled external ports. No live model, provider key, host restart, toolchain or robot is needed for these claims.

- Concurrent duplicate-window prompts for two chats at one canonical root: one admitted, other busy and absent from durable inbox/history; idle later does not execute the draft. Real aliases contend; a distinct project runs concurrently. Raw V2 and legacy managed entry policy is verified separately.
- Same-chat overlapping submissions, an admission failure and exact retries: independent tokens, one canonical durable row for matching retry, conflicting-ID error preserved. Admit-only never wakes and releases only its reservation.
- Old execution terminal while newer durable admission is delayed; older terminal callback cannot release the newer reservation. Delayed notification repeated after a new owner is harmless.
- Coalesced success and failure/interruption successors inherit the correct chain callbacks. **Wake blocked inside asynchronous execution-release/Scope.close** attaches to a fresh successor; completion of the old scope cannot release its reservation. Also test several wakes on each side of that boundary.
- Missing Session, managed lookup failure, gate acquisition failure/busy, cancellation before acquisition, runner defect and no pending input: accepted admission reservations all settle without requiring an execution lease or provider turn.
- Stop during bounded handoff waits for registration; stop during runner/tool/approval cleanup preserves ownership until settled. Cancellation of a submitter or joining resume caller never prematurely releases accepted ownership or cancels an unrelated owner.
- Scope shutdown during acquire, handoff, pending inherited successor and pending fresh successor; late tracked registration settles without execution. Reconstruct twice with fresh scopes; no stale callbacks, active ownership or automatic durable provider replay. Verify gate/lifecycle/coordinator finalizer order.
- Reopen the real SQLite database: separate chat histories and associations survive; gate active state is empty; model/runner start count remains zero until explicit authorized resume in the controlled runtime.
- Disabled real-host factory: association/create-chat/read operations remain available; every managed prompt/resume/wake path performs zero provider/tool/runner work, and refused prompts have zero new inbox rows. Managed root without membership and resolution errors cannot use compatibility fallback. Test ordinary unmanaged compatibility independently without claiming FTC authorization.
- API registration and generated Client contracts match actual handler success/error shapes. Test host graph construction with controlled services, including the second OpenCode host; no live app start is required.

## Existing evidence and unresolved decisions

Read-only `shasum -a 256 -c docs/validation/m3-02/fix1-SHA256SUMS` matched all six reviewed M3 source/test identities. `git diff 1aa520e9e -- packages/core/src/session.ts packages/core/src/session/runner/llm.ts` was empty. No unchanged tests or benchmarks were rerun.

The M3-02 report's 17 focused passes/100 assertions and 150 covering passes/471 assertions remain historical prerequisite evidence for those matched sources. Its 1000-lifecycle median timings (9.671 ms baseline, 12.821 ms unmanaged, 14.153 ms managed) measured the initial candidate, not the later shutdown repair or this proposed adapter. The report explicitly retained those distributions after the small repair. They do not establish terminal-callback, SQL membership, host-integration, contention, shutdown or renderer performance. The production renderer baseline remains separate. Once coordinator/host paths change, obtain a scoped new comparison if required by applicable performance policy; do not rerun unchanged suites merely during preflight.

Before coding, root should approve these genuine product-contract choices:

1. Raw managed V2 prompt: typed refusal requiring FTC submit (smallest), or transparent routing through M2 with declared busy/error mapping. Managed disabled prompts should be refused before admission either way.
2. Exact public FTC command/event surface: explicit resume endpoint and owner-change events versus existing canonical Session events plus active snapshot. No existing V2 HTTP resume endpoint can be assumed.
3. Actual exposed host scope: standalone/SDK plus OpenCode's composed host, and policy for existing legacy Sessions in a newly associated root. Recommend fail-closed legacy execution for managed roots; do not silently convert legacy histories or route their model loop into V2.
4. Completion wording: a disabled real-host binding plus actual controlled-runtime integration can be reviewed as M2 API/concurrency work, while FTC production execution and broader acceptance remain blocked on M9. Do not mark the module's production/platform acceptance gate complete on fixture evidence.

These decisions do not require permission to run a robot or enable generic Bash; neither is part of this task. The blocking condition is absent proven production action isolation and unresolved public integration ownership, not lack of an isolated gate implementation.
