# M1-01 task-scoped independent review

**Specification: Issues found.** The six assigned source/test/locale files implement the standalone supplied-port scope, but chat-creation/query ordering and conflicting owner membership remain incomplete (I1–I2).

**Quality: Needs fixes.** Two focused actual-component probes reproduce behavior defects. No production-composition or whole-branch verdict is implied.

## Scope and evidence

- Reviewed the exact `M1-01-brief.md`, `M1-01-implementation.md`, and supplied `M1-01-review.diff`, base `00a6067cc`, candidate `87fffe434fe1f6a4b1cf91bec7b5ba3e8a9eb97e`; followed the SDD task-reviewer template and root/App instructions. The initial combined tool response truncated the diff/report inside functions, so the cut-off workspace/facade/test bodies and locale hunks were recovered in bounded reads. No Git commands, broad branch exploration, product edits, existing-suite reruns, subagents, app/server restart or network access.
- All six assigned paths have their corresponding hunks. The root-owned `.gitignore` addition excludes exactly `/docs/validation/m1-01/empty-recovery-red.log`. The oversized original was not read; its disclosed bounded excerpt/provenance is distinct from the complete named behavioral RED.
- Read the existing logs: named intended RED is 1 failed assertion about missing active chat; final actual DOM is 42 pass/154 assertions, locale 7 pass/1031 assertions, affected browser 9 pass/15 assertions, lint 0 warnings/0 errors, and formatting passes. Runtime-import evidence shows only Solid runtime imports. Coordinator reports the matching six frozen hashes and package typecheck; no redundant suite/typecheck rerun was performed.
- Named additional risks inspected: (a) whether an older chat-list query can supersede a later successful create command; (b) whether same-project owner data can conflict with a known chat/Session mapping and reach a command. Both checks use only the candidate fixture and actual workspace, in `docs/validation/m1-01/reviewer-probe.test.ts:163` and `:178`.

## Strengths

- `packages/app/src/ftc/facades.ts:1–40` uses type-only canonical contracts, typed translation, and a supplied presentation boundary. `workspace.tsx:10–28` scopes local state/command retirement to a component; there is no second execution owner or history repository.
- `workspace.tsx:395–425` captures the full selected identity and draft revision before asynchronous submission; edit-and-revert protection is substantive. `workspace.tsx:59–115` invalidates stale initial owner results after an event. `workspace.tsx:234–260` keeps recovery on the canonical root and captures the stop target without declaring idle.
- `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts:18–38` compiles the actual TSX at the one owned path before import; `:113–145` supplies presentation and observes real reactive DOM/disposal. Existing tests cover independent project selection, deferred draft updates, cancellation, foreign-project results and explicit commands rather than merely reproducing workspace logic.
- `packages/app/src/i18n/en.ts:4–11` and `zh.ts:6–12` add exactly the seven assigned phrases; the diff leaves prior English intact. `parity.test.ts:18–26,121–137,158–168` adds a literal missing-key exception for non-zh dictionaries and corresponding en/zh placeholder checks without a prefix exemption or removal of prior coverage.

## Issues

### Critical

None found within this task scope.

### Important

**I1 — Older list result erases a newly created chat from the view.** `packages/app/src/ftc/workspace.tsx:137–141`, `:224–229`, `:301`.

The new-chat action stays enabled while `listChats` is pending. If that query captured `[a1]`, then `createChat` succeeds with `a2`, the component correctly selects `a2` and permits drafting. When the original query later resolves, it unconditionally replaces the list with `[a1]` and selects `a1`. The successful new chat and its unsent draft disappear from the current selection until another query happens to recover membership. This violates explicit canonical-success selection and stale-query/draft safety; it can occur with individually correct ports and a normal delayed snapshot. Protect list application against intervening membership/selection changes, or serialize the relevant operations, retaining the successful canonical member and current draft. Add this deferred-query regression to the product test suite.

Evidence: focused probe `reviewer-probe.test.ts:163–176` first confirms displayed `chat_a2` after creation, enters `new chat draft`, then resolves the older `[a1]` list. The next assertion expects `chat_a2` but receives `chat_a1`.

**I2 — Known chat/Session conflicts are accepted as an active stop target.** `packages/app/src/ftc/workspace.tsx:68–83`, `:253–260`, `:410–417`, `:459–460`.

`validOwner` checks only the project ID. With the list already containing canonical `(project_a, chat_a2, ses_a2)`, an event `(project_a, chat_a2, ses_b1)` is marked ready, displayed, and forwarded to `ports.stop`. The busy-submit result path likewise accepts any same-project mapping. Full ChatRef identity is used for keys but not reconciled against known membership at these ingress points; new-chat results already perform such a consistency check. Reject conflicts with known chat-to-Session and Session-to-chat mappings, retain the existing draft/presentation, and expose localized recovery. Check both arrival orders when list and owner observations settle, while allowing a genuinely new nonconflicting owner record to be handled according to the supplied-port contract. M2 remains the runtime authority; this finding does not claim a backend execution bypass.

Evidence: focused probe `reviewer-probe.test.ts:178–186` sends the conflicting event after the normal list has loaded and clicks stop. Expected sink `[]`; actual sink `[{ projectID: "project_a", chatID: "chat_a2", sessionID: "ses_b1" }]`.

### Minor

None independently actionable beyond the two defects above.

## Focused verification

Working directory: `/Users/dylanxu/coding_tree/packages/app`.

```sh
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun test --conditions=browser --preload ./happydom.ts ../../docs/validation/m1-01/reviewer-probe.test.ts
```

Final focused run: exit **1**, **0 pass, 2 fail, 3 assertions**, one file. Both failures are behavioral assertions against the actual TSX; no fixture/import errors in that run. The probe copies only the candidate fixture preceding its tests, adjusts imports for its documentation location, and contains only the two new tests. Because the documentation directory lacks App dependency resolution, its Solid imports explicitly select the installed ESM browser files to retain the same owner identity as transformed workspace code.

Preparation failures are disclosed separately and are not defect evidence: the first probe-generation attempt used the wrong working directory and created no file; initial absolute package-directory imports selected Solid server CJS; restoring bare imports failed resolution from the docs directory. Explicit ESM browser-file resolution repaired the isolated probe harness. No product or shared harness configuration was changed.

## Cannot verify from this diff

Production composition/reuse of the actual existing chat renderer, durable restart behavior, provider/backend concurrency, visual browser/host clipping, native editorial/bilingual release acceptance, complete Microsoft PDF/Apple guide access, integrated lifetime checks, packaged platform behavior, native filesystem/toolchain and physical robot behavior remain separate gates as disclosed in the implementation report. The supplied presentation boundary is acceptable for this standalone task; it is not evidence that M1-11 production composition is complete.

**Assessment: Needs fixes.** The task is well scoped and has substantial real DOM coverage, but I1 is a reproducible normal asynchronous ordering defect and I2 leaves the specified exact membership boundary inconsistent across ingress paths. Repair and focused regressions are required before task credit.
