# M1-01 fix-round 1 scoped independent review

**Specification: Issues found. I1 ADDRESSED; I2 NOT ADDRESSED in full.**

**Quality: Needs fixes.** The two original reproduction cases are repaired, but the full-identity reconciliation fix misses canonical membership arriving for another project while its create command remains pending.

## Scope and evidence

Reviewed the complete two-path fix diff `M1-01-fix1-review.diff`, base `87fffe434`, frozen head `0a0a23ed9069e50b8dd314ae14d54664aaa341ab`, against the exact brief, initial independent review and appended implementation fix1 report. Recovered the tool-truncated test-hunk tail with a bounded read. Reviewed only I1/I2 and blocking consequences of this fix; no unrelated source review, product/source/Git/ledger mutation, delegation, app/server startup or default suite rerun.

Read the current six-source manifest and its matching verification, four-unchanged-source evidence, full final focused log (58 pass, 218 assertions), unchanged original reviewer-probe log (2 pass, 4 assertions; implementer rerun), browser log summary (9 pass, 15 assertions), typecheck, lint (0 warnings/errors), formatting, whitespace and runtime import records. The archived expanded RED summary records 44 pass/11 fail/173 assertions; the owner-observation RED records 56 pass/2 fail/214 assertions. These existing runs were not repeated.

## I1 — ADDRESSED

`packages/app/src/ftc/workspace.tsx:62,135–153,254–255` captures the project-local membership revision when querying, advances it on successful creation, and merges a pre-create list with the newer known members. Selection is reconciled against that merged full-identity list. The existing button flow remains enabled while loading; it has not been disabled to hide the race.

`packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts:840–857` checks enabled creation, canonical new-chat selection, retained draft, inclusion of the older member, later send availability and no automatic submission. The archived unchanged independent I1 probe also passes. This resolves the originally reported behavior without adding a domain execution authority.

## I2 — NOT ADDRESSED in full

The original same-project defect is repaired: `workspace.tsx:75,100,445–460,501–515` compares both chat-to-Session and Session-to-chat identity against canonical membership and accepted owner observations. New tests cover events, snapshots, busy receipts, owner-before-list order, repeated observations, foreign-project known mappings, nonconflicting unlisted owners and canonical recovery (`m1-01.test.ts:864–1029`). These are useful positive and negative controls, and the original independent I2 probe passes.

### Important remaining blocker: later canonical membership does not invalidate another project's cached active owner

**Locations:** `packages/app/src/ftc/workspace.tsx:168–175` and `:254–261`; the same project-only reconciliation pattern appears at `:149–150`.

`remember` updates the global canonical membership cache and drops conflicting entries from `observedOwners`, but leaves corresponding entries in `store.owners` unchanged. Its callers then recheck only `request.projectID`. Therefore:

1. Begin create-chat in project A and leave its result pending.
2. Select project B and receive a nonconflicting, unlisted B owner using Session X.
3. The A create command resolves with a canonical A member using Session X.
4. The B observation is removed from the observation cache, yet B's displayed owner remains ready. Clicking Stop forwards B/X despite the now-known canonical A/X membership.

This is the reverse cross-project arrival order of the already tested known-membership conflict. It remains within I2's required full identity/arrival-order/ingress reconciliation; no production composition is necessary to reproduce it. Revalidate all affected cached active owners when canonical membership is accepted, removing conflicting stop targets and displaying existing localized recovery while preserving the selected project's valid history/draft. Add this exact delayed-create regression. Do not block or remove the nonconflicting unlisted-owner flow.

**Focused evidence:** `docs/validation/m1-01/reviewer-fix1-probe.test.ts:163–188` renders the actual TSX with the existing candidate fixture. Expected stop sink `[]`; actual sink:

```json
[{"projectID":"project_b","chatID":"chat_unlisted","sessionID":"ses_late-created"}]
```

Command, from `/Users/dylanxu/coding_tree/packages/app`:

```sh
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun test --conditions=browser --preload ./happydom.ts ../../docs/validation/m1-01/reviewer-fix1-probe.test.ts
```

Ran once: **exit 1; 0 pass, 1 fail, 1 assertion**. No harness errors. The first stop-sink assertion fails, so subsequent draft/recovery assertions in the probe are not claimed as executed. Captured output: `docs/validation/m1-01/reviewer-fix1-probe.log`. Review evidence/source hashes: `docs/validation/m1-01/reviewer-fix1-freeze.json`.

## Other issues and boundaries

No new Critical issue or additional independent Important issue identified in this fix-only scope. The remaining I2 issue is a UI identity/command-routing defect; M2 remains runtime authority and no backend bypass is claimed.

Production composition, actual host presentation, persistence, provider concurrency, visual/native/platform/physical and full bilingual acceptance remain outside this task-level re-review, with no new completion claim. Root owns repair assignment, commit and task credit.

**Assessment: Needs fixes.** I1 is closed; I2 requires the cross-project canonical-ingress reconciliation above before this task can receive credit.
