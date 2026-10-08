# M1-01 fix-round 2 scoped independent review

**Specification: Compliant for the assigned standalone M1-01 scope.** Original findings **I1 ADDRESSED** and **I2 ADDRESSED**, including the remaining cross-project canonical-ingress case.

**Quality: Approved.** No new Critical or Important issue found in this fix. Root owns completion credit and ledger changes.

## Scope

Reviewed the complete 175-line two-path `M1-01-fix2-review.diff`, source base `0a0a23ed9`, frozen head `dd00790ac897e32d909b8d2b6b0295a59c13968e`. Compared it with the exact brief, original I1/I2 findings, fix1 review and appended fix2 implementation report. Review was limited to closure of the remaining I2 defect and new blocking defects introduced by this fix. No unrelated source or initial whole-diff review was repeated.

## Findings closure and strengths

- **I1 remains ADDRESSED.** The earlier project-local revision/merge repair remains intact in the supplied diff (`packages/app/src/ftc/workspace.tsx:139–151`), and the candidate's full 62-case run retains the prior regression. No flow restriction or new selection/draft change is introduced here.
- **I2 ADDRESSED.** `packages/app/src/ftc/workspace.tsx:166–178` now revalidates every cached active owner after accepting canonical membership. A conflicting full identity invokes existing owner rejection and localized recovery. This closes the late A-create/B-owner gap: removing a conflicting observation from `observedOwners` is now accompanied by invalidating the cached ready owner that supplies the stop target.
- Both canonical ingress paths call the same repair: list at `workspace.tsx:146`, create at `:256`. The two narrower project-only checks are removed. Nonconflicting owners do not trigger rejection; the change introduces no new command, domain execution claim, schema, locale or facade.
- The delayed-create regression at `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts:1037` checks the empty conflicting stop sink, retained B chat/history/draft, localized recovery and no submission. Its paired positive case preserves the exact nonconflicting owner/stop target.
- The delayed-list regression at `m1-01.test.ts:1068` uses a current A query rather than bypassing cancellation. The retained actual slot getter at `:1102` observes removal of B's offscreen cached conflicting owner before revisiting B; subsequent checks retain both drafts and valid stop/recovery behavior. Its paired positive case guards against indiscriminate invalidation.

## Evidence inspected and verification

Read legible archived evidence rather than rerunning suites:

- `m1-01/fix2-red.log`: genuine behavioral RED, **60 pass / 2 fail / 235 assertions**, 62 cases. Failures are the invalid B stop packet after A creation and stale cached B active identity after A listing; positive nonconflicting controls pass.
- `m1-01/fix2-focused-final.log`: **62 pass / 0 fail / 246 assertions**, including all four new cases.
- `m1-01/fix2-reviewer-probe.log`: unchanged fix1 independent reproducer passes **1 test / 3 assertions**. This is the implementer's rerun of the prior independent probe, not a newly executed reviewer test.
- `m1-01/fix2-browser-final.log`: **9 pass / 15 assertions**. App typecheck log records `tsgo -b`, with completed exit 0 reported by the coordinator. Lint records **0 warnings / 0 errors**; formatting and whitespace pass; runtime import inspection still shows only Solid imports and erased facade types.
- Current six-source manifest, archived verification, four-unchanged-source evidence, and unchanged initial reviewer artifacts were inspected. Independently ran `shasum -a 256 -c docs/validation/m1-01/fix2-source-sha256.txt` from `/Users/dylanxu/coding_tree`: **exit 0, all six current hashes match**.

No uncovered concrete doubt required another runtime probe. No tests, app/server startup, Git/index/product/ledger mutations, delegation or evidence regeneration were performed during this review. Only this report was written; prior evidence remains intact.

## Issues

**Critical:** None found in the fix scope.

**Important:** None remaining from I1/I2; none newly introduced by this fix found.

## Retained acceptance boundaries

This approval closes the original task-level software review findings cumulatively. It does not establish production host composition or actual existing chat-renderer integration, durable restart behavior, real provider/backend concurrency, visual browser/host acceptance, complete official-guide/native editorial approval, full bilingual release acceptance, native/platform packaging, FTC toolchain or physical robot behavior. Those disclosed later gates remain unrun and separate. The supplied presentation boundary remains the accepted standalone task boundary; M2 remains runtime authority.

**Assessment: Approved.** The central repair covers both canonical ingress paths and all cached active owners, with actual-component negative/positive regressions and preserved draft/history behavior. I1 and I2 are closed for frozen candidate `dd00790ac897e32d909b8d2b6b0295a59c13968e`.
