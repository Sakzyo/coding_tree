# M9-01 preparation implementation candidate

Date: 2026-10-08. Worker: `/root/m9_01`. Status: **DONE_WITH_CONCERNS — candidate pending independent review**.

Task: M9-01. Requirements: ROB-03, ROB-04, ROB-07. Acceptance context: AC-10 and AC-11 remain production/physical gates; this report establishes isolated preparation behavior only.

Source base and current HEAD at verification: `5fdd801e145c422700bbba9643a747f0113a58e6`. Product changes are uncommitted. Coordinator owns Git/index, task checkboxes, progress ledger and shared exports; this worker did not commit or change those shared files. The coordinator added `FtcOperation` to `packages/schema/src/index.ts`, which is included in checks and the frozen source manifest.

## Scope and implemented behavior

- Added canonical browser-safe `FtcOperation` records at the assigned Schema path: independent RobotMode, exact-prefix OperationID, M9-owned DeploymentArtifactContext, Action, OperationRequest, Status, PreparedOperation and structured OperationError. Core re-exports the exact Schema values.
- DeploymentArtifactContext contains projectID, buildID, sourceRevision (a nonempty array of canonical FtcJava.Revision records), configurationRevision and digest. It carries no filesystem path or build capability and is not M5 ArtifactRef. M5 producer evidence is still required at production composition.
- Core `Operations.make`/layer creates only scoped in-memory state. Its facade exposes only `prepareOperation`. Mandatory read-only policy resolves an opaque caller object against trusted project/chat/Session, initiator, independent robotMode, selected controller, opaque string generation, verified status and exact action-kind capability. Caller assertions cannot replace those facts.
- Observation rejects agent initialize/start/tune. Deployment can prepare in either mode. Authenticated direct-user preparation can omit chat and can prepare controls in observation. Every accepted request remains `awaiting_approval`; no initiator, code setting, fingerprint or serialized request supplies approval.
- Required non-null finite JSON state/value and exact nonempty trimmed OpMode/field are structurally checked. The mandatory narrow semantic/artifact port decides version-specific support. Valid zero and false survive. No robot state enum, tuning range or missing producer semantics are inferred.
- Runtime ingress first validates the canonical type with excess-property rejection, then canonical Schema encode/decode omits undefined optional keys. The validated request is copied and deeply frozen before policy/parameter waits; mode and opaque caller identity are captured at the same boundary.
- A deterministic SHA-256 fingerprint uses JSON with object keys sorted by code-unit order and covers project, optional chat, initiator, controller, generation, mode and the full action. Generated operationID is excluded. Only accepted immutable PreparedOperation values enter the private owner-local map, after the final active guard. Disposal marks the owner closed and clears that map before interrupting/joining the owned waits.
- Caller interruption owns one preparation and waits for its asynchronous port cleanup. Owner disposal waits for all owned cleanup, rejects new work and prevents late successful preparation. No public test accessor, approval/execute/status method, mutation/transport port, SQL, timer, subscription or host wiring was added.

## TDD and debugging evidence

Read Superpowers TDD and its writing-good-tests reference before implementation. The exact required test was written first; an importable no-policy scaffold returned `unsupported_operation` so RED exercised a real service call without a missing-import failure. [red.log](m9-01/red.log) records **0 pass / 1 fail / 1 assertion**, with expected `observation_only` and actual `unsupported_operation`; the test process exited 1. The shell that printed that log returned 0, so that shell wrapper result is not used as the test result. The scaffold was replaced by the implementation.

The expanded initial run, [green-initial.log](m9-01/green-initial.log), recorded **51 pass / 4 fail / 145 assertions** (exit 1): direct-user optional omission, agent missing-chat error classification, and both asynchronous disposal cases. Those failures were investigated with Superpowers systematic-debugging, not timeout increases.

Optional decoding investigation showed that the repository's optional helper accepts explicit undefined in its Type but not its encoded wire input. The canonical runtime-type validation/encode/decode boundary resolves this without admitting malformed values.

Five [disposal diagnostic logs](m9-01/disposal-diagnostic-5.log) preserve the lifecycle investigation. Diagnostics showed resource cleanup and the caller release completing while the concurrent owner Scope closer never completed. The coordinator identified the existing verified beta.83 observer-list issue; worker source inspection confirmed `fiberJoin` resumes synchronously and Fiber completion iterates a mutable observer array. A local `joinPreparation` callback defers resume with queueMicrotask, allowing the owner retirement observer to receive its notification before observer removal. There is no import of the M6 lifecycle implementation. Both held owner-cleanup tests then passed without changing timeouts. Temporary instrumentation was removed.

[green.log](m9-01/green.log) records the first clean **55 pass / 0 fail / 158 assertions**. Additional coverage then checked all scalar fingerprint bindings, control snapshot fields, asynchronous caller cleanup, malformed supplied verified/controller facts and canonical root-barrel identity.

An initial Core typecheck failed on Bun `test.each` readonly-table inference and JSON literal-union inference; [core-typecheck-initial.log](m9-01/core-typecheck-initial.log) preserves it. Test tables were corrected without weakening the contract. Initial scoped lint had seven warnings, then one; all introduced diagnostics were resolved. Final lint is clean.

## Frozen verification

Environment: macOS 26.5.2, arm64; pinned `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`, version **1.3.14**, build `0d9b296a`; repository Effect **4.0.0-beta.83**. No dependency installation was performed.

Every Core test command used this exact inline environment prefix (package working directory listed below):

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH OPENCODE_TEST_HOME=/private/tmp/m9-01-home XDG_CONFIG_HOME=/private/tmp/m9-01-home/config XDG_DATA_HOME=/private/tmp/m9-01-home/data XDG_CACHE_HOME=/private/tmp/m9-01-home/cache
```

Typecheck/format/lint commands used the same pinned PATH. Full output was redirected to the linked logs; process exit was captured before printing output.

| Working directory | Exact command after environment prefix | Actual final result | Evidence |
| --- | --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts` | exit 0; 66 pass, 0 fail, 194 assertions | [focused-final.log](m9-01/focused-final.log) |
| `packages/core` | `bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts ./test/ftc/agent-and-context/m3-03.test.ts ./test/ftc/projects-and-chats/m2-05.test.ts ./test/ftc/ftc-configuration-and-libraries/m6-03.test.ts` | exit 0; 125 pass, 0 fail, 453 assertions across 4 files | [trust-lifecycle-final.log](m9-01/trust-lifecycle-final.log) |
| `packages/core` | `bun typecheck` | exit 0 (`tsgo --noEmit` through package script) | [core-typecheck-final.log](m9-01/core-typecheck-final.log) |
| `packages/schema` | `bun typecheck` | exit 0 (`tsgo --noEmit` through package script) | [schema-typecheck-final.log](m9-01/schema-typecheck-final.log) |
| repo root | `bun node_modules/oxlint/bin/oxlint packages/schema/src/ftc-operation.ts packages/core/src/ftc/operations.ts packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts packages/schema/src/index.ts` | exit 0; 0 warnings, 0 errors | [lint.log](m9-01/lint.log) |
| repo root | `bun node_modules/prettier/bin/prettier.cjs --check packages/schema/src/ftc-operation.ts packages/schema/src/index.ts packages/core/src/ftc/operations.ts packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` | exit 0; all matched files formatted | [format.log](m9-01/format.log) |
| repo root | `git diff --check` | exit 0 | [diff-check.log](m9-01/diff-check.log); new files also covered by format/lint checks |
| repo root | exact `shasum` command below | exit 0; frozen product/shared-export/source hashes | [source-sha256.txt](m9-01/source-sha256.txt) |

Exact source-freeze command from repo root:

```sh
shasum -a 256 packages/schema/src/ftc-operation.ts packages/schema/src/index.ts packages/core/src/ftc/operations.ts packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts docs/validation/M9-01-brief.md docs/validation/M9-01-preflight.md docs/prompt.md docs/proposal.md docs/high-level-design.md docs/tasks/robot-approvals-and-operations.md AGENTS.md packages/schema/AGENTS.md > docs/validation/m9-01/source-sha256.txt
shasum -a 256 -c docs/validation/m9-01/source-sha256.txt
```

The second command exited 0 with all twelve entries matching; see [source-verification.log](m9-01/source-verification.log).

An earlier selected regression invocation misspelled the M6 directory and therefore ran only the two existing trust/lifecycle files: 39 pass / 169 assertions in [trust-lifecycle-initial.log](m9-01/trust-lifecycle-initial.log). That is not claimed as M6 verification. The final command above used the actual `ftc-configuration-and-libraries` path and ran all four named files. A subsequent intermediate four-file run had 121 pass / 436 assertions before the last supporting test additions; the final frozen counts are the table above.

The scoped source/import inspection is saved in [boundary-audit.log](m9-01/boundary-audit.log). Operations runtime imports only node:crypto, canonical Schema namespaces and Effect. Pending insertion follows the active guard; clearing precedes owner-scope close. The actual facade-key assertion allows only prepareOperation and confirms no execute method. Real preparations reach the recording read-only fixture ports. The task's exact zero-dispatch counter assertion is retained, but the counter alone is not proof: exclusion of a dispatch capability and inspected absence of mutation/transport/host imports establish this module's boundary. This is not a composed production bypass test.

## Fixture classification and remaining gates

M9-01 tests exercise the real Operations service with controlled read-only policy/semantic ports. Caller handles, verified target/action capabilities, successful/current artifact eligibility and supported parameter values are supplied fixture facts. They do not establish actual M2/M3 authentication composition, M5 successful/current producer evidence, M8 physical identity/capability provenance or any user's real consent. M6 regression evidence includes its existing protected-reader fixture/local checks and is not expanded into release/platform acceptance.

**NOT RUN / still required:** M5 build/artifact producer and current-success binding; M8 verified controller identity/generation/capability composition; M9-02 exact single-use approval; M9-03 through M9-06 coordination/current-state/dispatch/outcome/transport; M9-07 action isolation (existing BLOCKED ruling unchanged); M9-08 production host enforcement; M9-09 physical controllers/transports; macOS/Windows production app, installed FTC toolchain, provider/model, USB/Wi-Fi, robot lifecycle/tuning and packaged release checks. No host execution or robot-changing control was enabled.

Only requested focused/affected suites were run, as bounded by docs/prompt.md and the dispatch brief; the complete Core test suite was not run and no full-suite pass is claimed. No network/provider/robot/toolchain/credential process was operated. Independent review, coordinator commit and ledger/checklist accounting remain outside this worker's candidate completion.
