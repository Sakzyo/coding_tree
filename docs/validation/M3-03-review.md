# M3-03 independent task review

**Spec compliance: ❌ Needs fixes.** The assigned plan/direct policy and canonical contracts are implemented, but owner disposal does not clean up pending trusted policy/approval operations (`packages/core/src/ftc/agent.ts:79`, `:91`, `:151`).

**Task quality: Needs fixes.** One Important lifecycle defect; no Critical findings. Review target: `6620d1bc1..118a1ac80`.

## Strengths

- Canonical serializable records remain in Schema, and Core re-exports their exact identities; no sibling implementation import or import-time I/O appears in the changed module (`packages/schema/src/ftc-agent.ts:10`, `:19`; `packages/core/src/ftc/agent.ts:3`, `:10`, `:65`).
- Trusted policy controls mode, and plan approval binds the immutable actual proposal and complete revisions. Pending-plan identity is checked again after the asynchronous approval boundary before consumption (`packages/core/src/ftc/agent.ts:115`, `:141`).
- The opaque instance-local authorization checks every canonical proposal field and refreshes project/root/path/mode policy. Cancellation revokes authorization before interrupting the edit port; producer conflict/partial-failure results propagate unchanged (`packages/core/src/ftc/agent.ts:97`, `:171`, `:206`; `packages/core/test/ftc/agent-and-context/m3-03.test.ts:263`, `:381`, `:433`).
- The report correctly distinguishes controlled ports from production integration and records repaired harness failures instead of crediting them as product failures (`docs/validation/M3-03-implementation.md:40`, `:66`, `:76`).

## Findings

### Critical

None.

### Important — owner disposal leaves pending trusted port operations alive

**Location:** `packages/core/src/ftc/agent.ts:79`, `:91`, `:151`; coverage gap at `packages/core/test/ftc/agent-and-context/m3-03.test.ts:464`.

The finalizer marks the facade closed and closes `applications`, but only `edits.applyEdits` is forked into that scope. Calls awaiting `ports.policy.check` or `ports.approvals.check` still run in their external caller fibers. Closing the owning Scope therefore returns without interrupting those calls or releasing resources acquired by their ports. The later `active()` checks prevent subsequent editing, but cannot clean up an operation that never finishes. The current disposal test starts closure only after entering the edit application, so it misses this boundary.

A focused probe used the real Agent with a policy port implemented as `Effect.acquireUseRelease`, acquiring a resource, signaling a Deferred, and waiting on `Effect.never`. After `Scope.close(owner, Exit.void)`, the acquired resource remained unreleased. Explicitly interrupting the separate caller fiber released it:

```json
{"afterOwnerClose":{"acquired":true,"released":false,"applied":false},"afterExplicitCallerInterrupt":{"acquired":true,"released":true,"applied":false}}
```

Track the full in-flight public operations, including policy and approval waits, under the facade owner, and await their interruption cleanup on disposal. Preserve capability revocation before edit-port cleanup. Add focused disposal tests that suspend inside policy and approval checks and verify release without separately interrupting callers. This is required by the binding scoped-owner cleanup constraint; no unauthorized edit was observed in the probe.

### Minor

None.

## Cannot verify from this diff

- ⚠️ Production host policy/event authenticity, Session/project membership, and enforcement of at most one active chat per canonical project remain composition responsibilities. Code-mode grants alone cannot establish them (`packages/core/src/ftc/agent.ts:18`, `:26`; `docs/validation/M3-03-implementation.md:76`). Verify these when wiring public adapters.
- ⚠️ Preservation of actual dirty buffers, disk races and current revisions depends on the Java producer. The final task tests use controlled edit ports and prove delegation/result preservation, not real filesystem integration (`packages/core/test/ftc/agent-and-context/m3-03.test.ts:99`, `:381`). Existing M5 evidence is separately reported; final M3 production composition remains unverified.
- ⚠️ Local builds belong to the M5/M3-05 adapters; provider, platform, robot, release, and real UI acceptance are not established here. The facade exposes no build/deploy/start/tuning operation (`packages/core/src/ftc/agent.ts:40`; `docs/validation/M3-03-implementation.md:76`).

## Checks performed

- Read the binding brief, implementation report, reviewer instructions, Schema package instructions, and supplied review diff. Production hunks were reviewed from the diff; no separate changed-source reads, Git commands, suite reruns, product edits, or ledger edits were performed. Recovered truncated evidence output from the supplied diff; its embedded historical source snapshot was not treated as an additional candidate.
- Named outside-diff risk: the structural Java authorization bridge might omit canonical proposal fields or mismatch its producer. Checked only the canonical declarations at `packages/schema/src/ftc-java.ts:32`, `:46`, `:85`, the public re-export at `packages/core/src/ftc/java.ts:17`, and the referenced declarations at `packages/core/src/ftc/java/documents.ts:31`, `:66`. The proposal comparison covers the current fields, and the structural port is compatible. This does not establish production wiring.
- Inspected supplied final evidence: 19 Core tests / 87 assertions, 18 affected Session tests / 116 assertions, 24 Schema tests / 66 assertions, clean final typecheck logs, zero final lint warnings/errors, and passing scoped formatting (`docs/validation/m3-03/focused-final.log:24`; `affected-session-regressions.log:25`; `schema-tests-final.log:33`; `core-typecheck-final-cleanup.log:1`; `schema-typecheck-final.log:1`; `lint-final.log:1`; `format-final-cleanup.log:1`, all under the same evidence directory). Historical lint/setup failures have explicit corrections and are not unresolved findings.
- Named focused probe: pending policy resource ownership during owner disposal. Ran once from `packages/core` with `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun -e`, using `OPENCODE_TEST_HOME=/private/tmp/m3-03-review-home` and all four XDG roots (`config`, `data`, `cache`, `state`) under that directory. Exit 0; observed the lifecycle defect above and explicitly interrupted the caller afterward. No probe file was created and no suite was rerun.

## Scoped re-review — fix round 1/5

**I1: ADDRESSED. Spec compliance: ✅ Compliant within the reviewed task scope. Task quality: Approved.** This supersedes the original blocking verdict for I1. Reviewed repair `7d861ea4c..10c34d122`; the coordinator-only documentation commit between the original reviewed head and this repair base does not change the product baseline.

- The new operations Scope owns the asynchronous bodies of `proposeCodeChange`, `approveCodePlan`, and `codeChanges.check`. Owner disposal closes and awaits those operations before the application Scope; the shared wrapper propagates caller cancellation to its operation fiber (`packages/core/src/ftc/agent.ts:67`, `:80`, `:90`, `:129`, `:157`, `:191`). This directly addresses policy/approval resources surviving owner closure.
- Ingress Session/mode/proposal, approval event/plan/revisions, and authorization/proposal capture remain outside the asynchronous ownership boundary. The repair retains the existing immutable proposal checks, atomic plan consumption, and application cleanup that revokes capability before edit-port interruption (`packages/core/src/ftc/agent.ts:109`, `:126`, `:149`, `:185`).
- The four new resource tests suspend at proposal policy, approval event validation, approval policy recheck, and authorization policy. They assert release immediately after owner disposal without separately interrupting callers. The additional delayed-release test verifies disposal waits and escaped calls reject during cleanup (`packages/core/test/ftc/agent-and-context/m3-03.test.ts:485`, `:533`). These are controlled-port lifecycle checks, not production integration acceptance.
- New Critical/Important breakage in the repair: **none found**. New Minor observations: **none**.
- Inspected supplied RED/GREEN evidence: four pre-repair behavioral failures / eight assertions (`docs/validation/m3-03/fix1-red.log:101`), final 24 passed / 110 assertions including the existing cancellation-finalizer regression (`docs/validation/m3-03/fix1-focused-final.log:21`, `:29`), and 18 affected Session tests / 116 assertions (`docs/validation/m3-03/fix1-affected.log:25`). Final scoped lint and formatting are clean (`docs/validation/m3-03/fix1-lint.log:1`; `docs/validation/m3-03/fix1-format-check.log:1`).
- ⚠️ **Core package typecheck is not credited green for this repair.** The supplied run exits 2 with three diagnostics in concurrently owned M2/M6 files, none in the repaired files (`docs/validation/m3-03/fix1-core-types.log:2`, `:4`, `:12`). The coordinator must settle those owners and obtain the required passing package typecheck before final completion. This is a remaining integration gate, not new repair-local breakage.
- The original cannot-verify host, real Java composition, provider/build, platform and robot acceptance items remain unchanged. This scoped re-review adds no production acceptance claim.
- Read the appended implementation report and repair diff; no successful tests were rerun, no new probe or outside-source check was necessary, and no Git/product/index/ledger operation was performed. Only this review report was appended.
