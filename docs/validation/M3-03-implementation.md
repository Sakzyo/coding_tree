# M3-03 implementation candidate — 2026-10-07

Status: **DONE_WITH_CONCERNS**, frozen for coordinator commit and independent review. Dispatch/base and observed HEAD: `e4d498ca0adcbf8842c4cabb4da8ccb80818a0be`. The implementer did not stage, commit, change the ledger/checklist, edit Session/Java/host/composition/SQL/root barrels, or dispatch subagents. The coordinator added the Schema root `FtcAgent` export; it is included in checks and the [source manifest](m3-03/source-sha256.txt).

Read the dispatch brief first, root and Schema AGENTS, canonical Java producer/Schema contracts and relevant existing tests. Used the executing-plans, TDD/writing-good-tests and verification-before-completion instructions; the explicit dispatch overrides generic full-suite, commit, ledger and delegation steps.

## Implemented boundary

`packages/schema/src/ftc-agent.ts` contains only serializable `CodeMode`, `PlanID` and `CodePlan`. The plan contains project/Session identity, the canonical full Java proposal, its explanation, and ordered complete document/buffer/disk revisions. Core re-exports these exact Schema values, and uses canonical `FtcJava.EditResult` without a competing result or boolean `applied` field.

`packages/core/src/ftc/agent.ts` provides the scoped `Agent.make`, `Agent.Service` and `Agent.layer` facade. It consumes three narrow structural ports:

- `policy.check({ sessionID, proposal })` resolves trusted Session/project membership, current user code mode, canonical root and authorized source paths. A request's `mode` must equal this trusted mode. Model-selected `direct` cannot override `plan-first`.
- `approvals.check({ trustedUserEvent, plan })` receives the exact full immutable plan and actual runtime event object. The host is responsible for binding the real event to every plan value. Model JSON, IDs, repository/context/log text and `approved: true` objects are data, not user authority.
- `edits.applyEdits({ proposal, authorization })` owns revision checking and file application. Its canonical successful/conflict/partial failure results and typed errors propagate unchanged. M3 performs no filesystem writes or revision simulation itself.

The facade's structural `codeChanges.check` bridges the Java producer's opaque runtime authorization port without importing any sibling implementation. Each application creates a frozen object tracked by an instance-local WeakMap; an equal-looking object or JSON round trip cannot acquire authority. The checker verifies every canonical proposal field and each revision, refreshes trusted policy, and requires the identical project/root/path scope and mode. Capabilities exist only for their live application and never convey build, deployment, initialization, start, tuning or other robot permission.

Ingress scalar fields (`sessionID`, `mode`, `planID`, event object identity) and complete proposal/expected revisions are captured before the first yield. A plan and its nested proposal, edits and revisions are copied and frozen. `Schema.Struct.make` was deliberately avoided for the runtime plan after a behavioral test demonstrated that it clones nested values and loses the existing freeze.

`plan-first` returns the intended edits without invoking the edit port. A trusted approval atomically consumes its pending plan before any policy/application await. Mismatched approved revisions fail `revision_conflict`; changed mode/root/paths or revoked policy fail `edit_unauthorized`. Actual document staleness remains the producer's canonical `conflict` result and is preserved. Concurrent or later claims cannot apply the consumed plan again. Forged/unrecognized approvals leave the pending plan intact. After a consumed stale, conflict, failed, cancelled or rejected application, a new proposal is required. Direct calls are distinct explicit applications with fresh policy and producer revision checks; M3 does not silently retry them or add a deduplication ID/API.

Caller cancellation revokes the capability before interrupting the edit port, including its interruption finalizer. The owning Scope marks the facade closed, discards pending plans, and interrupts its application child Scope. Escaped APIs reject `owner_closed`. No separate UI plan-cancel API was added. Plans/capabilities are local to this scoped owner; disposal/restart does not persist or replay them.

## Tests and assertion map

The final focused file exercises the real M3 facade with controlled external policy, event validation and edit-application ports. Fixtures contain complete canonical data. No subject mock, global reset or sibling implementation is imported. An application count proves whether M3 invoked its edit port; it is not evidence of a production disk write, real user approval or host wiring.

| Contract | Focused coverage |
| --- | --- |
| Plan-first performs zero applications; stale approved revisions cannot apply; direct invokes application | `m3-03.test.ts:26`, `plan-first waits and stale approval cannot edit` |
| Mode comes from trusted policy; fake/wrong-plan events reject; successful approval cannot replay | `:144`, `model-selected direct mode and forged or wrong-plan events cannot apply` |
| Mutable proposal/Session/mode cannot redirect the admitted plan | `:164`, `proposal and scalar envelope are copied before asynchronous policy resolution` |
| Mutable approval envelope cannot redirect another plan; concurrent claims invoke one application | `:209`, `approval envelope mutation and concurrent claims cannot redirect or repeat application` |
| Changed mode/root/path/revocation before approval consumes and rejects the plan | `:242`, four fresh-policy cases |
| Capability binds project, explanation, paths, replacements, edit count and each document/buffer/disk revision; JSON forgery and post-apply reuse reject | `:263`, `opaque authorization binds every proposal field and expires after apply` |
| Policy is refreshed inside a live application | `:323`, four active-policy cases |
| Scoped instances cannot exchange plans or capabilities | `:357`, `independent owners cannot exchange plans or active edit capabilities` |
| Canonical conflict, partial/unknown failure and typed port error propagate unchanged; no automatic replay | `:381`, three result/error cases |
| Cancellation revokes before edit-port interruption cleanup and consumes claimed plan | `:433`, `caller cancellation revokes capability and consumes its claimed plan` |
| Disposal interrupts live applications and rejects escaped pending/capability APIs | `:464`, `owner disposal revokes pending plans and active capabilities` |
| Schema round trip, complete revisions, supported modes, exact ID prefix, stable identifiers and exact root/Core facade identities | `packages/schema/test/ftc-agent.test.ts`, plus first focused Core test |

## RED/GREEN record

Initial [Core](m3-03/red.log) and [Schema](m3-03/schema-red.log) discovery baselines each failed one assertion because the assigned module did not exist. These baseline discovery assertions were removed from the final tests; they do not establish behavioral RED beyond the absent module. Initial implementation passed [Core 1/8](m3-03/initial-green.log) and [Schema 1/12](m3-03/schema-initial-green.log).

Expanded tests produced a genuine [nested immutability RED](m3-03/immutable-red.log): 13 passed, one failed because the actual runtime plan's nested revision was not frozen. The repaired [boundary GREEN](m3-03/boundary-green.log) passed 14 tests/67 assertions. An earlier [boundary setup log](m3-03/boundary-baseline.log) also contains an incorrect fixture use of `Exit.isInterrupted`; that harness error was corrected to `Exit.isFailure` and is not credited as a product RED.

The stronger [cancellation RED](m3-03/cancellation-red.log) failed the actual interruption-finalizer assertion: the edit capability still validated during cancellation cleanup. After moving revocation before `Fiber.interrupt`, [GREEN](m3-03/cancellation-green.log) passed 19 tests/87 assertions. The [final focused run](m3-03/focused-final.log) confirms the final isolated test/source candidate.

Exploratory [integration-green](m3-03/integration-green.log) and [expanded-green](m3-03/expanded-green.log) logs include one real Java composition test temporarily written before the coordinator clarified separate integration ownership. That test/import was removed. These historical logs are retained but **are not credited to the final M3 module selection or production integration**.

## Final verification

Commands ran with pinned `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`, Bun `1.3.14`. Core test runs used `OPENCODE_TEST_HOME=/private/tmp/m3-03-home`, `XDG_CONFIG_HOME=/private/tmp/m3-03-home/config`, `XDG_DATA_HOME=/private/tmp/m3-03-home/data`, `XDG_CACHE_HOME=/private/tmp/m3-03-home/cache`; the recovered Session regression command additionally set `XDG_STATE_HOME=/private/tmp/m3-03-home/state`. Tests/typechecks ran from their package directories.

| Cwd | Command | Exit/result | Evidence |
| --- | --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/agent-and-context/m3-03.test.ts` | 0; 19 passed, 0 failed, 87 assertions | [focused-final](m3-03/focused-final.log) |
| `packages/core` | `bun test ./test/ftc/agent-and-context/m3-01.test.ts ./test/ftc/agent-and-context/m3-02.test.ts` with task-owned state root | 0; 18 passed, 0 failed, 116 assertions | [affected-session-regressions](m3-03/affected-session-regressions.log) |
| `packages/core` | Initial affected command additionally included `./test/ftc/java-development/m5-02.test.ts` | 1 overall; M5-02 30 passed/125 assertions; M3-01/02 failed at setup with 2 EPERM errors | [affected-regressions-setup](m3-03/affected-regressions-setup.log) |
| `packages/schema` | `bun test ./test/ftc-agent.test.ts ./test/ftc-java.test.ts ./test/contract-hygiene.test.ts` | 0; 24 passed, 0 failed, 66 assertions | [schema-tests-final](m3-03/schema-tests-final.log) |
| `packages/core` | `bun typecheck` after final fixture cleanup | 0 | [core-typecheck-final-cleanup](m3-03/core-typecheck-final-cleanup.log) |
| `packages/schema` | `bun typecheck` | 0 | [schema-typecheck-final](m3-03/schema-typecheck-final.log) |
| Repository | `bun x oxlint` over the four assigned source/test files plus coordinator-owned Schema root | 0; 0 warnings/errors | [lint-final](m3-03/lint-final.log) |
| Repository | `bun x prettier --check` over those five files | 0 | [format-final-cleanup](m3-03/format-final-cleanup.log) |
| Repository | `git diff --check` | 0 | [diff-check](m3-03/diff-check.log) |

The first affected regression command omitted `XDG_STATE_HOME` and attempted `/Users/dylanxu/.local/state/opencode`, which the sandbox rejected. It did not demonstrate a product failure; the two affected Session files passed after adding the missing task-owned state root. The already-passing M5-02 selection was preserved rather than redundantly rerun. Initial package typechecks contained three new fixture branding/literal errors; [Core](m3-03/core-typecheck-initial.log) retains its initial errors, and both final package checks passed after fixture correction. [Lint before cleanup](m3-03/lint-before-cleanup.log) recorded three unnecessary fixture assertions; these were removed and scoped lint was refreshed to zero warnings. No foreign-lane source correction was made.

## Scope review and limits

Assigned changes are the two new production files, focused Core and Schema tests, this report and task evidence. The coordinator's root export is separately owned. [Source review](m3-03/source-review.diff) and [source SHA-256](m3-03/source-sha256.txt) identify the candidate; canonical Java Schema is hashed as an unchanged dependency. [Unchanged Java producer check](m3-03/java-unchanged.log) confirms no Java facade/document/Schema diff from the base.

No host policy/event adapters, Java production composition, UI approval flow, provider execution, local-build orchestration, robot operation, release, Windows execution or physical hardware was enabled/tested by this task. Actual current-revision conflict safety is producer-owned; the passing existing M5-02 selection exercises its real temporary-filesystem implementation separately. No build/deploy/start/tuning authority or new-file semantics were added. Missing robot facts confer no authority; this facade returns code records/errors only.

Independent review, coordinator commit/root delivery and ledger reconciliation remain coordinator gates. Any candidate source edit after this report requires refreshed relevant checks and hashes.
