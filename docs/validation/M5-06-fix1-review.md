# M5-06 fix1 scoped independent re-review

## Spec compliance

**Approved. Original Important publication-boundary finding: ADDRESSED.** The fix satisfies the appended fix1 ruling within the isolated M5 owner scope. No new repair-introduced specification blocker was found.

Reviewed base `7bcada6d9a3d2455ce4e2f26c81586fbcc63fd9f` to head `3c2438f5c784ec7e97af56cd5468a17f8d8c12b7`, using `M5-06-fix1-review.diff` and `m5-06/fix1/candidate-manifest.json`. This re-review covers the original finding and the repair's changes only; it does not restart the whole task or branch review.

## Strengths and resolution evidence

- **The final gap is closed at the owner boundary.** `artifact()` and `verifyArtifact()` join the read/current Scope and finish final asynchronous project authorization before entering a single `Effect.sync` callback. Inside that callback, complete-current confirmation, protected-content confirmation, identity/invalidity checks and positive publication run synchronously. There is no intervening async cleanup or authorization after either confirmation and before publication (`packages/core/src/ftc/java/build.ts:717–747`, `:760–774`, `:804–813`). This addresses both generation changes during cleanup and content changes while current/cleanup is held.
- **The producer obligation is explicit and narrow.** The new Core-only observation handles bind the exact observed retained bytes and original complete basis, remain usable after query cleanup, and require synchronous continuity confirmation. The old three build ports and canonical public artifact schemas/facade remain unchanged (`packages/core/src/ftc/java/build.ts:56–78`, `:98–124`; the two-path repair stat in `M5-06-fix1-review.diff:6–8`).
- **Known change is distinct from unavailable proof.** Complete source/configuration/generation changes and dirty state persist as invalid history; false content continuity establishes content invalidity. Missing/undefined proof fails typed, malformed result shapes fail typed, and callback exceptions remain defects. A stale/dirty confirmation is persisted before unavailable content proof could hide it (`packages/core/src/ftc/java/build.ts:670–705`, `:717–747`).
- **The original reviewer scenarios remain effective.** The generation and content scenarios preserve their original behavioral assertions, now strengthened to exact `artifact_invalid`, `stale` and `content` outcomes. Only the trusted fixture observation shapes and controlled confirmation implementations were adapted; production validity is not inferred from those fixture implementations (`packages/core/test/ftc/java-development/m5-06.test.ts:100–110`, `:866–924`).
- **Boundary coverage targets the repaired behavior.** The matrix covers both methods across read cleanup, current cleanup and final authorization with source/configuration/generation/dirty/content changes. Separate tests cover unavailable proof, malformed or async confirmation results, defects, public JavaBuild/Java owner close, and caller interruption with no issued identity (`packages/core/test/ftc/java-development/m5-06.test.ts:926–1151`). Existing joined-cleanup and interruption tests remain in the tested suite.

## Issues

### Critical

None found in the repair scope.

### Important

Original finding **ADDRESSED**. No new repair-introduced blockers found.

### Minor

None identified in the repair scope.

## Verification and limits

- Read the full fix-only diff once in three consecutive chunks, the appended fix1 ruling, repair report and final manifest. No changed source was separately reread, no broader codebase inspection or Git commands were performed, and no product/ledger/checklist files were changed.
- Inspected the ten manifest-selected final check logs. Focused M5-06: **101 pass / 346 assertions**; M5-05: **62 / 373**; document regressions: **50 / 194**; Schema: **49 / 107**, all zero failures. Core and Schema typechecks, scoped lint, formatting, whitespace and import checks exited zero. Final lint reports zero warnings/errors, and no diagnostic noise was found in the selected logs (`docs/validation/m5-06/fix1/final-core-focused-v2.log`, `final-core-build-regression.log`, `final-core-document-regression.log`, `final-schema-focused.log`, and the other six logs selected by `candidate-manifest.json`).
- Root independently verified all five committed source identities, ten check/log pairs and 57 evidence hashes; original final2 evidence and reviewer probes remain preserved. These are controller-supplied integrity checks, not additional executions by this reviewer. No successful suite was rerun, and no new probe was necessary because the repair and existing focused evidence answer the named doubt.
- **Production authority remains unverified.** A synchronous JavaScript callback alone cannot prove continuity against arbitrary external writers. Approval relies on the explicit trusted producer contract requiring complete input/recipe/authority and protected-content continuity through synchronous publication, or typed unavailability. The fixture's declared serialized inventory and `readFileSync` comparisons establish only isolated owner behavior (`packages/core/src/ftc/java/build.ts:56–70`; `packages/core/test/ftc/java-development/m5-06.test.ts:100–110`; `docs/validation/M5-06-fix1-implementation.md`, “Remaining gates and handoff”). Production adapters, real FTC tools, M4/M9 composition, Windows/native/packaging and physical robot/release acceptance remain NOT RUN/unavailable.

## Assessment

**Specification verdict: Approved for the scoped M5-06 repair.** The original Important freshness finding is addressed with both current-input and protected-content confirmation after cleanup and final asynchronous authorization.

**Code-quality verdict: Approved for the scoped repair.** The change adds a focused confirmation boundary and behavior-driven regressions without expanding public schemas or introducing a production adapter. No remaining repair blocker was found; this approval grants no production/platform/robot readiness claim and authorizes no subsequent task work.
