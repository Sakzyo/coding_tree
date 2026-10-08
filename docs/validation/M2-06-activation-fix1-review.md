# M2-06 activation fence — fix round 1 scoped re-review

## Finding Verdicts

- **R1: owner-scope disposal releases shell ownership before actual shell cleanup — ADDRESSED.** `packages/opencode/src/effect/runner.ts:94` introduces one shared `ownedWork` boundary. The accepted sequential lifetime already holds the release finalizer; the repair then registers the resource scope (`:97`) and finally the actual worker fiber (`:99`). Closing that lifetime therefore interrupts/joins the worker, including its automatic child cleanup, before closing resources and releasing ownership. Both normal runs (`:114`) and shells (`:181`) use this boundary, so correctness no longer depends on parent-scope sibling-finalizer order.
- **Caller cancellation and failure propagation preserved.** The outer shell remains a caller child (`packages/opencode/src/effect/runner.ts:183`). Interruption of its restored wait interrupts and awaits the inner worker (`:100`), and `return yield* exit` propagates the worker's actual exit (`:103`), including cleanup defects instead of substituting a plain cancellation result. The retained final run passes both the new caller-cancellation case and existing `cancel does not mask shell defects` case (`docs/validation/m2-06-activation/fix1-regression-opencode.log:20`, `:34`).
- **Exact regression and cleanup ordering verified from source/evidence.** The new owner-disposal test registers `runner.cancel` before accepting a shell, gates cleanup, asserts the disposal remains pending with ownership held, and checks zero claims after cleanup (`packages/opencode/test/effect/runner.test.ts:602`, `:634`). Separate run/shell cases assert the exact order `child`, `resource`, `release` (`:644`, `:693`); caller cancellation (`:699`) and parallel parent disposal (`:738`) also retain claims while their cleanup is blocked. These tests exercise the real Runner with ownership hooks rather than reproducing its admission state machine.

## New Breakage in the Fix Diff

- **Critical / Important: None found.** The two-file repair confines lifecycle changes to a reusable boundary shared by the two execution branches. It preserves the outer run/shell ownership relationships, queued handoff, exact existing release scopes and generic engine policy boundary (`packages/opencode/src/effect/runner.ts:94`, `:114`, `:181`). The final retained regressions pass joined callers, replacement-after-cancel, queued work and shell handoff (`docs/validation/m2-06-activation/fix1-regression-opencode.log:4`).
- **Minor: No new finding.** Scoped lint still reports 31 warnings and zero errors, consistent with the previously established inherited baseline (`docs/validation/m2-06-activation/fix1-lint.log`). The additional worker fiber/resource scope has a measured local cost recorded in the report; neither those samples nor this review establish a production latency budget (`docs/validation/m2-06-activation/fix1-performance.log`, `docs/validation/m2-06-activation/fix1-performance-owned.log`).

## Checks and Evidence

- Reviewed only `4a8005983782eac8220dc7243167356f79636626` → `02d355917935756a356f208841a0f5c3f773e998`, reading the supplied two-file fix diff once and the appended fix report. No Git commands, product edits, source crawl, subagents or test-suite reruns were performed. The existing source/evidence answered the identified lifecycle questions, so no additional probe was needed.
- Inspected the genuine pre-repair RED: expected held ownership 1, received 0 while disposal was pending; exit 1, one failing test (`docs/validation/m2-06-activation/fix1-red-shell-disposal.log:4`). Inspected final GREEN output showing all five added lifetime regressions passing (`docs/validation/m2-06-activation/fix1-regression-opencode.log:31`).
- Inspected the covering final OpenCode result: **211 pass, 2 unchanged projector-disabled skips, 0 fail, 738 assertions** (`docs/validation/m2-06-activation/fix1-regression-opencode.log`). Unlike the earlier 206-test run, this run includes the final HTTP scalar-capture changes and the Runner repair. Earlier failed repair attempts remain debugging evidence, not passing validation.
- Inspected retained M2 composition **13 pass / 75 assertions**, actual AppLayer last-close/cancel/reopen **PASS**, clean package-local OpenCode typecheck, and passing 22-path formatting output (`docs/validation/m2-06-activation/fix1-m2-composition.log`, `docs/validation/m2-06-activation/fix1-actual-host-generation.log`, `docs/validation/m2-06-activation/fix1-types.log`, `docs/validation/m2-06-activation/fix1-format.log`). The appended command ledger records their actual commands, package cwd and exit 0 (`docs/validation/m2-06-activation/commands.jsonl`).
- Root reports independent verification of all 22 frozen source hashes. This reviewer did not duplicate that freeze check or treat unchanged Core/Server/SDK checks as new runs.

## Out-of-Scope Observations

- None newly identified. The original review's downstream limits remain: this local software repair does not establish Windows, packaging/release, real provider performance, external-process/escaped-child containment, M9 action authority or physical robot acceptance (`docs/validation/M2-06-activation-review.md`).

## Verdict

**Fix round: All findings addressed, no new Critical/Important breakage. Quality: Approved.** R1 is closed. Combined with the original 22-path review, this clears the identified software blocker to accepting the bounded current-process I2 activation fence; final task/checklist reconciliation remains with root, and downstream gates remain separate.
