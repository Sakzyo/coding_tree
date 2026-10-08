# M1-01 standalone workspace implementation brief — 2026-10-08

Released on explicit continuation to `/root/m1_01` as sole product writer from `00a6067cc`, 2026-10-08. Prepared source hashes still match; retain unchanged baseline/probe evidence. Actual component behavioral RED/GREEN is still required. Current session target is 32 completed tasks in total, then checkpoint and stop. Read root/app AGENTS.md, docs/prompt.md, M1 module/global constraints, PRJ-01–04, the design M1 ownership/concurrency sections and docs/validation/M1-01-preflight.md. No existing application route or session/timeline edits.

Allowed product paths: packages/app/src/ftc/facades.ts, packages/app/src/ftc/workspace.tsx, packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts; necessary new typed locale keys only in packages/app/src/i18n/en.ts and zh.ts. Preserve all existing English keys/wording. Root owns Git/ledger/checklists. No Schema/API/client generation, Core/Server runtime imports, host registration, manifests or provider/robot execution. Report docs/validation/M1-01-implementation.md and owned docs/validation/m1-01/* evidence. No worker commits or subagents.

Additional exact assignment: packages/app/src/i18n/parity.test.ts, only to allow these newly rendered workspace keys to be missing in non-zh dictionaries and verify complete English/Chinese phrases and identical placeholders: ftc.workspace.activeChat, ftc.workspace.busyDraft, ftc.workspace.queryFailed, ftc.workspace.retry, ftc.workspace.reopen, ftc.workspace.membershipFailed, ftc.workspace.sendFailed. Reduce this literal set if any key is not actually needed/rendered. No broad prefix exemption, new unassigned keys or weakening of existing locale/plural/placeholder checks. Existing Language merge supplies English fallback; other new-key translations remain outside the first-version contract.

Use the verified test-local Bun onLoad Solid/TypeScript compiler before dynamic actual component import, restricted to the one workspace TSX path and installed Vite Solid dependencies. Use ordinary ESM Solid imports to preserve owner identity. No shared preload, dependency/lockfile, existing session/timeline or app-server changes. Localization source evidence and unavailable full-guide/native/bilingual audit limits are recorded in m1-01/localization-preparation.md; preserve those distinctions.

Use canonical FtcProject ProjectContext/ChatRef/OwnerStatus/SubmitPrompt/SubmitResult through narrow browser-safe supplied ports, preserving association vs Location host IDs. Known projects and folder-selection requests are supplied; create means association of a prepared folder, not template creation. Keep one createStore, component-local per-chat drafts and selection. Existing chat/history presentation enters through a narrow supplied slot; don't import context-heavy PromptInput or create a second conversation/history owner. The production adapter is M1-11.

Only explicit actions emit create/open/new-chat/submit/stop. Capture full original target and text across async waits; busy/error retains drafts, idle never auto-submits, admission clears only unchanged submitted text. Stop targets the displayed exact owner and does not itself establish idle. Query failure/loading is distinct from idle. Ignore/cancel obsolete target queries; an owner event invalidates older initial owner snapshots. Unmount retires subscriptions/pending work without stopping domain execution. Fresh component instances have independent state.

All visible/accessibility/recovery text must use existing typed i18n, reusing semantically correct keys. Assign only necessary new complete phrases; validate Chinese wording using the required official localization corpora and retain evidence. Do not translate from model knowledge alone. Use existing language context at host boundary or its narrow typed translation port; fixtures cannot substitute a different localization contract.

Use TDD with intended behavioral RED, actual rendered DOM assertions under the exact mandated Bun browser command, then minimum GREEN. Follow the preflight matrix for busy/idle, independent projects, exact routing, deferred input/status/query races, canonical identity and fresh-scope cleanup. No full app/backend/Electron startup. Actual browser visual inspection, host API wiring, persistence/native/platform/bilingual release acceptance remain separate gates. Avoid session/timeline paths so their performance baseline remains unchanged.

Pinned Bun executable /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun. Isolate task OPENCODE_TEST_HOME/XDG if required. Run exact focused browser test, affected prompt/selection/localization regressions only where touched, package bun typecheck, scoped lint/format/whitespace and actual import checks. Preserve failures/logs and freeze all final source/test/locale hashes. Return tested candidate with commands/cwds/exits/counts, assumptions and unrun gates; independent review precedes task credit.

## Exact original task excerpt

### M1-01 — Show project/chat selection and busy ownership

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/app/src/ftc/facades.ts`, `packages/app/src/ftc/workspace.tsx`, `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts`.

**Interfaces:** Consumes M2 ProjectContext/ChatRef/status contracts through fixture facades. Produces create/open/chat/submit/stop commands and local unsent drafts.

- [ ] **1. Write the focused test:** In `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts`, add `busy project identifies active chat without submitting drafts`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(view.activeChatID).toBe(activeChatID); expect(submittedDrafts).toEqual([]); expect(otherProjectEnabled).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/app`, run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Reuse existing chat presentation and createStore state. Separate project histories and show the active owner, allowing another project to run; no automatic submission when busy status clears. Read package instructions and record required benchmark baseline before changing existing session/timeline code.
- [ ] **4. Verify:** Re-run `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-01.test.ts` from `packages/app`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): show project/chat selection and busy ownership`.
