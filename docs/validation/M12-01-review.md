### Spec Compliance

- ✅ Spec compliant; reviewed the complete one-task range `7e36d8da0..8a0b5881b`. All four planned task files have implementing/test hunks. The additional Schema tests, canonical root export, and generated migration artifacts directly support the requested storage contract.
- `packages/core/src/ftc/learning/sql.ts:10` owns only `ftc_learning_attempt`, with snake_case columns and composite course/lesson/version/attempt identity. `packages/core/src/database/migration/20261007052343_ftc-learning-progress.ts:9` adds that table without sibling-table writes or ownership foreign keys; `docs/validation/m12-01/snapshot-delta.json:2` records 11 DDL additions and zero removals, consistent with the snapshot diff.
- `packages/core/src/ftc/learning.ts:65` strictly decodes attempts before storage and reconciles existing exact historical retries before consulting current content. New attempts require a current matching lesson/version. `packages/core/src/ftc/learning.ts:98` derives only current-version `recorded`/`not_started` status while retaining historical attempts; it grants no completion or physical competence.
- `packages/schema/src/ftc-learning.ts:24` and `packages/schema/src/ftc-learning.ts:32` preserve serializable, readonly project/configuration/evidence provenance and distinct submitted/failed/cancelled/unknown outcomes. Owner references require a revision; student observations require an explicit label. These records do not authenticate producer evidence, as required for this task.
- `packages/core/src/ftc/learning.ts:33` borrows an externally scoped database through a type-only infrastructure dependency. Construction neither acquires nor closes it, and imports contain no bootstrap or database initialization. `packages/core/test/ftc/learning-and-progress/m12-01.test.ts:34` checks the actual fresh-process import tree for application-state/database side effects.
- `packages/core/test/ftc/learning-and-progress/m12-01.test.ts:62` verifies literal saved progress, separate connection scopes/reopen, English/Chinese content presentation equivalence, and unchanged project-manifest bytes/mtime. Stable identifiers and errors carry no presentation language.
- ⚠️ Cannot verify from this diff: production Electron/UI/Location composition, Windows runtime/packaging, actual bilingual course acceptance, classroom competence, physical robot behavior, or release enablement. The controller must retain those gates separately; disposable SQLite and synthetic content/evidence fixtures do not satisfy them (`docs/validation/M12-01-implementation.md:44`).
- ⚠️ M12-04/05 own evidence verification and physical completion rules. This task stores supplied provenance and deliberately cannot establish verified producer ownership or physical competence (`packages/schema/src/ftc-learning.ts:16`). No user-database migration execution is credited; generated lifecycle and populated temporary-database upgrade evidence are the reviewed scope (`packages/core/test/ftc/learning-and-progress/m12-01.test.ts:400`). Ledger completion remains controller-owned and was not changed by this review.

### Strengths

- `packages/core/src/ftc/learning/sql.ts:64` uses an atomic insert-or-conflict path and compares retained payloads instead of overwriting provenance. Real independent connections test six exact retries, independent attempts, and competing conflicting submissions (`packages/core/test/ftc/learning-and-progress/m12-01.test.ts:268`, `:280`).
- `packages/core/test/ftc/learning-and-progress/m12-01.test.ts:121` proves a historical exact retry survives a content upgrade without crediting the new version, then proves a new-version attempt produces recorded status while preserving the original evidence.
- `packages/core/src/ftc/learning/sql.ts:94` validates persisted JSON/records and reports malformed state explicitly; `:113` preserves domain errors and maps infrastructure failures to a stable error. Lookup failure/invalid content, read-only failure, corrupt evidence, and cancellation have focused behavioral tests (`packages/core/test/ftc/learning-and-progress/m12-01.test.ts:316`, `:333`, `:355`, `:370`).
- `packages/core/test/ftc/learning-and-progress/m12-01.test.ts:400` applies the real tracked lifecycle to a populated predecessor database, verifies a host row is preserved and the migration is recorded once after repeated apply, then records/reopens actual learning state.
- `packages/schema/test/ftc-learning.test.ts:18`, `:27`, `:57` cover serialization, exact generated ID prefix, provenance/revision requirements, zero/negative timestamps, omitted optional properties, and unique canonical identifiers; Core facade identity is checked at `packages/core/test/ftc/learning-and-progress/m12-01.test.ts:307`. The implementation remains a small contract, facade, and private repository rather than introducing another runtime or profile system.

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- None found.

#### Minor (Nice to Have)

- None found.

### Performed Checks and Evidence

- Read the task-reviewer rubric, exact task brief/binding constraints, implementation report, applicable Schema instructions, and complete frozen diff. The initial tool response truncated the middle; the omitted diff ranges were recovered in bounded reads. No changed product file was separately reread, no unchanged product implementation was crawled, and no Git/index/ledger operation was performed.
- Ran `shasum -a 256 -c docs/validation/m12-01/source-hashes.sha256` from the repository; exit 0, all 11 frozen files matched.
- Named risk: JSON field insertion order could make a semantic exact retry appear conflicting at `packages/core/src/ftc/learning.ts:72` / `packages/core/src/ftc/learning/sql.ts:69`. Ran one focused Bun 1.3.14 probe from `packages/schema`, decoding an Attempt and the same object with recursively reversed property order using the implementation's strict canonical Schema decoder. Exit 0, `sameAfterDecode: true`; this resolves that doubt without rerunning a successful suite.
- Inspected existing final evidence, rather than executing it again: focused Core suite 17 pass/0 fail/52 assertions (`docs/validation/m12-01/green-final.log:22`), focused plus migration suite 35 pass/0 fail/91 assertions (`docs/validation/m12-01/core-final-covering.log:42`), Schema/contract suite 8 pass/0 fail/23 assertions (`docs/validation/m12-01/schema-contracts.log:15`), package-local Core/settled Schema typecheck logs, migration generation/drift logs, and zero-warning lint/format logs. The successful final outputs are clean; earlier foreign M5 diagnostics and the corrected predecessor fixture failure are retained with their scope and later resolution in `docs/validation/M12-01-implementation.md:31`.
- Inspected the persistence mutation RED and import-side-effect RED evidence (`docs/validation/m12-01/persistence-mutation-red.log:11`, `docs/validation/m12-01/import-red.log:10`). The literal persistence assertion detects missing writes, and the import probe detects actual application-state directory creation; these substantiate meaningful behavior checks beyond file existence in the initial baseline.

### Assessment

**Task quality:** Approved

**Reasoning:** The bounded source change satisfies M12-01 with durable local versioned storage, conflict-safe immutable provenance, language-independent progress, strict canonical contracts, and explicit failure behavior. Real SQLite/reopen/multi-connection/migration tests and the no-I/O import correction support this task's isolated acceptance; spanning production and competence gates remain unverified.
