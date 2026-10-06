# M4-01 independent task review

Reviewer `/root/m4_01_review`; base `705d41839dc1e64e12343c62777ce500e022d3a1`; head `88890fecfa5a40ecde88f08fbeb8308fe23076e0`. Read-only against [complete task diff](M4-01-review.diff).

## Specification and quality verdict

**Needs fixes.** Other reviewed requirements satisfied, but dynamic versions pass the claimed pinning boundary. Real platform compatibility, authenticity of evaluation records, downloaded checksum verification and readiness remain appropriately separate future gates.

## Important finding

`packages/schema/src/ftc-environment.ts:7`: Version rejects bare latest/next/nightly but accepts `latest.release`, `latest.integration`, `1.+`. These do not identify a single dependency version. A focused read-only check called the actual resolver with each selector in the Android Gradle plugin artifact and project constraint; all returned matched. Existing tests only cover bare latest. Reject dynamic selectors while preserving legitimate exact versions/build metadata, and cover artifact and constraint inputs.

## Evidence checked

Pure synchronous whole-combination resolver; structured malformed-input results; ambiguity rejection; separate JDK records; empty production catalog. Raw final evidence31 pass/63 assertions; contract/lint/format outputs support report. RED logs show behavioral failure. Full Schema log has the same two pre-existing event-manifest failures with no event changes. No Critical/Minor findings. No checkout mutations, Git commands or suite reruns; only focused resolver experiment for dynamic selectors.

Fix round 1/5 assigned to same implementer.

## Fix round 1 re-review

Reviewer `/root/m4_01_review`, head `fff70c0e14d50d68cdc77865cd8d123394a8d059`: **original finding NOT ADDRESSED fully**. Original examples now rejected with independent artifact/constraint tests and 54 passing checks, but `latest.milestone` and uppercase equivalent still match. Gradle supports arbitrary `latest.<status>` selectors, so excluding only release/integration is incomplete. [Primary source](https://docs.gradle.org/current/userguide/component_metadata_rules.html). No other Critical/Important/Minor findings. Only focused read-only resolver check executed; raw RED/GREEN/type/lint/format evidence inspected.

Fix round 2/5: reject the whole selector family case-insensitively; cover milestone/custom statuses at both boundaries. Same implementer assigned.

## Fix round 2 re-review and completion

Reviewer `/root/m4_01_review`, head `f7d2a93eabae724f29875a29840b000cee8749fb`: **original Important finding ADDRESSED; task quality Approved**. Shared validator rejects every `latest.` prefix case-insensitively. Milestone/custom selectors test both input boundaries; exact versions/prereleases/build metadata still pass. Raw evidence 62 pass/97 assertions, RED eight failures; contracts/types/lint/format support report. No new Critical/Important/Minor finding. Read-only review; no suite rerun.

Coordinator reconciled required M4-01 behavior, final source identities, focused regression and existing baseline failures. **M4-01 DONE.** Production compatibility catalog remains empty; real platform/build/readiness are later gates and are not claimed complete.
