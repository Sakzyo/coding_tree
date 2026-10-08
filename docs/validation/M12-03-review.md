# M12-03 independent task review — 2026-10-08

## Specification

**Compliant.** Reviewed the complete four-path product diff from `768ec206c` through `012996bac`: product candidate `8f81bc5cc`, followed by an evidence-only correction. The intervening `f3677d94b` coordinator documentation and the package's broad documentation stat are not additional product scope.

- Request identity, immutable capture, and the separate trusted binding are implemented at `packages/core/src/ftc/learning.ts:306–351`. The command is decoded, cloned, recursively frozen before supplied asynchronous work, and its complete returned binding context must match. Canonical Schema identities are exposed at `learning.ts:33–42` and tested at `packages/core/test/ftc/learning-and-progress/m12-03.test.ts:336–342`.
- Declared generic/library-specific applicability and selected track/exact version agreement are checked at `learning.ts:194–211` and `354–381`. Generic SDK records remain usable with explicit installed-library facts. Curriculum facts used with neither remain separate from installed facts: course and lesson validation precede `pathing_required` at `382–397`.
- Explicit requested language, local-only lookup, exact course version, record/document identity, lesson version, unique IDs, and structural-policy reconciliation are preserved at `learning.ts:145–237`. Navigation still requires entry points through its wrapper at `247–253`; exercise requests do not introduce that prerequisite.
- The result binds exact course/lesson versions, project/configuration, SDK and installed-library facts and returns every canonical exercise unchanged at `learning.ts:398–412`. Multi-exercise and true/false/omitted physical policy assertions appear at `m12-03.test.ts:168–293`; source prompt/criteria and no prose-derived requirements at `344–386`. Canonical consumed schemas and encoded omission are covered at `packages/schema/src/ftc-learning.ts:68–117` and `packages/schema/test/ftc-learning.test.ts:29–99`.
- The exercise method has no repository write, progress-award, execution or configuration-mutation call. The owned source import inventory contains no sibling runtime/bootstrap or operations imports (`docs/validation/m12-03/import-boundaries.txt:1–15`). Real-service disposable SQLite assertions check empty attempt/entry/skip tables; supplied-port cleanup and borrowed DB usability are covered at `m12-03.test.ts:649–701`, with suspended finalizer waiting at `703–747`.

**Cannot verify from this diff:** trusted production adapter provenance, real authored M11 autonomous curricula/capstones, real student competence, composed routing, Chinese terminology acceptance, platform/release acceptance, and physical robot correctness. These are expressly separate future gates (`docs/validation/M12-03-brief.md:3,9,23,31`; `M12-03-implementation.md:79–81`). Echoing a synthetic trusted binding and source-labelled fixture records does not authenticate production facts or authorize robot operations.

## Strengths

- Reusing content resolution preserves existing navigation applicability and policy checks without duplicating them; only the entry-point prerequisite is split into the navigation wrapper (`learning.ts:118–253`).
- Boundary mutation tests cover caller input, binding reply, and returned content across actual suspended Effects (`m12-03.test.ts:388–433,572–647`). Producer-owned scoped effects retain cancellation and awaited cleanup without adding a new lifecycle registry (`649–747`).
- Tests exercise the actual service and temporary SQLite rather than copying applicability logic. The nominal constant operation counter at `m12-03.test.ts:153,160` has no observational power by itself; the report accurately identifies source/API boundaries, unchanged configuration and empty tables as the substantive isolated evidence (`M12-03-implementation.md:66`).

## Issues

### Critical

None found.

### Important

None found.

### Minor

None requiring a change in this task.

## Checks and review limits

- Applied the Superpowers SDD task-reviewer template, with a task-scoped spec and quality gate. Read the brief, implementation report, and full product diff; did not crawl the branch or rerun a suite.
- The diff omits intervening lines inside the shared resolver and the remainder of `policy()`. Read `learning.ts:76–245,532–555` to resolve the named risks of navigation entry-point/applicability/policy regression and loss of optional physical policy. The existing checks are retained; policy compares structural flags, not translated prose.
- Checked `M12-03-preflight.md` and `M12-03-resume-reconciliation.md:37–43` for the named risk of confusing declared track literals with supplied canonical content-library facts. The reconciled contract deliberately uses supplied trusted library names; the implementation matches the declared track and exact supplied pair and checks found M11 metadata. No guessed display-name mapping is required.
- Checked the canonical `ftc-knowledge.ts` declarations for the named risk of losing exercise/physical policy: `Exercise` has optional Boolean physical policy, `Lesson` requires nonempty canonical exercises, and entry points remain optional (`32–59`).
- Read retained behavioral RED: `docs/validation/m12-03/red-behavior.log` fails for expected `exercise`, received `pathing_required`, without a broken import or harness. Read final evidence: focused **46 pass / 247 assertions**, covering **129 pass / 724 assertions**, Schema **5 pass / 32 assertions**, clean Core/Schema typechecks, and clean scoped lint/format. Coordinator independently verified the frozen four source hashes and report/driver/TSV manifest; this review did not regenerate those results.
- The evidence-only cleanup is accurately disclosed at `M12-03-implementation.md:64`: product diff check was clean, broad staged evidence whitespace was not clean, and raw diagnostic logs/patch contexts remain verbatim. Controlled TSV/driver cleanup did not change source bytes; no rewriting of raw evidence or source retest is required for that repair.
- No focused probe was needed: no unresolved code doubt remained after the scoped checks. No source, Git/index, branch or shared ledger mutations were made by this reviewer.

## Quality

**Approved.** The change satisfies the isolated M12-03 contract, preserves navigation and producer/borrowed-resource ownership, and has meaningful coverage for identity, applicability, mutation, policy preservation and cancellation. Approval covers the frozen isolated software candidate, with the explicitly unverified production/curriculum/platform/physical gates retained.
