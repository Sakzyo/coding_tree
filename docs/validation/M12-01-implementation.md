# M12-01 implementation candidate

Base: `1dd9f1ba3`. Task: persist current local-user progress with project-linked attempts. Coordinator owns Git, the Schema root barrel, and generated migration/schema/snapshot/registry artifacts. This worker owns only the five source/test files listed below and this evidence directory.

## Contract and scope

`recordAttempt(Attempt)` records immutable `(courseID, lessonID, lessonVersion, attemptID)` identity, canonical `Project.ID`, configuration revision, explanation, outcome (`submitted`, `failed`, `cancelled`, `unknown`), and typed evidence with source/timestamp plus explicit owner-reference revision or student-observation provenance. Producer labels are recorded data; M12 does not authenticate them or award competence.

`progress({ courseID })` derives current-version `not_started`/`recorded` lesson state from one module-owned `ftc_learning_attempt` table and an injected canonical `FtcKnowledge.Lesson[]` lookup. Progress carries stable identifiers, versions, attempt IDs and full historical attempts. It has no language/display copy, profile identity, completion flag, exercise execution or project-manifest operation. An exact historical retry reconciles before current lesson lookup; a conflicting payload fails without rewriting provenance. Newly submitted unknown lessons/versions reject. Updating content leaves prior-version attempts visible and the new version `not_started` until an attempt for that version is recorded.

Migration `20261007052343_ftc-learning-progress` was generated exclusively by the coordinator with the existing inspected `bun script/migration.ts --name ftc-learning-progress` lifecycle. Its snapshot delta adds only the table, nine columns and composite primary key (11 added records; none removed). SQL has no foreign ownership references or sibling-table writes.

## Verification state

Source candidate frozen in `m12-01/source-hashes.sha256`. The import-only RED led to `layer(lookup, db)` with a type-only `EffectSQLiteDatabase` infrastructure dependency: caller composition acquires/disposes Database.Service externally; learning does no connection disposal or bootstrap import. Current focused, covering, both package types, contract, lint, format and migration-drift checks pass. An intervening Schema typecheck exposed three active foreign M5 test diagnostics; no M12 diagnostics. After M5 reported those tests stable, the settled Schema typecheck exited 0 in `m12-01/schema-typecheck-settled.log`. Earlier passing and foreign-only failure evidence is retained.

Pinned runtime: `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`, Bun `1.3.14 (0d9b296a)`. Core tests isolate `OPENCODE_TEST_HOME=/private/tmp/m12-01-home` and `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME` under `/private/tmp/m12-01-xdg-*`. No user database is opened. All fixture databases are disposable temporary files.

| Command | CWD | Exit | Evidence |
|---|---|---:|---|
| `bun test ./test/ftc/learning-and-progress/m12-01.test.ts` (initial missing behavior) | `packages/core` | 1 | `m12-01/red.log`; one assertion failure, zero harness errors |
| Same focused suite after db-injection adaptation | `packages/core` | 0 | `m12-01/green-final.log`; 17 pass, 0 fail, 52 assertions |
| Focused suite plus `./test/database-migration.test.ts` after adaptation | `packages/core` | 0 | `m12-01/core-final-covering.log`; 35 pass, 0 fail, 91 assertions |
| Focused persistence test with repository write temporarily removed | `packages/core` | 1 | `m12-01/persistence-mutation-red.log`; saved progress lacks attempt and stays not_started; source restored immediately |
| `bun test ... --test-name-pattern 'importing learning'` | `packages/core` | 1 | `m12-01/import-red.log`; subprocess import creates four temp XDG directories |
| `bun test ./test/database-migration.test.ts` | `packages/core` | 0 | `m12-01/migration-regression.log`; 18 pass, 0 fail, 39 assertions |
| `bun script/migration.ts --name ftc-learning-progress` (coordinator) | `packages/core` | 0 | `m12-01/migration-generate.log`; coordinator-verified snapshot delta 11 added, 0 removed records |
| `bun script/migration.ts --check` | `packages/core` | 0 | `m12-01/migration-check.log`; no stale migration/schema/registry |
| `bun test ./test/ftc-learning.test.ts ./test/contract-hygiene.test.ts` | `packages/schema` | 0 | `m12-01/schema-contracts.log`; 8 pass, 0 fail, 23 assertions |
| `bun typecheck` | `packages/core` | 0 | `m12-01/core-typecheck-final.log` |
| `bun typecheck` after M5 test stabilization | `packages/schema` | 0 | `m12-01/schema-typecheck-settled.log`; intervening foreign-only failure retained in `schema-typecheck-final.log` |
| `bun x --no-install oxlint` with five owned TypeScript paths | repository | 0 | `m12-01/lint-final.log`; zero warnings/errors |
| `bun x --no-install prettier --check` with same five paths | repository | 0 | `m12-01/format-final.log` |

Earlier foreign M5 lane Core type errors and one corrected host-migration fixture omission are retained separately in `core-typecheck-initial.log`, `core-typecheck.log`, and `green-initial.log`. No foreign source was edited. The corrected host fixture supplies the existing required `sandboxes` field.

## Assertion map and evidence limits

- Reopen/language: exact literal saved-state expectation, separately constructed SQLite scopes, English/Chinese content presentation, unchanged manifest bytes/mtime.
- Version ownership: historical exact retry after content upgrade, new version initially unstarted, new-version attempt then recorded with old attempt retained.
- Cross-project provenance/outcomes: retained different canonical project/configuration identities, reading/build/physical evidence, owner revisions, student observation, failed/cancelled/unknown distinct outcomes; independent user database empty.
- Concurrency: six exact retry connections produce one durable attempt; four independent attempts retained; conflicting same-key submissions produce one winner and one conflict without overwrite.
- Failure/cleanup: unknown lesson/version/course, empty revision and unsolicited completion property reject; failed/malformed/duplicate lookup fails explicitly; SQLite query-only write leaves prior data unchanged; malformed persisted evidence yields a stable error; cancellation executes port finalizer and leaves no attempt; subsequent scopes remain usable.
- Migration: `applyOnly` before learning migration creates a real populated predecessor database, `apply` twice preserves the existing host project row, records the migration once, then actual service record/reopen works; closed database files remove cleanly.
- Contract checks: serializable round-trip, exact ID prefix, required labelled provenance/revision, timestamp zero accepted/negative rejected, optional omission, unique stable identifiers, exact Core facade/Schema identities, no completion outcome.
- Import lifecycle: a real fresh Bun subprocess with isolated XDG paths exercises the actual import tree, not a source-text assertion. Its own runtime transpiler cache is disabled using `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`; the actual module import leaves the fixture directory empty.

Lesson content and evidence references are synthetic supplied immutable port records. SQLite files, SQL writes, migration application/reopen, process import and scoped cleanup are real. These isolated results do not validate actual producer evidence, classroom competence, bilingual production course quality, physical robots, Windows packaging/runtime, Electron/UI composition, M12-04/05 completion rules, or release/platform enablement. No agent/build/deploy/robot operation is started.

## Frozen files and scoped checks

Worker-owned source/test files:

- `packages/schema/src/ftc-learning.ts`
- `packages/schema/test/ftc-learning.test.ts`
- `packages/core/src/ftc/learning.ts`
- `packages/core/src/ftc/learning/sql.ts`
- `packages/core/test/ftc/learning-and-progress/m12-01.test.ts`

Coordinator-owned files included in the manifest: `packages/schema/src/index.ts`, `packages/core/schema.json`, `packages/core/src/database/migration.gen.ts`, `packages/core/src/database/schema.gen.ts`, `packages/core/src/database/migration/20261007052343_ftc-learning-progress.ts`, and `docs/validation/m12-01/snapshot-delta.json`. No Git/index/commit, checklist/progress, foreign product file, user database or generated artifact was changed by the worker. Generator temporary files and fixture DBs are disposed by their existing scopes.

Scoped checks ran from repository cwd with the exact five worker-owned paths above:

```sh
bun x --no-install oxlint packages/schema/src/ftc-learning.ts packages/core/src/ftc/learning.ts packages/core/src/ftc/learning/sql.ts packages/core/test/ftc/learning-and-progress/m12-01.test.ts packages/schema/test/ftc-learning.test.ts
bun x --no-install prettier --check packages/schema/src/ftc-learning.ts packages/core/src/ftc/learning.ts packages/core/src/ftc/learning/sql.ts packages/core/test/ftc/learning-and-progress/m12-01.test.ts packages/schema/test/ftc-learning.test.ts
```

SHA256 values (repository-relative paths; identical to the frozen manifest):

```text
5808e0bf563b50bfc03f66a9c8beffb7324eba2d225e808743441f512f96518e  packages/schema/src/ftc-learning.ts
7d23dd33164e90a8355ac4cad6ea3603c1ac21d0fd12cb99adc55809e377ce13  packages/schema/test/ftc-learning.test.ts
b72103a1a86308419bc66026f11950de74a9a9a670ae1a7af2d77d22486ce9cd  packages/core/src/ftc/learning.ts
8119367412326a5b6717cf8ada25acd4588a5c69d7ee9f391dae726278a14bea  packages/core/src/ftc/learning/sql.ts
6917dce3b95eea8351a4b89de3549a4660ea836ecf9164e47d784950e6ba3bb5  packages/core/test/ftc/learning-and-progress/m12-01.test.ts
835f9336ea76e91e2e6a423cc5995a819d7bb2dcad066e474ec87fafd43fe5b3  packages/schema/src/index.ts
f25c2eb030e4ab1b5333ea7ad905bc59602bd2514584acd1ba293c6b5c9d56ca  packages/core/src/database/migration/20261007052343_ftc-learning-progress.ts
eb7bd6178b0b5997a5ff991e3f49fb03eaf06e342888ccc4cdd7855a40595b81  packages/core/src/database/migration.gen.ts
29f0312c86b61f534e6a76af21345a9e06ffa5e1cf1033512c717c0e2b67ec0f  packages/core/src/database/schema.gen.ts
c9f9e27008f25ed37133209a51d5fc60f6bbbd4c4864318f3ad651637a858e87  packages/core/schema.json
71ac3e0c3ca8958ec4cbe0300b1e59d26334a0f7e57a56cf6c33fd96ded6a27b  docs/validation/m12-01/snapshot-delta.json
```

This candidate is frozen and ready for independent source/behavior review with all requested automated checks passing. No task ledger or commit completion is claimed by this worker report.
