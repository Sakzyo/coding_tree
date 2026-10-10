# M9-02 implementation candidate — 2026-10-10

Worker: `/root/m9_02`. Status: **DONE_WITH_CONCERNS — implementation candidate for root-owned independent specification/code-quality review**. No task credit is claimed. The verified count remains 31/94 until root approves this candidate; the saved stopping milestone is 32/94. No task33 was started. No worker Git/index, ledger/checklist, delegation, host, provider, robot, producer, SQL, timer, transport or execution work was performed.

Read the exact unchanged M9-02 brief, continuation addendum/source audit, contract audit, interruption checkpoint, root/Schema instructions, execution prompt, source module/spec/design/shared constraints and prerequisite reports. The memory registry was used for isolated-module/ownership orientation; current source documents determine the implemented contract. Applied Superpowers TDD, writing-good-tests, systematic debugging and verification-before-completion. The explicit narrow verification scope in the brief and `docs/prompt.md` supersedes the skill's default whole-package test instruction. No whole-package or production acceptance pass is claimed.

## Implemented behavior and lifetime

The public facade now has exactly `prepareOperation` and `approveOperation`. Canonical `FtcOperation.ApprovalRequest` reuses the exact PreparedOperation operation-ID/fingerprint fields and stable identifier, with the exact Core re-export. The seven assigned approval error codes are canonical. The opaque `userEvent` exists only in the Core input; it is absent from Schema/JSON authority. Existing preparation-only ports, constructors and `make: Effect<Interface, never, Scope>` remain valid. PreparedOperation and Status are unchanged; a returned descriptor is the original deeply immutable preparation snapshot with `awaiting_approval` status, never a bearer token or current-consent promise.

Approval captures the scalar request/event reference and supplied claim/clock/deadline handles before waiting. It uses the existing private pending map, one claimed set, accepted-deadline map and first-reason tombstones. Unknown/caller-mismatched pairs never consume another event. The trusted synchronous claim, captured decision and reservation have no intervening yield; authentic mismatches can retire only the event's actual owner-known exact pair. A deliberate Deploy event accepts only stored deployment, with no second confirmation or initialization/start capability. Explicit approval binds only the stored action. Reject and exact trusted synchronous revocation retire pending/claimed/accepted consent irreversibly, including change-away/change-back; unknown/mismatched callback pairs cannot retarget another binding.

Construction forks only the supplied local observer and returns without awaiting registration. Missing, pending, failed, defective or malformed registration cannot set readiness; preparation stays available. Observation is supervised **and explicitly supplied** the private owner Scope, so successful and partially registered listener finalizers remain owned until owner disposal. A successful void result means readiness only under the documented trusted adapter postcondition: this exact listener was installed and stays installed until its owner Scope closes. Types/void alone cannot verify that semantic fact; no actual issuer or host protocol is invented here.

Every approval attempt owns a Scope for scoped clock/deadline resources, supervised by the owner and closed/joined on completion, failure and caller interruption. External registration/clock/deadline waits have no broad uninterruptible mask or lock. Claim/commit comparisons are synchronous. The existing beta.83 queued fiber-observer join is unchanged. Disposal first sets closed, disables readiness and clears pending/claimed/consent/tombstones, then closes/joins the private Scope; late callbacks cannot insert or approve. Held observer, preparation, clock and deadline cleanup do not reopen admission.

Clock/deadline numbers share only the supplied adapter comparison domain/unit; there is no inferred unit, TTL, wall clock or timer. Nonfinite or malformed facts fail closed. A deadline at/before claimedAt retires immediately; final now at/after deadline expires, and accepted consent may expire lazily on repeat. Matching precommit failure/interruption retires with `approval_cancelled` unless an earlier exact reason exists. The first canonical producer error remains visible on that first attempt, while repeats see its retirement reason; genuine defects and caller interruption remain distinguishable. Ordinary domain failures recheck owner/first-tombstone after both per-attempt cleanup and supervised join. Postcommit cleanup can delay the returned snapshot while exact callbacks revoke private consent; it grants no execution or later validity guarantee.

## Four-source candidate

The source audit reconstructs each original existing file by removing **only the assigned additions**. Its SHA-256 equals the reviewed prerequisite for Operations and Schema, and reversing the single M9-01 facade-key assertion exactly restores its old hash. All twelve protected document/instruction hashes in the old preparation manifest still match. Operations/Schema/M9-01 are byte-identical to root's interrupted draft; the new test differs only by the final helper return-type repair since that checkpoint.

| Source | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/operations.ts` | `e701c26a463962d19e196d735ef83adc91808fd30ea9d64093092a9ee11d35f8` |
| `packages/schema/src/ftc-operation.ts` | `30c49b1809b43bb808b25ebb29887d436dc45db1236c99f54454950ecd5bcbf9` |
| `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` | `685a7b9a327b9a61031cb0af18b9439cd1fc54c33c5701aa7120545fe84e051b` |
| `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts` | `12e3805e4bc5d40d24e4c1c8db956e943066b8055fc6698a46aece08c1c76c1e` |

Machine-readable source/import/whitespace/protected checks: [source-audit-resume-v2.json](m9-02/implementation-2026-10-10/source-audit-resume-v2.json), [four-source manifest](m9-02/implementation-2026-10-10/source-sha256-resume-v2.txt). Operations still imports only `node:crypto`, canonical operation/project Schema and Effect; Schema imports remain within its original browser-safe dependencies. No execution/transport/host/SQL/runtime-registry dependency or testing accessor was added. The pre-existing M9-01 parameterized-case label diagnostic Minor remains unchanged.

## Exact task/substep evidence

| Substep | Evidence and candidate result |
| --- | --- |
| 1: focused task test | Actual owner `Deploy click authorizes only the displayed build and target`, current new test line 156. The accepted artifact digest is the displayed literal; stored target is preserved; returned object is the original snapshot; genuine reuse yields `approval_consumed`; a forged event on a fresh binding yields `untrusted_approval`. |
| 2: meaningful baseline RED | [task-red.log](m9-02/implementation-2026-10-10/task-red.log), exit 1, 0 pass/1 fail/1 assertion: real owner cannot accept deliberate Deploy. A test-only absent-method guard fails approval; no production scaffold or missing-import exception was used. Original production hashes in task-red metadata equal prerequisite hashes. Fresh prior M9-01 baseline: 66 pass/194 assertions. |
| 3: smallest behavior | Four assigned source/test files only, canonical request/errors and owner-local approval transitions/owned lifetimes described above. No execution surface or producer implementation. |
| 4: verification | Current-source focused 79 pass/456 assertions; combined 145 pass/650 assertions; Core/Schema package `bun typecheck`, four-file lint/format and protected/import/whitespace audit all exit 0. Held cleanup/public-owner tests exercise actual scopes and public repeat behavior. |
| 5: review/record | This report and machine source/evidence freezes are ready. Independent review, Git/commit, ledger/checklist and task credit remain root-owned and **pending**, not self-approved. |

Current real-owner coverage includes both robot modes, user/agent prepared contexts, initialize/start/tune-specific consent, opaque fake/copied/serialized/code/wrong-owner events, unknown and same-hash/different-ID contexts, request/claim snapshots across preclaim and deadline waits, synchronous claim reentrancy, at-most-one concurrent acceptance with unrelated progress, rejection before/after acceptance, exact context-category callback retirement before/during/after acceptance, unknown callback isolation, before/equal/after expiry, malformed/missing effects and finite facts, canonical failures versus defects, no replay after legitimate cancellation, optional observer omission/failure/pending/malformed/partial registration, held success registration, per-attempt and owner-held clock/deadline cleanup, owner-closed precedence during cleanup, independent fresh owners/events and postcommit revocation. Distinct context fixtures cover project/chat/initiator/mode/controller/generation/build/digest/source/configuration/action/OpMode/field/value/state. They exercise the consumed callback boundary; they do not validate production change detectors or cross-window notification ordering.

## Commands and preserved outputs

All runs use pinned `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun` (reports Bun 1.3.14), with PATH prefixed by its directory. Each `*.json` contains exact argv, absolute cwd, exit, environment, full bounded log SHA-256 and four-source SHA-256. Logs are saved completely; output bound is 2,000,000 bytes and subprocess time bound 60 seconds. `OPENCODE_TEST_HOME` and XDG config/data/cache/state roots use distinct paths under `/private/tmp/m9-02-2026-10-10-home/`; HOME is not repurposed. Command/evidence digests are in the candidate freeze and evidence manifest.

| Final check | Exact argv after pinned Bun | cwd | Exit/result |
| --- | --- | --- | --- |
| `focused-resume-v2` | `test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts` | `packages/core` | 0; 79 pass, 456 assertions |
| `combined-resume-v2` | `test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts ./test/ftc/robot-approvals-and-operations/m9-02.test.ts` | `packages/core` | 0; 145 pass, 650 assertions |
| `core-types-resume-v2` | `typecheck` | `packages/core` | 0 |
| `schema-types-resume-v2` | `typecheck` | `packages/schema` | 0 |
| `lint-resume-v2` | `./node_modules/oxlint/bin/oxlint --deny-warnings packages/core/src/ftc/operations.ts packages/schema/src/ftc-operation.ts packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts` | repository directory | 0; 0 warnings/errors |
| `format-resume-v2` | `./node_modules/prettier/bin/prettier.cjs --check packages/core/src/ftc/operations.ts packages/schema/src/ftc-operation.ts packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts` | repository directory | 0 |
| `source-audit-command-resume-v2` | **Python:** `python3 docs/validation/m9-02/implementation-2026-10-10/source-audit-resume-v2.py` | repository directory | 0; exact original reconstruction, protected hashes/imports/whitespace |

Repository directory means `/Users/dylanxu/coding_tree`; all tests/types ran from package directories. Full final logs are [focused](m9-02/implementation-2026-10-10/focused-resume-v2.log), [combined](m9-02/implementation-2026-10-10/combined-resume-v2.log), [Core types](m9-02/implementation-2026-10-10/core-types-resume-v2.log), [Schema types](m9-02/implementation-2026-10-10/schema-types-resume-v2.log), [lint](m9-02/implementation-2026-10-10/lint-resume-v2.log), [format](m9-02/implementation-2026-10-10/format-resume-v2.log). All six final checks share the exact four-source manifest above.

No old run names/evidence were overwritten. The completed earlier failing/superseded runs remain explicit:

| Preserved run | Actual outcome | Resolution/limit |
| --- | --- | --- |
| `task-red` | Exit 1; deliberate Deploy missing | Mandatory behavior RED, then real owner GREEN. |
| `contract-red-bounded` | Exit 1; 62 fail | Additional pre-method matrix stopped at absent facade guard; not claimed as branch-by-branch RED. |
| `green-first` | Exit 1; 61 pass/1 fail | Held cleanup exposed owner-close error precedence through supervised join. Added final post-join state recheck; `green-owner-precedence` passes 62/344. |
| `expired-policy-red` | Exit 1; 1 selected fail | Known deadline<=claimedAt incorrectly read a later failing clock. Immediate expiry retirement fixes it; `expired-policy-green` passes 1 selected/4 assertions and final suite retains it. |
| `core-types-final` | Exit 2; duplicate request-property diagnostics | Intentional malformed fixture values moved into targeted Object.assign before interruption. |
| `lint-final` | Exit 1; 8 warnings/0 errors | Two obsolete canonical casts removed; deliberate malformed runtime fixtures use Object.assign; actual custom listener is installed/used. Later scoped lint passes without rule suppressions. |
| `core-types-resume-v1` | Exit 2; test-guard Effect union inference | Removing the obsolete cast inferred two separate Effect return types. A single explicit canonical Effect return annotation repairs the test helper; `core-types-resume-v2` passes. Product behavior is unchanged. |
| `source-audit-command-resume-v1` | Exit 1; inverse-script hash assertion | The evidence script retained two extra newlines while removing added interface members. Corrected only the evidence-script inverse slicing in separate v2 files; all three original source hashes reconstruct exactly. |

One exploratory full-matrix `contract-red` process was manually interrupted while the initial runner buffered stdout. No complete test log or reliable completed exit/source snapshot survives for that exploratory attempt; it receives **no acceptance credit**. The observed command interruption was exit 130 with Python KeyboardInterrupt. This limitation was reported immediately and is retained in root's interruption checkpoint; it is not presented as a completed RED or reconstructed raw output. The runner then switched to direct file streaming before the completed bounded contract RED and later checks. Mandatory initial task RED and both later product-defect RED/GREEN outputs are preserved. Earlier 79/456 and 145/650 runs predate the interrupted lint/type cleanup and are superseded by fresh resume-v2 results.

## Remaining concerns and unrun gates

Independent root-owned specification/code-quality review, candidate commit and ledger/checklist reconciliation are pending. The pre-existing case-label diagnostic Minor remains deferred. The incomplete exploratory buffered attempt is the evidence limitation described above; current required checks have complete saved outputs.

No actual user-action/display-bound event issuer, producer clock/deadline semantics, exact revocation ordering across windows, M2/M3 membership composition, full current M5 successful-build identity/provenance conversion, M8 verified identity/generation/state/capability producer, controller lease, dispatch-time freshness/revalidation/consumption, mutation transport, durable operation outcomes, enforceable host/tool/dashboard bypass isolation, macOS/Windows packaged host or physical robot matrix was run or established. The M9 artifact revision-array projection remains a supplied fixture; future M5 composition must reconcile its complete input identity rather than silently reducing it. AC-10/AC-11 remain unfulfilled by isolated approval tests. No broader package suite, production app/server/provider, FTC toolchain or hardware operation was run.
