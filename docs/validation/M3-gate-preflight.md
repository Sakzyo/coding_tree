# Session gate integration preflight

Read-only investigator: `/root/m3_gate_preflight`, 2026-10-06. Source inspection only; no edits, tests, app/network/robot processes. Coordinator separately inspected the identified Server registration and coordinator implementation. M2-02 was the sole product writer and its changing files were excluded.

## Verified entry points

| Boundary | Source and behavior |
| --- | --- |
| Admission | `packages/core/src/session.ts:360`: validate Session, resolve prompt, default steer, admit/reconcile input, compare equivalence, then wake unless resume:false. Receipt is `packages/schema/src/session-input.ts:15`. |
| Retry | `session/input.ts:41,191`: existing record plus Session/prompt/delivery equivalence. `test/session-prompt.test.ts:272` covers changing an exact retry from resume:false to true without another row. |
| Resume/stop | `session.ts:425`: process-global execution delegation. Interrupt needs no Session lookup. |
| Placement | `session/execution/local.ts:16`: one coordinator per execution service; every drain reads SessionStore then resolves Location services from stored placement. |
| Runner | `session/runner/llm.ts:187,200,241,286`: promotion/allowance reset, history reload, stream, and tool/interruption settlement. |
| V2 registration | `packages/server/src/routes.ts:26,52` composes SessionV2 and installs SessionExecutionLocal. Planned `packages/opencode/src/effect/app-runtime.ts:58` currently composes legacy Session/SessionPrompt. Wiring only that legacy file would not cover V2 Server execution. |

## Ownership lifetime and contract gaps

`session/run-coordinator.ts:17,51–100` owns entries containing done, owner fiber, pendingWake and stopping. Concurrent resumes join; wakes coalesce. Success with a pending wake starts another drain on the same entry without settling waiters. Failure/interruption with a new pending wake replaces the entry, then settles old waiters. Interrupt clears the prior pending wake and awaits cleanup; a new wake during cleanup may schedule a successor. Canceling a joining caller does not cancel the owner.

The current coordinator option is only drain(key, force). Neither it nor Execution publishes lease-bearing terminal-settlement notifications. Releasing in a runner's per-drain finalizer would not track the full ownership chain. Existing tests at `test/session-run-coordinator.test.ts:141,247,285,321,351` cover these transitions.

Execution resume currently returns void/RunError, and advisory wake is error-free void (`session/execution.ts:9–17`). RunError has no busy variant (`session/runner/index.ts:11–17`). M3-02 must explicitly define blocked resume and wake outcomes; a GateResult cannot silently replace the existing API. Resolve Session-to-chat identity through M2 membership and explicit Location mapping, never by comparing M2 association ID with the host Project ID.

Planned acquired/busy results do not alone distinguish an unused admission reservation from an existing active same-chat lease. M2-03/04/05 and M3-02 must agree on ownership lifecycle before composing it. Token equality alone does not make rollback safe for concurrent same-chat admissions. This is an observed contract gap; the preflight does not prescribe an extra loop or a final implementation.

## Races that require coverage

- One same-chat admission fails while another admission/drain uses its project ownership: release only the failed call's unused reservation.
- An old drain settles between a same-chat reservation and that admission's wake: no second chat may slip in or strand admitted work.
- Idle resume:false admits without scheduling a settlement callback: release an unused reservation and require gate acquisition on later execution.
- resume:false suppresses wake only (`session.ts:382`); an already-active runner can promote that input (`session/runner/llm.ts:396–413`). It is not a rejected-draft store. Reject a different busy chat before durable admission.
- Stale completion/stop callbacks and wakes during interruption cleanup cannot release a newer owner.
- Restart restores associations/history without acquiring ownership or waking. Existing replay coverage (`test/session-prompt.test.ts:403`) schedules no execution. Advisory wake without pending input does not force provider work; explicit resume does. No automatic crash replay.

## Coordinator path reservations

- M3-02: planned local execution/runner files, plus `packages/core/src/session/run-coordinator.ts` and its test for lifecycle hooks; `packages/core/src/session/execution.ts` if blocked-outcome typing requires it. These additions require explicit dispatch ownership and focused regressions.
- Gate records remain owned canonically by M2 in `packages/schema/src/ftc-project.ts`; M3 consumes those records in its narrow port. Serialize any extension.
- M2-04/05: serialize projects.ts and projects/gate.ts, with explicit reservation/settlement semantics.
- M2-06: explicitly assign actual V2 `packages/server/src/routes.ts`, plus existing Protocol API/Server handlers registrations and planned composition/group/handler files. Treat app-runtime.ts according to its actual role, not as proof of V2 wiring.
- Public Protocol/HttpApi changes regenerate Client through `bun run generate` in packages/client, with one assigned writer.

Current runner tests replace Execution with a controlled coordinator (`test/session-runner.test.ts:240`); those passing suites alone cannot prove production placement lookup or composed gate wiring. M3-01 may reuse invariant coverage but later M3-02/M2-06 must exercise their real integration paths.
