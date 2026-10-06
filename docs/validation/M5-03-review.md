# M5-03 independent review

Reviewer: `/root/m5_03_review`, read-only, 2026-10-06. Base `75f1038c48f7b5c9afbbba91fef837d2a7794506`; head `8dfc591ed4307a8c51ac5af3d6c32310ecbabeac`. Stable full diff: [M5-03-review.diff](M5-03-review.diff).

## Spec compliance

Available-host subset compliant. The four requested files are present, launcher consumes canonical artifact records, and real native/shadow observations remain distinct (`language-service.ts:8`, `m5-03.test.ts:13`). Full M5-03 remains BLOCKED: Windows ownership/import, production integration, complete runtime-package provenance and isolation are unverified (`java-import.md:90`).

## Strengths and evidence

- Explicit empty diagnostic publications support clean-code claims; deliberate edits produce semantic errors naming `missingM503Symbol`. Native syntax-only diagnostics fail assertions (`m5-03.test.ts:81`, `shadow-base-result.json:6`).
- Definition targets identify expected dependencies/generated source. Road Runner completion replaces the member at characters 43–46, consistent with the corrected cursor regression (`shadow-roadrunner-result.json:508`, `probe_test.py:6`).
- Cleanup owns a POSIX process group, escalates TERM to KILL, and separately stops the dedicated Gradle home. Recorded tests cover exit, abort and timeout with inherited-pipe descendants (`owned.ts:12`, `covering-tests.log:6`).
- SDK provisioning incident and limited JDK executable hashes are disclosed without production support claims (`java-import.md:25`).

## Findings

Critical: none. Important: none within available-host evaluation scope.

Minor (deferred):

1. Temporary workspace removal is skipped when Gradle cleanup fails. `run()` or the exit assertion can throw before `rm(owned)`; put removal in an inner `finally`, preserving cleanup failure. `packages/core/test/ftc-evaluation/m5-03.test.ts:120`.
2. Retained evidence is not a complete request/response transcript. Client records server notifications and selected response results, not outgoing parameters or response envelopes. Recording requests would make per-run cursor/protocol provenance directly auditable. Current source/completion edits support reported results. `packages/core/test/ftc-adapters/fixtures/java-import/probe.py:26`.
3. Successful compiler output contains upstream deprecation notes. Identify these explicitly as upstream noise without modifying preserved FTC sources. `docs/validation/m5-03/gradle-native-compile.log:14`.

Task quality: **Approved for available-host evaluation; full task remains BLOCKED.**

Reviewer checks: supplied diff read without Git operations, edits or suite reruns. Focused outside-diff checks confirmed canonical artifact schema and TERM-resistant process fixture. Independently hashed originals/copies for all **136 retained shadow inventory entries**; all digests matched.
