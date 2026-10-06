# M2-01 implementation evidence

Date: 2026-10-06. Host: Darwin arm64. Bun: 1.3.14 (`0d9b296a`), executable `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`.

Reviewed/tested base: `e65f6c386b4abc97582d4814eb98a9ae3c97045a`. Validation ran against that revision plus the task-owned implementation in the commit introducing this report. The exact tested source bytes are recorded in [source-sha256.txt](m2-01/source-sha256.txt); resolve the delivery revision with `git log -1 --format=%H -- docs/validation/M2-01-implementation.md`. Concurrent coordinator documentation is excluded from this change.

## Delivered behavior and identity decision

`FtcProject.ProjectContext` is the canonical Schema contract. Its `projectID` uses the existing `Project.ID` schema but identifies **one M2 canonical-root association**, generated as `ftc_<UUID>`. It must never be passed to legacy Project APIs. `location` uses existing `Location.Info` and retains the existing host `location.project.id` and `directory`. The canonical local root, not either ID alone, defines execution ownership for subsequent gate work. This representation was confirmed by the coordinator before functional implementation because existing Git clones may share a host project ID and non-Git folders resolve to `global`.

The injected folder-identity/access port resolves aliases and inspects accessibility without writing project files. The Effect service rejects relative canonical/host directories, a mismatched Location directory, and explicit workspace placement. Both create and open associate an already prepared accessible folder. The private SQLite adapter atomically upserts by canonical root, preserves the local association ID, and refreshes its explicit host mapping on reopen. It neither imports existing Project/Session implementations nor writes their tables. No Session ID/schema or future Chat/Gate contract was added.

The service owns no import-time resources or global state. Its caller supplies the repository connection within its scope. Folder-port interruption before persistence leaves no association; a committed atomic association is durable and reconciled by retry, rather than rolled back after an ambiguous interruption. No active execution state is restored.

## Commands and results

All commands used `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH` and isolated `OPENCODE_TEST_HOME=/private/tmp/m2-01-env/home`, plus `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME` under `/private/tmp/m2-01-env/{data,config,cache,state}`. Database files and project fixtures were separate temporary directories managed by `tmpdir()` and scoped SQLite layers.

| Command                                                                                             | Cwd               | Exit / result                                                                | Evidence                                               |
| --------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `bun test ./test/ftc/projects-and-chats/m2-01.test.ts` (RED)                                        | `packages/core`   | 1; 0 pass, 1 fail, 0 assertions reached                                      | [red.log](m2-01/red.log)                               |
| Same selection, expanded RED                                                                        | `packages/core`   | 1; 1 pass, 7 fail, 6 assertions                                              | [red-expanded.log](m2-01/red-expanded.log)             |
| Same selection, first GREEN                                                                         | `packages/core`   | 0; 8 pass, 30 assertions                                                     | [green.log](m2-01/green.log)                           |
| Same selection, expanded verification                                                               | `packages/core`   | 0; 12 pass, 46 assertions                                                    | [green-expanded.log](m2-01/green-expanded.log)         |
| Same selection, final                                                                               | `packages/core`   | 0; 13 pass, 50 assertions                                                    | [focused-final.log](m2-01/focused-final.log)           |
| `bun test ./test/ftc/projects-and-chats/m2-01.test.ts ./test/database-migration.test.ts`            | `packages/core`   | 0; 31 pass, 89 assertions; includes 18 migration regressions / 39 assertions | [covering.log](m2-01/covering.log)                     |
| `bun script/migration.ts --name ftc-project-association`                                            | `packages/core`   | 0; generated one task migration and shared artifacts                         | [migration-generate.log](m2-01/migration-generate.log) |
| `bun script/migration.ts --check`                                                                   | `packages/core`   | 0; snapshot, full schema and registry current                                | [migration-check.log](m2-01/migration-check.log)       |
| `bun typecheck`                                                                                     | `packages/core`   | 0                                                                            | [core-typecheck.log](m2-01/core-typecheck.log)         |
| `bun typecheck`                                                                                     | `packages/schema` | 0                                                                            | [schema-typecheck.log](m2-01/schema-typecheck.log)     |
| `bun test ./test/contract-hygiene.test.ts ./test/compatibility.test.ts ./test/v1-isolation.test.ts` | `packages/schema` | 0; 8 pass, 17 assertions                                                     | [schema-contracts.log](m2-01/schema-contracts.log)     |
| `bunx oxlint <eight TypeScript paths below>`                                                        | repository root   | 0; 0 warnings, 0 errors                                                      | [lint.log](m2-01/lint.log)                             |
| `bunx prettier --check <same eight paths>`                                                          | repository root   | 0                                                                            | [format.log](m2-01/format.log)                         |
| `git diff --check`                                                                                  | repository root   | 0                                                                            | Terminal check before staging                          |

Exact lint/format paths:

```text
packages/schema/src/ftc-project.ts
packages/schema/src/index.ts
packages/core/src/ftc/projects.ts
packages/core/src/ftc/projects/sql.ts
packages/core/test/ftc/projects-and-chats/m2-01.test.ts
packages/core/src/database/migration/20261006121634_ftc-project-association.ts
packages/core/src/database/migration.gen.ts
packages/core/src/database/schema.gen.ts
```

RED used compiling contract/service/repository scaffolding that explicitly failed with `M2-01 association is not implemented`; SQLite initialization completed first. It was a missing operation rather than a missing import or malformed harness. Expanded RED included a five-second cancellation-test timeout because the unimplemented operation never reached the port's start barrier; final interruption/release assertions pass. Four later verification tests checked already implemented failure/lifecycle/mapping/migration behavior; no separate RED is claimed for those tests.

The initial Core typecheck found three test expectation arguments missing canonical brands; those were fixed. Initial lint found object stringification and spreading a Schema class; these were fixed by reading the SQL error message and constructing Location fields explicitly. Initial formatting found the test file unformatted; the final check passes. Earlier diagnostics are retained in `core-typecheck-initial.log`, `lint-initial.log`, and `format-initial.log`.

## Assertion map and validation boundaries

| Test area             | Actual evidence                                                                                                                                               | Boundary                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Folder aliases/reopen | Real directory and symlink, Java/manifest files, two closed/reopened SQLite scopes; identical association/context and preserved file list, modes and contents | Supplied `fs.realpath`/stat/read-access fixture; no production filesystem adapter or platform-wide case-normalization claim |
| Shared host IDs       | Two real roots and copied manifests remain distinct for both `global` and `shared-remote`; reopen preserves membership identity                               | Host resolver IDs are explicit fixtures; existing Git resolver was inspected, not composed or mutated                       |
| Concurrency           | Eight independent SQLite connections concurrently open one canonical root; one stored row and one association ID                                              | In-process connections, not a multi-process stress/performance proof                                                        |
| Folder errors         | Real missing path and regular file; injected EACCES result; no association and unchanged file                                                                 | Permission denial is injected to avoid user/sandbox permission ambiguity                                                    |
| Cancellation          | Interrupt while the identity port is pending; port finalizer runs, no row                                                                                     | Does not claim a forced cancellation at the exact SQLite commit instruction                                                 |
| Invalid placement     | Directory mismatch, relative canonical/host directories and explicit workspace are rejected before persistence                                                | Implicit local placement only, matching current Location policy                                                             |
| Database failure      | Real SQLite `PRAGMA query_only=ON` rejects writes with structured retry error, no partial row; fresh scope successfully retries                               | No disk-full/corrupt-storage fault injection                                                                                |
| Scope independence    | Same root in two separate database files receives distinct associations; original database still reopens its original ID                                      | No app restart or live host composition                                                                                     |
| Host identity refresh | Reopen changes persisted host mapping while retaining association ID/canonical root                                                                           | No broader existing Project ID migration semantics                                                                          |
| Migration             | All prior tracked migrations create the old schema; seeded Project row survives new migration and rerun; new association works                                | Real temporary database only; no production database touched                                                                |
| Schema                | Exact Core/Schema facade identity and existing Project/Location schema identity; optional omission and unique identifiers; affected contract suites           | No Protocol/Server change or SDK generation required                                                                        |

The generated snapshot has exactly seven added DDL records, all belonging to `ftc_project_association`, and zero removed or changed existing DDL records; [snapshot-delta.json](m2-01/snapshot-delta.json) records the structural comparison against the base. Snapshot UUID/line wrapping are generator output. The new migration creates only the task table; the registry gains one entry and the generated full schema gains that table. No generated artifacts or earlier migrations were hand-edited.

NOT RUN: full unrelated Core external suites; Schema event-manifest suite (two known unrelated baseline failures in the dispatch brief); production folder binding/composition; actual Electron/server restart; Windows filesystem/SQLite execution; robot/toolchain/model work; future chats/gates/Session admission. Tests do not assert execution ownership behavior that belongs to later M2 tasks. No project SDK/dependency/template contents were changed.
