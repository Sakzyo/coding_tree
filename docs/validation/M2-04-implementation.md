# M2-04 — Submit without admitting a busy chat's draft

Implementation owner `/root/m2_04`; assigned base `a232ce6ca505cf0fac8adb1817a9a7938d481e18`. **DONE_WITH_CONCERNS candidate, frozen for independent review.** Coordinator owns Git, checklist and ledger. Shared HEAD at source freeze was `af062679b49123c749fd6656c9bc1d7ef0588512`; disjoint coordinator commits advanced it during implementation. Exact four source/test hashes are in [SHA256SUMS](m2-04/SHA256SUMS).

## Approved contract before implementation

`FtcProjects.submitter({gate, admission, handoff})` returns the separate `submitPrompt` facet; existing project-only layers are unchanged. Gate consumes canonical ChatRef and returns canonical GateResult; each acquisition is its own token. Admission uses the existing Session prompt port, errors, prompt/options and receipt. Submit reserves first, returns busy before admission, and calls canonical prompt with `resume:false` while holding the reservation. Explicit admit-only submission releases that unused token without handoff. Default/true submission invokes masked `handoff({chat,receipt,lease})`; success means exact-token responsibility has been accepted, not execution completion. The adapter must register ownership before scheduling advisory wake and release only after execution has acquired a distinct claim or terminal no-work/failure/cancellation settlement. A failed/defective handoff must leave no accepted token or scheduled wake. Submission releases its own token on admission/handoff failure or cancellation before handoff acceptance. Durable admission may already have committed; compensation never deletes Session input. M2-05/06 own production adapter/composition; no Session runtime changes, second loop or private Session store.

Handoff is bounded ownership registration and must never await model execution or terminal settlement. Cancellation during masked handoff waits for that registration; if acceptance succeeds, the adapter retains responsibility even if the submitting fiber is then interrupted. The gate factory retains all live claims until exact releases or its owning scope closes. Submission itself stores no durable state and creates no process, subscription or provider loop.

Schema owns serializable `FtcProject.SubmitPrompt` and `SubmitResult`; prompt input, message ID, delivery and admission receipt reuse their canonical Session schemas. Core re-exports the exact Schema values. The admission port is `Pick<SessionV2.Interface, "prompt">`, preserving the canonical NotFound/PromptConflict error identities. No root barrel, migrations, SQL, gate implementation, Session runtime, Protocol, Server, Client, SDK or host wiring changed.

## Behavioral RED and repairs

The test was written first. Minimal exported-facet scaffolding then forwarded canonical prompt admission while deliberately ignoring the supplied gate and handoff. [Initial RED](m2-04/red.log) failed on the real module's busy submission result: expected `{kind:"busy",active:first}`, received an admitted receipt for the rejected draft. Exit 1; 0 pass, 1 fail, 2 assertions. This was a behavioral failure, not a missing export/import or harness failure. [Lifecycle RED](m2-04/lifecycle-red.log) recorded the other missing ownership behaviors before implementation: 0 pass, 7 fail, 9 assertions. Those historical tests were expanded afterward; this is not claimed as RED evidence for all final cases.

The first GREEN attempt had 6 pass/1 fail because Effect 4's `Fiber.interrupt` returns void; the cancellation test incorrectly treated it as an Exit. The fixture now awaits `Fiber.await` after interruption. That test-harness diagnostic is retained in [green.log](m2-04/green.log), not counted as product failure evidence. Initial Schema types caught unbranded expected ChatRefs and a widened delivery literal in the new contract test; branded fixture constructors and a literal delivery repaired those test types. Earlier M4 typecheck snapshots also caught the unfinished receipt fixture's missing attachment MIME shape and the then-admitted-only scaffold result; both were corrected in this lane. Final checks below are green.

## Assertion map

Cases are in `packages/core/test/ftc/projects-and-chats/m2-04.test.ts`:

| Requirement | Concrete behavioral evidence |
| --- | --- |
| Busy draft never calls admission | Line 70: `admittedChatIDs === [first.chatID]`; `afterIdleAdmissionCount === 1`; idle settlement does not replay draft; explicit later resubmission admits it. Exact facade Schema and returned receipt identity assertions. |
| Successful handoff is not settlement; separate roots run | Line 99: competing chat stays busy after successful handoff, another project's chat admits, releasing one root leaves the other owned. |
| Explicit admit-only admission | Line 115: idle `resume:false` admits and releases, skips handoff; busy different-chat `resume:false` refuses; same-chat admit-only releases its own reservation while preserving active execution ownership. |
| Failure and defects | Lines 134, 150, 257: canonical admission error is preserved; failed same-chat claim cannot release another accepted token; handoff failure retains already-admitted receipt while releasing unused token; admission/handoff defects clean up. |
| Cancellation | Lines 165, 225, 291: pending admission cancellation preserves another same-chat claim; masked handoff cancellation retains accepted ownership until adapter settlement; cancelled acquisition and rejected membership never call admission. |
| Canonical options and tokens | Line 188: default steer and explicit queue pass existing prompt/message-ID/delivery values with internal admit-only behavior; same-chat calls get two distinct tokens; one release leaves the second live. |
| Concurrent different chats | Line 275: exactly one admitted result, one busy result, one receipt and one accepted claim. |
| Real durable Session admission | Line 325: actual SessionV2/SQLite pipeline admits one row, exact retry from `resume:false` to true returns the same receipt without another row, busy admit-only draft creates no row, changed prompt/delivery/Session reuse raises canonical PromptConflictError. Cancellation after real durable commit retains the row while releasing unused reservation. |
| Old execution settles during admission | Line 407: a pending new reservation bridges old execution release; competing chat cannot admit; transferred token differs from old; stale old release cannot unlock new owner. |
| Schema contracts | `packages/schema/test/ftc-submission.test.ts`: absent options encode without undefined properties; canonical input attachments/delivery; malformed IDs/delivery/receipts reject; existing SessionInput receipt round-trips; stable public identifiers. |

Controlled admission/handoff fixtures observe the real submission facet and real M2 gate. They own no alternate Session repository. The separate integration case uses the actual SessionV2 persistence/admission pipeline with SQLite; it does not duplicate retry logic. Its controlled execution port defects if admission attempts advisory wake, proving the internal admit-only split. Actual local gate/coordinator lifecycle regressions are included below; production handoff composition is still future work.

## Commands and results

Pinned Bun `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`, version `1.3.14 (0d9b296a)`. Core test commands use:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH \
OPENCODE_TEST_HOME=/private/tmp/ftc-m2-04/home \
XDG_DATA_HOME=/private/tmp/ftc-m2-04/data \
XDG_CONFIG_HOME=/private/tmp/ftc-m2-04/config \
XDG_CACHE_HOME=/private/tmp/ftc-m2-04/cache \
XDG_STATE_HOME=/private/tmp/ftc-m2-04/state
```

Schema, typecheck and scoped-tool commands use the same pinned PATH. The isolated roots are task-owned; SQLite integration fixtures use disposing temporary directories. No user app/server was restarted. Tests and `bun typecheck` ran only from their package directories.

| Command | Cwd | Exit/result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/projects-and-chats/m2-04.test.ts` | `packages/core` | 1; intended draft admission failure | [RED](m2-04/red.log) |
| Same focused command, final | `packages/core` | 0; **14 pass, 0 fail, 77 assertions** | [focused final](m2-04/focused-final.log) |
| `bun test ./test/ftc/projects-and-chats/m2-01.test.ts ./test/ftc/projects-and-chats/m2-02.test.ts ./test/ftc/projects-and-chats/m2-03.test.ts ./test/ftc/projects-and-chats/m2-04.test.ts ./test/ftc/agent-and-context/m3-02.test.ts ./test/session-prompt.test.ts ./test/session-run-coordinator.test.ts` | `packages/core` | 0; **121 pass, 0 fail, 422 assertions**; before three facade/receipt identity assertions and documentation-only final edits. Final focused run covers those assertions; not claimed as a combined final 425-assertion run. | [affected covering](m2-04/covering.log) |
| `bun test ./test/ftc-submission.test.ts ./test/contract-hygiene.test.ts` | `packages/schema` | 0; **7 pass, 0 fail, 19 assertions** | [Schema final](m2-04/schema-tests-final.log) |
| `bun typecheck` | `packages/core` | 0; final source/test types | [Core final](m2-04/core-typecheck-final.log) |
| `bun typecheck` | `packages/schema` | 0; final types, later formatting only | [Schema final](m2-04/schema-typecheck-final.log) |
| `bunx --no-install oxlint packages/core/src/ftc/projects.ts packages/schema/src/ftc-project.ts packages/core/test/ftc/projects-and-chats/m2-04.test.ts packages/schema/test/ftc-submission.test.ts` | repository | 0; **0 warnings, 0 errors** | [lint final](m2-04/lint-final.log) |
| `bunx --no-install prettier --check` with those same four paths | repository | 0; all formatted | [format final](m2-04/format-final.log) |
| `git diff --check --` with those four paths and this report/brief | repository | 0 | [diff check](m2-04/diff-check.log) |
| `shasum -a 256` with those four source/test paths | repository | 0; exact candidate freeze | [SHA256SUMS](m2-04/SHA256SUMS) |

## Scope and remaining gates

Scoped diff adds only the submission port/facet, canonical request/result records, meaningful tests and task evidence. The coordinator explicitly approved the brief addendum before coding. No Git/index/commit or ledger/checklist mutation by this worker. No extra project-only service stub, global state or module registry.

M2-05/06 must compose the transactional handoff adapter with the existing execution gate; passing these narrow-port tests does not claim production desktop/Server wiring. The adapter must honor bounded registration, exact-token responsibility, execution/no-work/failure/cancellation settlement and no release merely on wake return. Full unrelated package suites, renderer/performance acceptance, UI, macOS/Windows production delivery, provider/network and physical-robot gates were not run. No public Protocol/HttpApi or legacy SDK surface changed, so regeneration was not applicable. Independent review and coordinator commit/ledger completion remain open.
