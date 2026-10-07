# M12-02 independent task review

## Spec compliance

- ❌ Issues found: M12 rejects a valid class of public M11 results under explicit library applicability. `packages/core/src/ftc/learning.ts:156` and `:157` impose library equality/range-presence rules that differ from M11's established SDK-wide-content behavior. See Important finding I1.
- ✅ The remaining inspected implementation follows the accepted task boundaries: exact entry levels and canonical results (`packages/schema/src/ftc-learning.ts:48`, `:79`); optional producer metadata with unknown preserved (`packages/schema/src/ftc-knowledge.ts:37`, `:59`); entry/skip navigation without manufactured completion (`packages/core/src/ftc/learning.ts:203`, `:294`); and two personal version-bound tables (`packages/core/src/ftc/learning/sql.ts:27`, `:37`).
- ⚠️ Cannot verify from this diff: production curriculum policy, classroom competence, physical validation, Windows/native UI, and Location composition. These remain explicit later acceptance gates, not defects in this isolated synthetic task (`docs/validation/M12-02-implementation.md:91`). Import-no-I/O behavior is supported by the recorded M12-01 run, not independently rerun here (`docs/validation/m12-02/core-covering-final.log:4`).

## Strengths

- Current course/lesson snapshots are compared before navigation state is accessed, and supplied values are copied at the boundary. Mixed snapshots and delayed external mutation have meaningful regression coverage (`packages/core/src/ftc/learning.ts:185`, `:369`; `packages/core/test/ftc/learning-and-progress/m12-02.test.ts:332`, `:633`).
- Transactions validate existing personal state before upsert, retain attempts, atomically reconcile exact skips, and return each mutation's own state. The module does not claim ownership of the caller's connection (`packages/core/src/ftc/learning/sql.ts:52`, `:79`, `:101`; `packages/core/test/ftc/learning-and-progress/m12-02.test.ts:529`).
- Entry choices, skip policy, multilingual presentation, and absence of completion/award fields are checked through the real service and disposable SQLite, rather than hardcoded completion fixtures (`packages/core/test/ftc/learning-and-progress/m12-02.test.ts:121`, `:155`, `:211`).
- The coordinator's historical-skip ruling is implemented: a changed lesson version retains the course entry and historical rows without inheriting skip credit. The report preserves the genuine failing regression and final passing result (`packages/core/src/ftc/learning.ts:203`; `packages/core/test/ftc/learning-and-progress/m12-02.test.ts:681`; `docs/validation/m12-02/red-lesson-upgrade.log:5`; `docs/validation/m12-02/core-covering-final.log:45`).
- Producer changes are bounded to metadata validation/equality, and the generated migration adds only the two navigation tables. The integration test uses actual predecessor migrations, repeats application, preserves the old attempt/host rows, and reopens (`packages/core/src/ftc/knowledge.ts:269`, `:305`; `packages/core/src/database/migration/20261007065802_ftc-learning-navigation.ts:8`; `packages/core/test/ftc/learning-and-progress/m12-02.test.ts:529`).

## Issues

### Critical

- None found in the inspected task diff.

### Important

- **I1 — Generic SDK courses fail when the caller supplies a library binding.** `packages/core/src/ftc/learning.ts:156` rejects `record.library === undefined` whenever `binding.library` is supplied; `:157` independently rejects the absent record library range. M11 deliberately returns SDK-wide records alongside library-specific results for library-qualified queries, including an unrelated library (`packages/core/test/ftc/ftc-knowledge/m11-02.test.ts:97`–`:115`). Therefore a trusted binding such as `{ courseVersion: "1.0.0", sdkVersion: "11.1.0", library: "Road Runner", libraryVersion: "1.0.0" }` and an otherwise valid SDK-wide course record cannot reach `selectEntry`, `skipLesson`, `nextLesson`, or metadata-aware `progress`; all fail with `invalid_course`. This breaks the requirement to consume the canonical public M11 applicability contract. Apply library-name/version constraints only when the returned record declares library-specific applicability; retain strict rejection of malformed pairs and incompatible library-specific records. Add a focused regression for a generic course under an explicit library binding, plus matching and incompatible library-specific cases. Existing M12 fixtures only use bindings without a library, so their successful runs do not answer this case (`packages/core/test/ftc/learning-and-progress/m12-02.test.ts:69`).

### Minor

- No open minor findings. Historical lint warnings in `docs/validation/m12-02/lint.log:94` are resolved in the final evidence (`docs/validation/m12-02/lint-final.log:1`); expected RED failures and the explicitly labelled GREEN characterization are not unresolved validation noise (`docs/validation/M12-02-implementation.md:52`–`:59`).

## Checks and review limits

- Reviewed the supplied one-task package for base `7dd70f8ae` and head `181f495ee`: all 44 file diffs, in sequential chunks. The first oversized tool output was truncated, so the affected opening/log ranges were recovered in smaller chunks. No changed source file was separately reread, and no Git commands were run.
- Inspected one named outside-diff source risk: M12's new library equality check could conflict with M11's public query semantics. The focused existing test check at `packages/core/test/ftc/ftc-knowledge/m11-02.test.ts:97`–`:115` establishes the contract mismatch in I1. Also read the brief-referenced preflight to confirm the producer/consumer boundary (`docs/validation/M12-02-preflight.md:32`).
- Read recorded final evidence: Core/M11 134 passing tests and 644 assertions (`docs/validation/m12-02/core-covering-final.log:149`); Schema 10 passing tests and 39 assertions (`docs/validation/m12-02/schema-covering-final.log:19`); both package typechecks, migration consistency check, scoped lint/format/diff exits 0 (`docs/validation/m12-02/verification.tsv:2`–`:9`). The driver sets pinned Bun and all task-owned XDG roots (`docs/validation/m12-02/verify.sh:5`–`:10`). These are inspected implementation evidence, not reviewer reruns.
- No tests, probes, services, providers, applications, robot calls, network operations, installations, or broad crawls were performed. I1 follows directly from the changed conditional and the existing public contract; a probe was unnecessary. No product, generated, index, Git, or ledger file was modified; this report is the sole output.

## Assessment

**Task quality: Needs fixes.**

The task otherwise has strong storage, version-history, and content-boundary coverage. Correct the applicability mismatch in I1 before accepting M12-02; its current passing tests cover neither generic nor library-specific courses with a supplied library binding.

## Fix round 1 scoped re-review — `181f495ee` → `088310368`

- **Spec compliance: ✅ Approved within the accepted isolated-task scope. I1 ADDRESSED.** The repaired conditional now accepts records with neither library field, rejects partially declared library metadata, and applies library identity/version/range checks only to library-specific records (`packages/core/src/ftc/learning.ts:156`–`:162`). This resolves the public M11 applicability mismatch without changing the SDK checks or introducing a default binding.
- **Task quality: Approved.** No new Critical or Important breakage found in the repair. The production change is confined to the applicability conditional; the regression uses the real service and disposable SQLite through all four affected commands (`packages/core/test/ftc/learning-and-progress/m12-02.test.ts:721`, `:752`). Positive cases preserve course/version/language and navigation state with no manufactured attempts. Negative cases exercise mismatched library, incompatible version, invalid range, and each incomplete metadata pair, requiring typed failures and empty personal/attempt tables.
- **Evidence inspected:** the pre-fix regression records four `invalid_course` failures in the generic-course case, followed by seven passing focused cases and 64 assertions (`docs/validation/m12-02/fix1-red.log:13`; `docs/validation/m12-02/fix1-green.log:4`–`:16`). The final covering run records 141 passes, zero failures and 708 assertions; Core typecheck and scoped lint/format/diff checks exit zero (`docs/validation/m12-02/fix1-core-covering.log:156`; `docs/validation/m12-02/fix1-verification.tsv:2`–`:6`). The initial test-only type narrowing diagnostic is resolved by the final result, not an outstanding issue (`docs/validation/m12-02/fix1-core-typecheck.log:1`).
- **Review scope:** read the appended implementation report and supplied repair diff, recovering a truncated log range with a bounded second read. No broader review, outside-source checks, successful-suite repetitions, probes, Git commands, subagents, or product/index/ledger changes were performed. This appended report is the sole output. Prior production curriculum, classroom, physical, platform/UI, and composition limitations still apply (`docs/validation/M12-02-implementation.md:91`).
