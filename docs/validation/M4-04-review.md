# M4-04 independent task review

## Spec Compliance

- ❌ Issues found: automatic setup loses the required manual imported-wrapper result after successfully preparing another component (`packages/core/src/ftc/environment.ts:440`). The one-component orchestration, unchanged public request shape and trusted authorization requirements otherwise match the scoped brief.
- Reviewed immutable package: `.superpowers/sdd/progress/review-fcf89eb8d..7ec20aae5.diff`, base `fcf89eb8d`, head `7ec20aae5`. The controller reports matching all four frozen source hashes; this review did not rerun Git commands.
- ⚠️ Cannot verify production download source/redirect isolation, extraction/path confinement, executable provenance, atomic publication under host concurrency, or exact owned-entry deletion from these injected ports. `packages/core/src/ftc/environment/adapters.ts:31`, `:42`, `:48`, `:53` correctly leave these obligations with the production adapter. Controller must retain these gates before host wiring or a platform-support claim.
- ⚠️ Cannot verify real OS authorization UX/revocation, M4-06/M5 saved-input and APK composition, macOS/Windows installer behavior, or platform acceptance from synthetic fixtures (`docs/validation/M4-04-implementation.md:85`). These are explicitly unclaimed and do not block this isolated orchestration review.

## Strengths

- Public prepare input remains exactly project/profile/choice; absent automatic ports reject before existing-run disposal (`packages/core/src/ftc/environment.ts:310`, `packages/schema/src/ftc-environment.ts:226`). No public approval/component override was added.
- Authorization is strictly decoded and bound to project/profile/component and source/version/license/digest before cache/download activity (`packages/core/src/ftc/environment.ts:668`). Missing license or system permission produces explicit manual recovery (`:682`, `:635`).
- Download bytes and actual cached/staged archive bytes are hashed independently; tool existence and exact staged path/version are checked before commit (`packages/core/src/ftc/environment.ts:689`, `:698`, `:704`, `:720`, `:729`). Malformed asset references cannot authorize discard (`:694`); rejected decoded cached entries alone reach the narrow discard boundary (`:728`).
- One eligible component is selected per explicit attempt and completed valid tools are skipped through ordinary inspection (`packages/core/src/ftc/environment.ts:407`). Refreshed profile drift removes the candidate and blocks build dispatch (`:433`). Existing scoped run ownership, cancellation and disposal are reused rather than adding a second orchestrator (`:355`, `:515`, `:545`).
- Tests exercise the real layer with real bytes, directories, hashing and staging cleanup; controlled ports remain honest synthetic external boundaries (`packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts:238`, `:267`, `:321`, `:621`, `:676`, `:709`). Final evidence records 37/185 focused, 192/633 covering, 6/12 Schema, clean types/lint/format; historical RED and warning logs are explicitly superseded rather than hidden (`docs/validation/M4-04-implementation.md:31`, `:53`).

## Issues

### Critical (Must Fix)

- None found in the scoped diff.

### Important (Should Fix)

- **Preserve manual wrapper recovery after automatic preparation.** `packages/core/src/ftc/environment.ts:440`: initial readiness converts a missing imported Gradle wrapper from `missing/install` to `manual/manual_setup` at lines 387–390, but a successful preparation re-inspects at lines 430–432 and selects raw `refreshed.readiness`, bypassing that conversion. When both build Java and the imported wrapper are missing, Java is prepared successfully and the final result/event again advertises the wrapper as `missing/install`, contradicting the explicit automatic-mode contract and exposing installation recovery for team-owned files. The current wrapper regression (`packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts:449`) makes every other tool available, so no automatic preparation occurs and it misses this branch. Apply the same wrapper policy to post-preparation readiness before observation/return; add a focused regression with a missing wrapper plus one missing automatically eligible tool, asserting Java becomes ready, wrapper stays manual, no wrapper download occurs, imported bytes are unchanged and build is not dispatched.

### Minor (Nice to Have)

- None found that warrants a task change.

## Assessment

**Task quality:** Needs fixes.

**Reasoning:** The byte validation, exact trusted authorization and bounded cache-discard orchestration are sound for the declared injected-adapter scope. A normal successful automatic attempt can nevertheless return the wrong imported-wrapper recovery, so the existing passing evidence does not satisfy this explicit behavior until the narrow regression is fixed.

**Checks performed:** Read the exact brief/report and the supplied task diff, in bounded passes. The environment hunk ended before the run/result lifecycle, so the focused `packages/core/src/ftc/environment.ts:340–585` read checked the named risk that refreshed readiness might be transformed before settlement; it is returned unchanged. A focused `packages/schema/src/ftc-environment.ts:1–65` read checked the named authorization risk of artifact fields omitted from binding; Artifact has exactly the four compared fields. No suites or focused reproduction were rerun, no broader codebase crawl was performed, and the sole authored file is this review report.

## Re-review round 1 — supersedes the initial verdict

- **Spec compliance: ✅ Compliant for the scoped M4-04 orchestration task.** I1 is resolved in `.superpowers/sdd/progress/review-1aa520e9e..06036d945.diff` (base `1aa520e9e`, head `06036d945`): initial automatic readiness and successful refreshed readiness now use the same `automaticReadiness` policy (`packages/core/src/ftc/environment.ts:386`, `:435`, `:588`). Guided readiness retains its prior selection, and the helper changes only imported-wrapper installation recovery.
- **Task quality: Approved.** The focused regression at `packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts:796` exercises missing Java plus missing wrapper, confirms successful Java preparation, manual wrapper recovery in results/events/recheck, unchanged wrapper bytes, one Java download/publication and no build. The exact RED evidence demonstrates the original failure; repaired focused evidence records 38 pass / 196 assertions and covering evidence records 193 pass / 644 assertions with clean Core types/lint/format (`docs/validation/M4-04-implementation.md:94`). The controller reports matching all four frozen hashes; unchanged Schema/adapters retain their prior evidence.
- **Critical / Important / Minor:** None outstanding within the original finding and repair-introduced-breakage scope. The initial review's production adapter, OS authorization, platform and M4-06/M5 cannot-verify gates remain unchanged and unclaimed.
- **Checks performed:** Reviewed the supplied fix-only diff and appended implementation evidence. No tests rerun, broader searches, product/Git/index/ledger edits or additional agents; only this review report was appended.
