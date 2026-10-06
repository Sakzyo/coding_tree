# M2-02 implementation evidence

Date: 2026-10-06. Task: **M2-02 — Persist separate chat-to-Session membership**. Requirement coverage: PRJ-02 and the association-persistence portion of PRJ-03; contributes to AC-03. It does not complete AC-03 execution/history/restart acceptance or PRJ-04's later gate tasks.

Base: `2c36be13c2d15707ac09a73c4b62b6e968bab131` (reviewed M2-01 product commit `917fc044b`). The tested snapshot is that base plus this task's owned changes; [source-sha256.txt](m2-02/source-sha256.txt) records exact final source bytes, including generated artifacts. Resolve delivery commit with `git log -1 --format=%H -- docs/validation/M2-02-implementation.md`. Concurrent coordinator documentation is excluded from the task commit.

## Behavior and ownership

`createChat({ projectID })` obtains the canonical M2 association, creates a Session only through `SessionAccess.createSession({ location })`, validates the returned record and a subsequent Session lookup, and inserts one local chat membership. `listChats({ projectID })` reads insertion-ordered memberships and validates each referenced Session before returning them. Missing projects, missing Sessions, mismatched returned IDs or placement, duplicate membership, changed project mappings, Session port errors, and SQLite failures never become successful results.

The Schema package owns serializable `ChatID`, `ChatRef`, `ProjectRequest`, and `ChatError`. Core re-exports those exact schemas. The new ID generates and validates the `chat_` prefix. Existing Project and Session IDs are reused, and errors retain stable language-independent codes with optional omission.

M2 `projectID` identifies one canonical-root association, not Session's upstream project. Sessions are checked against `project.location.project.id`, explicit canonical directory and workspace placement. Two roots can share `global` (or another host project ID) without sharing memberships. Folder aliases reopen the same association. New Session calls use canonical implicit-local `Location.Ref`; Schema `Session.Info` is the returned/looked-up record. The future host adapter must translate Session.get's typed not-found result into this narrow port's `undefined` result and translate other access errors. No host binding is implemented here.

The module-owned `ftc_chat` table stores only sequence/order, chat ID, association ID, and Session ID. Unique Session ID prevents any two chats in this database from sharing a Session. The foreign key points only to the M2 association table. There is no Session-table foreign key, history copy, Session store/model loop, admission, wake, execution or gate operation. A transactional association recheck prevents committing membership if the host mapping changes during Session creation.

Session creation and membership persistence are separate ownership boundaries, not one transaction. The coordinator confirmed that a Session created before a membership failure/interruption remains unassociated and must not be deleted by M2. Tests verify this with real SQLite write rejection and interrupted Session lookup. Retrying `createChat` creates a fresh Session; it is not an idempotent chat-create command. A crash/interruption exactly at a completed membership commit can leave durable membership visible on reopen; no exactly-once acknowledgement or cross-owner rollback is claimed. Consumers can list committed memberships. A later Session deletion/placement change makes listing fail visibly, without deleting the membership. No recovery execution is scheduled.

All state/resources belong to supplied scoped instances. Constructing the layer performs no I/O. M2-01's test now supplies create/get ports that die if touched; its existing assertions are unchanged.

## Environment and exact commands

Darwin arm64; Bun 1.3.14 (`0d9b296a`) at `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`. Every test/typecheck/migration command used:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
HOME=/private/tmp/m2-02-env/home
OPENCODE_TEST_HOME=/private/tmp/m2-02-env/home
XDG_DATA_HOME=/private/tmp/m2-02-env/data
XDG_CONFIG_HOME=/private/tmp/m2-02-env/config
XDG_CACHE_HOME=/private/tmp/m2-02-env/cache
XDG_STATE_HOME=/private/tmp/m2-02-env/state
```

Tests use independent real temporary directories and SQLite connections, disposed by the fixture and Effect scope. No user database or project is changed. Working directories in the table are relative to `/Users/dylanxu/coding_tree`.

| Command | Cwd | Result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/projects-and-chats/m2-02.test.ts` (initial RED) | `packages/core` | Test exit 1; 0 pass / 1 fail, explicit missing behavior after SQLite setup | [red.log](m2-02/red.log) |
| Same (expanded RED) | `packages/core` | Exit 1; 0 pass / 16 fail | [red-expanded.log](m2-02/red-expanded.log) |
| Same (first GREEN) | `packages/core` | Exit 0; 16 pass / 44 assertions | [green.log](m2-02/green.log) |
| Same (final focused) | `packages/core` | Exit 0; 19 pass / 63 assertions | [focused-final.log](m2-02/focused-final.log) |
| `bun test ./test/ftc/projects-and-chats/m2-02.test.ts ./test/ftc/projects-and-chats/m2-01.test.ts ./test/database-migration.test.ts` | `packages/core` | Exit 0; 50 pass / 152 assertions | [covering.log](m2-02/covering.log) |
| `bun test ./test/ftc/projects-and-chats/m2-02.test.ts --test-name-pattern 'host mapping refresh'` with only the transaction mapping guard removed temporarily | `packages/core` | Exit 1; expected `project_changed`, received successful result; guard then restored and final focused run passed | [host-mapping-red.log](m2-02/host-mapping-red.log) |
| `bun script/migration.ts --name ftc-chat-membership` | `packages/core` | Exit 0; one new task migration generated | [migration-generate.log](m2-02/migration-generate.log) |
| `bun script/migration.ts --check` | `packages/core` | Exit 0; snapshot/schema/registry current | [migration-check.log](m2-02/migration-check.log) |
| `bun typecheck` | `packages/core` | Exit 0 | [core-typecheck.log](m2-02/core-typecheck.log) |
| `bun typecheck` | `packages/schema` | Exit 0 | [schema-typecheck.log](m2-02/schema-typecheck.log) |
| `bun test ./test/contract-hygiene.test.ts ./test/compatibility.test.ts ./test/v1-isolation.test.ts` | `packages/schema` | Exit 0; 8 pass / 17 assertions | [schema-contracts.log](m2-02/schema-contracts.log) |
| `bunx oxlint <eight TypeScript paths below>` | repository root | Exit 0; zero errors/warnings | [lint.log](m2-02/lint.log) |
| `bunx prettier --check <same eight paths>` | repository root | Exit 0 | [format.log](m2-02/format.log) |
| `git diff --check` | repository root | Exit 0 | Final pre-commit terminal check |

Exact lint/format paths:

```text
packages/schema/src/ftc-project.ts
packages/core/src/ftc/projects.ts
packages/core/src/ftc/projects/sql.ts
packages/core/test/ftc/projects-and-chats/m2-01.test.ts
packages/core/test/ftc/projects-and-chats/m2-02.test.ts
packages/core/src/database/migration/20261006123700_ftc-chat-membership.ts
packages/core/src/database/migration.gen.ts
packages/core/src/database/schema.gen.ts
```

Initial RED used callable service scaffolding that explicitly failed `M2-02 chat membership is not implemented`; no missing import or database harness failure. The initial shell displayed the captured log and therefore returned zero after the failing test, while the log records the test failure. The expanded RED command itself returned 1; its interruption test timed out because the missing operation never reached the start barrier. Upgrade and Schema verification were added after initial implementation; no preimplementation RED is claimed for those verification tests. The mapping guard has explicit removal/restoration RED/GREEN evidence.

Initial covering verification was 49 pass / 1 fail because the contract test assumed refined scalar identifiers lived on `schema.ast.annotations`. Runtime inspection showed Effect keeps the identifier on the string refinement, and the generated JSON Schema correctly emitted `#/$defs/FtcProject.ChatID`. The assertion now checks generated references, the consumer-visible contract. Initial Core typecheck found a plain-string expected path array and mixed Result generic narrowing in tests; fixed with branded fixture roots and `_tag` discrimination. Initial lint reported one consistent-return warning; lookup now returns the validated Session. These initial results remain in [covering-initial.log](m2-02/covering-initial.log), [core-typecheck-initial.log](m2-02/core-typecheck-initial.log), and [lint-initial.log](m2-02/lint-initial.log). All final checks above pass.

## Assertion map

| Area | Evidence established | Limits |
| --- | --- | --- |
| Reopen/order and distinct chats | Two closed/reopened database scopes retain `[a,b]`, distinct chat/Session IDs and association IDs; listing rejects create attempts; actual Session table remains empty | Controlled complete Session.Info records retained by the test fixture; no claim of Session history persistence, actual app restart or live M3 binding |
| Shared host identity and aliasing | Two real directories sharing `global` keep separate chats; a real symlink opens the first association and lists its original chat | macOS filesystem only; fixture resolves paths with realpath |
| Missing project / scope independence | Another database cannot use the first database's project ID; create/list return `project_not_found` before Session creation | No global reset or host registry tested |
| Placement and identity validation | Creation rejects wrong directory, association-ID-as-host-ID, explicit workspace, wrong lookup ID and missing record; reopen rejects missing, moved and wrong-ID records | Controlled Session lookup mutations; no permission/robot/model behavior |
| Concurrency | Six separate SQLite connections offering one Session produce one chat and five `chat_session_conflict` errors | In-process connections; no multi-process stress or performance claim |
| Storage failure and retry | Real `PRAGMA query_only=ON` rejects membership, no row appears, created Session remains; retry gets fresh Session/chat while original Session remains | No disk-full/corruption injection; no cross-owner rollback |
| Cancellation | Interrupted lookup finalizer completes; no chat row; already-created Session remains | No forced interruption at the exact SQLite commit instruction |
| Session access failures | Both create and lookup return structured error and no chat row | Injected typed failures rather than real Session owner failure |
| Host mapping refresh | Association changed during Session creation prevents membership; guard-removal test demonstrates regression failure | Controlled ordering in one process |
| Migration | All tracked migrations preceding this task create prior schema; original association survives upgrade and rerun; created chat reopens | Temporary SQLite only; no user database touched |
| Schema contracts | Exact facade/schema and Project/Session ID identity, chat-prefix rejection, generated stable references, optional omission and existing contract checks | Protocol/Server surfaces unchanged; SDK regeneration not applicable |

## Migration scope and self-review

The migration generator was inspected before invocation. New migration `20261006123700_ftc-chat-membership.ts` creates only `ftc_chat`; generated registry gains one entry and full schema gains the same table. [snapshot-delta.json](m2-02/snapshot-delta.json) records nine added DDL records, all for `ftc_chat`, and zero removed/changed prior records. The integer primary key supplies durable insertion order; unique chat and Session IDs prevent membership overlap. No old migration or generated file was hand-edited.

Self-review checked task scope, canonical ID ownership, Session table/history separation, project-key filtering, unique Session constraint, narrow port contract, scoped connection cleanup, failure propagation, ordered reopen, generated migration delta, and the unchanged M2-01 assertions. No unresolved implementation findings identified before independent review.

Not run: unrelated broad Core external suites (coordinator confirmed scoped verification), Schema event-manifest tests with two known unrelated baseline failures, production Session composition, full app/server restart, Windows execution, robot/toolchain/model/provider work, and future gate/admission tasks. No package/dependency/lockfile or shared checklist/progress changes are included. User requested stopping after the current task; no later task was started.
