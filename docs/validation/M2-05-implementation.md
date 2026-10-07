# M2-05 — Exact ownership settlement and stop cleanup

**DONE_WITH_CONCERNS candidate, frozen for independent review.** Worker `/root/m2_05`; assigned reviewed source checkpoint `9bcb23ce6`. Coordinator owns Git, ledger and checklists. Only `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/gate.ts`, the assigned test and this task's evidence were written. Final source/test identities are in [SHA256SUMS](m2-05/SHA256SUMS). No Schema behavior or public Protocol/HttpApi changed.

## Approved ownership contract

Before dependent production coding, the coordinator approved separate exact admission and execution claims, authoritative real-gate `held(lease)`, deferred terminal notifications during bounded registration, and waiting for pending handoffs before stop/scope interruption. The worker read the M2-04 and repaired M3-02 reports and the actual public contracts. Existing project-only layers and the existing submission facet retain their interfaces.

`FtcProjects.lifecycle({gate, execution})` constructs a scoped lifecycle facet. Construct it after its injected real gate in an owning scope, so lifecycle cleanup runs before that gate's scope invalidates its claims. Its interfaces are:

- `acquire(chat)` delegates canonical membership/root arbitration to M2's real gate and registers the returned distinct execution lease. A busy result is unchanged. Cancellation or facade closure before registration compensates only the unused exact claim.
- `handoff({chat,receipt,lease})` consumes the reservation already acquired by `submitter` through the real gate. It validates an actually held exact lease, chat/Session agreement and the admission receipt's Session. It snapshots the lease/chat, registers pending responsibility, and calls injected `execution.wake` while masked against submitting-fiber interruption. Duplicate registration of a token is rejected. Successful wake return retains responsibility; it does not release ownership.
- Injected `execution.wake` is the bounded registration/scheduling port, with the exact canonical handoff input. Its inherited `Submission.handoff` contract requires failure/defect to leave no accepted responsibility or scheduled wake. It must later arrange an explicit `settled(admissionLease)` notification after the applicable full terminal chain, including terminal no-work/rejection/cancellation without execution acquisition. It must not wait for model execution during handoff.
- `settled(lease)` requires the complete project key/chat/Session/token tuple. It releases only that registered claim. A notification during pending registration records terminal intent and defers release until registration completes. Unknown, malformed, mismatched, repeated and stale callbacks cannot release a newer claim. M3's exact execution finalizer supplies `settled(executionLease)` separately.
- `stopRun({chat})` waits for already-pending bounded registrations, resolves the current canonical owner, and interrupts only a matching active chat through the supplied Session interruption port. Idle and different-chat stops do nothing. Interruption return does not manufacture admission terminality; all claims remain until their exact notifications certify settled cleanup.
- Scope disposal closes admission/acquisition, waits pending registrations, interrupts each remaining owned Session once, waits cleanup, and then releases residual exact claims. Delayed acquisitions that finish after closure release their own unused token. Late callbacks cannot affect a fresh owner.

The token is the generation identity; there is no chat-wide generation counter, release-on-acquire transition or blanket same-chat release. Admission reservations bridge execution completion even if durable admission is still pending. Admission and execution each retain independent tokens until their own applicable terminal notifications. No Session repository, runner, loop, provider orchestration, global registry, process or subscription was added.

## Behavioral RED, GREEN and mutation evidence

The first tests were written before behavior. Minimal exported-facet scaffolding forwarded gate acquisition, bounded wake and interruption, with a deliberately unimplemented settlement notification. [Initial RED](m2-05/red.log) reached the real gate and failed `afterCleanup.kind`: expected `acquired`, received `busy`. All three initial cases failed on unreleased real ownership, not missing exports/imports: **0 pass, 3 fail, 10 assertions**, exit 1.

The additional lifecycle baseline demonstrated idle interruption, interruption before bounded registration completed, and independent claim settlement. Its first run retained a test-fixture timeout: an assertion threw while a masked handoff still awaited its controlled Deferred. The fixture now captures observations, completes controlled waits, then asserts. [Repaired lifecycle RED](m2-05/lifecycle-red-repaired.log) is **0 pass, 3 fail, 7 assertions**, exit 1, all behavioral assertions. The earlier [diagnostic log](m2-05/lifecycle-red.log) is preserved but its timeout is not counted as product evidence. Final controlled-wait cases use the same cleanup-safe observation pattern.

After minimal implementation, [initial GREEN](m2-05/green-initial.log) passed 8 tests / 31 assertions. Additional cases cover cancellation, malformed identity, disposal and delayed acquisition; these are expanded coverage, not claimed as historical RED for every case. Initial Core types passed. Initial scoped lint found two new return-consistency warnings, repaired with explicit Effect returns; final lint has none.

The [pending-terminal mutation](m2-05/pending-terminal-mutation.log) temporarily removed only the pending-registration guard from actual `settled`. The final controlled race then failed expected `busy`, received `acquired`: **0 pass, 1 fail, 1 assertion**, exit 1. Original production source was restored in `finally` before final verification. This demonstrates sensitivity to premature release; it is mutation evidence, not additional historical TDD chronology.

## Assertion map

All cases use actual M2 lifecycle code and the real gate. Test fixture Project/Location/chat records are controlled immutable domain inputs, not filesystem alias/canonicalization measurements. The external admission/registration/interrupt ports and cleanup boundaries are controlled Effects/Deferreds. M2-04's real durable Session/SQLite tests remain in the affected suite; this new file does not duplicate or access Session storage.

| Requirement | Final test and observation |
| --- | --- |
| Stop retains ownership during cleanup; stale completion preserves new owner | `m2-05.test.ts:49`: captured during-cleanup result is busy, exact completion after interruption cleanup permits acquired successor, old callback leaves active successor and `held(newLease)` true. |
| Pending handoff cannot unlock its protected wake | Line 84: an exact terminal callback during delayed registration leaves competing chat busy; registration completion applies the deferred terminal notification. Mutation proves this assertion catches early release. |
| Admission races older execution settlement | Line 114: durable-admission port delayed after reservation; old execution settles, competing chat stays busy; admission completes with a distinct token; old callback still cannot unlock it; exact admission terminal no-work notification finally releases it without execution acquisition. |
| Idle/different-chat stop and independent project | Line 159: interruption array remains empty for idle and other-chat stop; another canonical root acquires concurrently. |
| Stop/registration race | Line 182: no interruption during delayed registration; exact matching Session is interrupted after acceptance; gate stays busy during cleanup and after interrupt return until exact admission terminal notification. |
| Independent claims and exact notification tuple | Line 233: two admission tokens plus execution token are distinct; execution and one admission settlement leave the second admission live; repeated/mismatched callbacks cannot free it. |
| Failure compensation | Line 261: failed handoff leaves the separate execution claim held; after its exact settlement, competing chat can acquire. |
| Scope/registration race | Line 281: closure does not interrupt or release while registration is pending; after registration, one matching Session interruption and residual settlement free ownership. |
| Submitting cancellation | Line 318: cancellation during masked registration waits for acceptance; accepted token survives interruption until its exact callback. |
| Lease authority | Line 359: fabricated/mismatched/released leases reject without scheduling; unrelated valid reservation remains held. |
| Acquisition/closure race | Line 390: delayed acquisition finishing after lifecycle closure fails and releases only its newly unused token. |
| Pending acquisition cancellation | Line 417: no acquired claim or terminal release is fabricated; another chat can acquire. |
| Authoritative held query | Line 440: full project/chat/Session/token identity is required; released token is no longer held. |
| Registration defect plus pending terminal | Line 456: competing chat remains busy until registration defect settles; compensation frees only that reservation. |
| Scope retains owner during cleanup | Line 489: competing chat stays busy, new lifecycle acquisition rejects closed, and cleanup completion releases residual execution/admission claims; old callback cannot affect a fresh raw-gate owner. |

The excerpt's stale-token requirement is represented by `held(newLease) === true` plus active ChatRef equality. `activeChat` intentionally exposes ChatRef without a token, and reacquisition always allocates a new distinct claim. The authoritative held query verifies the actual newer token survives, without adding token enumeration or asserting a token derived from the same expected value.

## Commands and final results

Pinned Bun `1.3.14 (0d9b296a)` at `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`. All Core test/type commands used this exact environment prefix:

```sh
env PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH \
OPENCODE_TEST_HOME=/private/tmp/ftc-m2-05/home \
XDG_DATA_HOME=/private/tmp/ftc-m2-05/data \
XDG_CONFIG_HOME=/private/tmp/ftc-m2-05/config \
XDG_CACHE_HOME=/private/tmp/ftc-m2-05/cache \
XDG_STATE_HOME=/private/tmp/ftc-m2-05/state
```

Scoped tools used the same pinned PATH. No user app/server was restarted. Test/type commands ran from package directories. Evidence log redirection is relative to the stated cwd.

| Command | Cwd | Exit/result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/projects-and-chats/m2-05.test.ts` baseline | `packages/core` | 1; 0 pass, 3 fail, 10 assertions | [RED](m2-05/red.log) |
| Same file with `--test-name-pattern 'idle\|stop waits\|same-chat'` baseline | `packages/core` | 1; 0 pass, 3 fail, 7 assertions | [Repaired lifecycle RED](m2-05/lifecycle-red-repaired.log) |
| Same file with `--test-name-pattern 'terminal notification waits'`, mutated guard | `packages/core` | 1; 0 pass, 1 fail, 1 assertion; source restored | [Mutation](m2-05/pending-terminal-mutation.log) |
| `bun test ./test/ftc/projects-and-chats/m2-05.test.ts` final | `packages/core` | 0; **15 pass, 0 fail, 59 assertions** | [Focused final](m2-05/focused-final.log) |
| `bun test ./test/ftc/projects-and-chats/m2-01.test.ts ./test/ftc/projects-and-chats/m2-02.test.ts ./test/ftc/projects-and-chats/m2-03.test.ts ./test/ftc/projects-and-chats/m2-04.test.ts ./test/ftc/projects-and-chats/m2-05.test.ts ./test/ftc/agent-and-context/m3-02.test.ts ./test/session-prompt.test.ts ./test/session-run-coordinator.test.ts` | `packages/core` | 0; **136 pass, 0 fail, 484 assertions** | [Affected final](m2-05/affected-final.log) |
| `bun typecheck` | `packages/core` | 0 | [Final types](m2-05/core-typecheck-final.log) |
| `bunx --no-install oxlint packages/core/src/ftc/projects.ts packages/core/src/ftc/projects/gate.ts packages/core/test/ftc/projects-and-chats/m2-05.test.ts` | repository | 0; 0 warnings, 0 errors | [Final lint](m2-05/lint-final.log) |
| `bunx --no-install prettier --check` with those same three paths | repository | 0 | [Final formatting](m2-05/format-final.log) |
| `shasum -a 256` with those same three paths | repository | 0; frozen exact candidate | [SHA256SUMS](m2-05/SHA256SUMS) |

No Schema source changed, so no new Schema contract test or Schema typecheck was required. Existing canonical GateLease/GateError contracts are reused without duplicating schema identities. No Protocol/Server/legacy SDK surface changed, so regeneration does not apply. The worker performed no Git commands or ledger/checklist changes; coordinator scoped Git review/diff checks and independent review remain outstanding.

## Remaining composed and release gates

**M3 currently emits exact execution-terminal callbacks only; it does not emit admission-terminal callbacks.** This task's passing evidence is valid for explicitly supplied exact admission/execution notifications. M2-06 must provide a module/domain-owned lifecycle adapter that associates each reservation with actual coordinator chains and covers terminal no-work/rejection/cancellation, admission-during-terminal-release, pending wake/successor and stop/disposal races. This behavior is substantive domain logic and cannot be hidden in composition as mere wiring or inferred from wake return. If the actual integration needs a further M3 public lifecycle seam, its assigned integration owner must design, implement and verify it before enabling FTC execution.

The facade does not certify terminality on behalf of that adapter or release a reservation merely because an older execution lease settled. An adapter that omits an admission callback intentionally leaves its reservation held; this is visible protected ownership, not proof of working production scheduling.

No actual composed host, Server/desktop UI, real provider/tool/approval cleanup, production platform enablement, packaged macOS/Windows, performance acceptance, offline inference, robot or crash-recovery integration was run here. Existing reviewed M3/renderer benchmark evidence is retained and not repeated for this isolated M2 change. Durable rows are not deleted on submission failure, and no post-crash provider replay was added. No broad unrelated suites were rerun.
