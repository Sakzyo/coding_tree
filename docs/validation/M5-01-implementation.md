# M5-01 — document owner candidate

Base: `a232ce6ca`. The candidate is frozen against [source hashes](m5-01/source-sha256.txt). The coordinator owns independent review, staging/commit, task checklist and progress updates. No worker Git/index edits were made. This evidence establishes an isolated document foundation, not production editor/platform enablement.

## Delivered contract

`packages/schema/src/ftc-java.ts` owns `FtcJava.DocumentID`, `DocumentSnapshot`, `DocumentEvent` and `DocumentError`. The coordinator added the canonical `FtcJava` root namespace export in `packages/schema/src/index.ts`; Core re-exports those exact values. Schema records are serializable and readonly. The document ID generator validates `doc_`; snapshot paths validate absolute POSIX, drive or UNC syntax; revisions reject negative/fractional values; error optionals omit undefined.

`Java.layer({ filesystem, projects })` creates a scoped owner. `filesystem` supplies `realpath` and scoped `readText`; `projects.resolve(Project.ID)` supplies an authorized canonical `FtcProject.ProjectContext`. That narrow port is authority, while the project record supplied to `openDocument` is checked against it, including host project/location/workspace fields. The coordinator explicitly approved this port and absolute opened-path selection on 2026-10-07. Core imports canonical Schema project records and the existing `KeyedMutex`, with no sibling FTC runtime imports.

- `openDocument({ project, path })` accepts an authorized project record and project-relative or absolute existing path, canonicalizes the file and returns the owned immutable snapshot. Internal aliases share an identity. Two project IDs cannot adopt one canonical file within an owner.
- `changeDocument({ path, expectedRevision, text })` uses the absolute path returned by open to select the already owned document, rechecks project authorization/path scope, and updates only the buffer when its revision matches. Stale changes fail with expected/actual revisions. Actual changes increment the buffer revision; no-ops emit nothing. Returning to captured saved text clears dirty without reducing the revision.
- `readDocument({ projectID, path })` queries only an already open document, resolves authority again and rechecks canonical containment. It never implicitly opens or reloads the disk.
- `events` is a scoped live stream of `{ type: "opened" | "changed", snapshot }`. Each event carries document, project, canonical path, buffer and disk revision. Only admission and actual buffer changes emit events; subscribers attach before those operations.

Saved text/disk revision and the current buffer are separate owner state. A new snapshot starts at buffer/disk revision zero; edits advance only buffer revision. `dirty` compares with the saved text captured on open. External refresh/save is intentionally absent in this task: reopening after an external disk edit retains the owned dirty buffer and captured disk revision. M5-02 must establish conflict/save/refresh semantics.

The owner scope, rather than a view scope, owns documents and events. Closing a nested view scope preserves a dirty document. Closing the owner clears document state and shuts down subscriptions; escaped operations fail `owner_closed`, and a fresh owner starts from disk. File reads own a nested scope and a bracketed fiber in the owner scope. Both caller cancellation and owner disposal interrupt a blocked read and release supplied resources without admitting partial state. Importing the modules performs no I/O. Application wiring supplies the ports and binds the owner to its Location; no production bootstrap registration was added.

## RED/GREEN evidence

The first focused test was written before source existed. [Initial RED](m5-01/red.log) failed an explicit missing-module assertion (0 pass, 1 fail, exit 1), with real file setup working and no import/harness exception. The final test imports the real module directly and contains no source-availability assertion.

To independently establish the required behavioral regression, [dirty-buffer regression RED](m5-01/dirty-buffer-regression-red.log) temporarily changed reopening to return captured saved text instead of the owned current buffer. The exact `detaching a view preserves dirty buffer` assertion failed: expected `unsaved`, received `saved` (0 pass, 1 fail, exit 1). The original source was restored in a `finally` block and final GREEN followed. This is supplemental mutation evidence, not a claim that the mutation preceded implementation.

[Schema path RED](m5-01/schema-path-red.log) caught three accepted relative paths before the absolute-path contract refinement (13 pass, 3 fail, exit 1). Final Schema checks passed after the refinement.

[Owner read RED](m5-01/owner-read-red.log) directly exposed the resource lifetime edge before its correction: owner close left one active scoped read (0 pass, 1 fail, exit 1). A bracketed owner-scope read fiber fixed that behavior while the existing caller-cancellation test continued to pass; final focused GREEN includes both cases.

The first event test timed out because `Stream.toPull` defers subscription; it was corrected to start a real subscriber before publication and assert collected events. Initial logs preserve that failure and the test corrections. Initial Core typechecks preserved in-flight foreign M2-04 errors and two local test typing errors; local errors were corrected and the [earlier Core typecheck](m5-01/core-types.log) passed before the later owner-read fix. After that fix, the latest Core typecheck has only a newly arriving foreign M6 `src/ftc/configuration/manifest.ts(79,29)` event literal error, with no M5 errors. Initial affected file-mutation setup attempted the default state directory and was sandbox-denied; adding task-owned `XDG_STATE_HOME` fixed the harness without escalation or source changes.

## Final verification

All commands use Bun `1.3.14 (0d9b296a)` with `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`. Core tests set task-owned `OPENCODE_TEST_HOME` plus `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `XDG_STATE_HOME` under `/private/tmp/m5-01-*`. Exact commands, cwd, exit codes and counts are recorded in [checks.json](m5-01/checks.json). Paths in that file are relative to `/Users/dylanxu/coding_tree`.

| Check                                                              | cwd               | Exit | Evidence                                                                             |
| ------------------------------------------------------------------ | ----------------- | ---- | ------------------------------------------------------------------------------------ |
| Exact focused `bun test ./test/ftc/java-development/m5-01.test.ts` | `packages/core`   | 0    | [20 pass, 0 fail, 69 assertions](m5-01/core-focused-final.log)                       |
| Focused plus file-mutation/keyed-mutex affected tests              | `packages/core`   | 0    | [36 pass, 0 fail, 100 assertions](m5-01/core-affected-final.log)                     |
| FtcJava contract plus Schema contract hygiene tests                | `packages/schema` | 0    | [21 pass, 0 fail, 36 assertions](m5-01/schema-affected-final.log)                    |
| `bun typecheck`                                                    | `packages/core`   | 2    | [Core log: foreign M6 ManifestEvent error; no M5 errors](m5-01/core-types-final.log) |
| `bun typecheck`                                                    | `packages/schema` | 0    | [Schema log](m5-01/schema-types-final.log)                                           |
| Scoped `oxlint` on six verified source/test/barrel files           | repository        | 0    | [0 warnings, 0 errors](m5-01/lint-final.log)                                         |
| Scoped `prettier --check`                                          | repository        | 0    | [format log](m5-01/format-final.log)                                                 |

Scoped `git diff --check` passed for the tracked barrel change; Prettier checked all new source/test files. All six verified source/test/barrel files are included in the final SHA256 manifest. Known unrelated Schema manifest failures from earlier evidence were not rerun. No tests were invoked at repository root.

## Assertion map and fixture distinction

| Required behavior                          | Focused test/assertions                                                                                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dirty buffer survives detachment           | `detaching a view preserves dirty buffer`: text `unsaved`, dirty true, disk `saved`; buffer 1/disk 0; read returns same snapshot                                                                                                                                 |
| Canonical identity and concurrent opens    | `canonical file aliases share a buffer...`: three aliases yield one document ID and canonical path; dirty query through alias matches                                                                                                                            |
| Revision conflicts and immutable snapshots | `stale edits cannot replace...`: stale edit rejected, unchanged query, no-op preserved, restoring saved text gives buffer 2/disk 0 and clean state; old snapshots remain immutable                                                                               |
| Revisioned events                          | `revisioned events describe exactly...`: exact opened/changed snapshots; no duplicate reopened/no-op/stale events                                                                                                                                                |
| Authorized scope                           | traversal/symlink table, `substituted project context...`, `absolute sibling paths...`: typed rejection, outside bytes preserved; location/project claims cannot substitute authority                                                                            |
| Path changes after open                    | `retargeting an opened file...`: queries and edits fail after outside-link replacement                                                                                                                                                                           |
| Independent owner/project state            | `independent owners and projects...`, `one owner rejects two project identities...`: no dirty leakage; conflicting same-file project ownership rejected                                                                                                          |
| Concurrent revision admission              | `concurrent changes...`: exactly one success, one failure, buffer revision advances once                                                                                                                                                                         |
| External disk content preserved            | `reopening does not erase...`: owned snapshot unchanged, external bytes remain external                                                                                                                                                                          |
| Scope cleanup                              | owner disposal/fresh owner, cancellation and shutdown tests: closed commands fail; fresh saved state; active scoped read count returns to zero on caller cancellation and owner disposal; interrupted read not admitted; event subscriber settles on owner close |
| Invalid inputs and unavailable files       | `missing files and invalid revisions...`: missing file fails, invalid revisions fail, owned buffer unchanged                                                                                                                                                     |
| Canonical contracts                        | Core exact facade identity tests and Schema tests: JSON round-trip, IDs/identifiers, relative-path rejection, Windows/UNC syntax, optional omission and closed state vocabulary                                                                                  |

Filesystem tests exercise real temp directories, real file contents, real `fs.realpath`, real symlinks, replacement and `Bun.file().text()`. Only the explicitly supplied project-resolution boundary is a fixture. Cancellation additionally supplies a controlled scoped read port to expose acquisition/release and interruption; the module, paths and files stay real. A nested Effect scope models view detachment, without pretending to exercise a UI component.

## Remaining gates

Production port adapters/bootstrap wiring, live UI/editor attachment, Windows filesystem behavior and native product lifecycle are unrun. Windows Schema path syntax is validated, but no Windows OS execution is claimed. Save/edit proposals, external refresh/conflict recovery, language-service sessions, build/artifact APIs and real Gradle/robot behavior belong to later tasks and were not implemented. Canonicalization checks reject observed symlink escapes and recheck after initial reads; a supplied filesystem port must preserve its read/identity boundary for hostile concurrent filesystem mutations, and this is not an OS-level atomic no-follow guarantee.

No unrelated source, generated artifacts, application startup, checklist or ledger was edited. Any source change after this freeze requires refreshed verification and hashes.

## Coordinator settlement — 2026-10-07

Independent specification/quality review approves with no Critical/Important findings. Minor chronology observation is retained in the progress ledger; the earlier evidence already distinguishes initial missing scaffolding from later mutation sensitivity. All five M5 source/test hashes match current bytes, and the committed `9bcb23ce6` Schema index hash matches the sixth frozen digest. The later FtcConfiguration root entry is separately owned M6 work. After foreign M6 typing was repaired, coordinator ran `bun typecheck` from packages/core with pinned Bun: **exit 0**, [settled log](m5-01/core-types-settled.log). The earlier failed settlement attempt is retained in [attempt log](m5-01/core-types-settlement-attempt.log); no failing result was waived. M5 sources and successful suites were unchanged.
