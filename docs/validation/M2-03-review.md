# M2-03 independent task review

## Spec Compliance

- **Spec verdict: compliant within the isolated task gate.** Reviewed fixed range `a94369c4c..258054ca9` using `.superpowers/sdd/progress/review-a94369c4c..258054ca9.diff`, the binding brief, implementation report, and task-reviewer template. The approved public `getProject` addition is confined to the facade; no repository, migration, Session runtime, host composition, Protocol or generated-client changes appear in this range.
- Canonical-root ownership, contention and independent roots are implemented at `packages/core/src/ftc/projects/gate.ts:80` and exercised by `packages/core/test/ftc/projects-and-chats/m2-03.test.ts:34` and `:53`. The owner lookup/write contains no asynchronous gap.
- Exact membership checking precedes allocation (`packages/core/src/ftc/projects/gate.ts:63`); distinct same-chat claim tokens and token/root/chat/Session-checked release implement the approved contract (`:85`, `:102`). The stale/mismatched-release test starts at `packages/core/test/ftc/projects-and-chats/m2-03.test.ts:88`.
- Construction/disposal owns the map (`packages/core/src/ftc/projects/gate.ts:32`); pending validation cannot resurrect a closed gate (`:81`). Interrupted lookup, bracketed failure/cancellation, independent instances and disposal races are covered at `packages/core/test/ftc/projects-and-chats/m2-03.test.ts:176`, `:196`, `:223` and `:328`. Explicit caller release/transfer responsibility is documented at `packages/core/src/ftc/projects/gate.ts:26`; this review does not reinterpret claims as fiber-lifetime leases.
- Schema owns serializable gate records and Core re-exports their exact identities (`packages/schema/src/ftc-project.ts:66`, `:72`, `:79`, `:86`; `packages/core/test/ftc/projects-and-chats/m2-03.test.ts:289`). The narrow consumed port is explicit at `packages/core/src/ftc/projects/gate.ts:11`.
- **Cannot verify from this task diff:** production sharing across windows/Locations and reservation transfer/terminal release through the complete Session coordinator chain. Root must retain these as M2-04/05, M3-02 and production-composition gates; isolated gate approval establishes none of that behavior (`docs/validation/M2-03-implementation.md:82`, `:83`).
- **Cannot verify from this task diff:** Windows physical canonicalization/case aliases and platform acceptance. Root must retain separate physical-platform evidence; prepared port aliases prove gate keying only (`docs/validation/M2-03-implementation.md:84`).
- **Cannot verify independently from this task diff:** unchanged Schema manifest source equivalence to the archived baseline. The recorded failures match the baseline evidence, and manifest files are absent from the task diff; root must keep the existing failure reconciliation outside this task (`docs/validation/m2-03/schema-tests.log:17`, `docs/validation/m2-03/schema-manifest-baseline.log:9`).

## Strengths

- Small scoped ownership service; no import-time ownership map, I/O, sibling bootstrap or Session-store access (`packages/core/src/ftc/projects/gate.ts:11`, `:30`).
- Input and lease snapshots prevent caller mutation from changing acquired ownership (`packages/core/src/ftc/projects/gate.ts:63`, `:91`), and independent tokens protect a keeper against another same-chat caller's cleanup (`packages/core/test/ftc/projects-and-chats/m2-03.test.ts:196`).
- Recorded behavioral RED evidence reaches the real harness, followed by 18 focused tests/56 assertions and 50 covering tests/169 assertions (`docs/validation/m2-03/red.log:11`, `docs/validation/m2-03/green.log:23`, `docs/validation/m2-03/covering.log:59`).

## Issues

### Critical

- None found.

### Important

- **Duplicate project-placement validation:** `packages/core/src/ftc/projects.ts:96` and `packages/core/src/ftc/projects/gate.ts:44` contain the same six-clause schema/absolute-path/association/directory/workspace predicate verbatim. This establishes two implementations of one validation invariant; a future placement-contract change can update one boundary while leaving the other rejecting valid projects or accepting stale mappings. The task-reviewer rubric explicitly classifies duplicated logic as Important. Extract one small pure validator in the existing module-owned facade and use it at both boundaries, preserving `project_changed` versus `invalid_project` at their current callers and the invalid-port tests. This is a shared invariant, so a reusable helper is justified without introducing a registry or new service.

### Minor

- None found.

## Checks and Assessment

- **Quality verdict: needs fixes** for the duplicated validation invariant above; no functional defect was found in the scoped lease behavior.
- Read the stable review package in bounded chunks because the initial combined tool output was truncated. Initial recovery also displayed the gate source and facade diff; subsequent line references were derived from the fixed review package. No broader source crawl, product edits, index/branch mutations or test reruns were performed.
- Inspected the coordinator's existing combined evidence to resolve the report's transient foreign M11 type error: `docs/validation/parallel-2026-10-06/core-tests.log:211` records 196 pass, 0 fail and 595 assertions; Core and Schema typecheck logs contain only the normal `tsgo --noEmit` invocation. The dispatch confirms exit 0 and source-hash reconciliation; `docs/validation/M2-03-implementation.md:91` records the same resolution. Focused lint and format logs are clean (`docs/validation/m2-03/lint.log:1`, `docs/validation/m2-03/format-check.log:2`).
- This is an independent spec/quality review of M2-03, not a whole-branch merge review or production Session/platform acceptance.

## Fix round 1 re-review

- **Spec verdict: compliant. Quality verdict: approved.** Reviewed only the fix package `.superpowers/sdd/progress/review-f075a4348..32dbfd69b.diff` (`f075a4348..32dbfd69b`) and implementation report's round-1 section (`docs/validation/M2-03-implementation.md:93`). This verdict supersedes the original quality verdict above.
- **Original Important finding: addressed.** One pure `FtcProjects.validProjectContext` now owns all six validation checks (`packages/core/src/ftc/projects.ts:153`), consumed by both the facade (`:95`) and gate (`packages/core/src/ftc/projects/gate.ts:42`). The conjunction preserves the original negated-disjunction behavior and short-circuit order; schema rejection still prevents subsequent property access. Both callers retain their original domain errors. Removing the gate's unused path import is the only adjacent cleanup.
- **New breakage: none found. Open Critical/Important/Minor findings: none.** The helper performs synchronous validation without I/O, new services, state, dependency direction changes or changes to allocation, release or disposal.
- **Verification evidence:** the recorded before and after suites each contain 50 pass, 0 fail and 169 assertions (`docs/validation/m2-03/round1/before.log:59`, `docs/validation/m2-03/round1/after.log:59`). Core and Schema typecheck logs contain the normal invocation only; their exit-0 results are recorded at `docs/validation/M2-03-implementation.md:101`. Lint records zero warnings/errors (`docs/validation/m2-03/round1/lint.log:1`), and formatting passes (`docs/validation/m2-03/round1/format-check.log:2`). Root confirmed four tested source hashes matched. No concrete new doubt warranted rerunning tests.
- **Original Schema-baseline provenance cannot-verify item: resolved by coordinator evidence.** Root confirmed current and archived event-manifest source/test bytes are identical to checkpoint `3d496b0c9`. Existing manifest failures remain an unrelated baseline condition, not a new task finding.
- **Remaining separate gates:** production sharing across windows/Locations, reservation transfer and terminal release through the Session coordinator chain, and physical Windows/platform canonicalization acceptance. This fix neither implements nor verifies those future gates (`docs/validation/M2-03-implementation.md:82`, `:83`, `:84`).
- Only this review report was appended; no product, Git/index, ledger or subagent actions were taken.
