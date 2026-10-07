# M12-02 implementation candidate

Base: `e798d3162`. Scope and rulings: `docs/validation/M12-02-brief.md`; the coordinator accepted the optional explicit course-binding facet during dispatch. This is an implementation candidate awaiting independent review and root commit, not ledger completion.

## Behavior and contracts

- Canonical `FtcLearning.EntryLevel` is exactly `java-beginner | ftc-beginner | experienced`. New canonical request schemas are `SelectEntryRequest`, `SkipLessonRequest`, and `NextLessonRequest`; Core exposes those exact values and `LessonResult` without duplicate identities.
- `selectEntry` resolves current English content and stores only the selected level against the course ID/version. It changes navigation start without touching prior lessons, attempts, evidence or awards. Omitted selection starts at the first supplied lesson and creates no selection row.
- `skipLesson` resolves current English policy and accepts explicit `skippable:true` only. It records a course/lesson-version-bound personal navigation preference. `LessonProgress.status` gains `skipped`, with all existing attempt IDs and attempt records retained. No completion/competence/physical-award field or evidence is synthesized.
- `nextLesson` returns the first non-skipped lesson at/after the selected start. Submitted, failed, cancelled and unknown attempts never advance navigation. Canonical explanation/application requirements and true/false/omitted physical requirements pass through unchanged.
- Result tags: `lesson` includes current course ID/version, requested language and canonical Lesson; `no_next` includes the same binding and means navigation exhaustion only; `unavailable` carries requested course/language and actual missing reason. Missing capability or entry metadata remains explicit. Invalid input, lookup failures, malformed/mixed content, policy denial, malformed stored state and store failures use typed `LearningError` values with stable recovery actions.
- Existing `LessonLookup.lessons({courseID})` and bare Lesson-array attempt-only consumers remain supported. When `course` is absent, progress keeps its M12-01 shape; exact historical attempt retries are checked before current-content lookup.

The optional runtime port is:

```ts
course?: {
  binding(input: { courseID: string }): Effect<{
    courseVersion: string
    sdkVersion: string
    library?: string
    libraryVersion?: string
  }, unknown>
  lookup(input: FtcKnowledge.ContentQuery): Effect<FtcKnowledge.ContentResult, unknown>
}
```

The trusted adapter supplies exact course version and explicit SDK/library applicability. M12 supplies `id`, requested `language` and `localOnly:true`, validates concrete versions and paired library/version values, then consumes canonical `ContentResult`. It selects exactly one matching ID/version/language record and validates record/document identities, local availability, applicability, unique IDs, entry references, ordered lesson IDs/versions and structural policy against the current `lessons` snapshot. Missing reasons are never interpreted as `no_next`. There is no project store, implicit SDK/latest-version selection, M11 runtime import or sibling-store access. Validated ingress and port results are copied before subsequent asynchronous boundaries; outgoing query/binding inputs are frozen.

Commands have no expected-version wire field. They bind content resolved during the call and return that binding; rejecting a stale previously viewed page is a later consumer contract.

## M11 producer extension

Optional canonical document `entryPoints` requires all three fixed keys when supplied; optional lesson `skippable` and exercise `requiresPhysicalValidation` preserve omission as unknown. Existing content remains valid without them. M11 validates entry references and compares presence/value of entry/skip/physical metadata across en/zh, retaining existing uniqueness, identifiers, versions, source/prose and explanation/application requirements. Producer tests invoke M11 independently; M12 module tests consume supplied canonical port fixtures rather than M11 runtime.

No production curriculum/resources/prose/digests were authored. All policy fixtures are explicitly synthetic. Actual production starts/skips/physical requirements and bilingual content review remain the named M11/M12-06/07 composed acceptance gate.

## Personal SQLite ownership and migration

`ftc_learning_entry` has `course_id, course_version, entry_level`, primary key `(course_id, course_version)`. `ftc_learning_skip` has `course_id, course_version, lesson_id, lesson_version`, with all four fields as primary key. There is no project/language/user/profile identity or ownership foreign key. The existing attempt table is unchanged.

Personal reads and mutations run in one transaction. Existing stored rows and attempts are decoded before writes; invalid state cannot be hidden by an upsert. Valid historical skip rows whose lesson ID/version is absent from the current snapshot are retained and ignored for current navigation. This includes a lesson-only upgrade with an unchanged course version: its course-bound entry remains, but the new lesson receives no old skip credit. A changed course version inherits neither entry nor skips. This coordinator ruling distinguishes historical data from malformed stored identities/levels and from mixed current content snapshots; M11 authors still must revise appropriate owning versions for content/policy changes. Entry reselection updates one course-version row, exact skip retries are atomic/idempotent, and returned progress corresponds to the same transaction. Caller retains DB lifecycle ownership; module construction/import starts no DB/application-state I/O.

Root alone generated:

- `packages/core/src/database/migration/20261007065802_ftc-learning-navigation.ts`
- `packages/core/src/database/migration.gen.ts`
- `packages/core/src/database/schema.gen.ts`
- `packages/core/schema.json`

Root's `docs/validation/m12-02/snapshot-delta.json` establishes 11 additions confined to the two new tables and no removals. The implementation worker did not edit generated artifacts or apply migrations to a user database. The separate actual migration test creates a disposable populated predecessor, records an old attempt and host row, applies the generated migration twice, verifies both rows unchanged and the migration tracked once, writes navigation state, closes/reopens, and verifies retained state through the real M12 service. Module-only tests separately create only owned SQLite tables through fixture DDL.

## TDD chronology

1. Wrote M12 focused tests for navigation/skips and the three entry choices before production implementation. Package-local pinned Bun run failed as expected: 0 pass/7 fail, missing `selectEntry`, `skipLesson`, `nextLesson` behavior (`red-core.log`). The synthetic metadata also exceeded the old canonical schema; this was an expected absent producer contract, not missing test dependencies.
2. Wrote optional metadata/schema and paired M11 metadata validator tests before production extension. Both failed on absent optional fields (`red-schema.log`, `red-producer.log`).
3. Added canonical metadata/requests/results, the bounded producer validation extension, explicit course lookup/binding, navigation service and owned tables/repository. Initial GREEN: 9 pass/0 fail, 56 assertions (`green-initial.log`). During this cycle an internal query included optional `undefined` wire properties; removed those properties before strict decoding. No default was added to hide the error.
4. Added edge/persistence/version/cancellation/migration assertions. Expanded GREEN: 20 pass/0 fail, 157 assertions (`expanded-core.log`). Later key-order and mutation boundary characterizations passed without further behavior changes; `red-key-order.log` is the original chronological filename but records a GREEN characterization run (26 pass), not a claimed RED.
5. Coordinator clarified lesson-only upgrades: wrote a targeted regression first, observed `invalid_stored_navigation` (0 pass/1 fail in `red-lesson-upgrade.log`), then changed current-policy validation to ignore non-current lesson/version skip rows. Replaced the superseded old-version-as-corruption assertion with a genuinely malformed whitespace identity. Final reruns cover retained course entry, old attempts/exact retry, no inherited skip, and two retained skip versions.
6. Package type checks identified only worker test annotations/readonly fixture mutation typing, then scoped lint identified unnecessary non-null assertions and an unsafe invalid-input cast. Corrected these local test issues; final clean evidence follows. No unrelated foreign diagnostics were present in final package checks.

An initial shell write used package cwd with repository-relative paths and failed before writing any test source; removed its empty mistakenly created directories. One initial test invocation used Bun `--cwd` and the package script tried a missing PATH Bun; reran from the package cwd with pinned Bun on PATH. Neither is counted as a meaningful RED.

## Verification

Final command ledger and exit codes: `docs/validation/m12-02/verification.tsv`. Final reproducible command driver: `docs/validation/m12-02/verify.sh`. Every runtime/test/check in that driver uses Bun 1.3.14 at `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`, task-owned `OPENCODE_TEST_HOME=/private/tmp/m12-02-home`, and all XDG DATA/CONFIG/CACHE/STATE roots under `/private/tmp/m12-02-*`. Test/typecheck commands run from Core or Schema package directories, never root/raw tsc. Formatter/linter/diff checks operate only on owned paths. Full command output is retained in the log directory.

Final results (all exit 0):

| Check | Result | Log |
| --- | --- | --- |
| Core: M12-01, M12-02, M11 producer/query/content suites | 134 pass, 0 fail; 644 assertions across 6 files | `core-covering-final.log` |
| Schema: learning, course metadata, contract hygiene | 10 pass, 0 fail; 39 assertions across 3 files | `schema-covering-final.log` |
| Core package `bun typecheck` | clean | `core-typecheck-final.log` |
| Schema package `bun typecheck` | clean | `schema-typecheck-final.log` |
| Actual generated migration `bun script/migration.ts --check` | no schema changes; full/incremental consistency passes | `migration-check-final.log` |
| Scoped oxlint | 0 warnings, 0 errors | `lint-final.log` |
| Scoped Prettier check | all nine files pass | `format-check-final.log` |
| Scoped `git diff --check` | clean | `diff-check-final.log` |

No broad unrelated baseline test suite was run, following the dispatch's bounded verification requirement. Initial checks omitted isolated roots on some non-I/O typecheck/Schema invocations; the final reproducible driver sets every required root for every command.

Covered assertions include all entry choices; explicit and unknown skip policy; physical true/false/unknown and mandatory explanation/application preservation; requested en/zh IDs; no attempt-driven advancement; entry/skip/missing/invalid input failures before writes; local availability, duplicate and mixed snapshots; exact skips/concurrent connections; reselection; malformed persisted rows/attempts; read-only failure; cancellation cleanup; immutable ingress/port results; reopen and independent local DB isolation; project-manifest bytes/mtime unchanged; course upgrade and historical exact retry; borrowed DB lifetime; actual tracked migration integration; canonical facade identities/schema omission/serialization/identifiers; and existing M12-01 fresh-process import-no-I/O plus M11 producer coverage.

## Scope and self-review

Worker changed only the nine source/test files listed in `source-sha256.txt` and this report/log directory. Root owns the four generated artifacts included separately in the same manifest. No Git/index/ledger/host/UI/Session/M2/M6/Protocol/barrel/package/lockfile/production-content edits were made by this worker. The exact source/generated hashes are captured after final validation. Independent review and root commit remain pending.

Self-review verified dependency direction and no sibling runtime import in M12; reviewed SQL primary keys, decode-before-write transaction flow, skip/attempt separation, exact historical retry order, current content binding and unavailable-versus-no-next distinction. Schema decoding canonicalizes field order; key-order characterizations confirm equivalent objects are not rejected by structural comparisons. Existing M12-01 behavior is covered without changing its test file.

Limits: isolated synthetic software acceptance only. No classroom competence, production course policy, physical observation/robot action, Windows/native UI/Location composition, exercise evaluator, prerequisite graph, build/deployment authority or later M12 behaviors are claimed. No user database/application/server was opened or restarted.

## Fix round 1 — I1 library applicability (base `181f495ee`)

Status: **I1 addressed; candidate frozen for scoped independent re-review.** Read `docs/validation/M12-02-review.md` and reproduced its SDK-wide-content rejection before changing implementation. This section supersedes the initial implementation's applicability acceptance claim only; earlier history and evidence remain intact.

M11 permits SDK-wide content under a library-qualified query. The repair first checks that a returned record's `library` and `libraryRange` are either both present or both omitted. Library identity, explicit binding version and range compatibility are enforced only for records declaring library-specific applicability. SDK-wide records therefore remain valid under an explicit project library binding. Concrete course/SDK binding, SDK compatibility, record/document version/language, local-only lookup, snapshot reconciliation, personal state and evidence behavior remain intact. Only the applicability conditional in `packages/core/src/ftc/learning.ts` and new regressions in `packages/core/test/ftc/learning-and-progress/m12-02.test.ts` changed.

Meaningful RED→GREEN:

- Before implementation, appended seven focused cases exercising **all four** affected commands (`selectEntry`, `skipLesson`, `nextLesson`, metadata-aware `progress`) against canonical synthetic results and actual disposable owned SQLite tables. The generic SDK-wide case observed four `invalid_course` results where four successes were required. Matching library-specific and five rejection cases already passed. `fix1-red.log`: exit **1**, **6 pass / 1 fail**, 57 assertions; no harness/dependency failure.
- Changed only the applicability conditional. `fix1-green.log`: exit **0**, **7 pass / 0 fail**, 64 assertions. Positive cases cover SDK-wide and matching library-specific records; negative cases cover different library, incompatible version, invalid range, missing range, and missing library identity. Negative cases verify both personal tables and the attempt table remain empty. Positive cases verify course/version/language binding, entry/skip status, and no manufactured attempt.
- Both focused invocations ran from `/Users/dylanxu/coding_tree/packages/core` with the exact command `bun test ./test/ftc/learning-and-progress/m12-02.test.ts -t 'explicit library binding'`. Environment: pinned Bun 1.3.14 directory prepended to `PATH`, `OPENCODE_TEST_HOME=/private/tmp/m12-02-fix1-home`, `XDG_DATA_HOME=/private/tmp/m12-02-fix1-data`, `XDG_CONFIG_HOME=/private/tmp/m12-02-fix1-config`, `XDG_CACHE_HOME=/private/tmp/m12-02-fix1-cache`, `XDG_STATE_HOME=/private/tmp/m12-02-fix1-state`.
- The first covering typecheck found a test-only generic narrowing issue from applying `Result.isSuccess/isFailure` to heterogeneous command results. Retained output: `fix1-core-typecheck-initial.log`. Replaced those predicates with discriminating `success`/`failure` property checks; no production changes or casts were needed. Final checks below supersede that failure.

Final covering checks use the same isolated roots and pinned Bun. Exact commands/cwds/exits are in `docs/validation/m12-02/fix1-verification.tsv`; reproducible driver is `fix1-verify.sh`:

| Command | Cwd | Exit / result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/learning-and-progress/m12-01.test.ts ./test/ftc/learning-and-progress/m12-02.test.ts ./test/ftc/ftc-knowledge` | `packages/core` | **0; 141 pass, 0 fail; 708 assertions, 6 files** | `fix1-core-covering.log` |
| `bun typecheck` | `packages/core` | **0; clean** | `fix1-core-typecheck.log` |
| Scoped `oxlint` on the two changed source/test files | repository root | **0; 0 warnings, 0 errors** | `fix1-lint.log` |
| Scoped `prettier --check` on those two files | repository root | **0; clean** | `fix1-format.log` |
| Scoped `git diff --check` on those two files | repository root | **0; clean** | `fix1-diff-check.log` |

The covering selection includes existing M11 query applicability (`m11-02.test.ts`), producer metadata (`course-metadata.test.ts`), M11 validation/content, M12-01 and all M12-02 regressions, including actual migration/reopen and import-no-I/O coverage. Schema, SQL and generated artifacts were not changed, so standalone Schema typechecks/tests and generator consistency checks were not redundantly rerun. No foreign lane diagnostics appeared in final Core typecheck.

Self-review: a record with neither library field takes only the SDK applicability branch; a partial pair fails before any write; a complete pair requires the matching bound library and a satisfying explicit version. Verified the repair adds no new API/default, modifies no content policy or persistence schema, and cannot convert missing content into navigation exhaustion. No open fix-round concerns beyond the pre-existing named production/native/physical acceptance gates.

Frozen repair SHA-256 (`fix1-source-sha256.txt`):

- `packages/core/src/ftc/learning.ts`: `33d6c3d3d8f6ae7a769355fb95f33ef99f3f1382a05dcb38fae2b4878f171884`
- `packages/core/test/ftc/learning-and-progress/m12-02.test.ts`: `e482c9d700d7615b313eadd6caf436fd2755a0407ec1b55551b6a17d811b7fca`

This repair leaves prior initial-freeze artifacts historical; `fix1-report-freeze.sha256` identifies the appended report, repair manifest and verification ledger. Root retains commit/staging/ledger authority; this worker performed no Git/index/ledger or other source mutations.
